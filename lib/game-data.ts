import type { CompanionRole, CompanionState, GearSlot, Rarity } from "./game-types";

export const REALMS = [
  "凡尘", "引灵", "凝元", "灵台", "御空", "化境", "归真", "星君", "天尊",
] as const;

export const ZONES = [
  { name: "青岚古道", subtitle: "雾锁山门", accent: "#75e6c2" },
  { name: "赤砂遗境", subtitle: "落日残城", accent: "#f3b66a" },
  { name: "玄冰天隙", subtitle: "永夜冰川", accent: "#86c9ff" },
  { name: "苍梧神墟", subtitle: "万木灵域", accent: "#9fda78" },
  { name: "九霄云宫", subtitle: "天门终境", accent: "#e8d28c" },
] as const;

export const ENEMIES = [
  "雾牙山魈", "噬灵藤", "青铜傀儡", "流火妖狐", "玄甲岩兽",
  "夜巡羽卫", "裂空螳螂", "幽泉蛇君", "天门守将", "无相古龙",
] as const;

export const SLOT_META: Record<GearSlot, { label: string; glyph: string }> = {
  weapon: { label: "灵刃", glyph: "◇" },
  armor: { label: "玄甲", glyph: "⬡" },
  ring: { label: "星戒", glyph: "○" },
  charm: { label: "灵符", glyph: "✦" },
};

export const RARITY_META: Record<Rarity, { label: string; color: string; multiplier: number }> = {
  common: { label: "凡品", color: "#9ba5ae", multiplier: 1 },
  rare: { label: "灵品", color: "#65b8ff", multiplier: 1.35 },
  epic: { label: "玄品", color: "#b98cff", multiplier: 1.8 },
  legendary: { label: "天品", color: "#ffc95c", multiplier: 2.5 },
};

export const ROLE_META: Record<CompanionRole, { label: string; short: string; color: string }> = {
  guardian: { label: "守御", short: "盾", color: "#7fc8ff" },
  healer: { label: "疗愈", short: "愈", color: "#82e5ae" },
  ranger: { label: "猎手", short: "猎", color: "#f2c878" },
  mage: { label: "术师", short: "术", color: "#c5a0ff" },
};

export const COMPANION_POOL: Omit<CompanionState, "level" | "stars" | "shards">[] = [
  { id: "comp-iron-mountain", name: "岩山", role: "guardian", rarity: "rare", basePower: 285, skillName: "撼岳嘲讽", glyph: "山" },
  { id: "comp-moon-healer", name: "月萝", role: "healer", rarity: "rare", basePower: 270, skillName: "月华回春", glyph: "月" },
  { id: "comp-wind-hunter", name: "追风", role: "ranger", rarity: "rare", basePower: 305, skillName: "连珠破空", glyph: "风" },
  { id: "comp-spark-mage", name: "萤火", role: "mage", rarity: "rare", basePower: 300, skillName: "星火燎原", glyph: "火" },
  { id: "comp-tide-warden", name: "沧澜", role: "guardian", rarity: "epic", basePower: 430, skillName: "潮生壁垒", glyph: "澜" },
  { id: "comp-dew-sage", name: "青露", role: "healer", rarity: "epic", basePower: 415, skillName: "万物复苏", glyph: "露" },
  { id: "comp-falcon", name: "飞翎", role: "ranger", rarity: "epic", basePower: 455, skillName: "苍穹箭雨", glyph: "翎" },
  { id: "comp-frost-mage", name: "霜弦", role: "mage", rarity: "epic", basePower: 448, skillName: "寒天封界", glyph: "霜" },
  { id: "comp-dragon-guard", name: "烛龙", role: "guardian", rarity: "legendary", basePower: 650, skillName: "龙魂不灭", glyph: "龙" },
  { id: "comp-sun-priest", name: "曦和", role: "healer", rarity: "legendary", basePower: 625, skillName: "曜日神愈", glyph: "曦" },
  { id: "comp-star-archer", name: "天狼", role: "ranger", rarity: "legendary", basePower: 690, skillName: "星落九天", glyph: "星" },
  { id: "comp-void-mage", name: "无相", role: "mage", rarity: "legendary", basePower: 680, skillName: "太虚湮灭", glyph: "虚" },
];

export const ITEM_NAMES: Record<GearSlot, string[]> = {
  weapon: ["青竹剑", "流云刃", "斩星剑", "太虚神锋"],
  armor: ["行者衣", "玄鳞甲", "星陨战衣", "九霄云铠"],
  ring: ["聚灵环", "流光戒", "天枢星戒", "乾坤道环"],
  charm: ["清心符", "护元玉", "镇岳灵印", "无相天符"],
};

export const formatNumber = (value: number) => {
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
  if (safe >= 1_000_000_000) return `${(safe / 1_000_000_000).toFixed(2)}B`;
  if (safe >= 1_000_000) return `${(safe / 1_000_000).toFixed(2)}M`;
  if (safe >= 10_000) return `${(safe / 1_000).toFixed(1)}K`;
  return Math.floor(safe).toLocaleString("zh-CN");
};

export const formatDuration = (seconds: number) => {
  const value = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const secs = value % 60;
  if (hours > 0) return `${hours}小时 ${minutes}分`;
  if (minutes > 0) return `${minutes}分 ${secs}秒`;
  return `${secs}秒`;
};
