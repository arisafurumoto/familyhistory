import { requireFamilySession } from "../auth";
import { FamilyApp } from "../FamilyApp";
import { getFamilyData } from "../family-data";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  await requireFamilySession("/calendar");
  const data = await getFamilyData();
  return <FamilyApp activeView="calendar" initialData={data} />;
}
