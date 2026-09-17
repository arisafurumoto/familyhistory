export const TIMELINE_CATEGORIES = [
  { name: "出生", icon: "baby" },
  { name: "入学", icon: "school" },
  { name: "卒業", icon: "graduation" },
  { name: "就職", icon: "briefcase" },
  { name: "結婚", icon: "heart" },
  { name: "引越し", icon: "home" },
  { name: "旅行", icon: "plane" },
  { name: "記念日", icon: "party" },
  { name: "逝去", icon: "flower" },
  { name: "ペット", icon: "paw" },
  { name: "その他", icon: "more" },
] as const;

export const CALENDAR_CATEGORIES = [
  "家族行事",
  "誕生日",
  "記念日",
  "法事",
  "旅行",
  "その他",
] as const;

export function formatFamilyMemberDisplayName(
  familyName: string,
  givenName: string,
) {
  if (isAlphabeticNamePart(familyName) && isAlphabeticNamePart(givenName)) {
    return `${givenName} ${familyName}`;
  }
  if (familyName && givenName) return `${familyName} ${givenName}`;
  return `${familyName}${givenName}`;
}

export function formatFamilyMemberStoredName(
  familyName: string,
  givenName: string,
) {
  if (isAlphabeticNamePart(familyName) && isAlphabeticNamePart(givenName)) {
    return `${givenName} ${familyName}`;
  }
  return `${familyName}${givenName}`;
}

function isAlphabeticNamePart(value: string) {
  return /^[A-Za-z]+$/.test(value);
}

export type TimelineEvent = {
  id: number;
  title: string;
  dateYear: number;
  dateMonth: number | null;
  dateDay: number | null;
  datePrecision: string;
  category: string;
  location: string;
  description: string;
  coverPhotoKey: string | null;
  coverPhotoName: string | null;
  coverPhotoContentType: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FamilyMember = {
  id: number;
  name: string;
  familyName: string;
  givenName: string;
  birthYear: number | null;
  birthMonth: number | null;
  birthDay: number | null;
  deathYear: number | null;
  deathMonth: number | null;
  deathDay: number | null;
  memo: string;
  photoKey: string | null;
  photoName: string | null;
  photoContentType: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FamilyRelationship = {
  id: number;
  personId: number;
  relatedPersonId: number;
  relationshipType: string;
  createdAt: string;
};

export type CalendarEvent = {
  id: number;
  title: string;
  eventDate: string;
  eventTime: string | null;
  location: string;
  category: string;
  description: string;
  recurrence: string;
  createdAt: string;
  updatedAt: string;
};

export type FamilyData = {
  timelineEvents: TimelineEvent[];
  familyMembers: FamilyMember[];
  familyRelationships: FamilyRelationship[];
  calendarEvents: CalendarEvent[];
};
