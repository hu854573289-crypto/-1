import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { gameSaves, saveSnapshots } from "@/db/schema";
import { createDefaultGameState, migrateGameState } from "@/lib/game-state";
import { GAME_SCHEMA_VERSION } from "@/lib/game-types";
import {
  checksumJson,
  cleanName,
  cleanReason,
  createSnapshot,
  ensurePlayer,
  getPlayerIdentity,
  parseStateJson,
  saveLeaderboard,
  shouldSnapshot,
} from "@/lib/server/game-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const identity = await getPlayerIdentity();
  if (!identity) return json({ error: "sign_in_required" }, 401);
  const now = Date.now();
  try {
    await ensurePlayer(identity, now);
    const db = getDb();
    let [save] = await db.select().from(gameSaves).where(and(eq(gameSaves.playerId, identity.id), eq(gameSaves.slot, 1))).limit(1);

    if (!save) {
      const state = createDefaultGameState(now, identity.displayName);
      const stateJson = JSON.stringify(state);
      const checksum = await checksumJson(stateJson);
      await db.insert(gameSaves).values({
        id: `save_${identity.id}_1`, playerId: identity.id, slot: 1, revision: 0,
        schemaVersion: GAME_SCHEMA_VERSION, stateJson, checksum, createdAt: now, updatedAt: now,
      });
      await saveLeaderboard(identity, state, now);
      return json({ state, revision: 0, schemaVersion: GAME_SCHEMA_VERSION, serverTime: now, player: identity });
    }

    let raw = parseStateJson(save.stateJson);
    const saveChecksum = await checksumJson(save.stateJson);
    if (saveChecksum !== save.checksum || !raw || typeof raw !== "object") {
      const candidates = await db.select().from(saveSnapshots).where(eq(saveSnapshots.playerId, identity.id)).orderBy(desc(saveSnapshots.createdAt)).limit(12);
      let recovered: unknown = null;
      for (const candidate of candidates) {
        const candidateRaw = parseStateJson(candidate.stateJson);
        if (candidateRaw && typeof candidateRaw === "object" && await checksumJson(candidate.stateJson) === candidate.checksum) {
          recovered = candidateRaw;
          break;
        }
      }
      if (!recovered) return json({ error: "save_integrity_failed" }, 503);
      const recoveredState = migrateGameState(recovered, now, identity.displayName);
      const recoveredJson = JSON.stringify(recoveredState);
      const recoveredChecksum = await checksumJson(recoveredJson);
      const [updated] = await db.update(gameSaves).set({
        revision: sql`${gameSaves.revision} + 1`, schemaVersion: GAME_SCHEMA_VERSION,
        stateJson: recoveredJson, checksum: recoveredChecksum, updatedAt: now,
      }).where(and(eq(gameSaves.id, save.id), eq(gameSaves.revision, save.revision))).returning();
      if (!updated) return json({ error: "revision_conflict" }, 409);
      save = updated;
      raw = recoveredState;
    }
    const state = migrateGameState(raw, now, identity.displayName);
    const rawVersion = raw && typeof raw === "object" && "schemaVersion" in raw ? Number((raw as { schemaVersion?: unknown }).schemaVersion) : save.schemaVersion;
    if (save.schemaVersion < GAME_SCHEMA_VERSION || rawVersion < GAME_SCHEMA_VERSION) {
      const migratedJson = JSON.stringify(state);
      const migratedChecksum = await checksumJson(migratedJson);
      const oldState = migrateGameState(raw, save.updatedAt, identity.displayName);
      await createSnapshot({ playerId: identity.id, revision: save.revision, schemaVersion: save.schemaVersion, reason: "migration", stateJson: save.stateJson, checksum: save.checksum, state: oldState, now });
      const [updated] = await db.update(gameSaves).set({
        revision: sql`${gameSaves.revision} + 1`, schemaVersion: GAME_SCHEMA_VERSION,
        stateJson: migratedJson, checksum: migratedChecksum, updatedAt: now,
      }).where(and(eq(gameSaves.id, save.id), eq(gameSaves.revision, save.revision))).returning();
      if (updated) save = updated;
      await saveLeaderboard(identity, state, now);
    }

    return json({ state, revision: save.revision, schemaVersion: GAME_SCHEMA_VERSION, serverTime: now, player: identity });
  } catch (error) {
    return json({ error: "cloud_read_failed", detail: safeError(error) }, 500);
  }
}

export async function PUT(request: Request) {
  const identity = await getPlayerIdentity();
  if (!identity) return json({ error: "sign_in_required" }, 401);
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 600_000) return json({ error: "save_too_large" }, 413);
  const now = Date.now();
  try {
    const payload = await request.json() as { state?: unknown; expectedRevision?: unknown; reason?: unknown };
    const expectedRevision = Number(payload.expectedRevision);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) return json({ error: "invalid_revision" }, 400);
    const reason = cleanReason(payload.reason);
    const state = migrateGameState(payload.state, now, identity.displayName);
    state.profile.name = cleanName(state.profile.name || identity.displayName);
    state.idle.lastSeenAt = now;
    state.lastSavedAt = now;
    const stateJson = JSON.stringify(state);
    if (stateJson.length > 550_000) return json({ error: "save_too_large" }, 413);
    const checksum = await checksumJson(stateJson);
    await ensurePlayer(identity, now);
    const db = getDb();
    const [current] = await db.select().from(gameSaves).where(and(eq(gameSaves.playerId, identity.id), eq(gameSaves.slot, 1))).limit(1);
    if (!current) return json({ error: "save_not_initialized" }, 409);
    if (current.revision !== expectedRevision) {
      try {
        await createSnapshot({
          playerId: identity.id, revision: expectedRevision, schemaVersion: GAME_SCHEMA_VERSION,
          reason: "conflict-backup", stateJson, checksum, state, now,
        });
      } catch { /* Preserve the live remote save even when conflict backup is unavailable. */ }
      return json({ error: "revision_conflict", currentRevision: current.revision }, 409);
    }

    const nextRevision = current.revision + 1;
    const [updated] = await db.update(gameSaves).set({
      revision: sql`${gameSaves.revision} + 1`, schemaVersion: GAME_SCHEMA_VERSION,
      stateJson, checksum, updatedAt: now,
    }).where(and(eq(gameSaves.id, current.id), eq(gameSaves.revision, expectedRevision))).returning({ revision: gameSaves.revision });
    if (!updated) return json({ error: "revision_conflict" }, 409);

    const previousState = migrateGameState(parseStateJson(current.stateJson), current.updatedAt, identity.displayName);
    const crossedMilestone = Math.floor(state.progress.bestStage / 10) > Math.floor(previousState.progress.bestStage / 10);
    if (shouldSnapshot(nextRevision, reason) || crossedMilestone) {
      try {
        await createSnapshot({
          playerId: identity.id, revision: current.revision, schemaVersion: current.schemaVersion,
          reason: crossedMilestone ? "milestone" : reason, stateJson: current.stateJson, checksum: current.checksum,
          state: previousState, now,
        });
      } catch { /* The live save remains valid even if snapshot rotation is delayed. */ }
    }
    try { await saveLeaderboard(identity, state, now); } catch { /* Ranking is non-authoritative. */ }
    return json({ revision: updated.revision, schemaVersion: GAME_SCHEMA_VERSION, serverTime: now, checksum });
  } catch (error) {
    return json({ error: "cloud_write_failed", detail: safeError(error) }, 500);
  }
}

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status, headers: { "cache-control": "no-store" } });
}

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "unknown";
  if (message.includes("no such table")) return "database_migration_pending";
  return "unexpected_storage_error";
}
