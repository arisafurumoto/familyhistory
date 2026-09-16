import { requireFamilySession } from "../auth";
import { FamilyApp } from "../FamilyApp";
import { getFamilyData } from "../family-data";

export const dynamic = "force-dynamic";

export default async function TreePage() {
  await requireFamilySession("/tree");
  const data = await getFamilyData();
  return <FamilyApp activeView="tree" initialData={data} />;
}
