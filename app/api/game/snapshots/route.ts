import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { gameSaves, saveSnapshots } from "@/db/schema";
import { migrateGameState } from "@/lib/game-state";
import { GAME_SCHEMA_VERSION } from "@/lib/game-types";
import { checksumJson, createSnapshot, ensurePlayer, getPlayerIdentity, parseStateJson, saveLeaderboard } from "@/lib/server/game-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const identity = await getPlayerIdentity();
  if (!identity) return Response.json({ error: "sign_in_required" }, { status: 401 });
  try {
    const rows = await getDb().select({
      id: saveSnapshots.id, revision: saveSnapshots.revision, schemaVersion: saveSnapshots.schemaVersion,
      reason: saveSnapshots.reason, createdAt: saveSnapshots.createdAt, stage: saveSnapshots.stage,
      level: saveSnapshots.level, power: saveSnapshots.power,
    }).from(saveSnapshots).where(eq(saveSnapshots.playerId, identity.id)).orderBy(desc(saveSnapshots.createdAt)).limit(12);
    return Response.json({ snapshots: rows }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "snapshot_read_failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const identity = await getPlayerIdentity();
  if (!identity) return Response.json({ error: "sign_in_required" }, { status: 401 });
  const now = Date.now();
  try {
    const payload = await request.json() as { snapshotId?: unknown; expectedRevision?: unknown };
    const snapshotId = typeof payload.snapshotId === "string" ? payload.snapshotId.slice(0, 80) : "";
    const expectedRevision = Number(payload.expectedRevision);
    if (!snapshotId || !Number.isSafeInteger(expectedRevision)) return Response.json({ error: "invalid_request" }, { status: 400 });
    await ensurePlayer(identity, now);
    const db = getDb();
    const [current] = await db.select().from(gameSaves).where(and(eq(gameSaves.playerId, identity.id), eq(gameSaves.slot, 1))).limit(1);
    if (!current || current.revision !== expectedRevision) return Response.json({ error: "revision_conflict", currentRevision: current?.revision }, { status: 409 });
    const [snapshot] = await db.select().from(saveSnapshots).where(and(eq(saveSnapshots.id, snapshotId), eq(saveSnapshots.playerId, identity.id))).limit(1);
    if (!snapshot) return Response.json({ error: "snapshot_not_found" }, { status: 404 });

    const restored = migrateGameState(parseStateJson(snapshot.stateJson), now, identity.displayName);
    restored.idle.lastSeenAt = now;
    restored.lastSavedAt = now;
    const restoredJson = JSON.stringify(restored);
    const restoredChecksum = await checksumJson(restoredJson);
    await createSnapshot({
      playerId: identity.id, revision: current.revision, schemaVersion: current.schemaVersion,
      reason: "manual-restore", stateJson: current.stateJson, checksum: current.checksum,
      state: migrateGameState(parseStateJson(current.stateJson), current.updatedAt, identity.displayName), now,
    });
    const [updated] = await db.update(gameSaves).set({
      revision: sql`${gameSaves.revision} + 1`, schemaVersion: GAME_SCHEMA_VERSION,
      stateJson: restoredJson, checksum: restoredChecksum, updatedAt: now,
    }).where(and(eq(gameSaves.id, current.id), eq(gameSaves.revision, expectedRevision))).returning({ revision: gameSaves.revision });
    if (!updated) return Response.json({ error: "revision_conflict" }, { status: 409 });
    await saveLeaderboard(identity, restored, now);
    return Response.json({ revision: updated.revision, state: restored, serverTime: now }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "snapshot_restore_failed" }, { status: 500 });
  }
}
