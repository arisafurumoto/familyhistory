import { requireFamilySession } from "./auth";
import { FamilyApp } from "./FamilyApp";
import { getFamilyData } from "./family-data";

export const dynamic = "force-dynamic";

export default async function Home() {
  await requireFamilySession("/");
  const data = await getFamilyData();
  return <FamilyApp activeView="timeline" initialData={data} />;
}
