import { env } from "cloudflare:workers";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { getD1, getDb } from "@/db";
import {
  calendarEvents,
  familyMembers,
  familyRelationships,
  timelineEvents,
} from "@/db/schema";
import {
  CALENDAR_CATEGORIES,
  TIMELINE_CATEGORIES,
  formatFamilyMemberStoredName,
  type FamilyData,
} from "./family-shared";

import { commitTimelinePhotoChange, optimizeTimelinePhoto, type ImagesBinding } from "./timeline-photo";

type MediaBucket = {
  delete(key: string): Promise<void>;
  put(
    key: string,
    value: ArrayBuffer,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
};

type ProfileDate = {
  year: number | null;
  month: number | null;
  day: number | null;
};

let schemaReady = false;

export async function ensureFamilySchema() {
  if (schemaReady) return;

  const d1 = getD1();
  await d1.batch([
    d1.prepare(`CREATE TABLE IF NOT EXISTS timeline_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      date_year INTEGER NOT NULL,
      date_month INTEGER,
      date_day INTEGER,
      date_precision TEXT NOT NULL,
      category TEXT NOT NULL,
      location TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      cover_photo_key TEXT,
      cover_photo_name TEXT,
      cover_photo_content_type TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    d1.prepare(`CREATE INDEX IF NOT EXISTS idx_timeline_events_date
      ON timeline_events (date_year, date_month, date_day)`),
    d1.prepare(`CREATE TABLE IF NOT EXISTS family_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      family_name TEXT NOT NULL DEFAULT '',
      given_name TEXT NOT NULL DEFAULT '',
      gender TEXT NOT NULL DEFAULT '',
      birth_year INTEGER,
      birth_month INTEGER,
      birth_day INTEGER,
      death_year INTEGER,
      death_month INTEGER,
      death_day INTEGER,
      memo TEXT NOT NULL DEFAULT '',
      photo_key TEXT,
      photo_name TEXT,
      photo_content_type TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    d1.prepare(`CREATE INDEX IF NOT EXISTS idx_family_members_name
      ON family_members (name)`),
    d1.prepare(`CREATE INDEX IF NOT EXISTS idx_family_members_split_name
      ON family_members (family_name, given_name)`),
    d1.prepare(`CREATE TABLE IF NOT EXISTS family_relationships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL,
      related_person_id INTEGER NOT NULL,
      relationship_type TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    d1.prepare(`CREATE INDEX IF NOT EXISTS idx_family_relationships_person
      ON family_relationships (person_id)`),
    d1.prepare(`CREATE INDEX IF NOT EXISTS idx_family_relationships_related
      ON family_relationships (related_person_id)`),
    d1.prepare(`CREATE TABLE IF NOT EXISTS calendar_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      event_date TEXT NOT NULL,
      event_time TEXT,
      location TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      recurrence TEXT NOT NULL DEFAULT 'none',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    d1.prepare(`CREATE INDEX IF NOT EXISTS idx_calendar_events_date
      ON calendar_events (event_date)`),
    d1.prepare(`CREATE INDEX IF NOT EXISTS idx_calendar_events_recurrence
      ON calendar_events (recurrence)`),
    d1.prepare("PRAGMA optimize"),
  ]);

  await ensureTimelineEventLocationColumn(d1);
  await ensureFamilyMemberNameColumns(d1);
  await ensureFamilyMemberGenderColumn(d1);
  schemaReady = true;
}

export async function getFamilyData(): Promise<FamilyData> {
  await ensureFamilySchema();
  const db = getDb();

  const [timelineRows, memberRows, relationshipRows, calendarRows] =
    await Promise.all([
      db
        .select()
        .from(timelineEvents)
        .orderBy(
          asc(timelineEvents.dateYear),
          asc(timelineEvents.dateMonth),
          asc(timelineEvents.dateDay),
          asc(timelineEvents.id),
        ),
      db
        .select()
        .from(familyMembers)
        .orderBy(
          asc(familyMembers.familyName),
          asc(familyMembers.givenName),
          asc(familyMembers.name),
        ),
      db.select().from(familyRelationships).orderBy(asc(familyRelationships.id)),
      db
        .select()
        .from(calendarEvents)
        .orderBy(asc(calendarEvents.eventDate), asc(calendarEvents.eventTime)),
    ]);

  return {
    timelineEvents: timelineRows,
    familyMembers: memberRows,
    familyRelationships: relationshipRows,
    calendarEvents: calendarRows,
  };
}

export async function saveTimelineEvent(formData: FormData) {
  await ensureFamilySchema();
  const db = getDb();
  const id = optionalId(formData.get("id"));
  const parsedDate = parseTimelineDate(formData);
  // Validate all fields before storing a new object.
  const values: typeof timelineEvents.$inferInsert = {
    title: requiredText(formData, "title", "タイトル"),
    dateYear: parsedDate.year,
    dateMonth: parsedDate.month ?? undefined,
    dateDay: parsedDate.day ?? undefined,
    datePrecision: parsedDate.precision,
    category: timelineCategory(formData.get("category")),
    location: plainText(formData.get("location"), 200),
    description: plainText(formData.get("description"), 5000),
    updatedAt: new Date().toISOString(),
  };
  const previous = id
    ? await db.select().from(timelineEvents).where(eq(timelineEvents.id, id)).get()
    : null;
  if (id && !previous) throw new Error("この年表は削除されています。");
  const photo = await maybeStoreImage(formData.get("coverPhoto"), "timeline");
  if (photo) Object.assign(values, {
    coverPhotoKey: photo.key,
    coverPhotoName: photo.name,
    coverPhotoContentType: photo.contentType,
  });
  await commitTimelinePhotoChange(photo, previous?.coverPhotoKey ?? null, async () => {
    if (id) {
      const conditions = [eq(timelineEvents.id, id)];
      if (photo) conditions.push(previous?.coverPhotoKey
        ? eq(timelineEvents.coverPhotoKey, previous.coverPhotoKey)
        : isNull(timelineEvents.coverPhotoKey));
      const changed = await db.update(timelineEvents).set(values)
        .where(and(...conditions)).returning({ id: timelineEvents.id });
      if (!changed.length) throw new Error("写真が変更または年表が削除されました。再読み込みしてからお試しください。");
    } else {
      await db.insert(timelineEvents).values(values);
    }
  }, removeUnreferencedTimelinePhoto);
}

async function removeUnreferencedTimelinePhoto(key: string) {
  if (!key.startsWith("timeline/")) return;
  const db = getDb();
  const [events, people] = await Promise.all([
    db.select({ id: timelineEvents.id }).from(timelineEvents).where(eq(timelineEvents.coverPhotoKey, key)).limit(1),
    db.select({ id: familyMembers.id }).from(familyMembers).where(eq(familyMembers.photoKey, key)).limit(1),
  ]);
  if (!events.length && !people.length) {
    const runtimeEnv = env as unknown as { MEDIA?: MediaBucket };
    await runtimeEnv.MEDIA?.delete(key);
  }
}

export async function saveFamilyMember(formData: FormData) {
  await ensureFamilySchema();
  const db = getDb();
  const id = optionalId(formData.get("id"));
  const birth = parseProfileDate(formData, "birth");
  const death = parseProfileDate(formData, "death");
  const now = new Date().toISOString();
  const familyName = requiredText(formData, "familyName", "姓");
  const givenName = requiredText(formData, "givenName", "名");
  const name = formatFamilyMemberStoredName(familyName, givenName);

  if (!id) validateAutomaticFamilyEvents(formData, birth, death);

  const gender = formData.has("gender") ? parseMemberGender(formData.get("gender")) : undefined;
  const photo = await maybeStoreImage(formData.get("photo"), "people");

  const values: typeof familyMembers.$inferInsert = {
    name,
    ...(gender !== undefined ? { gender } : {}),
    familyName,
    givenName,
    birthYear: birth.year ?? undefined,
    birthMonth: birth.month ?? undefined,
    birthDay: birth.day ?? undefined,
    deathYear: death.year ?? undefined,
    deathMonth: death.month ?? undefined,
    deathDay: death.day ?? undefined,
    memo: plainText(formData.get("memo"), 5000),
    updatedAt: now,
    ...(photo
      ? {
          photoKey: photo.key,
          photoName: photo.name,
          photoContentType: photo.contentType,
        }
      : {}),
  };

  if (id) {
    await db.update(familyMembers).set(values).where(eq(familyMembers.id, id));
    return;
  }

  await db.insert(familyMembers).values(values);
  await createAutomaticFamilyEvents(formData, name, birth, death, now);
}

function validateAutomaticFamilyEvents(
  formData: FormData,
  birth: ProfileDate,
  death: ProfileDate,
) {
  if (isChecked(formData, "addBirthTimeline")) {
    ensureTimelineProfileDate(birth, "誕生", "生年月日");
  }
  if (isChecked(formData, "addBirthCalendar")) {
    ensureFullProfileDate(birth, "誕生日", "生年月日");
  }
  if (isChecked(formData, "addDeathTimeline")) {
    ensureTimelineProfileDate(death, "命日", "没年月日");
  }
  if (isChecked(formData, "addDeathCalendar")) {
    ensureFullProfileDate(death, "命日", "没年月日");
  }
}

async function createAutomaticFamilyEvents(
  formData: FormData,
  name: string,
  birth: ProfileDate,
  death: ProfileDate,
  now: string,
) {
  const db = getDb();
  const automaticTimelineEvents: (typeof timelineEvents.$inferInsert)[] = [];
  const automaticCalendarEvents: (typeof calendarEvents.$inferInsert)[] = [];

  if (isChecked(formData, "addBirthTimeline")) {
    automaticTimelineEvents.push(
      automaticTimelineEvent(`${name}誕生`, "出生", birth, now),
    );
  }
  if (isChecked(formData, "addDeathTimeline")) {
    automaticTimelineEvents.push(
      automaticTimelineEvent(`${name}逝去`, "逝去", death, now),
    );
  }
  if (isChecked(formData, "addBirthCalendar")) {
    automaticCalendarEvents.push(
      automaticCalendarEvent(`${name}の誕生日`, "誕生日", birth, now),
    );
  }
  if (isChecked(formData, "addDeathCalendar")) {
    automaticCalendarEvents.push(
      automaticCalendarEvent(`${name}の命日`, "法事", death, now),
    );
  }

  if (automaticTimelineEvents.length > 0) {
    await db.insert(timelineEvents).values(automaticTimelineEvents);
  }
  if (automaticCalendarEvents.length > 0) {
    await db.insert(calendarEvents).values(automaticCalendarEvents);
  }
}

function automaticTimelineEvent(
  title: string,
  category: string,
  date: ProfileDate,
  now: string,
): typeof timelineEvents.$inferInsert {
  const year = ensureTimelineProfileDate(date, title, "日付");

  return {
    title,
    dateYear: year,
    dateMonth: date.month ?? undefined,
    dateDay: date.day ?? undefined,
    datePrecision: date.day ? "day" : date.month ? "month" : "year",
    category,
    location: "",
    description: "",
    updatedAt: now,
  };
}

function automaticCalendarEvent(
  title: string,
  category: string,
  date: ProfileDate,
  now: string,
): typeof calendarEvents.$inferInsert {
  const eventDate = fullProfileDate(date, title, "日付");

  return {
    title,
    eventDate,
    eventTime: null,
    location: "",
    category,
    description: "",
    recurrence: "annual",
    updatedAt: now,
  };
}

function ensureTimelineProfileDate(
  date: ProfileDate,
  eventLabel: string,
  fieldLabel: string,
) {
  if (!date.year) {
    throw new Error(
      `${eventLabel}を年表に追加するには、${fieldLabel}の年を入力してください。`,
    );
  }

  return date.year;
}

function ensureFullProfileDate(
  date: ProfileDate,
  eventLabel: string,
  fieldLabel: string,
) {
  if (!date.year || !date.month || !date.day) {
    throw new Error(
      `${eventLabel}をカレンダーに追加するには、${fieldLabel}の年・月・日をすべて入力してください。`,
    );
  }

  return {
    day: date.day,
    month: date.month,
    year: date.year,
  };
}

function fullProfileDate(date: ProfileDate, eventLabel: string, fieldLabel: string) {
  const { day, month, year } = ensureFullProfileDate(date, eventLabel, fieldLabel);
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

async function ensureTimelineEventLocationColumn(d1: D1Database) {
  const tableInfo = await d1.prepare("PRAGMA table_info(timeline_events)").all();
  const columns = new Set(
    (tableInfo.results as Array<{ name: string }>).map((column) => column.name),
  );

  if (!columns.has("location")) {
    await d1
      .prepare(
        "ALTER TABLE timeline_events ADD COLUMN location TEXT NOT NULL DEFAULT ''",
      )
      .run();
  }
}

async function ensureFamilyMemberGenderColumn(d1: D1Database) {
  const hasColumn = async () => {
    const info = await d1.prepare("PRAGMA table_info(family_members)").all();
    return (info.results as Array<{ name: string }>).some(column => column.name === "gender");
  };
  if (await hasColumn()) return;
  try {
    await d1.prepare("ALTER TABLE family_members ADD COLUMN gender TEXT NOT NULL DEFAULT ''").run();
  } catch (error) {
    // Another worker may have added the column concurrently.
    if (!(await hasColumn())) throw error;
  }
}

async function ensureFamilyMemberNameColumns(d1: D1Database) {
  const tableInfo = await d1.prepare("PRAGMA table_info(family_members)").all();
  const columns = new Set(
    (tableInfo.results as Array<{ name: string }>).map((column) => column.name),
  );
  const statements: D1PreparedStatement[] = [];

  if (!columns.has("family_name")) {
    statements.push(
      d1.prepare(
        "ALTER TABLE family_members ADD COLUMN family_name TEXT NOT NULL DEFAULT ''",
      ),
    );
  }
  if (!columns.has("given_name")) {
    statements.push(
      d1.prepare(
        "ALTER TABLE family_members ADD COLUMN given_name TEXT NOT NULL DEFAULT ''",
      ),
    );
  }
  if (statements.length > 0) await d1.batch(statements);

  await d1
    .prepare(
      `CREATE INDEX IF NOT EXISTS idx_family_members_split_name
      ON family_members (family_name, given_name)`,
    )
    .run();
}

export async function saveFamilyRelationship(formData: FormData) {
  await ensureFamilySchema();
  const db = getDb();
  const id = optionalId(formData.get("id"));
  const relationshipType = stringValue(formData.get("relationshipType"));
  const rawPersonId = requiredId(formData.get("personId"), "人物");
  const rawRelatedPersonId = requiredId(formData.get("relatedPersonId"), "相手");

  if (rawPersonId === rawRelatedPersonId) {
    throw new Error("同じ人物どうしの関係は登録できません。");
  }

  const normalized =
    relationshipType === "spouse"
      ? normalizeSpouse(rawPersonId, rawRelatedPersonId)
      : { personId: rawPersonId, relatedPersonId: rawRelatedPersonId };

  if (relationshipType !== "parent" && relationshipType !== "spouse") {
    throw new Error("関係の種類が正しくありません。");
  }

  const matchingRelationships = await db
    .select({ id: familyRelationships.id })
    .from(familyRelationships)
    .where(
      and(
        eq(familyRelationships.personId, normalized.personId),
        eq(familyRelationships.relatedPersonId, normalized.relatedPersonId),
        eq(familyRelationships.relationshipType, relationshipType),
      ),
    )
    .limit(2);

  if (matchingRelationships.some((relationship) => relationship.id !== id)) return;

  const values: typeof familyRelationships.$inferInsert = {
    personId: normalized.personId,
    relatedPersonId: normalized.relatedPersonId,
    relationshipType,
  };

  if (id) {
    await db.update(familyRelationships).set(values).where(eq(familyRelationships.id, id));
    return;
  }

  await db.insert(familyRelationships).values(values);
}

export async function saveCalendarEvent(formData: FormData) {
  await ensureFamilySchema();
  const db = getDb();
  const id = optionalId(formData.get("id"));
  const now = new Date().toISOString();

  const values: typeof calendarEvents.$inferInsert = {
    title: requiredText(formData, "title", "タイトル"),
    eventDate: requiredDate(formData.get("eventDate"), "日付"),
    eventTime: null,
    location: plainText(formData.get("location"), 200),
    category: calendarCategory(formData.get("category")),
    description: plainText(formData.get("description"), 5000),
    recurrence: recurrenceValue(formData.get("recurrence")),
    updatedAt: now,
  };

  if (id) {
    await db.update(calendarEvents).set(values).where(eq(calendarEvents.id, id));
    return;
  }

  await db.insert(calendarEvents).values(values);
}

export async function deleteTimelineEvent(formData: FormData) {
  await ensureFamilySchema();
  const id = requiredId(formData.get("id"), "年表");
  await getDb().delete(timelineEvents).where(eq(timelineEvents.id, id));
}

export async function deleteFamilyMember(formData: FormData) {
  await ensureFamilySchema();
  const db = getDb();
  const id = requiredId(formData.get("id"), "人物");

  await db
    .delete(familyRelationships)
    .where(
      or(
        eq(familyRelationships.personId, id),
        eq(familyRelationships.relatedPersonId, id),
      ),
    );
  await db.delete(familyMembers).where(eq(familyMembers.id, id));
}

export async function deleteFamilyRelationship(formData: FormData) {
  await ensureFamilySchema();
  const id = requiredId(formData.get("id"), "関係");
  await getDb().delete(familyRelationships).where(eq(familyRelationships.id, id));
}

export async function deleteCalendarEvent(formData: FormData) {
  await ensureFamilySchema();
  const id = requiredId(formData.get("id"), "予定");
  await getDb().delete(calendarEvents).where(eq(calendarEvents.id, id));
}

function parseTimelineDate(formData: FormData) {
  const year = requiredNumber(formData.get("dateYear"), "年", 1, 9999);
  const month = optionalNumber(formData.get("dateMonth"), 1, 12);
  const day = optionalNumber(formData.get("dateDay"), 1, 31);

  if (day && !month) {
    throw new Error("日を入力する場合は月も入力してください。");
  }
  if (month && day) ensureValidDate(year, month, day);

  return {
    year,
    month,
    day,
    precision: day ? "day" : month ? "month" : "year",
  };
}

function parseProfileDate(formData: FormData, prefix: "birth" | "death") {
  const year = optionalNumber(formData.get(`${prefix}Year`), 1, 9999);
  const month = optionalNumber(formData.get(`${prefix}Month`), 1, 12);
  const day = optionalNumber(formData.get(`${prefix}Day`), 1, 31);

  if (day && !month) {
    throw new Error("日を入力する場合は月も入力してください。");
  }
  if (year && month && day) ensureValidDate(year, month, day);

  return { year, month, day };
}

async function maybeStoreImage(value: FormDataEntryValue | null, folder: string) {
  if (!(value instanceof File) || value.size === 0) return null;
  if (!value.type.startsWith("image/")) {
    throw new Error("画像ファイルを選んでください。");
  }
  if (value.size > 5 * 1024 * 1024) {
    throw new Error("画像は5MB以下にしてください。");
  }

  const runtimeEnv = env as unknown as { MEDIA?: MediaBucket; IMAGES?: ImagesBinding };
  if (!runtimeEnv.MEDIA) {
    throw new Error("画像保存用のストレージがまだ利用できません。");
  }

  if (folder === "timeline") {
    const photo = await optimizeTimelinePhoto(value, runtimeEnv.IMAGES);
    try {
      await runtimeEnv.MEDIA.put(photo.key, photo.bytes, {
        httpMetadata: { contentType: photo.contentType },
      });
    } catch (error) {
      // A transport error may occur after R2 has accepted the object.
      try { await runtimeEnv.MEDIA.delete(photo.key); }
      catch { console.error("Timeline photo upload cleanup failed.", photo.key); }
      throw error;
    }
    return { key: photo.key, name: photo.name, contentType: photo.contentType };
  }

  const extension = extensionFromFile(value);
  const key = `${folder}/${crypto.randomUUID()}${extension}`;
  await runtimeEnv.MEDIA.put(key, await value.arrayBuffer(), {
    httpMetadata: { contentType: value.type || "application/octet-stream" },
  });

  return {
    key,
    name: value.name,
    contentType: value.type || "application/octet-stream",
  };
}

function extensionFromFile(file: File) {
  const byName = file.name.match(/\.[a-z0-9]{2,8}$/i)?.[0]?.toLowerCase();
  if (byName) return byName;
  if (file.type === "image/png") return ".png";
  if (file.type === "image/webp") return ".webp";
  return ".jpg";
}

function timelineCategory(value: FormDataEntryValue | null) {
  const text = stringValue(value);
  if (TIMELINE_CATEGORIES.some((category) => category.name === text)) return text;
  return "その他";
}

function calendarCategory(value: FormDataEntryValue | null) {
  const text = stringValue(value);
  if (CALENDAR_CATEGORIES.some((category) => category === text)) return text;
  return "その他";
}

function recurrenceValue(value: FormDataEntryValue | null) {
  return stringValue(value) === "annual" ? "annual" : "none";
}

function requiredText(formData: FormData, key: string, label: string) {
  const text = plainText(formData.get(key), 160);
  if (!text) throw new Error(`${label}を入力してください。`);
  return text;
}

function plainText(value: FormDataEntryValue | null, maxLength: number) {
  return stringValue(value).replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function stringValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

function isChecked(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function pad2(value: number) {
  return `${value}`.padStart(2, "0");
}

function optionalId(value: FormDataEntryValue | null) {
  const id = optionalNumber(value, 1, 1_000_000_000);
  return id ?? null;
}

function requiredId(value: FormDataEntryValue | null, label: string) {
  const id = optionalId(value);
  if (!id) throw new Error(`${label}を選んでください。`);
  return id;
}

function requiredNumber(
  value: FormDataEntryValue | null,
  label: string,
  min: number,
  max: number,
) {
  const number = optionalNumber(value, min, max);
  if (number === null) throw new Error(`${label}を入力してください。`);
  return number;
}

function optionalNumber(value: FormDataEntryValue | null, min: number, max: number) {
  const text = stringValue(value).trim();
  if (!text) return null;
  if (!/^\d+$/.test(text)) throw new Error("数字で入力してください。");
  const number = Number(text);
  if (number < min || number > max) throw new Error("日付の値が正しくありません。");
  return number;
}

function requiredDate(value: FormDataEntryValue | null, label: string) {
  const text = stringValue(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error(`${label}を入力してください。`);
  }
  const [year, month, day] = text.split("-").map(Number);
  ensureValidDate(year, month, day);
  return text;
}

function ensureValidDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("日付の値が正しくありません。");
  }
}

function normalizeSpouse(personId: number, relatedPersonId: number) {
  return personId < relatedPersonId
    ? { personId, relatedPersonId }
    : { personId: relatedPersonId, relatedPersonId: personId };
}

function parseMemberGender(value: FormDataEntryValue | null): "" | "female" | "male" | "other" {
  if (value === "" || value === "female" || value === "male" || value === "other") return value;
  throw new Error("性別は選択肢から選んでください。");
}
