"use client";

import { useMemo, useState } from "react";
import type {
  CalendarEvent,
  FamilyData,
  FamilyMember,
  FamilyRelationship,
  TimelineEvent,
} from "./family-shared";
import { CALENDAR_CATEGORIES, TIMELINE_CATEGORIES } from "./family-shared";

type ActiveView = "timeline" | "tree" | "calendar";

type FamilyAppProps = {
  activeView: ActiveView;
  initialData: FamilyData;
};

const navItems = [
  { href: "/", label: "年表", view: "timeline" },
  { href: "/tree", label: "家系図", view: "tree" },
  { href: "/calendar", label: "カレンダー", view: "calendar" },
] as const;

const etoAnimals = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];

export function FamilyApp({ activeView, initialData }: FamilyAppProps) {
  const [data, setData] = useState(initialData);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function submitFamilyForm(form: HTMLFormElement, doneMessage: string) {
    setIsSaving(true);
    setMessage("処理中です。");

    try {
      const response = await fetch("/api/family", {
        method: "POST",
        body: new FormData(form),
      });
      const payload = (await response.json()) as {
        data?: FamilyData;
        error?: string;
      };

      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "保存できませんでした。");
      }

      setData(payload.data);
      setMessage(doneMessage);
      form.reset();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存できませんでした。");
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="古本家の歴史 年表へ">
          <span className="brand-mark">古</span>
          <span>
            <strong>古本家の歴史</strong>
            <small>家族の記録</small>
          </span>
        </a>
        <nav className="main-nav" aria-label="主要ナビゲーション">
          {navItems.map((item) => (
            <a
              aria-current={item.view === activeView ? "page" : undefined}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <form action="/api/auth/logout" method="post">
          <button className="ghost-button" type="submit">
            ログアウト
          </button>
        </form>
      </header>

      <main className="content">
        {message ? (
          <p className="status-message" role="status">
            {message}
          </p>
        ) : null}

        {activeView === "timeline" ? (
          <TimelineSection data={data} isSaving={isSaving} onSubmit={submitFamilyForm} />
        ) : null}
        {activeView === "tree" ? (
          <TreeSection data={data} isSaving={isSaving} onSubmit={submitFamilyForm} />
        ) : null}
        {activeView === "calendar" ? (
          <CalendarSection data={data} isSaving={isSaving} onSubmit={submitFamilyForm} />
        ) : null}
      </main>
    </div>
  );
}

function TimelineSection({
  data,
  isSaving,
  onSubmit,
}: {
  data: FamilyData;
  isSaving: boolean;
  onSubmit: (form: HTMLFormElement, doneMessage: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState<TimelineEvent | null>(null);

  return (
    <section className="section-grid timeline-layout">
      <div className="panel form-panel">
        <div className="section-heading">
          <span className="section-kicker">年表</span>
          <h1>{editing ? "年表を編集" : "年表に追加"}</h1>
        </div>
        <form
          key={editing?.id ?? "new-timeline"}
          className="entry-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const saved = await onSubmit(event.currentTarget, "年表を保存しました。");
            if (saved) setEditing(null);
          }}
        >
          <input name="action" type="hidden" value="saveTimeline" />
          {editing ? <input name="id" type="hidden" value={editing.id} /> : null}
          <label>
            <span>タイトル</span>
            <input
              defaultValue={editing?.title ?? ""}
              name="title"
              required
              type="text"
            />
          </label>
          <fieldset className="date-fields">
            <legend>日付</legend>
            <input
              defaultValue={editing?.dateYear ?? ""}
              inputMode="numeric"
              name="dateYear"
              placeholder="年"
              required
              type="number"
            />
            <input
              defaultValue={editing?.dateMonth ?? ""}
              inputMode="numeric"
              max="12"
              min="1"
              name="dateMonth"
              placeholder="月"
              type="number"
            />
            <input
              defaultValue={editing?.dateDay ?? ""}
              inputMode="numeric"
              max="31"
              min="1"
              name="dateDay"
              placeholder="日"
              type="number"
            />
          </fieldset>
          <label>
            <span>カテゴリー</span>
            <select defaultValue={editing?.category ?? "出生"} name="category">
              {TIMELINE_CATEGORIES.map((category) => (
                <option key={category.name} value={category.name}>
                  {category.icon} {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>説明</span>
            <textarea
              defaultValue={editing?.description ?? ""}
              name="description"
              rows={5}
            />
          </label>
          <label>
            <span>カバー写真</span>
            <input accept="image/*" name="coverPhoto" type="file" />
          </label>
          <div className="form-actions">
            {editing ? (
              <button className="ghost-button" onClick={() => setEditing(null)} type="button">
                取消
              </button>
            ) : null}
            <button className="primary-button" disabled={isSaving} type="submit">
              {editing ? "更新" : "登録"}
            </button>
          </div>
        </form>
      </div>

      <div className="timeline-list" aria-label="年表一覧">
        {data.timelineEvents.length === 0 ? (
          <EmptyState title="年表はまだ登録されていません" />
        ) : (
          data.timelineEvents.map((timelineEvent) => {
            const category = TIMELINE_CATEGORIES.find(
              (item) => item.name === timelineEvent.category,
            );
            return (
              <article className="timeline-item" key={timelineEvent.id}>
                <div className="timeline-date">{formatPartialDate(timelineEvent)}</div>
                <div className="timeline-card">
                  {timelineEvent.coverPhotoKey ? (
                    <img
                      alt={timelineEvent.coverPhotoName ?? timelineEvent.title}
                      className="timeline-photo"
                      src={`/api/photos/${timelineEvent.coverPhotoKey}`}
                    />
                  ) : null}
                  <div className="timeline-body">
                    <span className="category-badge">
                      <span>{category?.icon ?? "記"}</span>
                      {timelineEvent.category}
                    </span>
                    <h2>{timelineEvent.title}</h2>
                    {timelineEvent.description ? <p>{timelineEvent.description}</p> : null}
                    <div className="item-actions">
                      <button
                        className="text-button"
                        onClick={() => setEditing(timelineEvent)}
                        type="button"
                      >
                        編集
                      </button>
                      <form
                        className="inline-form"
                        onSubmit={async (event) => {
                          event.preventDefault();
                          if (!window.confirm("この年表を削除しますか？")) return;
                          const deleted = await onSubmit(
                            event.currentTarget,
                            "年表を削除しました。",
                          );
                          if (deleted && editing?.id === timelineEvent.id) setEditing(null);
                        }}
                      >
                        <input name="action" type="hidden" value="deleteTimeline" />
                        <input name="id" type="hidden" value={timelineEvent.id} />
                        <button className="danger-button" disabled={isSaving} type="submit">
                          削除
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

function TreeSection({
  data,
  isSaving,
  onSubmit,
}: {
  data: FamilyData;
  isSaving: boolean;
  onSubmit: (form: HTMLFormElement, doneMessage: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState<FamilyMember | null>(null);
  const [editingRelationship, setEditingRelationship] =
    useState<FamilyRelationship | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(
    data.familyMembers[0]?.id ?? null,
  );

  const selectedPerson =
    data.familyMembers.find((person) => person.id === selectedId) ??
    data.familyMembers[0] ??
    null;
  const familyMap = useMemo(
    () => new Map(data.familyMembers.map((person) => [person.id, person])),
    [data.familyMembers],
  );
  const relations = selectedPerson
    ? getPersonRelations(selectedPerson, data.familyRelationships, familyMap)
    : null;

  return (
    <section className="tree-page">
      <div className="section-heading wide-heading">
        <span className="section-kicker">家系図</span>
        <h1>人物を中心に見る</h1>
      </div>

      <div className="section-grid tree-layout">
        <div className="panel form-panel">
          <h2>{editing ? "人物を編集" : "人物を追加"}</h2>
          <form
            key={editing?.id ?? "new-person"}
            className="entry-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const saved = await onSubmit(event.currentTarget, "人物を保存しました。");
              if (saved) setEditing(null);
            }}
          >
            <input name="action" type="hidden" value="saveMember" />
            {editing ? <input name="id" type="hidden" value={editing.id} /> : null}
            <div className="name-fields">
              <label>
                <span>姓</span>
                <input
                  defaultValue={nameParts(editing).familyName}
                  name="familyName"
                  required
                  type="text"
                />
              </label>
              <label>
                <span>名</span>
                <input
                  defaultValue={nameParts(editing).givenName}
                  name="givenName"
                  required
                  type="text"
                />
              </label>
            </div>
            <DateTriple label="生年月日" prefix="birth" source={editing} />
            <DateTriple label="没年月日" prefix="death" source={editing} />
            <label>
              <span>写真</span>
              <input accept="image/*" name="photo" type="file" />
            </label>
            <label>
              <span>メモ</span>
              <textarea defaultValue={editing?.memo ?? ""} name="memo" rows={4} />
            </label>
            <div className="form-actions">
              {editing ? (
                <button className="ghost-button" onClick={() => setEditing(null)} type="button">
                  取消
                </button>
              ) : null}
              <button className="primary-button" disabled={isSaving} type="submit">
                {editing ? "更新" : "登録"}
              </button>
            </div>
          </form>

          <h2>{editingRelationship ? "関係を編集" : "関係を追加"}</h2>
          <form
            key={editingRelationship?.id ?? "new-relationship"}
            className="entry-form compact-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const saved = await onSubmit(event.currentTarget, "関係を保存しました。");
              if (saved) setEditingRelationship(null);
            }}
          >
            <input name="action" type="hidden" value="saveRelationship" />
            {editingRelationship ? (
              <input name="id" type="hidden" value={editingRelationship.id} />
            ) : null}
            <label>
              <span>関係</span>
              <select
                defaultValue={editingRelationship?.relationshipType ?? "parent"}
                name="relationshipType"
              >
                <option value="parent">親子</option>
                <option value="spouse">配偶者</option>
              </select>
            </label>
            <PersonSelect
              defaultValue={editingRelationship?.personId ?? ""}
              label="人物"
              members={data.familyMembers}
              name="personId"
            />
            <PersonSelect
              defaultValue={editingRelationship?.relatedPersonId ?? ""}
              label="相手"
              members={data.familyMembers}
              name="relatedPersonId"
            />
            <div className="form-actions">
              {editingRelationship ? (
                <button
                  className="ghost-button"
                  onClick={() => setEditingRelationship(null)}
                  type="button"
                >
                  取消
                </button>
              ) : null}
              <button className="primary-button" disabled={isSaving} type="submit">
                {editingRelationship ? "更新" : "登録"}
              </button>
            </div>
          </form>
          <RelationshipList
            editingRelationshipId={editingRelationship?.id ?? null}
            familyMap={familyMap}
            isSaving={isSaving}
            onDeleted={(relationshipId) => {
              if (editingRelationship?.id === relationshipId) setEditingRelationship(null);
            }}
            onEdit={setEditingRelationship}
            onSubmit={onSubmit}
            relationships={data.familyRelationships}
          />
        </div>

        <div className="tree-stage">
          {data.familyMembers.length === 0 ? (
            <EmptyState title="家系図はまだ登録されていません" />
          ) : (
            <>
              <label className="person-picker">
                <span>表示する人物</span>
                <select
                  onChange={(event) => setSelectedId(Number(event.target.value))}
                  value={selectedPerson?.id ?? ""}
                >
                  {data.familyMembers.map((person) => (
                    <option key={person.id} value={person.id}>
                      {displayName(person)}
                    </option>
                  ))}
                </select>
              </label>

              {selectedPerson && relations ? (
                <div className="person-board">
                  <RelationColumn title="親" people={relations.parents} />
                  <div className="center-person">
                    <PersonCard person={selectedPerson} primary />
                    <div className="item-actions center-actions">
                      <button
                        className="text-button"
                        onClick={() => setEditing(selectedPerson)}
                        type="button"
                      >
                        編集
                      </button>
                      <form
                        className="inline-form"
                        onSubmit={async (event) => {
                          event.preventDefault();
                          if (!window.confirm("この人物を削除しますか？ 関係も削除されます。")) {
                            return;
                          }
                          const remainingMembers = data.familyMembers.filter(
                            (person) => person.id !== selectedPerson.id,
                          );
                          const deleted = await onSubmit(
                            event.currentTarget,
                            "人物を削除しました。",
                          );
                          if (deleted) {
                            if (editing?.id === selectedPerson.id) setEditing(null);
                            setEditingRelationship(null);
                            setSelectedId(remainingMembers[0]?.id ?? null);
                          }
                        }}
                      >
                        <input name="action" type="hidden" value="deleteMember" />
                        <input name="id" type="hidden" value={selectedPerson.id} />
                        <button className="danger-button" disabled={isSaving} type="submit">
                          削除
                        </button>
                      </form>
                    </div>
                  </div>
                  <RelationColumn title="配偶者" people={relations.spouses} />
                  <RelationColumn title="兄弟姉妹" people={relations.siblings} />
                  <RelationColumn title="子ども" people={relations.children} />
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function CalendarSection({
  data,
  isSaving,
  onSubmit,
}: {
  data: FamilyData;
  isSaving: boolean;
  onSubmit: (form: HTMLFormElement, doneMessage: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [monthCursor, setMonthCursor] = useState(() => firstDayOfMonth(new Date()));
  const monthEvents = useMemo(
    () => eventsForMonth(data.calendarEvents, monthCursor),
    [data.calendarEvents, monthCursor],
  );

  return (
    <section className="section-grid calendar-layout">
      <div className="panel form-panel">
        <div className="section-heading">
          <span className="section-kicker">カレンダー</span>
          <h1>{editing ? "予定を編集" : "予定を追加"}</h1>
        </div>
        <form
          key={editing?.id ?? "new-calendar"}
          className="entry-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const saved = await onSubmit(event.currentTarget, "予定を保存しました。");
            if (saved) setEditing(null);
          }}
        >
          <input name="action" type="hidden" value="saveCalendar" />
          {editing ? <input name="id" type="hidden" value={editing.id} /> : null}
          <label>
            <span>タイトル</span>
            <input defaultValue={editing?.title ?? ""} name="title" required type="text" />
          </label>
          <label>
            <span>日付</span>
            <input defaultValue={editing?.eventDate ?? ""} name="eventDate" required type="date" />
          </label>
          <label>
            <span>時刻（日本時間）</span>
            <input defaultValue={editing?.eventTime ?? ""} name="eventTime" type="time" />
          </label>
          <label>
            <span>場所</span>
            <input defaultValue={editing?.location ?? ""} name="location" type="text" />
          </label>
          <label>
            <span>カテゴリー</span>
            <select defaultValue={editing?.category ?? "家族行事"} name="category">
              {CALENDAR_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>繰り返し</span>
            <select defaultValue={editing?.recurrence ?? "none"} name="recurrence">
              <option value="none">一回のみ</option>
              <option value="annual">毎年</option>
            </select>
          </label>
          <label>
            <span>説明</span>
            <textarea defaultValue={editing?.description ?? ""} name="description" rows={4} />
          </label>
          <div className="form-actions">
            {editing ? (
              <button className="ghost-button" onClick={() => setEditing(null)} type="button">
                取消
              </button>
            ) : null}
            <button className="primary-button" disabled={isSaving} type="submit">
              {editing ? "更新" : "登録"}
            </button>
          </div>
        </form>
      </div>

      <div className="calendar-panel">
        <div className="calendar-header">
          <button
            aria-label="前の月"
            className="icon-button"
            onClick={() => setMonthCursor(addMonths(monthCursor, -1))}
            type="button"
          >
            ‹
          </button>
          <h2>{formatMonth(monthCursor)}</h2>
          <button
            aria-label="次の月"
            className="icon-button"
            onClick={() => setMonthCursor(addMonths(monthCursor, 1))}
            type="button"
          >
            ›
          </button>
        </div>
        {monthEvents.length === 0 ? (
          <EmptyState title="この月の予定はありません" />
        ) : (
          <div className="calendar-list">
            {monthEvents.map(({ event, occurrenceDate }) => (
              <article className="event-card" key={`${event.id}-${occurrenceDate}`}>
                <time>{formatFullDate(occurrenceDate)}</time>
                <h3>{event.title}</h3>
                <p className="meta-line">
                  {event.eventTime ? formatVisitorLocalTime(occurrenceDate, event.eventTime) : "終日"}
                  {event.location ? ` / ${event.location}` : ""}
                  {event.recurrence === "annual" ? " / 毎年" : ""}
                </p>
                <span className="category-badge small">{event.category}</span>
                {event.description ? <p>{event.description}</p> : null}
                <div className="item-actions">
                  <button className="text-button" onClick={() => setEditing(event)} type="button">
                    編集
                  </button>
                  <form
                    className="inline-form"
                    onSubmit={async (submitEvent) => {
                      submitEvent.preventDefault();
                      if (!window.confirm("この予定を削除しますか？")) return;
                      const deleted = await onSubmit(
                        submitEvent.currentTarget,
                        "予定を削除しました。",
                      );
                      if (deleted && editing?.id === event.id) setEditing(null);
                    }}
                  >
                    <input name="action" type="hidden" value="deleteCalendar" />
                    <input name="id" type="hidden" value={event.id} />
                    <button className="danger-button" disabled={isSaving} type="submit">
                      削除
                    </button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function DateTriple({
  label,
  prefix,
  source,
}: {
  label: string;
  prefix: "birth" | "death";
  source: FamilyMember | null;
}) {
  return (
    <fieldset className="date-fields">
      <legend>{label}</legend>
      <input
        defaultValue={source?.[`${prefix}Year`] ?? ""}
        inputMode="numeric"
        name={`${prefix}Year`}
        placeholder="年"
        type="number"
      />
      <input
        defaultValue={source?.[`${prefix}Month`] ?? ""}
        inputMode="numeric"
        max="12"
        min="1"
        name={`${prefix}Month`}
        placeholder="月"
        type="number"
      />
      <input
        defaultValue={source?.[`${prefix}Day`] ?? ""}
        inputMode="numeric"
        max="31"
        min="1"
        name={`${prefix}Day`}
        placeholder="日"
        type="number"
      />
    </fieldset>
  );
}

function PersonSelect({
  defaultValue = "",
  label,
  members,
  name,
}: {
  defaultValue?: number | "";
  label: string;
  members: FamilyMember[];
  name: string;
}) {
  return (
    <label>
      <span>{label}</span>
      <select defaultValue={defaultValue} name={name} required>
        <option value="">選択</option>
        {members.map((person) => (
          <option key={person.id} value={person.id}>
            {displayName(person)}
          </option>
        ))}
      </select>
    </label>
  );
}

function RelationshipList({
  editingRelationshipId,
  familyMap,
  isSaving,
  onDeleted,
  onEdit,
  onSubmit,
  relationships,
}: {
  editingRelationshipId: number | null;
  familyMap: Map<number, FamilyMember>;
  isSaving: boolean;
  onDeleted: (relationshipId: number) => void;
  onEdit: (relationship: FamilyRelationship) => void;
  onSubmit: (form: HTMLFormElement, doneMessage: string) => Promise<boolean>;
  relationships: FamilyRelationship[];
}) {
  return (
    <div className="relationship-list">
      <h3>登録済みの関係</h3>
      {relationships.length === 0 ? (
        <p className="muted">関係はまだ登録されていません。</p>
      ) : (
        relationships.map((relationship) => (
          <div
            className={
              editingRelationshipId === relationship.id
                ? "relationship-row editing"
                : "relationship-row"
            }
            key={relationship.id}
          >
            <div>
              <strong>{relationshipTypeLabel(relationship.relationshipType)}</strong>
              <span>{relationshipSummary(relationship, familyMap)}</span>
            </div>
            <div className="item-actions">
              <button
                className="text-button"
                onClick={() => onEdit(relationship)}
                type="button"
              >
                編集
              </button>
              <form
                className="inline-form"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (!window.confirm("この関係を削除しますか？")) return;
                  const deleted = await onSubmit(
                    event.currentTarget,
                    "関係を削除しました。",
                  );
                  if (deleted) onDeleted(relationship.id);
                }}
              >
                <input name="action" type="hidden" value="deleteRelationship" />
                <input name="id" type="hidden" value={relationship.id} />
                <button className="danger-button" disabled={isSaving} type="submit">
                  削除
                </button>
              </form>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function RelationColumn({ people, title }: { people: FamilyMember[]; title: string }) {
  return (
    <section className="relation-column">
      <h3>{title}</h3>
      {people.length === 0 ? (
        <p className="muted">未登録</p>
      ) : (
        people.map((person) => <PersonCard key={person.id} person={person} />)
      )}
    </section>
  );
}

function PersonCard({ person, primary = false }: { person: FamilyMember; primary?: boolean }) {
  const sign = getZodiacSign(person.birthMonth, person.birthDay);
  const eto = getEto(person.birthYear);

  return (
    <article className={primary ? "person-card primary-person" : "person-card"}>
      {person.photoKey ? (
        <img alt={person.photoName ?? displayName(person)} src={`/api/photos/${person.photoKey}`} />
      ) : (
        <span className="person-initial">{displayName(person).slice(0, 1)}</span>
      )}
      <div>
        <h4>{displayName(person)}</h4>
        {formatPersonLife(person) ? <p>{formatPersonLife(person)}</p> : null}
        <div className="profile-tags">
          {person.familyName ? <span>姓: {person.familyName}</span> : null}
          {person.givenName ? <span>名: {person.givenName}</span> : null}
          {sign ? <span>{sign}</span> : null}
          {eto ? <span>{eto}</span> : null}
        </div>
        {person.memo ? <p className="person-memo">{person.memo}</p> : null}
      </div>
    </article>
  );
}

function relationshipTypeLabel(type: string) {
  return type === "spouse" ? "配偶者" : "親子";
}

function relationshipSummary(
  relationship: FamilyRelationship,
  familyMap: Map<number, FamilyMember>,
) {
  const person = familyMap.get(relationship.personId);
  const relatedPerson = familyMap.get(relationship.relatedPersonId);
  const personName = person ? displayName(person) : "未登録の人物";
  const relatedName = relatedPerson ? displayName(relatedPerson) : "未登録の人物";

  if (relationship.relationshipType === "spouse") {
    return `${personName} / ${relatedName}`;
  }

  return `親: ${personName} / 子: ${relatedName}`;
}

function displayName(person: FamilyMember) {
  if (person.familyName || person.givenName) {
    return `${person.familyName}${person.givenName}`;
  }
  return person.name;
}

function nameParts(person: FamilyMember | null) {
  if (!person) return { familyName: "", givenName: "" };
  if (person.familyName || person.givenName) {
    return {
      familyName: person.familyName,
      givenName: person.givenName,
    };
  }

  const [familyName, ...rest] = person.name.trim().split(/\s+/);
  if (rest.length > 0) return { familyName, givenName: rest.join("") };
  return { familyName: "", givenName: person.name };
}

function EmptyState({ title }: { title: string }) {
  return (
    <div className="empty-state">
      <span>記</span>
      <p>{title}</p>
    </div>
  );
}

function getPersonRelations(
  person: FamilyMember,
  relationships: FamilyData["familyRelationships"],
  familyMap: Map<number, FamilyMember>,
) {
  const parents = relationships
    .filter((relation) => relation.relationshipType === "parent" && relation.relatedPersonId === person.id)
    .map((relation) => familyMap.get(relation.personId))
    .filter(Boolean) as FamilyMember[];
  const parentIds = new Set(parents.map((parent) => parent.id));
  const children = relationships
    .filter((relation) => relation.relationshipType === "parent" && relation.personId === person.id)
    .map((relation) => familyMap.get(relation.relatedPersonId))
    .filter(Boolean) as FamilyMember[];
  const spouseRelations = relationships.filter(
    (relation) =>
      relation.relationshipType === "spouse" &&
      (relation.personId === person.id || relation.relatedPersonId === person.id),
  );
  const spouses = spouseRelations
    .map((relation) =>
      familyMap.get(relation.personId === person.id ? relation.relatedPersonId : relation.personId),
    )
    .filter(Boolean) as FamilyMember[];
  const siblingIds = new Set<number>();

  relationships.forEach((relation) => {
    if (
      relation.relationshipType === "parent" &&
      parentIds.has(relation.personId) &&
      relation.relatedPersonId !== person.id
    ) {
      siblingIds.add(relation.relatedPersonId);
    }
  });

  const siblings = [...siblingIds]
    .map((id) => familyMap.get(id))
    .filter(Boolean) as FamilyMember[];

  return { parents, spouses, siblings, children };
}

function formatPartialDate(event: TimelineEvent) {
  if (event.datePrecision === "day" && event.dateMonth && event.dateDay) {
    return `${event.dateYear}年${event.dateMonth}月${event.dateDay}日`;
  }
  if (event.datePrecision === "month" && event.dateMonth) {
    return `${event.dateYear}年${event.dateMonth}月`;
  }
  return `${event.dateYear}年`;
}

function formatProfileDate(
  year: number | null,
  month: number | null,
  day: number | null,
) {
  if (year && month && day) return `${year}年${month}月${day}日`;
  if (year && month) return `${year}年${month}月`;
  if (year) return `${year}年`;
  if (month && day) return `${month}月${day}日`;
  return "";
}

function formatPersonLife(person: FamilyMember) {
  const birth = formatProfileDate(person.birthYear, person.birthMonth, person.birthDay);
  const death = formatProfileDate(person.deathYear, person.deathMonth, person.deathDay);
  if (birth && death) return `${birth} - ${death}`;
  if (birth) return `${birth} 生`;
  if (death) return `${death} 没`;
  return "";
}

function getZodiacSign(month: number | null, day: number | null) {
  if (!month || !day) return "";
  const mmdd = month * 100 + day;
  if (mmdd >= 321 && mmdd <= 419) return "牡羊座";
  if (mmdd >= 420 && mmdd <= 520) return "牡牛座";
  if (mmdd >= 521 && mmdd <= 621) return "双子座";
  if (mmdd >= 622 && mmdd <= 722) return "蟹座";
  if (mmdd >= 723 && mmdd <= 822) return "獅子座";
  if (mmdd >= 823 && mmdd <= 922) return "乙女座";
  if (mmdd >= 923 && mmdd <= 1023) return "天秤座";
  if (mmdd >= 1024 && mmdd <= 1122) return "蠍座";
  if (mmdd >= 1123 && mmdd <= 1221) return "射手座";
  if (mmdd >= 1222 || mmdd <= 119) return "山羊座";
  if (mmdd >= 120 && mmdd <= 218) return "水瓶座";
  return "魚座";
}

function getEto(year: number | null) {
  if (!year) return "";
  const index = ((year - 4) % 12 + 12) % 12;
  return `${etoAnimals[index]}年`;
}

function firstDayOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function formatMonth(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function formatFullDate(dateText: string) {
  const [year, month, day] = dateText.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}

function eventsForMonth(events: CalendarEvent[], monthCursor: Date) {
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth() + 1;
  return events
    .map((event) => {
      const [, eventMonth, eventDay] = event.eventDate.split("-").map(Number);
      const occurrenceDate =
        event.recurrence === "annual"
          ? `${year}-${pad2(eventMonth)}-${pad2(eventDay)}`
          : event.eventDate;
      const [, occurrenceMonth] = occurrenceDate.split("-").map(Number);
      return { event, occurrenceDate, occurrenceMonth };
    })
    .filter((item) => item.occurrenceMonth === month)
    .sort((left, right) => left.occurrenceDate.localeCompare(right.occurrenceDate));
}

function formatVisitorLocalTime(dateText: string, timeText: string) {
  const date = new Date(`${dateText}T${timeText}:00+09:00`);
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function pad2(value: number) {
  return `${value}`.padStart(2, "0");
}
