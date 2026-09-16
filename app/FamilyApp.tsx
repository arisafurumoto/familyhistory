"use client";

import {
  Baby,
  Briefcase,
  ChevronDown,
  CircleEllipsis,
  Flower,
  GraduationCap,
  Heart,
  Home,
  PawPrint,
  PartyPopper,
  Plane,
  School,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
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
const TREE_CARD_WIDTH = 220;
const TREE_CARD_HEIGHT = 164;
const TREE_COLUMN_GAP = 46;
const TREE_ROW_GAP = 86;
const TREE_PADDING_X = 28;
const TREE_PADDING_Y = 32;
const TREE_LABEL_WIDTH = 84;

type FamilyTreeLayout = {
  generationLabels: Array<{ key: string; text: string; y: number }>;
  height: number;
  lines: Array<{ key: string; kind: "parent" | "spouse"; path: string }>;
  nodes: Array<{
    generation: number;
    person: FamilyMember;
    x: number;
    y: number;
  }>;
  width: number;
};

type RelationshipSentenceRole = "parent" | "child" | "spouse";
type TimelineCategoryDefinition = (typeof TIMELINE_CATEGORIES)[number];

const timelineIconComponents: Record<
  TimelineCategoryDefinition["icon"],
  LucideIcon
> = {
  baby: Baby,
  briefcase: Briefcase,
  flower: Flower,
  graduation: GraduationCap,
  heart: Heart,
  home: Home,
  more: CircleEllipsis,
  party: PartyPopper,
  paw: PawPrint,
  plane: Plane,
  school: School,
};

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
        <Link className="brand" href="/" aria-label="古本家の歴史 年表へ">
          <span className="brand-mark">古</span>
          <span>
            <strong>古本家の歴史</strong>
            <small>家族の記録</small>
          </span>
        </Link>
        <nav className="main-nav" aria-label="主要ナビゲーション">
          {navItems.map((item) => (
            <Link
              aria-current={item.view === activeView ? "page" : undefined}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
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
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const timelineYears = useMemo(
    () => groupTimelineEventsByYear(data.timelineEvents),
    [data.timelineEvents],
  );
  const selectedEvent =
    data.timelineEvents.find((event) => event.id === selectedEventId) ?? null;

  return (
    <section className="timeline-page">
      <div className="section-heading wide-heading">
        <span className="section-kicker">年表</span>
        <h1>家族の出来事を見る</h1>
      </div>

      <div
        className={
          isAddOpen ? "panel timeline-add-panel open" : "panel timeline-add-panel"
        }
      >
        <button
          aria-controls="timeline-add-form"
          aria-expanded={isAddOpen}
          className="timeline-add-toggle"
          onClick={() => setIsAddOpen((current) => !current)}
          type="button"
        >
          <span>年表に追加</span>
          <ChevronDown aria-hidden="true" />
        </button>
        {isAddOpen ? (
          <div className="timeline-add-content" id="timeline-add-form">
            <TimelineEventForm
              event={null}
              isSaving={isSaving}
              onCancel={() => setIsAddOpen(false)}
              onSubmit={onSubmit}
              submitLabel="登録"
            />
          </div>
        ) : null}
      </div>

      <div
        className={
          selectedEvent
            ? "timeline-workspace has-selection"
            : "timeline-workspace full-width"
        }
      >
        <div className="timeline-list" aria-label="年表一覧">
          {timelineYears.length === 0 ? (
            <EmptyState title="年表はまだ登録されていません" />
          ) : (
            timelineYears.map(({ events, year }) => (
              <section className="timeline-year-group" key={year}>
                <h2 className="timeline-year-title">{year}年</h2>
                <div className="timeline-year-events">
                  {events.map((timelineEvent) => {
                    const category = timelineCategoryDefinition(
                      timelineEvent.category,
                    );

                    return (
                      <article
                        className={
                          selectedEventId === timelineEvent.id
                            ? "timeline-item selected"
                            : "timeline-item"
                        }
                        key={timelineEvent.id}
                      >
                        <span
                          aria-label={timelineEvent.category}
                          className="timeline-category-icon"
                          title={timelineEvent.category}
                        >
                          <TimelineCategoryIcon category={category} />
                        </span>
                        <button
                          aria-pressed={selectedEventId === timelineEvent.id}
                          className="timeline-title-button"
                          onClick={() => setSelectedEventId(timelineEvent.id)}
                          type="button"
                        >
                          {timelineEvent.title}
                        </button>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>

        {selectedEvent ? (
          <TimelineEventDetailPanel
            event={selectedEvent}
            isSaving={isSaving}
            key={selectedEvent.id}
            onDeleted={() => setSelectedEventId(null)}
            onSubmit={onSubmit}
          />
        ) : null}
      </div>
    </section>
  );
}

function TimelineEventForm({
  event,
  isSaving,
  onCancel,
  onSubmit,
  submitLabel,
}: {
  event: TimelineEvent | null;
  isSaving: boolean;
  onCancel?: () => void;
  onSubmit: (form: HTMLFormElement, doneMessage: string) => Promise<boolean>;
  submitLabel: string;
}) {
  return (
    <form
      key={event?.id ?? "new-timeline"}
      className="entry-form timeline-event-form"
      onSubmit={async (submitEvent) => {
        submitEvent.preventDefault();
        const saved = await onSubmit(
          submitEvent.currentTarget,
          "年表を保存しました。",
        );
        if (saved) onCancel?.();
      }}
    >
      <input name="action" type="hidden" value="saveTimeline" />
      {event ? <input name="id" type="hidden" value={event.id} /> : null}
      <label>
        <span>タイトル</span>
        <input defaultValue={event?.title ?? ""} name="title" required type="text" />
      </label>
      <fieldset className="date-fields">
        <legend>日付</legend>
        <input
          defaultValue={event?.dateYear ?? ""}
          inputMode="numeric"
          name="dateYear"
          placeholder="年"
          required
          type="number"
        />
        <input
          defaultValue={event?.dateMonth ?? ""}
          inputMode="numeric"
          max="12"
          min="1"
          name="dateMonth"
          placeholder="月"
          type="number"
        />
        <input
          defaultValue={event?.dateDay ?? ""}
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
        <select defaultValue={event?.category ?? "出生"} name="category">
          {TIMELINE_CATEGORIES.map((category) => (
            <option key={category.name} value={category.name}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>場所</span>
        <input defaultValue={event?.location ?? ""} name="location" type="text" />
      </label>
      <label className="timeline-description-field">
        <span>説明</span>
        <textarea
          defaultValue={event?.description ?? ""}
          name="description"
          rows={5}
        />
      </label>
      <label>
        <span>カバー写真</span>
        <input accept="image/*" name="coverPhoto" type="file" />
      </label>
      <div className="form-actions">
        {event ? (
          <button className="ghost-button" onClick={onCancel} type="button">
            取消
          </button>
        ) : null}
        <button className="primary-button" disabled={isSaving} type="submit">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function TimelineEventDetailPanel({
  event,
  isSaving,
  onDeleted,
  onSubmit,
}: {
  event: TimelineEvent;
  isSaving: boolean;
  onDeleted: () => void;
  onSubmit: (form: HTMLFormElement, doneMessage: string) => Promise<boolean>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const category = timelineCategoryDefinition(event.category);

  return (
    <aside className="panel timeline-detail-panel">
      {isEditing ? (
        <section className="detail-edit-section">
          <h2>年表を編集</h2>
          <TimelineEventForm
            event={event}
            isSaving={isSaving}
            onCancel={() => setIsEditing(false)}
            onSubmit={onSubmit}
            submitLabel="保存"
          />
        </section>
      ) : (
        <>
          <div className="timeline-detail-header">
            <span className="category-badge">
              <TimelineCategoryIcon category={category} />
              {event.category}
            </span>
            <h2>{event.title}</h2>
          </div>

          {event.coverPhotoKey ? (
            <img
              alt={event.coverPhotoName ?? event.title}
              className="timeline-detail-photo"
              src={`/api/photos/${event.coverPhotoKey}`}
            />
          ) : null}

          <dl className="timeline-detail-meta">
            <div>
              <dt>日付</dt>
              <dd>{formatPartialDate(event)}</dd>
            </div>
            <div>
              <dt>カテゴリー</dt>
              <dd>{event.category}</dd>
            </div>
            <div>
              <dt>場所</dt>
              <dd>{event.location || "未登録"}</dd>
            </div>
          </dl>

          <section className="timeline-detail-description">
            <h3>説明</h3>
            {event.description ? (
              <p>{event.description}</p>
            ) : (
              <p className="muted">説明はまだ登録されていません。</p>
            )}
          </section>
        </>
      )}

      <div className="timeline-detail-actions">
        {isEditing ? null : (
          <button
            className="primary-button"
            onClick={() => setIsEditing(true)}
            type="button"
          >
            編集
          </button>
        )}
        <form
          className="inline-form"
          onSubmit={async (submitEvent) => {
            submitEvent.preventDefault();
            if (!window.confirm("この年表を削除しますか？")) return;
            const deleted = await onSubmit(
              submitEvent.currentTarget,
              "年表を削除しました。",
            );
            if (deleted) onDeleted();
          }}
        >
          <input name="action" type="hidden" value="deleteTimeline" />
          <input name="id" type="hidden" value={event.id} />
          <button className="danger-button" disabled={isSaving} type="submit">
            削除
          </button>
        </form>
      </div>
    </aside>
  );
}

function TimelineCategoryIcon({
  category,
}: {
  category: TimelineCategoryDefinition;
}) {
  const Icon = timelineIconComponents[category.icon] ?? CircleEllipsis;
  return <Icon aria-hidden="true" strokeWidth={2.4} />;
}

function timelineCategoryDefinition(categoryName: string) {
  return (
    TIMELINE_CATEGORIES.find((category) => category.name === categoryName) ??
    TIMELINE_CATEGORIES[TIMELINE_CATEGORIES.length - 1]
  );
}

function groupTimelineEventsByYear(events: TimelineEvent[]) {
  const yearMap = new Map<number, TimelineEvent[]>();

  [...events].sort(compareTimelineEventsDesc).forEach((event) => {
    yearMap.set(event.dateYear, [...(yearMap.get(event.dateYear) ?? []), event]);
  });

  return [...yearMap.entries()].map(([year, yearEvents]) => ({
    events: yearEvents,
    year,
  }));
}

function compareTimelineEventsDesc(left: TimelineEvent, right: TimelineEvent) {
  return (
    right.dateYear - left.dateYear ||
    (right.dateMonth ?? 0) - (left.dateMonth ?? 0) ||
    (right.dateDay ?? 0) - (left.dateDay ?? 0) ||
    right.id - left.id
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
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const familyMap = useMemo(
    () => new Map(data.familyMembers.map((person) => [person.id, person])),
    [data.familyMembers],
  );
  const treeLayout = useMemo(
    () => buildFamilyTreeLayout(data.familyMembers, data.familyRelationships),
    [data.familyMembers, data.familyRelationships],
  );
  const selectedPerson =
    data.familyMembers.find((person) => person.id === selectedPersonId) ?? null;
  const selectedPersonRelationships = selectedPerson
    ? data.familyRelationships.filter(
        (relationship) =>
          relationship.personId === selectedPerson.id ||
          relationship.relatedPersonId === selectedPerson.id,
      )
    : [];

  return (
    <section className="tree-page">
      <div className="section-heading wide-heading">
        <span className="section-kicker">家系図</span>
        <h1>家族のつながりを見る</h1>
      </div>

      <div className="panel tree-entry-panel">
        <div className="tree-entry-block">
          <h2>人物を追加</h2>
          <form
            className="entry-form tree-add-form"
            onSubmit={async (event) => {
              event.preventDefault();
              await onSubmit(event.currentTarget, "人物を登録しました。");
            }}
          >
            <input name="action" type="hidden" value="saveMember" />
            <div className="name-fields">
              <label>
                <span>姓</span>
                <input name="familyName" required type="text" />
              </label>
              <label>
                <span>名</span>
                <input name="givenName" required type="text" />
              </label>
            </div>
            <DateTriple label="生年月日" prefix="birth" source={null} />
            <DateTriple label="没年月日" prefix="death" source={null} />
            <label>
              <span>写真</span>
              <input accept="image/*" name="photo" type="file" />
            </label>
            <label>
              <span>メモ</span>
              <textarea name="memo" rows={4} />
            </label>
            <div className="form-actions">
              <button className="primary-button" disabled={isSaving} type="submit">
                登録
              </button>
            </div>
          </form>
        </div>
      </div>

      <div
        className={
          selectedPerson ? "tree-workspace has-selection" : "tree-workspace full-width"
        }
      >
        <div className="tree-stage">
          {data.familyMembers.length === 0 ? (
            <EmptyState title="家系図はまだ登録されていません" />
          ) : (
            <FamilyTreeCanvas
              layout={treeLayout}
              onSelectPerson={(personId) => setSelectedPersonId(personId)}
              selectedPersonId={selectedPersonId}
            />
          )}
        </div>

        {selectedPerson ? (
          <PersonDetailPanel
            familyMap={familyMap}
            isSaving={isSaving}
            key={selectedPerson.id}
            members={data.familyMembers}
            onDeleted={() => setSelectedPersonId(null)}
            onSubmit={onSubmit}
            person={selectedPerson}
            relationships={selectedPersonRelationships}
          />
        ) : null}
      </div>
    </section>
  );
}

function PersonDetailPanel({
  familyMap,
  isSaving,
  members,
  onDeleted,
  onSubmit,
  person,
  relationships,
}: {
  familyMap: Map<number, FamilyMember>;
  isSaving: boolean;
  members: FamilyMember[];
  onDeleted: () => void;
  onSubmit: (form: HTMLFormElement, doneMessage: string) => Promise<boolean>;
  person: FamilyMember;
  relationships: FamilyRelationship[];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingRelationship, setEditingRelationship] =
    useState<FamilyRelationship | null>(null);
  const sign = getZodiacSign(person.birthMonth, person.birthDay);
  const eto = getEto(person.birthYear);
  const birthDate = formatProfileDate(
    person.birthYear,
    person.birthMonth,
    person.birthDay,
  );
  const relationshipOptions = members.filter((member) => member.id !== person.id);

  return (
    <aside className="panel person-detail-panel">
      <div className="person-detail-header">
        {person.photoKey ? (
          <img
            alt={person.photoName ?? displayName(person)}
            src={`/api/photos/${person.photoKey}`}
          />
        ) : (
          <span className="person-detail-initial">{displayName(person).slice(0, 1)}</span>
        )}
        <div>
          <span className="section-kicker">選択中の人物</span>
          <h2>{displayName(person)}</h2>
          <p>{birthDate || "生年月日未登録"}</p>
        </div>
      </div>

      {isEditing ? (
        <>
          <section className="detail-edit-section">
            <h3>人物情報</h3>
            <form
              key={`${person.id}-${person.updatedAt}`}
              className="entry-form"
              onSubmit={async (event) => {
                event.preventDefault();
                const saved = await onSubmit(
                  event.currentTarget,
                  "人物を保存しました。",
                );
                if (saved) {
                  setIsEditing(false);
                  setEditingRelationship(null);
                }
              }}
            >
              <input name="action" type="hidden" value="saveMember" />
              <input name="id" type="hidden" value={person.id} />
              <div className="name-fields">
                <label>
                  <span>姓</span>
                  <input
                    defaultValue={nameParts(person).familyName}
                    name="familyName"
                    required
                    type="text"
                  />
                </label>
                <label>
                  <span>名</span>
                  <input
                    defaultValue={nameParts(person).givenName}
                    name="givenName"
                    required
                    type="text"
                  />
                </label>
              </div>
              <DateTriple label="生年月日" prefix="birth" source={person} />
              <DateTriple label="没年月日" prefix="death" source={person} />
              <label>
                <span>写真</span>
                <input accept="image/*" name="photo" type="file" />
              </label>
              <label>
                <span>メモ</span>
                <textarea defaultValue={person.memo ?? ""} name="memo" rows={4} />
              </label>
              <div className="form-actions">
                <button
                  className="ghost-button"
                  onClick={() => {
                    setIsEditing(false);
                    setEditingRelationship(null);
                  }}
                  type="button"
                >
                  取消
                </button>
                <button className="primary-button" disabled={isSaving} type="submit">
                  保存
                </button>
              </div>
            </form>
          </section>

          <section className="detail-edit-section">
            <h3>{editingRelationship ? "関係を編集" : "関係を追加"}</h3>
            <PersonRelationshipForm
              key={editingRelationship?.id ?? `new-${person.id}`}
              editingRelationship={editingRelationship}
              isSaving={isSaving}
              members={relationshipOptions}
              onCancel={() => setEditingRelationship(null)}
              onSaved={() => setEditingRelationship(null)}
              onSubmit={onSubmit}
              person={person}
            />
            <SelectedRelationshipList
              editingRelationshipId={editingRelationship?.id ?? null}
              familyMap={familyMap}
              isSaving={isSaving}
              onDeleted={(relationshipId) => {
                if (editingRelationship?.id === relationshipId) {
                  setEditingRelationship(null);
                }
              }}
              onEdit={setEditingRelationship}
              onSubmit={onSubmit}
              person={person}
              relationships={relationships}
            />
          </section>
        </>
      ) : (
        <>
          <div className="profile-tags detail-tags">
            {formatPersonAge(person) ? <span>{formatPersonAge(person)}</span> : null}
            {sign ? <span>{sign}</span> : null}
            {eto ? <span>{eto}</span> : null}
          </div>
          {person.memo ? (
            <p className="person-memo">{person.memo}</p>
          ) : (
            <p className="muted person-memo">メモはまだ登録されていません。</p>
          )}

          <section className="detail-relationships">
            <h3>関係</h3>
            {relationships.length === 0 ? (
              <p className="muted">関係はまだ登録されていません。</p>
            ) : (
              <ul>
                {relationships.map((relationship) => (
                  <li key={relationship.id}>
                    {personRelationshipSummary(person, relationship, familyMap)}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <div className="detail-actions">
        {isEditing ? null : (
          <button
            className="primary-button"
            onClick={() => setIsEditing(true)}
            type="button"
          >
            編集
          </button>
        )}
        <form
          className="inline-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!window.confirm("この人物を削除しますか？ 関係も削除されます。")) {
              return;
            }
            const deleted = await onSubmit(event.currentTarget, "人物を削除しました。");
            if (deleted) onDeleted();
          }}
        >
          <input name="action" type="hidden" value="deleteMember" />
          <input name="id" type="hidden" value={person.id} />
          <button className="danger-button" disabled={isSaving} type="submit">
            削除
          </button>
        </form>
      </div>
    </aside>
  );
}

function PersonRelationshipForm({
  editingRelationship,
  isSaving,
  members,
  onCancel,
  onSaved,
  onSubmit,
  person,
}: {
  editingRelationship: FamilyRelationship | null;
  isSaving: boolean;
  members: FamilyMember[];
  onCancel: () => void;
  onSaved: () => void;
  onSubmit: (form: HTMLFormElement, doneMessage: string) => Promise<boolean>;
  person: FamilyMember;
}) {
  const initialSentence = relationshipSentenceDefaultsForPerson(
    person,
    editingRelationship,
  );
  const [relatedPersonId, setRelatedPersonId] = useState<number | "">(
    initialSentence.relatedPersonId,
  );
  const [role, setRole] = useState<RelationshipSentenceRole>(initialSentence.role);
  const relationshipType = role === "spouse" ? "spouse" : "parent";
  const storedPersonId = role === "child" ? relatedPersonId : person.id;
  const storedRelatedPersonId = role === "child" ? person.id : relatedPersonId;

  return (
    <form
      className="entry-form compact-form relationship-sentence-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const saved = await onSubmit(event.currentTarget, "関係を保存しました。");
        if (saved) {
          setRelatedPersonId("");
          setRole("parent");
          onSaved();
        }
      }}
    >
      <input name="action" type="hidden" value="saveRelationship" />
      {editingRelationship ? (
        <input name="id" type="hidden" value={editingRelationship.id} />
      ) : null}
      <input name="relationshipType" readOnly type="hidden" value={relationshipType} />
      <input name="personId" readOnly type="hidden" value={storedPersonId} />
      <input
        name="relatedPersonId"
        readOnly
        type="hidden"
        value={storedRelatedPersonId}
      />

      <div className="relationship-sentence" aria-label="関係">
        <span className="relationship-fixed-person">この人は</span>
        <select
          aria-label="相手"
          onChange={(event) =>
            setRelatedPersonId(event.target.value ? Number(event.target.value) : "")
          }
          required
          value={relatedPersonId}
        >
          <option value="">相手を選択</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {displayName(member)}
            </option>
          ))}
        </select>
        <span className="relationship-particle">の</span>
        <select
          aria-label="関係"
          onChange={(event) => setRole(event.target.value as RelationshipSentenceRole)}
          value={role}
        >
          <option value="parent">親です</option>
          <option value="child">子です</option>
          <option value="spouse">配偶者です</option>
        </select>
      </div>

      <div className="form-actions">
        {editingRelationship ? (
          <button className="ghost-button" onClick={onCancel} type="button">
            取消
          </button>
        ) : null}
        <button className="primary-button" disabled={isSaving} type="submit">
          {editingRelationship ? "更新" : "登録"}
        </button>
      </div>
    </form>
  );
}

function relationshipSentenceDefaultsForPerson(
  person: FamilyMember,
  relationship: FamilyRelationship | null,
): {
  relatedPersonId: number | "";
  role: RelationshipSentenceRole;
} {
  if (!relationship) return { relatedPersonId: "", role: "parent" };

  if (relationship.relationshipType === "spouse") {
    return {
      relatedPersonId:
        relationship.personId === person.id
          ? relationship.relatedPersonId
          : relationship.personId,
      role: "spouse",
    };
  }

  if (relationship.personId === person.id) {
    return {
      relatedPersonId: relationship.relatedPersonId,
      role: "parent",
    };
  }

  return {
    relatedPersonId: relationship.personId,
    role: "child",
  };
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

function SelectedRelationshipList({
  editingRelationshipId,
  familyMap,
  isSaving,
  onDeleted,
  onEdit,
  onSubmit,
  person,
  relationships,
}: {
  editingRelationshipId: number | null;
  familyMap: Map<number, FamilyMember>;
  isSaving: boolean;
  onDeleted: (relationshipId: number) => void;
  onEdit: (relationship: FamilyRelationship) => void;
  onSubmit: (form: HTMLFormElement, doneMessage: string) => Promise<boolean>;
  person: FamilyMember;
  relationships: FamilyRelationship[];
}) {
  return (
    <div className="relationship-list">
      <h3>この人の関係</h3>
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
            <div className="relationship-row-text">
              <span>{personRelationshipSummary(person, relationship, familyMap)}</span>
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

function FamilyTreeCanvas({
  layout,
  onSelectPerson,
  selectedPersonId,
}: {
  layout: FamilyTreeLayout;
  onSelectPerson: (personId: number) => void;
  selectedPersonId: number | null;
}) {
  return (
    <div className="tree-canvas-scroll" aria-label="家系図">
      <div
        className="tree-canvas"
        style={{ height: layout.height, width: layout.width }}
      >
        <svg
          aria-hidden="true"
          className="tree-lines"
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          width={layout.width}
        >
          {layout.lines.map((line) => (
            <path
              className={line.kind === "spouse" ? "tree-link spouse" : "tree-link parent"}
              d={line.path}
              key={line.key}
            />
          ))}
        </svg>

        {layout.generationLabels.map((label) => (
          <span
            className="generation-label"
            key={label.key}
            style={{ top: label.y }}
          >
            {label.text}
          </span>
        ))}

        {layout.nodes.map((node) => (
          <div
            className="tree-person-node"
            key={node.person.id}
            style={{ left: node.x, top: node.y }}
          >
            <TreePersonCard
              isSelected={selectedPersonId === node.person.id}
              onSelect={onSelectPerson}
              person={node.person}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function TreePersonCard({
  isSelected,
  onSelect,
  person,
}: {
  isSelected: boolean;
  onSelect: (personId: number) => void;
  person: FamilyMember;
}) {
  const birthDate = formatProfileDate(
    person.birthYear,
    person.birthMonth,
    person.birthDay,
  );
  const age = formatPersonAge(person);

  return (
    <article
      className={
        isSelected ? "person-card tree-person-card selected" : "person-card tree-person-card"
      }
    >
      {person.photoKey ? (
        <img
          alt={person.photoName ?? displayName(person)}
          src={`/api/photos/${person.photoKey}`}
        />
      ) : (
        <span className="person-initial">{displayName(person).slice(0, 1)}</span>
      )}
      <div className="tree-person-details">
        <button
          className="tree-person-name"
          onClick={() => onSelect(person.id)}
          type="button"
        >
          {displayName(person)}
        </button>
        {birthDate ? (
          <p>{birthDate}</p>
        ) : (
          <p className="muted">生年月日未登録</p>
        )}
        {age ? <p className="tree-person-age">{age}</p> : null}
      </div>
    </article>
  );
}

function personRelationshipSummary(
  person: FamilyMember,
  relationship: FamilyRelationship,
  familyMap: Map<number, FamilyMember>,
) {
  if (relationship.relationshipType === "spouse") {
    const partnerId =
      relationship.personId === person.id
        ? relationship.relatedPersonId
        : relationship.personId;
    const partner = familyMap.get(partnerId);
    return `${partner ? displayName(partner) : "未登録の人物"} の配偶者`;
  }

  if (relationship.personId === person.id) {
    const child = familyMap.get(relationship.relatedPersonId);
    return `${child ? displayName(child) : "未登録の人物"} の親`;
  }

  const parent = familyMap.get(relationship.personId);
  return `${parent ? displayName(parent) : "未登録の人物"} の子`;
}

function displayName(person: FamilyMember) {
  if (person.familyName && person.givenName) return `${person.familyName} ${person.givenName}`;
  if (person.familyName || person.givenName) return `${person.familyName}${person.givenName}`;
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

function buildFamilyTreeLayout(
  members: FamilyMember[],
  relationships: FamilyData["familyRelationships"],
): FamilyTreeLayout {
  const memberIds = new Set(members.map((member) => member.id));
  const parentRelationships = relationships.filter(
    (relationship) =>
      relationship.relationshipType === "parent" &&
      memberIds.has(relationship.personId) &&
      memberIds.has(relationship.relatedPersonId),
  );
  const spouseRelationships = relationships.filter(
    (relationship) =>
      relationship.relationshipType === "spouse" &&
      memberIds.has(relationship.personId) &&
      memberIds.has(relationship.relatedPersonId),
  );
  const generations = calculateGenerations(
    members,
    parentRelationships,
    spouseRelationships,
  );
  const generationValues = [...new Set(generations.values())].sort(
    (left, right) => left - right,
  );
  const groupByGeneration = generationValues.map((generationValue, generation) => ({
    generation,
    people: orderGenerationPeople(
      members.filter((member) => generations.get(member.id) === generationValue),
      spouseRelationships,
    ),
  }));
  const rowWidths = groupByGeneration.map(({ people }) =>
    people.length * TREE_CARD_WIDTH +
    Math.max(0, people.length - 1) * TREE_COLUMN_GAP,
  );
  const maxRowWidth = Math.max(...rowWidths, TREE_CARD_WIDTH);
  const width = Math.max(
    920,
    maxRowWidth + TREE_LABEL_WIDTH + TREE_PADDING_X * 2,
  );
  const nodes: FamilyTreeLayout["nodes"] = [];
  const nodeById = new Map<number, FamilyTreeLayout["nodes"][number]>();
  const generationLabels: FamilyTreeLayout["generationLabels"] = [];

  groupByGeneration.forEach(({ generation, people }, rowIndex) => {
    const y = TREE_PADDING_Y + rowIndex * (TREE_CARD_HEIGHT + TREE_ROW_GAP);
    const rowWidth =
      people.length * TREE_CARD_WIDTH +
      Math.max(0, people.length - 1) * TREE_COLUMN_GAP;
    const startX =
      TREE_PADDING_X +
      TREE_LABEL_WIDTH +
      Math.max(0, (maxRowWidth - rowWidth) / 2);

    generationLabels.push({
      key: `generation-${generation}`,
      text: `第${generation + 1}世代`,
      y: y + TREE_CARD_HEIGHT / 2,
    });

    people.forEach((person, index) => {
      const node = {
        generation,
        person,
        x: startX + index * (TREE_CARD_WIDTH + TREE_COLUMN_GAP),
        y,
      };
      nodes.push(node);
      nodeById.set(person.id, node);
    });
  });

  const height =
    TREE_PADDING_Y * 2 +
    groupByGeneration.length * TREE_CARD_HEIGHT +
    Math.max(0, groupByGeneration.length - 1) * TREE_ROW_GAP;
  const lines: FamilyTreeLayout["lines"] = [];

  spouseRelationships.forEach((relationship) => {
    const firstNode = nodeById.get(relationship.personId);
    const secondNode = nodeById.get(relationship.relatedPersonId);
    if (!firstNode || !secondNode) return;

    const [leftNode, rightNode] =
      firstNode.x <= secondNode.x ? [firstNode, secondNode] : [secondNode, firstNode];
    const y = leftNode.y + TREE_CARD_HEIGHT / 2;
    lines.push({
      key: `spouse-${relationship.id}`,
      kind: "spouse",
      path: `M ${leftNode.x + TREE_CARD_WIDTH} ${y} L ${rightNode.x} ${y}`,
    });
  });

  parentRelationships.forEach((relationship) => {
    const parentNode = nodeById.get(relationship.personId);
    const childNode = nodeById.get(relationship.relatedPersonId);
    if (!parentNode || !childNode) return;

    const startX = parentNode.x + TREE_CARD_WIDTH / 2;
    const startY = parentNode.y + TREE_CARD_HEIGHT;
    const endX = childNode.x + TREE_CARD_WIDTH / 2;
    const endY = childNode.y;
    const middleY = startY + Math.max(32, (endY - startY) / 2);
    lines.push({
      key: `parent-${relationship.id}`,
      kind: "parent",
      path: `M ${startX} ${startY} C ${startX} ${middleY} ${endX} ${middleY} ${endX} ${endY}`,
    });
  });

  return {
    generationLabels,
    height,
    lines,
    nodes,
    width,
  };
}

function calculateGenerations(
  members: FamilyMember[],
  parentRelationships: FamilyRelationship[],
  spouseRelationships: FamilyRelationship[],
) {
  const maxGeneration = Math.max(0, members.length - 1);
  const generations = new Map(members.map((member) => [member.id, 0]));
  const maxPasses = Math.max(1, members.length * (parentRelationships.length + 1));

  for (let pass = 0; pass < maxPasses; pass += 1) {
    let changed = false;

    parentRelationships.forEach((relationship) => {
      const parentGeneration = generations.get(relationship.personId) ?? 0;
      const childGeneration = generations.get(relationship.relatedPersonId) ?? 0;
      const nextGeneration = Math.min(parentGeneration + 1, maxGeneration);
      if (childGeneration < nextGeneration) {
        generations.set(relationship.relatedPersonId, nextGeneration);
        changed = true;
      }
    });

    spouseRelationships.forEach((relationship) => {
      const firstGeneration = generations.get(relationship.personId) ?? 0;
      const secondGeneration = generations.get(relationship.relatedPersonId) ?? 0;
      const sharedGeneration = Math.max(firstGeneration, secondGeneration);
      if (firstGeneration !== sharedGeneration) {
        generations.set(relationship.personId, sharedGeneration);
        changed = true;
      }
      if (secondGeneration !== sharedGeneration) {
        generations.set(relationship.relatedPersonId, sharedGeneration);
        changed = true;
      }
    });

    if (!changed) break;
  }

  const minimumGeneration = Math.min(...generations.values(), 0);
  if (minimumGeneration > 0) {
    members.forEach((member) => {
      generations.set(member.id, (generations.get(member.id) ?? 0) - minimumGeneration);
    });
  }

  return generations;
}

function orderGenerationPeople(
  people: FamilyMember[],
  spouseRelationships: FamilyRelationship[],
) {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const partnersById = new Map<number, FamilyMember[]>();

  spouseRelationships.forEach((relationship) => {
    const firstPerson = peopleById.get(relationship.personId);
    const secondPerson = peopleById.get(relationship.relatedPersonId);
    if (!firstPerson || !secondPerson) return;

    partnersById.set(relationship.personId, [
      ...(partnersById.get(relationship.personId) ?? []),
      secondPerson,
    ]);
    partnersById.set(relationship.relatedPersonId, [
      ...(partnersById.get(relationship.relatedPersonId) ?? []),
      firstPerson,
    ]);
  });

  const orderedPeople: FamilyMember[] = [];
  const visited = new Set<number>();

  [...people].sort(compareFamilyMembers).forEach((person) => {
    if (visited.has(person.id)) return;
    orderedPeople.push(person);
    visited.add(person.id);

    (partnersById.get(person.id) ?? [])
      .sort(compareFamilyMembers)
      .forEach((partner) => {
        if (visited.has(partner.id)) return;
        orderedPeople.push(partner);
        visited.add(partner.id);
      });
  });

  return orderedPeople;
}

function compareFamilyMembers(left: FamilyMember, right: FamilyMember) {
  const leftYear = left.birthYear ?? 9999;
  const rightYear = right.birthYear ?? 9999;
  if (leftYear !== rightYear) return leftYear - rightYear;
  return displayName(left).localeCompare(displayName(right), "ja-JP");
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

function formatPersonAge(person: FamilyMember) {
  const age = calculateAge(person);
  if (age === null) return "";
  return person.deathYear ? `享年${age}歳` : `${age}歳`;
}

function calculateAge(person: FamilyMember) {
  if (!person.birthYear) return null;

  const today = new Date();
  const endYear = person.deathYear ?? today.getFullYear();
  const endMonth = person.deathMonth ?? (person.deathYear ? 12 : today.getMonth() + 1);
  const endDay = person.deathDay ?? (person.deathYear ? 31 : today.getDate());
  let age = endYear - person.birthYear;

  if (person.birthMonth && person.birthDay) {
    const hasBirthdayPassed =
      endMonth > person.birthMonth ||
      (endMonth === person.birthMonth && endDay >= person.birthDay);
    if (!hasBirthdayPassed) age -= 1;
  }

  return age >= 0 ? age : null;
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
