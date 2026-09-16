import { isFamilyAuthenticated } from "../../auth";
import {
  deleteCalendarEvent,
  deleteFamilyMember,
  deleteFamilyRelationship,
  deleteTimelineEvent,
  getFamilyData,
  saveCalendarEvent,
  saveFamilyMember,
  saveFamilyRelationship,
  saveTimelineEvent,
} from "../../family-data";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isFamilyAuthenticated())) {
    return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  return Response.json({ data: await getFamilyData() });
}

export async function POST(request: Request) {
  if (!(await isFamilyAuthenticated())) {
    return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const action = formData.get("action");

    if (action === "saveTimeline") await saveTimelineEvent(formData);
    else if (action === "deleteTimeline") await deleteTimelineEvent(formData);
    else if (action === "saveMember") await saveFamilyMember(formData);
    else if (action === "deleteMember") await deleteFamilyMember(formData);
    else if (action === "saveRelationship") await saveFamilyRelationship(formData);
    else if (action === "deleteRelationship") await deleteFamilyRelationship(formData);
    else if (action === "saveCalendar") await saveCalendarEvent(formData);
    else if (action === "deleteCalendar") await deleteCalendarEvent(formData);
    else throw new Error("保存内容が正しくありません。");

    return Response.json({ data: await getFamilyData() });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "保存できませんでした。" },
      { status: 400 },
    );
  }
}
