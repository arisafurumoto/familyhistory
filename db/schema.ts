import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const timelineEvents = sqliteTable(
  "timeline_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    dateYear: integer("date_year").notNull(),
    dateMonth: integer("date_month"),
    dateDay: integer("date_day"),
    datePrecision: text("date_precision").notNull(),
    category: text("category").notNull(),
    location: text("location").notNull().default(""),
    description: text("description").notNull().default(""),
    coverPhotoKey: text("cover_photo_key"),
    coverPhotoName: text("cover_photo_name"),
    coverPhotoContentType: text("cover_photo_content_type"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_timeline_events_date").on(
      table.dateYear,
      table.dateMonth,
      table.dateDay,
    ),
  ],
);

export const familyMembers = sqliteTable(
  "family_members",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    gender: text("gender", { enum: ["", "female", "male", "other"] }).notNull().default(""),
    familyName: text("family_name").notNull().default(""),
    givenName: text("given_name").notNull().default(""),
    birthYear: integer("birth_year"),
    birthMonth: integer("birth_month"),
    birthDay: integer("birth_day"),
    deathYear: integer("death_year"),
    deathMonth: integer("death_month"),
    deathDay: integer("death_day"),
    memo: text("memo").notNull().default(""),
    photoKey: text("photo_key"),
    photoName: text("photo_name"),
    photoContentType: text("photo_content_type"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_family_members_name").on(table.name),
    index("idx_family_members_split_name").on(table.familyName, table.givenName),
  ],
);

export const familyRelationships = sqliteTable(
  "family_relationships",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    personId: integer("person_id").notNull(),
    relatedPersonId: integer("related_person_id").notNull(),
    relationshipType: text("relationship_type").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_family_relationships_person").on(table.personId),
    index("idx_family_relationships_related").on(table.relatedPersonId),
  ],
);

export const calendarEvents = sqliteTable(
  "calendar_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    eventDate: text("event_date").notNull(),
    eventTime: text("event_time"),
    location: text("location").notNull().default(""),
    category: text("category").notNull(),
    description: text("description").notNull().default(""),
    recurrence: text("recurrence").notNull().default("none"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_calendar_events_date").on(table.eventDate),
    index("idx_calendar_events_recurrence").on(table.recurrence),
  ],
);
