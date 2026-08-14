export const GAME_SCHEMA_VERSION = 3;

export type GameTab = "home" | "adventure" | "hero" | "bag" | "quests";
export type GearSlot = "weapon" | "armor" | "ring" | "charm";
export type Rarity = "common" | "rare" | "epic" | "legendary";

export type EquipmentItem = {
  id: string;
  name: string;
  slot: GearSlot;
  rarity: Rarity;
  level: number;
  power: number;
  locked?: boolean;
};

export type SkillState = {
  id: "sword" | "guard" | "storm";
  name: string;
  description: string;
  level: number;
  maxLevel: number;
};

export type QuestState = {
  id: string;
  title: string;
  description: string;
  type: "daily" | "journey";
  progress: number;
  target: number;
  rewardGold: number;
  rewardJade: number;
  claimed: boolean;
};

export type GameState = {
  schemaVersion: number;
  profile: {
    name: string;
    title: string;
    level: number;
    xp: number;
    realm: number;
    realmName: string;
    power: number;
  };
  currencies: {
    gold: number;
    jade: number;
    essence: number;
    keys: number;
  };
  hero: {
    baseAttack: number;
    baseHealth: number;
    baseDefense: number;
    crit: number;
    skillPoints: number;
    skills: SkillState[];
  };
  equipment: {
    equipped: Record<GearSlot, string | null>;
    inventory: EquipmentItem[];
  };
  progress: {
    stage: number;
    bestStage: number;
    unlockedZone: number;
    autoChallenge: boolean;
    battleSpeed: 1 | 2;
  };
  idle: {
    lastClaimAt: number;
    lastSeenAt: number;
    maxHours: number;
  };
  quests: QuestState[];
  daily: {
    dayKey: string;
    loginClaimed: boolean;
    streak: number;
  };
  statistics: {
    wins: number;
    defeats: number;
    monstersDefeated: number;
    goldEarned: number;
    idleSecondsClaimed: number;
  };
  settings: {
    music: boolean;
    haptics: boolean;
    lowMotion: boolean;
  };
  lastSavedAt: number;
};

export type BattleResult = {
  victory: boolean;
  enemyName: string;
  enemyPower: number;
  gold: number;
  essence: number;
  xp: number;
  loot?: EquipmentItem;
  log: string[];
};

export type CloudSaveEnvelope = {
  state: GameState;
  revision: number;
  schemaVersion: number;
  serverTime: number;
  player: {
    id: string;
    displayName: string;
  };
};

export type SaveSnapshot = {
  id: string;
  revision: number;
  schemaVersion: number;
  reason: string;
  createdAt: number;
  stage: number;
  level: number;
  power: number;
};
