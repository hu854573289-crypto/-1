import { COMPANION_POOL, ENEMIES, ITEM_NAMES, REALMS, RARITY_META } from "./game-data";
import {
  GAME_SCHEMA_VERSION,
  type BattleResult,
  type CompanionState,
  type EquipmentItem,
  type GameState,
  type GearSlot,
  type QuestState,
  type Rarity,
  type SummonResult,
} from "./game-types";

const slots: GearSlot[] = ["weapon", "armor", "ring", "charm"];
const rarities: Rarity[] = ["common", "rare", "epic", "legendary"];

export function dayKey(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function createDefaultGameState(now: number, name = "云游者"): GameState {
  const starterWeapon: EquipmentItem = {
    id: "starter-cloudblade",
    name: "青竹剑",
    slot: "weapon",
    rarity: "rare",
    level: 1,
    power: 68,
    locked: true,
  };
  const starterArmor: EquipmentItem = {
    id: "starter-traveler-coat",
    name: "行者衣",
    slot: "armor",
    rarity: "common",
    level: 1,
    power: 34,
    locked: true,
  };

  const starterTeam: CompanionState[] = COMPANION_POOL.slice(0, 4).map((member) => ({
    ...member,
    level: 1,
    stars: 1,
    shards: 0,
  }));

  const state: GameState = {
    schemaVersion: GAME_SCHEMA_VERSION,
    profile: {
      name: name.slice(0, 18) || "云游者",
      title: "初入云境",
      level: 1,
      xp: 0,
      realm: 0,
      realmName: REALMS[0],
      power: 0,
    },
    currencies: { gold: 1280, jade: 120, essence: 45, keys: 10 },
    hero: {
      baseAttack: 96,
      baseHealth: 920,
      baseDefense: 38,
      crit: 0.08,
      skillPoints: 1,
      skills: [
        { id: "sword", name: "流云剑诀", description: "造成强力单体伤害", level: 1, maxLevel: 12 },
        { id: "guard", name: "玄元护体", description: "降低战斗中受到的伤害", level: 1, maxLevel: 12 },
        { id: "storm", name: "万剑归潮", description: "周期性爆发并提高暴击", level: 0, maxLevel: 12 },
      ],
    },
    equipment: {
      equipped: { weapon: starterWeapon.id, armor: starterArmor.id, ring: null, charm: null },
      inventory: [starterWeapon, starterArmor],
    },
    team: { activeIds: starterTeam.map((member) => member.id), roster: starterTeam },
    summon: { pity: 0, totalPulls: 0, lastFreeDay: "", history: [] },
    bag: { forgeStones: 6, petFood: 3, skillScrolls: 2 },
    progress: { stage: 1, bestStage: 1, unlockedZone: 1, autoChallenge: true, battleSpeed: 1 },
    idle: { lastClaimAt: now, lastSeenAt: now, maxHours: 12 },
    quests: defaultQuests(),
    daily: { dayKey: dayKey(now), loginClaimed: false, streak: 1 },
    statistics: { wins: 0, defeats: 0, monstersDefeated: 0, goldEarned: 0, idleSecondsClaimed: 0, summons: 0 },
    settings: { music: false, haptics: true, lowMotion: false },
    lastSavedAt: now,
  };
  return recalculatePower(state);
}

function defaultQuests(): QuestState[] {
  return [
    { id: "daily-win", title: "巡山试炼", description: "击败 5 名敌人", type: "daily", progress: 0, target: 5, rewardGold: 650, rewardJade: 10, claimed: false },
    { id: "daily-forge", title: "淬炼灵器", description: "强化任意装备 2 次", type: "daily", progress: 0, target: 2, rewardGold: 400, rewardJade: 8, claimed: false },
    { id: "journey-10", title: "越过山门", description: "通关第 10 关", type: "journey", progress: 1, target: 10, rewardGold: 1800, rewardJade: 25, claimed: false },
    { id: "journey-power", title: "锋芒初现", description: "战力达到 2,000", type: "journey", progress: 0, target: 2000, rewardGold: 2200, rewardJade: 30, claimed: false },
  ];
}

export function xpNeeded(level: number) {
  return Math.floor(120 * Math.pow(1.16, Math.max(0, level - 1)));
}

export function heroUpgradeCost(level: number) {
  return Math.floor(180 * Math.pow(1.12, Math.max(0, level - 1)));
}

export function realmUpgradeCost(realm: number) {
  return Math.floor(90 * Math.pow(2.2, Math.max(0, realm)));
}

export function calculatePower(state: GameState) {
  const gearPower = state.equipment.inventory
    .filter((item) => state.equipment.equipped[item.slot] === item.id)
    .reduce((sum, item) => sum + item.power, 0);
  const skillPower = state.hero.skills.reduce((sum, skill) => sum + skill.level * 72, 0);
  const statPower = state.hero.baseAttack * 4.1 + state.hero.baseDefense * 2.8 + state.hero.baseHealth * 0.25;
  const teamPower = state.team.activeIds
    .map((id) => state.team.roster.find((member) => member.id === id))
    .filter((member): member is CompanionState => Boolean(member))
    .reduce((sum, member) => sum + companionPower(member), 0);
  return Math.max(1, Math.floor((statPower + gearPower + skillPower + teamPower) * (1 + state.profile.realm * 0.16)));
}

export function companionPower(member: CompanionState) {
  const rarity = RARITY_META[member.rarity].multiplier;
  return Math.floor(member.basePower * rarity * (1 + (member.level - 1) * 0.075) * (1 + (member.stars - 1) * 0.22));
}

export function recalculatePower(state: GameState): GameState {
  const power = calculatePower(state);
  const quests = state.quests.map((quest) => {
    if (quest.id === "journey-power") return { ...quest, progress: Math.min(quest.target, power) };
    if (quest.id === "journey-10") return { ...quest, progress: Math.min(quest.target, state.progress.bestStage) };
    return quest;
  });
  return { ...state, profile: { ...state.profile, power }, quests };
}

export function applyHeroUpgrade(state: GameState): GameState {
  const cost = heroUpgradeCost(state.profile.level);
  if (state.currencies.gold < cost) return state;
  const next = structuredClone(state);
  next.currencies.gold -= cost;
  next.profile.level += 1;
  next.hero.baseAttack += 18 + next.profile.level * 2;
  next.hero.baseHealth += 105 + next.profile.level * 6;
  next.hero.baseDefense += 5;
  if (next.profile.level % 5 === 0) next.hero.skillPoints += 1;
  next.team.roster.forEach((member) => { member.level = Math.max(member.level, next.profile.level); });
  return recalculatePower(next);
}

export function applyRealmUpgrade(state: GameState): GameState {
  const cost = realmUpgradeCost(state.profile.realm);
  if (state.currencies.essence < cost || state.profile.realm >= REALMS.length - 1) return state;
  const next = structuredClone(state);
  next.currencies.essence -= cost;
  next.profile.realm += 1;
  next.profile.realmName = REALMS[next.profile.realm];
  next.profile.title = next.profile.realm >= 4 ? "御空巡天" : next.profile.realm >= 2 ? "灵台行者" : "引灵修士";
  next.hero.baseAttack = Math.floor(next.hero.baseAttack * 1.2);
  next.hero.baseHealth = Math.floor(next.hero.baseHealth * 1.2);
  next.hero.baseDefense = Math.floor(next.hero.baseDefense * 1.18);
  next.hero.skillPoints += 2;
  return recalculatePower(next);
}

export function upgradeSkill(state: GameState, skillId: string): GameState {
  const skill = state.hero.skills.find((item) => item.id === skillId);
  if (!skill || state.hero.skillPoints <= 0 || skill.level >= skill.maxLevel) return state;
  const next = structuredClone(state);
  const target = next.hero.skills.find((item) => item.id === skillId)!;
  target.level += 1;
  next.hero.skillPoints -= 1;
  return recalculatePower(next);
}

export function enemyPowerForStage(stage: number) {
  const base = 760 * Math.pow(1.115, Math.max(0, stage - 1));
  return Math.floor(base * (stage % 5 === 0 ? 1.28 : 1));
}

export function enemyForStage(stage: number) {
  return stage % 5 === 0 ? `${ENEMIES[(Math.floor(stage / 5) + 7) % ENEMIES.length]}·首领` : ENEMIES[(stage - 1) % ENEMIES.length];
}

export function simulateBattle(state: GameState, random = Math.random): BattleResult {
  const stage = state.progress.stage;
  const enemyPower = enemyPowerForStage(stage);
  const ratio = state.profile.power / enemyPower;
  const victoryChance = Math.max(0.08, Math.min(0.98, 0.45 + (ratio - 1) * 0.7));
  const victory = ratio >= 1.3 || random() < victoryChance;
  const enemyName = enemyForStage(stage);
  if (!victory) {
    return { victory: false, enemyName, enemyPower, gold: 0, essence: 0, xp: 0, log: [`${enemyName} 撕开了护体灵光`, "灵息耗尽，已返回营地调息"] };
  }
  const boss = stage % 5 === 0;
  const gold = Math.floor((48 + stage * 14) * (boss ? 2.8 : 1));
  const essence = Math.floor((3 + stage * 0.8) * (boss ? 2 : 1));
  const xp = Math.floor(28 + stage * 6);
  const loot = random() < (boss ? 0.62 : 0.12) ? generateLoot(stage, random) : undefined;
  return {
    victory: true,
    enemyName,
    enemyPower,
    gold,
    essence,
    xp,
    loot,
    log: ["流云剑诀命中要害", boss ? "首领灵核崩解" : `${enemyName} 已被净化`, loot ? `获得 ${loot.name}` : `获得 ${gold} 铜钱`],
  };
}

export function applyBattleResult(state: GameState, result: BattleResult, now: number): GameState {
  const next = structuredClone(state);
  next.idle.lastSeenAt = now;
  if (!result.victory) {
    next.statistics.defeats += 1;
    return next;
  }
  next.currencies.gold += result.gold;
  next.currencies.essence += result.essence;
  next.profile.xp += result.xp;
  while (next.profile.xp >= xpNeeded(next.profile.level)) {
    next.profile.xp -= xpNeeded(next.profile.level);
    next.profile.level += 1;
    next.hero.baseAttack += 10;
    next.hero.baseHealth += 62;
    next.hero.baseDefense += 3;
    if (next.profile.level % 5 === 0) next.hero.skillPoints += 1;
    next.team.roster.forEach((member) => { member.level = Math.max(member.level, next.profile.level); });
  }
  next.statistics.wins += 1;
  next.statistics.monstersDefeated += 1;
  next.statistics.goldEarned += result.gold;
  next.progress.bestStage = Math.max(next.progress.bestStage, next.progress.stage);
  next.progress.stage += 1;
  next.progress.unlockedZone = Math.min(5, Math.max(next.progress.unlockedZone, Math.ceil(next.progress.stage / 20)));
  if (result.loot) next.equipment.inventory.unshift(result.loot);
  next.bag.forgeStones += result.victory && next.progress.stage % 5 === 0 ? 2 : result.victory && next.progress.stage % 3 === 0 ? 1 : 0;
  next.bag.petFood += result.victory && next.progress.stage % 10 === 0 ? 1 : 0;
  next.quests = next.quests.map((quest) => quest.id === "daily-win" ? { ...quest, progress: Math.min(quest.target, quest.progress + 1) } : quest);
  return recalculatePower(next);
}

export function generateLoot(stage: number, random = Math.random): EquipmentItem {
  const slot = slots[Math.floor(random() * slots.length)];
  const roll = random();
  const rarity: Rarity = roll > 0.985 ? "legendary" : roll > 0.9 ? "epic" : roll > 0.52 ? "rare" : "common";
  const rarityIndex = rarities.indexOf(rarity);
  const level = Math.max(1, Math.ceil(stage / 3));
  const power = Math.floor((42 + level * 17) * RARITY_META[rarity].multiplier);
  return {
    id: `loot-${Date.now()}-${Math.floor(random() * 1_000_000)}`,
    name: ITEM_NAMES[slot][rarityIndex],
    slot,
    rarity,
    level,
    power,
  };
}

export function equipItem(state: GameState, itemId: string): GameState {
  const item = state.equipment.inventory.find((entry) => entry.id === itemId);
  if (!item) return state;
  const next = structuredClone(state);
  next.equipment.equipped[item.slot] = item.id;
  return recalculatePower(next);
}

export function equipBest(state: GameState): GameState {
  const next = structuredClone(state);
  for (const slot of slots) {
    const best = next.equipment.inventory.filter((item) => item.slot === slot).sort((a, b) => b.power - a.power)[0];
    if (best) next.equipment.equipped[slot] = best.id;
  }
  return recalculatePower(next);
}

export function forgeEquipment(state: GameState, itemId: string): GameState {
  const source = state.equipment.inventory.find((item) => item.id === itemId);
  if (!source) return state;
  const cost = Math.floor(120 * Math.pow(1.14, source.level - 1));
  if (state.currencies.gold < cost) return state;
  const next = structuredClone(state);
  next.currencies.gold -= cost;
  const target = next.equipment.inventory.find((item) => item.id === itemId)!;
  target.level += 1;
  target.power = Math.floor(target.power * 1.16 + 8);
  next.quests = next.quests.map((quest) => quest.id === "daily-forge" ? { ...quest, progress: Math.min(quest.target, quest.progress + 1) } : quest);
  return recalculatePower(next);
}

export function canFreeSummon(state: GameState, now: number) {
  return state.summon.lastFreeDay !== dayKey(now);
}

export type SummonBatch = { state: GameState; results: SummonResult[]; error?: "currency" | "count" };

export function summonCompanions(state: GameState, count: 1 | 10, now: number, random = Math.random): SummonBatch {
  if (count !== 1 && count !== 10) return { state, results: [], error: "count" };
  const free = count === 1 && canFreeSummon(state, now);
  const jadeCost = count === 10 ? 1080 : 120;
  const useKeys = !free && state.currencies.keys >= count;
  if (!free && !useKeys && state.currencies.jade < jadeCost) return { state, results: [], error: "currency" };

  const next = structuredClone(state);
  if (free) next.summon.lastFreeDay = dayKey(now);
  else if (useKeys) next.currencies.keys -= count;
  else next.currencies.jade -= jadeCost;

  const results: SummonResult[] = [];
  for (let index = 0; index < count; index += 1) {
    next.summon.pity += 1;
    const guaranteedLegendary = next.summon.pity >= 80;
    const tenGuarantee = count === 10 && index === 9 && !results.some((result) => result.rarity === "epic" || result.rarity === "legendary");
    const roll = random();
    const rarity: Rarity = guaranteedLegendary || roll < 0.02 ? "legendary" : tenGuarantee || roll < 0.14 ? "epic" : "rare";
    if (rarity === "legendary") next.summon.pity = 0;
    const pool = COMPANION_POOL.filter((member) => member.rarity === rarity);
    const template = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
    const existing = next.team.roster.find((member) => member.id === template.id);
    const shards = rarity === "legendary" ? 40 : rarity === "epic" ? 20 : 10;
    if (existing) existing.shards += shards;
    else next.team.roster.push({ ...template, level: next.profile.level, stars: 1, shards: 0 });
    results.push({ id: template.id, name: template.name, role: template.role, rarity, glyph: template.glyph, isNew: !existing, shards: existing ? shards : 0 });
  }
  next.summon.totalPulls += count;
  next.statistics.summons += count;
  next.summon.history = [...results.reverse(), ...next.summon.history].slice(0, 30);
  return { state: recalculatePower(next), results: results.reverse() };
}

export function setActiveCompanion(state: GameState, companionId: string): GameState {
  const target = state.team.roster.find((member) => member.id === companionId);
  if (!target || state.team.activeIds.includes(companionId)) return state;
  const next = structuredClone(state);
  const sameRoleIndex = next.team.activeIds.findIndex((id) => next.team.roster.find((member) => member.id === id)?.role === target.role);
  if (sameRoleIndex >= 0) next.team.activeIds[sameRoleIndex] = companionId;
  else if (next.team.activeIds.length < 4) next.team.activeIds.push(companionId);
  else {
    const weakestIndex = next.team.activeIds.reduce((weakest, id, index, ids) => {
      const power = companionPower(next.team.roster.find((member) => member.id === id)!);
      const weakestPower = companionPower(next.team.roster.find((member) => member.id === ids[weakest])!);
      return power < weakestPower ? index : weakest;
    }, 0);
    next.team.activeIds[weakestIndex] = companionId;
  }
  return recalculatePower(next);
}

export function upgradeCompanionStar(state: GameState, companionId: string): GameState {
  const source = state.team.roster.find((member) => member.id === companionId);
  if (!source || source.stars >= 6) return state;
  const cost = source.stars * 20;
  if (source.shards < cost) return state;
  const next = structuredClone(state);
  const target = next.team.roster.find((member) => member.id === companionId)!;
  target.shards -= cost;
  target.stars += 1;
  return recalculatePower(next);
}

export function claimQuest(state: GameState, questId: string): GameState {
  const quest = state.quests.find((item) => item.id === questId);
  if (!quest || quest.claimed || quest.progress < quest.target) return state;
  const next = structuredClone(state);
  const target = next.quests.find((item) => item.id === questId)!;
  target.claimed = true;
  next.currencies.gold += target.rewardGold;
  next.currencies.jade += target.rewardJade;
  return next;
}

export function claimDailyLogin(state: GameState): GameState {
  if (state.daily.loginClaimed) return state;
  const next = structuredClone(state);
  next.daily.loginClaimed = true;
  next.currencies.jade += 30;
  next.currencies.gold += 600;
  return next;
}

export function idleReward(state: GameState, now: number) {
  const seconds = Math.max(0, Math.min(state.idle.maxHours * 3600, Math.floor((now - state.idle.lastClaimAt) / 1000)));
  const rate = 8 + state.progress.bestStage * 1.35;
  return {
    seconds,
    gold: Math.floor(seconds * rate / 60),
    essence: Math.floor(seconds * (0.16 + state.progress.bestStage * 0.012) / 60),
  };
}

export function claimIdleReward(state: GameState, now: number): GameState {
  const reward = idleReward(state, now);
  if (reward.seconds < 2) return state;
  const next = structuredClone(state);
  next.currencies.gold += reward.gold;
  next.currencies.essence += reward.essence;
  next.statistics.goldEarned += reward.gold;
  next.statistics.idleSecondsClaimed += reward.seconds;
  next.idle.lastClaimAt = now;
  next.idle.lastSeenAt = now;
  return next;
}

export function refreshDaily(state: GameState, now: number): GameState {
  const key = dayKey(now);
  if (state.daily.dayKey === key) return state;
  const next = structuredClone(state);
  next.daily = { dayKey: key, loginClaimed: false, streak: Math.min(7, state.daily.streak + 1) };
  next.quests = next.quests.map((quest) => quest.type === "daily" ? { ...quest, progress: 0, claimed: false } : quest);
  return next;
}

export function migrateGameState(input: unknown, now: number, fallbackName = "云游者"): GameState {
  const fallback = createDefaultGameState(now, fallbackName);
  if (!input || typeof input !== "object") return fallback;
  const raw = input as Partial<GameState>;
  const merged: GameState = {
    ...fallback,
    ...raw,
    profile: { ...fallback.profile, ...(raw.profile ?? {}) },
    currencies: { ...fallback.currencies, ...(raw.currencies ?? {}) },
    hero: { ...fallback.hero, ...(raw.hero ?? {}), skills: Array.isArray(raw.hero?.skills) ? raw.hero!.skills : fallback.hero.skills },
    equipment: {
      equipped: { ...fallback.equipment.equipped, ...(raw.equipment?.equipped ?? {}) },
      inventory: Array.isArray(raw.equipment?.inventory) ? raw.equipment!.inventory.slice(0, 250) : fallback.equipment.inventory,
    },
    team: {
      activeIds: Array.isArray(raw.team?.activeIds) ? raw.team!.activeIds.slice(0, 4) : fallback.team.activeIds,
      roster: Array.isArray(raw.team?.roster) ? raw.team!.roster.slice(0, 80) : fallback.team.roster,
    },
    summon: {
      ...fallback.summon,
      ...(raw.summon ?? {}),
      history: Array.isArray(raw.summon?.history) ? raw.summon!.history.slice(0, 30) : fallback.summon.history,
    },
    bag: { ...fallback.bag, ...(raw.bag ?? {}) },
    progress: { ...fallback.progress, ...(raw.progress ?? {}) },
    idle: { ...fallback.idle, ...(raw.idle ?? {}) },
    quests: Array.isArray(raw.quests) ? raw.quests : fallback.quests,
    daily: { ...fallback.daily, ...(raw.daily ?? {}) },
    statistics: { ...fallback.statistics, ...(raw.statistics ?? {}) },
    settings: { ...fallback.settings, ...(raw.settings ?? {}) },
    schemaVersion: GAME_SCHEMA_VERSION,
    lastSavedAt: finite(raw.lastSavedAt, now),
  };
  merged.profile.level = clampInt(merged.profile.level, 1, 999);
  merged.profile.realm = clampInt(merged.profile.realm, 0, REALMS.length - 1);
  merged.profile.realmName = REALMS[merged.profile.realm];
  merged.progress.stage = clampInt(merged.progress.stage, 1, 100_000);
  merged.progress.bestStage = clampInt(Math.max(merged.progress.bestStage, merged.progress.stage - 1), 1, 100_000);
  merged.progress.unlockedZone = clampInt(merged.progress.unlockedZone, 1, 5);
  merged.currencies.gold = clampInt(merged.currencies.gold, 0, 2_000_000_000);
  merged.currencies.jade = clampInt(merged.currencies.jade, 0, 10_000_000);
  merged.currencies.essence = clampInt(merged.currencies.essence, 0, 1_000_000_000);
  merged.currencies.keys = clampInt(merged.currencies.keys, 0, 1_000_000);
  merged.hero.skillPoints = clampInt(merged.hero.skillPoints, 0, 10_000);
  merged.summon.pity = clampInt(merged.summon.pity, 0, 79);
  merged.summon.totalPulls = clampInt(merged.summon.totalPulls, 0, 10_000_000);
  merged.statistics.summons = clampInt(merged.statistics.summons, 0, 10_000_000);
  merged.bag.forgeStones = clampInt(merged.bag.forgeStones, 0, 10_000_000);
  merged.bag.petFood = clampInt(merged.bag.petFood, 0, 10_000_000);
  merged.bag.skillScrolls = clampInt(merged.bag.skillScrolls, 0, 10_000_000);
  merged.team.roster = merged.team.roster.filter((member) => member && typeof member.id === "string").map((member) => ({
    ...member,
    level: clampInt(member.level, 1, 999),
    stars: clampInt(member.stars, 1, 6),
    shards: clampInt(member.shards, 0, 1_000_000),
    basePower: clampInt(member.basePower, 1, 1_000_000),
  }));
  if (merged.team.roster.length < 4) merged.team = fallback.team;
  const rosterIds = new Set(merged.team.roster.map((member) => member.id));
  merged.team.activeIds = merged.team.activeIds.filter((id) => rosterIds.has(id)).slice(0, 4);
  for (const member of merged.team.roster) {
    if (merged.team.activeIds.length >= 4) break;
    if (!merged.team.activeIds.includes(member.id)) merged.team.activeIds.push(member.id);
  }
  return recalculatePower(refreshDaily(merged, now));
}

function finite(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clampInt(value: unknown, min: number, max: number) {
  const number = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : min;
  return Math.min(max, Math.max(min, number));
}
