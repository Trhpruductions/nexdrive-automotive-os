import { db } from "@/lib/db";
import { handler, json } from "@/lib/api";

export const GET = handler("read", async () => {
  const rows = await db.machine.findMany({ where: { active: true }, orderBy: [{ lineId: "asc" }, { code: "asc" }], include: { line: { select: { id: true, name: true } } } });
  return json({ data: rows });
});
