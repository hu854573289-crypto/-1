import { getDb, getD1 } from "@/db";
import { leaderboard, players, saveSnapshots } from "@/db/schema";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import type { GameState } from "@/lib/game-types";

export type PlayerIdentity = { id: string; displayName: string };

export async function getPlayerIdentity(): Promise<PlayerIdentity | null> {
  const user = await getChatGPTUser();
  if (!user) return null;
  const digest = await sha256(user.email.trim().toLowerCase());
  return { id: `usr_${digest.slice(0, 32)}`, displayName: cleanName(user.displayName) };
}

export async function ensurePlayer(identity: PlayerIdentity, now: number) {
  await getDb().insert(players).values({
    id: identity.id,
    displayName: identity.displayName,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: players.id,
    set: { displayName: identity.displayName, updatedAt: now },
  });
}

export async function saveLeaderboard(identity: PlayerIdentity, state: GameState, now: number) {
  await getDb().insert(leaderboard).values({
    playerId: identity.id,
    displayName: cleanName(state.profile.name || identity.displayName),
    power: state.profile.power,
    stage: state.progress.bestStage,
    level: state.profile.level,
    realm: state.profile.realm,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: leaderboard.playerId,
    set: {
      displayName: cleanName(state.profile.name || identity.displayName),
      power: state.profile.power,
      stage: state.progress.bestStage,
      level: state.profile.level,
      realm: state.profile.realm,
      updatedAt: now,
    },
  });
}

export async function createSnapshot(input: {
  playerId: string;
  revision: number;
  schemaVersion: number;
  reason: string;
  stateJson: string;
  checksum: string;
  state: GameState;
  now: number;
}) {
  await getDb().insert(saveSnapshots).values({
    id: `snap_${crypto.randomUUID()}`,
    playerId: input.playerId,
    revision: input.revision,
    schemaVersion: input.schemaVersion,
    reason: cleanReason(input.reason),
    stateJson: input.stateJson,
    checksum: input.checksum,
    stage: input.state.progress.bestStage,
    level: input.state.profile.level,
    power: input.state.profile.power,
    createdAt: input.now,
  });
  await pruneSnapshots(input.playerId);
}

export async function pruneSnapshots(playerId: string) {
  await getD1().prepare(`
    DELETE FROM save_snapshots
    WHERE player_id = ?1
      AND id NOT IN (
        SELECT id FROM save_snapshots
        WHERE player_id = ?2
        ORDER BY created_at DESC
        LIMIT 12
      )
  `).bind(playerId, playerId).run();
}

export function cleanName(value: string) {
  const text = String(value || "云游者").replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, 18);
  return text || "云游者";
}

export function cleanReason(value: unknown) {
  const allowed = new Set(["autosave", "background", "idle-claim", "realm-upgrade", "summon", "milestone", "manual-restore", "migration", "initial", "conflict-backup", "integrity-recovery"]);
  const reason = typeof value === "string" ? value.slice(0, 32) : "autosave";
  return allowed.has(reason) ? reason : "autosave";
}

export function shouldSnapshot(revision: number, reason: string) {
  return revision % 150 === 0 || ["realm-upgrade", "milestone", "manual-restore", "migration", "integrity-recovery"].includes(reason);
}

export async function checksumJson(json: string) {
  return sha256(json);
}

export function parseStateJson(json: string): unknown {
  try { return JSON.parse(json); } catch { return null; }
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
