import assert from "node:assert/strict";
import test from "node:test";
import {
  applyBattleResult,
  claimIdleReward,
  createDefaultGameState,
  idleReward,
  migrateGameState,
  simulateBattle,
  summonCompanions,
} from "../lib/game-state";
import { GAME_SCHEMA_VERSION } from "../lib/game-types";

test("new players receive a playable, internally consistent save", () => {
  const state = createDefaultGameState(1_000, "测试游侠");
  assert.equal(state.schemaVersion, GAME_SCHEMA_VERSION);
  assert.equal(state.profile.name, "测试游侠");
  assert.ok(state.profile.power > 0);
  assert.equal(state.equipment.inventory.length, 2);
  assert.equal(state.team.activeIds.length, 4);
  assert.equal(state.team.roster.length, 4);
  assert.equal(state.currencies.keys, 10);
  assert.equal(state.progress.stage, 1);
});

test("a deterministic victory advances the stage and preserves rewards", () => {
  const state = createDefaultGameState(1_000);
  const battle = simulateBattle(state, () => 0);
  assert.equal(battle.victory, true);
  const next = applyBattleResult(state, battle, 2_000);
  assert.equal(next.progress.stage, 2);
  assert.equal(next.statistics.wins, 1);
  assert.ok(next.currencies.gold > state.currencies.gold);
});

test("legacy saves migrate without losing player progress", () => {
  const legacy = {
    schemaVersion: 1,
    profile: { name: "旧档玩家", level: 18, xp: 30, realm: 2, power: 1 },
    currencies: { gold: 98_765, jade: 321, essence: 456, keys: 7 },
    progress: { stage: 42, bestStage: 41, unlockedZone: 3, autoChallenge: true, battleSpeed: 2 },
  };
  const migrated = migrateGameState(legacy, 10_000);
  assert.equal(migrated.schemaVersion, GAME_SCHEMA_VERSION);
  assert.equal(migrated.profile.name, "旧档玩家");
  assert.equal(migrated.profile.level, 18);
  assert.equal(migrated.currencies.gold, 98_765);
  assert.equal(migrated.progress.stage, 42);
  assert.ok(migrated.hero.skills.length >= 3);
  assert.equal(migrated.team.activeIds.length, 4);
  assert.equal(migrated.schemaVersion, 4);
});

test("offline rewards are capped and claimed exactly once", () => {
  const state = createDefaultGameState(0);
  const afterTwoDays = 48 * 60 * 60 * 1_000;
  const reward = idleReward(state, afterTwoDays);
  assert.equal(reward.seconds, 12 * 60 * 60);
  const claimed = claimIdleReward(state, afterTwoDays);
  assert.equal(claimed.idle.lastClaimAt, afterTwoDays);
  assert.ok(claimed.currencies.gold > state.currencies.gold);
  assert.equal(idleReward(claimed, afterTwoDays).seconds, 0);
});

test("ten-pull summons guarantee epic or better and persist duplicate shards", () => {
  const state = createDefaultGameState(1_000);
  const pulled = summonCompanions(state, 10, 2_000, () => 0.5);
  assert.equal(pulled.results.length, 10);
  assert.ok(pulled.results.some((result) => result.rarity === "epic" || result.rarity === "legendary"));
  assert.equal(pulled.state.currencies.keys, 0);
  assert.equal(pulled.state.statistics.summons, 10);
  assert.ok(pulled.state.team.roster.some((member) => member.shards > 0));
});
