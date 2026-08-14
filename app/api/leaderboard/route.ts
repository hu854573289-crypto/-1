import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { leaderboard } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await getDb().select({
      name: leaderboard.displayName,
      power: leaderboard.power,
      stage: leaderboard.stage,
      level: leaderboard.level,
    }).from(leaderboard).orderBy(desc(leaderboard.power), desc(leaderboard.stage)).limit(50);
    return Response.json({ leaders: rows.map((row, index) => ({ rank: index + 1, ...row })) }, { headers: { "cache-control": "public, max-age=30" } });
  } catch {
    return Response.json({ leaders: [] }, { headers: { "cache-control": "no-store" } });
  }
}
