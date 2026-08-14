import type { GearSlot, Rarity } from "./game-types";

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
