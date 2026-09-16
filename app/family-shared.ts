export const TIMELINE_CATEGORIES = [
  { name: "出生", icon: "誕" },
  { name: "入学", icon: "学" },
  { name: "卒業", icon: "卒" },
  { name: "就職", icon: "職" },
  { name: "結婚", icon: "結" },
  { name: "引越し", icon: "住" },
  { name: "旅行", icon: "旅" },
  { name: "記念日", icon: "祝" },
  { name: "逝去", icon: "弔" },
  { name: "その他", icon: "記" },
] as const;

export const CALENDAR_CATEGORIES = [
  "家族行事",
  "誕生日",
  "記念日",
  "法事",
  "旅行",
  "その他",
] as const;

export type TimelineEvent = {
  id: number;
  title: string;
  dateYear: number;
  dateMonth: number | null;
  dateDay: number | null;
  datePrecision: string;
  category: string;
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
