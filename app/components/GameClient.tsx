/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyBattleResult,
  applyHeroUpgrade,
  applyRealmUpgrade,
  claimDailyLogin,
  claimIdleReward,
  claimQuest,
  createDefaultGameState,
  enemyForStage,
  enemyPowerForStage,
  equipBest,
  equipItem,
  forgeEquipment,
  heroUpgradeCost,
  idleReward,
  migrateGameState,
  realmUpgradeCost,
  simulateBattle,
  upgradeSkill,
  xpNeeded,
} from "@/lib/game-state";
import { formatDuration, formatNumber, RARITY_META, SLOT_META, ZONES } from "@/lib/game-data";
import type { BattleResult, CloudSaveEnvelope, GameState, GameTab, SaveSnapshot } from "@/lib/game-types";

const STORAGE_KEY = "cloudrealm-save-v3";
const TAB_META: { id: GameTab; icon: string; label: string }[] = [
  { id: "home", icon: "⌂", label: "云城" },
  { id: "adventure", icon: "⚔", label: "远征" },
  { id: "hero", icon: "◆", label: "修行" },
  { id: "bag", icon: "▣", label: "行囊" },
  { id: "quests", icon: "☷", label: "征途" },
];

type Props = {
  player: { displayName: string } | null;
};

type CloudStatus = "guest" | "loading" | "synced" | "saving" | "offline" | "conflict";

export default function GameClient({ player }: Props) {
  const initial = useMemo(() => createDefaultGameState(0, player?.displayName ?? "云游者"), [player?.displayName]);
  const [state, setState] = useState<GameState>(initial);
  const [clock, setClock] = useState(0);
  const [tab, setTab] = useState<GameTab>("home");
  const [ready, setReady] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>(player ? "loading" : "guest");
  const [battle, setBattle] = useState<BattleResult | null>(null);
  const [battleRound, setBattleRound] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"cloud" | "settings" | "leaderboard" | null>(null);
  const [offlineOpen, setOfflineOpen] = useState(false);
  const [questType, setQuestType] = useState<"daily" | "journey">("daily");
  const [snapshots, setSnapshots] = useState<SaveSnapshot[]>([]);
  const [leaders, setLeaders] = useState<{ rank: number; name: string; power: number; stage: number; level: number }[]>([]);
  const revisionRef = useRef(0);
  const stateRef = useRef(state);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { stateRef.current = state; }, [state]);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const vibrate = useCallback(() => {
    if (stateRef.current.settings.haptics && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(18);
  }, []);

  const mutate = useCallback((recipe: (current: GameState) => GameState, message?: string) => {
    setState((current) => {
      const next = recipe(current);
      if (next !== current) {
        dirtyRef.current = true;
        stateRef.current = next;
      }
      return next;
    });
    if (message) notify(message);
    vibrate();
  }, [notify, vibrate]);

  const loadCloud = useCallback(async () => {
    if (!player) return false;
    try {
      setCloudStatus("loading");
      const response = await fetch("/api/game", { cache: "no-store" });
      if (!response.ok) throw new Error("cloud unavailable");
      const payload = await response.json() as CloudSaveEnvelope;
      const loaded = migrateGameState(payload.state, payload.serverTime, payload.player.displayName);
      setClock(payload.serverTime);
      revisionRef.current = payload.revision;
      setState(loaded);
      stateRef.current = loaded;
      dirtyRef.current = false;
      setCloudStatus("synced");
      if (idleReward(loaded, payload.serverTime).seconds >= 60) setOfflineOpen(true);
      return true;
    } catch {
      setCloudStatus("offline");
      return false;
    }
  }, [player]);

  const saveCloud = useCallback(async (reason = "autosave") => {
    if (!player || savingRef.current || !dirtyRef.current) return;
    savingRef.current = true;
    setCloudStatus("saving");
    const candidate = { ...stateRef.current, lastSavedAt: Date.now() };
    try {
      const response = await fetch("/api/game", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state: candidate, expectedRevision: revisionRef.current, reason }),
      });
      if (response.status === 409) {
        setCloudStatus("conflict");
        notify("检测到另一设备的新进度，正在安全合并");
        await loadCloud();
        return;
      }
      if (!response.ok) throw new Error("save failed");
      const payload = await response.json() as { revision: number };
      revisionRef.current = payload.revision;
      dirtyRef.current = false;
      setCloudStatus("synced");
    } catch {
      setCloudStatus("offline");
    } finally {
      savingRef.current = false;
    }
  }, [loadCloud, notify, player]);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      let loadedFromCloud = false;
      if (player) loadedFromCloud = await loadCloud();
      if (!loadedFromCloud && !cancelled) {
        let loadedLocal = false;
        try {
          const cached = localStorage.getItem(STORAGE_KEY);
          if (cached) {
            const local = migrateGameState(JSON.parse(cached), Date.now(), player?.displayName ?? "云游者");
            setState(local);
            stateRef.current = local;
            loadedLocal = true;
            if (idleReward(local, Date.now()).seconds >= 60) setOfflineOpen(true);
          }
        } catch { localStorage.removeItem(STORAGE_KEY); }
        if (!loadedLocal) {
          const fresh = createDefaultGameState(Date.now(), player?.displayName ?? "云游者");
          setState(fresh);
          stateRef.current = fresh;
        }
      }
      if (!cancelled) { setClock(Date.now()); setReady(true); }
      if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    boot();
    return () => { cancelled = true; };
  }, [loadCloud, player]);

  useEffect(() => {
    if (!ready) return;
    const interval = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [ready, state]);

  useEffect(() => {
    if (!ready || !player) return;
    const interval = setInterval(() => void saveCloud("autosave"), 8000);
    const onVisibility = () => { if (document.visibilityState === "hidden") void saveCloud("background"); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVisibility); };
  }, [player, ready, saveCloud]);

  useEffect(() => {
    if (!ready || !state.progress.autoChallenge) return;
    const duration = state.progress.battleSpeed === 2 ? 1750 : 3200;
    const timer = setTimeout(() => {
      const result = simulateBattle(stateRef.current);
      setBattle(result);
      setBattleRound((round) => round + 1);
      mutate((current) => applyBattleResult(current, result, Date.now()));
      if (result.loot) notify(`灵光乍现：${result.loot.name}`);
    }, duration);
    return () => clearTimeout(timer);
  }, [battleRound, mutate, notify, ready, state.progress.autoChallenge, state.progress.battleSpeed]);

  const currentZone = ZONES[Math.min(ZONES.length - 1, Math.floor((state.progress.stage - 1) / 20))];
  const nextEnemyPower = enemyPowerForStage(state.progress.stage);
  const reward = idleReward(state, clock);
  const syncLabel = cloudStatus === "synced" ? "云端已同步" : cloudStatus === "saving" ? "正在保存" : cloudStatus === "loading" ? "加载云存档" : cloudStatus === "guest" ? "游客存档" : cloudStatus === "conflict" ? "正在合并" : "离线保护中";

  function claimIdle() {
    const before = idleReward(stateRef.current, Date.now());
    mutate((current) => claimIdleReward(current, Date.now()), `领取 ${formatNumber(before.gold)} 铜钱 · ${before.essence} 灵蕴`);
    setOfflineOpen(false);
    void saveCloud("idle-claim");
  }

  async function openCloud() {
    setSheet("cloud");
    if (!player) return;
    try {
      const response = await fetch("/api/game/snapshots", { cache: "no-store" });
      const payload = await response.json() as { snapshots?: SaveSnapshot[] };
      setSnapshots(payload.snapshots ?? []);
    } catch { notify("暂时无法读取存档历史"); }
  }

  async function openLeaderboard() {
    setSheet("leaderboard");
    try {
      const response = await fetch("/api/leaderboard", { cache: "no-store" });
      const payload = await response.json() as { leaders?: typeof leaders };
      setLeaders(payload.leaders ?? []);
    } catch { notify("排行榜暂未连接"); }
  }

  async function restoreSnapshot(id: string) {
    if (!player || !confirm("恢复后，当前进度也会先自动备份。确定继续吗？")) return;
    try {
      const response = await fetch("/api/game/snapshots", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ snapshotId: id, expectedRevision: revisionRef.current }),
      });
      if (!response.ok) throw new Error("restore failed");
      await loadCloud();
      notify("存档已安全恢复");
      setSheet(null);
    } catch { notify("恢复失败，请稍后重试"); }
  }

  return (
    <div className={`game-shell ${state.settings.lowMotion ? "low-motion" : ""}`}>
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <header className="topbar">
        <button className="player-pill" onClick={() => setSheet("settings")} aria-label="打开玩家设置"><span className="avatar">云</span><span><b>{state.profile.name}</b><small>{state.profile.realmName} · Lv.{state.profile.level}</small></span></button>
        <button className={`sync-pill ${cloudStatus}`} onClick={openCloud} aria-label="打开云存档"><span className="sync-dot" /> {syncLabel}</button>
      </header>
      <div className="resource-bar" aria-label="玩家资源">
        <Resource icon="◉" label="铜钱" value={state.currencies.gold} /><Resource icon="✦" label="灵玉" value={state.currencies.jade} /><Resource icon="♢" label="灵蕴" value={state.currencies.essence} /><Resource icon="⌁" label="秘钥" value={state.currencies.keys} />
      </div>
      <section className="screen" key={tab}>
        {tab === "home" && <HomeView state={state} reward={reward} currentZone={currentZone} onClaimIdle={claimIdle} onDaily={() => mutate(claimDailyLogin, "七日签到奖励已领取")} onCloud={openCloud} onLeaderboard={openLeaderboard} onAdventure={() => setTab("adventure")} />}
        {tab === "adventure" && <AdventureView state={state} battle={battle} nextEnemyPower={nextEnemyPower} currentZone={currentZone} onToggleAuto={() => mutate((current) => ({ ...current, progress: { ...current.progress, autoChallenge: !current.progress.autoChallenge } }))} onSpeed={() => mutate((current) => ({ ...current, progress: { ...current.progress, battleSpeed: current.progress.battleSpeed === 1 ? 2 : 1 } }))} />}
        {tab === "hero" && <HeroView state={state} onUpgrade={() => mutate(applyHeroUpgrade, "境息增长，基础属性提升")} onRealm={() => { mutate(applyRealmUpgrade, "破境成功，灵脉全面觉醒"); void saveCloud("realm-upgrade"); }} onSkill={(id) => mutate((current) => upgradeSkill(current, id), "功法领悟加深")} />}
        {tab === "bag" && <BagView state={state} onEquip={(id) => mutate((current) => equipItem(current, id), "装备已更换")} onBest={() => mutate(equipBest, "已装备当前最高战力组合")} onForge={(id) => mutate((current) => forgeEquipment(current, id), "淬炼成功，装备战力提升")} />}
        {tab === "quests" && <QuestView state={state} type={questType} onType={setQuestType} onClaim={(id) => mutate((current) => claimQuest(current, id), "征途奖励已收入行囊")} />}
      </section>
      <nav className="bottom-nav" aria-label="主要导航">
        {TAB_META.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)} aria-current={tab === item.id ? "page" : undefined}><span>{item.icon}</span><small>{item.label}</small>{item.id === "quests" && state.quests.some((quest) => !quest.claimed && quest.progress >= quest.target) && <i />}</button>)}
      </nav>
      {!ready && <div className="loading-cover"><span className="loading-seal">云</span><p>正在唤醒云境</p><div className="loading-line"><i /></div></div>}
      {toast && <div className="toast" role="status">{toast}</div>}
      {offlineOpen && <OfflineModal reward={reward} maxHours={state.idle.maxHours} onClaim={claimIdle} onClose={() => setOfflineOpen(false)} />}
      {sheet && <BottomSheet type={sheet} player={player} state={state} snapshots={snapshots} leaders={leaders} onClose={() => setSheet(null)} onRestore={restoreSnapshot} onSettings={(key) => mutate((current) => ({ ...current, settings: { ...current.settings, [key]: !current.settings[key] } }))} />}
    </div>
  );
}

function Resource({ icon, label, value }: { icon: string; label: string; value: number }) {
  return <div className="resource"><span>{icon}</span><div><small>{label}</small><b>{formatNumber(value)}</b></div></div>;
}

function HomeView({ state, reward, currentZone, onClaimIdle, onDaily, onCloud, onLeaderboard, onAdventure }: { state: GameState; reward: ReturnType<typeof idleReward>; currentZone: (typeof ZONES)[number]; onClaimIdle: () => void; onDaily: () => void; onCloud: () => void; onLeaderboard: () => void; onAdventure: () => void }) {
  const xpProgress = Math.min(100, state.profile.xp / xpNeeded(state.profile.level) * 100);
  return <div className="view home-view">
    <section className="world-card"><div className="world-copy"><p className="eyebrow">第 {state.progress.stage} 关 · {currentZone.subtitle}</p><h1>{currentZone.name}</h1><div className="power-line"><span>战力</span><b>{formatNumber(state.profile.power)}</b><i>↑ {Math.max(1, Math.floor(state.profile.power * 0.04))}</i></div><button className="primary-btn" onClick={onAdventure}>继续远征 <span>›</span></button></div><img className="hero-character" src="/assets/hero-character.png" alt="御剑游侠立绘" /><div className="world-gradient" /><div className="xp-strip"><span style={{ width: `${xpProgress}%` }} /><small>修为 {state.profile.xp}/{xpNeeded(state.profile.level)}</small></div></section>
    <section className="idle-card"><div className="idle-orb"><span>✦</span><i /></div><div className="idle-copy"><p>灵脉挂机收益</p><h2>{formatDuration(reward.seconds)}</h2><small>最多储存 {state.idle.maxHours} 小时 · 随关卡提升</small></div><div className="idle-reward"><span>◉ {formatNumber(reward.gold)}</span><span>♢ {reward.essence}</span></div><button onClick={onClaimIdle} disabled={reward.seconds < 2}>收取</button></section>
    <section className="quick-grid"><button onClick={onDaily} className={state.daily.loginClaimed ? "done" : ""}><span className="quick-icon warm">☀</span><b>每日签到</b><small>{state.daily.loginClaimed ? "今日已领取" : "灵玉 ×30"}</small></button><button onClick={onCloud}><span className="quick-icon teal">☁</span><b>云端存档</b><small>版本安全保护</small></button><button onClick={onLeaderboard}><span className="quick-icon violet">♜</span><b>云境榜</b><small>战力排行</small></button><button onClick={() => undefined}><span className="quick-icon blue">⌘</span><b>灵兽图鉴</b><small>{state.statistics.monstersDefeated} 次净化</small></button></section>
    <section className="realm-card"><div><p className="eyebrow">当前境界</p><h3>{state.profile.realmName}</h3><small>{state.profile.title}</small></div><div className="realm-rings"><i /><i /><i /><span>{state.profile.realm + 1}</span></div><div className="realm-stats"><span>攻 {formatNumber(state.hero.baseAttack)}</span><span>御 {formatNumber(state.hero.baseDefense)}</span><span>血 {formatNumber(state.hero.baseHealth)}</span></div></section>
  </div>;
}

function AdventureView({ state, battle, nextEnemyPower, currentZone, onToggleAuto, onSpeed }: { state: GameState; battle: BattleResult | null; nextEnemyPower: number; currentZone: (typeof ZONES)[number]; onToggleAuto: () => void; onSpeed: () => void }) {
  const advantaged = state.profile.power >= nextEnemyPower;
  return <div className="view adventure-view">
    <div className="section-heading"><div><p className="eyebrow">远征地图 · 第 {state.progress.stage} 关</p><h1>{currentZone.name}</h1></div><span className={`threat ${advantaged ? "safe" : "danger"}`}>{advantaged ? "优势" : "强敌"}</span></div>
    <section className="battle-card"><div className="battle-bg" /><div className="battle-top"><span>敌方战力 {formatNumber(nextEnemyPower)}</span><b>{enemyForStage(state.progress.stage)}</b><span>{state.progress.stage % 5 === 0 ? "首领战" : "自动战斗"}</span></div><div className="combatants"><div className="combatant hero-unit"><div className="unit-aura" /><img src="/assets/hero-character.png" alt="玩家角色" /><span>{state.profile.name}</span></div><div className="versus"><b>VS</b><i className={state.progress.autoChallenge ? "spinning" : ""}>✦</i></div><div className="combatant enemy-unit"><div className="enemy-core"><i /><span>{state.progress.stage % 5 === 0 ? "魁" : "妖"}</span></div><span>{enemyForStage(state.progress.stage)}</span></div></div><div className="battle-progress"><span key={`${state.progress.stage}-${state.progress.battleSpeed}`} className={state.progress.autoChallenge ? "running" : ""} style={{ animationDuration: state.progress.battleSpeed === 2 ? "1.75s" : "3.2s" }} /></div><div className="battle-log">{battle?.log.slice(-2).map((line, index) => <span key={`${line}-${index}`}>{line}</span>) ?? <span>灵脉连接完成，等待出剑…</span>}</div></section>
    <div className="battle-controls"><button className={state.progress.autoChallenge ? "active" : ""} onClick={onToggleAuto}><span>∞</span><b>{state.progress.autoChallenge ? "自动挑战中" : "开始自动挑战"}</b></button><button onClick={onSpeed}><span>»</span><b>{state.progress.battleSpeed}× 速度</b></button></div>
    <section className="zone-path"><div className="card-heading"><h2>云境路径</h2><small>每 5 关挑战首领</small></div><div className="path-line">{Array.from({ length: 5 }).map((_, index) => { const stage = Math.floor((state.progress.stage - 1) / 5) * 5 + index + 1; return <div key={stage} className={stage < state.progress.stage ? "cleared" : stage === state.progress.stage ? "current" : ""}><span>{index === 4 ? "魁" : stage}</span><small>{index === 4 ? "首领" : ""}</small></div>; })}</div></section>
    <section className="reward-preview"><div><span>◉</span><b>预计铜钱</b><small>+{formatNumber(48 + state.progress.stage * 14)}</small></div><div><span>♢</span><b>预计灵蕴</b><small>+{Math.floor(3 + state.progress.stage * .8)}</small></div><div><span>▣</span><b>装备掉落</b><small>{state.progress.stage % 5 === 0 ? "大幅提升" : "概率获得"}</small></div></section>
  </div>;
}

function HeroView({ state, onUpgrade, onRealm, onSkill }: { state: GameState; onUpgrade: () => void; onRealm: () => void; onSkill: (id: string) => void }) {
  const levelCost = heroUpgradeCost(state.profile.level); const realmCost = realmUpgradeCost(state.profile.realm);
  return <div className="view hero-view"><div className="section-heading"><div><p className="eyebrow">角色养成</p><h1>{state.profile.name}</h1></div><div className="power-badge"><small>总战力</small><b>{formatNumber(state.profile.power)}</b></div></div><section className="cultivation-card"><div className="cultivation-bg" /><img src="/assets/hero-character.png" alt="御剑者" /><div className="realm-label"><small>境界 {state.profile.realm + 1}</small><b>{state.profile.realmName}</b><span>{state.profile.title}</span></div><div className="stat-row"><div><small>攻击</small><b>{formatNumber(state.hero.baseAttack)}</b></div><div><small>生命</small><b>{formatNumber(state.hero.baseHealth)}</b></div><div><small>防御</small><b>{formatNumber(state.hero.baseDefense)}</b></div><div><small>暴击</small><b>{Math.round(state.hero.crit * 100)}%</b></div></div></section><div className="upgrade-grid"><button onClick={onUpgrade} disabled={state.currencies.gold < levelCost}><span>聚气修行</span><b>提升基础属性</b><small>◉ {formatNumber(levelCost)}</small></button><button className="realm-upgrade" onClick={onRealm} disabled={state.currencies.essence < realmCost}><span>破境</span><b>{state.profile.realmName} → 下一境</b><small>♢ {formatNumber(realmCost)}</small></button></div><section className="skills-card"><div className="card-heading"><h2>功法心诀</h2><span>可用悟性 {state.hero.skillPoints}</span></div>{state.hero.skills.map((skill, index) => <div className="skill-row" key={skill.id}><div className={`skill-icon skill-${index}`}>{index === 0 ? "剑" : index === 1 ? "御" : "潮"}</div><div><b>{skill.name}</b><small>{skill.description}</small><div className="skill-dots">{Array.from({ length: 6 }).map((_, dot) => <i key={dot} className={dot < Math.ceil(skill.level / 2) ? "filled" : ""} />)}</div></div><button onClick={() => onSkill(skill.id)} disabled={state.hero.skillPoints <= 0 || skill.level >= skill.maxLevel}>Lv.{skill.level}<span>+</span></button></div>)}</section></div>;
}

function BagView({ state, onEquip, onBest, onForge }: { state: GameState; onEquip: (id: string) => void; onBest: () => void; onForge: (id: string) => void }) {
  const items = [...state.equipment.inventory].sort((a, b) => b.power - a.power);
  return <div className="view bag-view"><div className="section-heading"><div><p className="eyebrow">装备与行囊</p><h1>灵器库</h1></div><button className="mini-primary" onClick={onBest}>一键最优</button></div><section className="equipment-slots">{Object.entries(SLOT_META).map(([slot, meta]) => { const equippedId = state.equipment.equipped[slot as keyof typeof state.equipment.equipped]; const item = state.equipment.inventory.find((entry) => entry.id === equippedId); return <div key={slot} className={item ? `rarity-${item.rarity}` : "empty"}><span>{meta.glyph}</span><small>{meta.label}</small><b>{item?.name ?? "未装备"}</b><em>{item ? `+${formatNumber(item.power)}` : "待探索"}</em></div>; })}</section><div className="inventory-heading"><h2>行囊</h2><small>{items.length}/250</small></div><section className="inventory-list">{items.map((item) => { const equipped = state.equipment.equipped[item.slot] === item.id; const forgeCost = Math.floor(120 * Math.pow(1.14, item.level - 1)); return <article key={item.id} className={`inventory-item rarity-${item.rarity}`}><div className="item-glyph">{SLOT_META[item.slot].glyph}</div><div className="item-copy"><p><b>{item.name}</b><span style={{ color: RARITY_META[item.rarity].color }}>{RARITY_META[item.rarity].label}</span></p><small>Lv.{item.level} · 战力 +{formatNumber(item.power)}</small></div><div className="item-actions">{!equipped && <button onClick={() => onEquip(item.id)}>装备</button>}<button onClick={() => onForge(item.id)} disabled={state.currencies.gold < forgeCost}>淬炼</button>{equipped && <em>已装备</em>}</div></article>; })}</section></div>;
}

function QuestView({ state, type, onType, onClaim }: { state: GameState; type: "daily" | "journey"; onType: (value: "daily" | "journey") => void; onClaim: (id: string) => void }) {
  const filtered = state.quests.filter((quest) => quest.type === type);
  return <div className="view quests-view"><div className="section-heading"><div><p className="eyebrow">任务与成就</p><h1>征途卷轴</h1></div><span className="streak">连续签到 {state.daily.streak} 天</span></div><div className="segmented"><button className={type === "daily" ? "active" : ""} onClick={() => onType("daily")}>每日修行</button><button className={type === "journey" ? "active" : ""} onClick={() => onType("journey")}>远征成就</button></div><section className="quest-list">{filtered.map((quest) => { const complete = quest.progress >= quest.target; return <article key={quest.id} className={complete && !quest.claimed ? "complete" : ""}><div className="quest-seal">{quest.claimed ? "✓" : type === "daily" ? "日" : "征"}</div><div className="quest-copy"><b>{quest.title}</b><small>{quest.description}</small><div className="quest-progress"><i><span style={{ width: `${Math.min(100, quest.progress / quest.target * 100)}%` }} /></i><em>{formatNumber(quest.progress)}/{formatNumber(quest.target)}</em></div><p><span>◉ {formatNumber(quest.rewardGold)}</span><span>✦ {quest.rewardJade}</span></p></div><button disabled={!complete || quest.claimed} onClick={() => onClaim(quest.id)}>{quest.claimed ? "已领取" : complete ? "领取" : "进行中"}</button></article>; })}</section><section className="stats-card"><div className="card-heading"><h2>远征记录</h2><small>永久保存</small></div><div><span><b>{formatNumber(state.statistics.wins)}</b><small>胜利</small></span><span><b>{formatNumber(state.statistics.defeats)}</b><small>折返</small></span><span><b>{formatNumber(state.statistics.monstersDefeated)}</b><small>净化</small></span><span><b>{formatDuration(state.statistics.idleSecondsClaimed)}</b><small>挂机</small></span></div></section></div>;
}

function OfflineModal({ reward, maxHours, onClaim, onClose }: { reward: ReturnType<typeof idleReward>; maxHours: number; onClaim: () => void; onClose: () => void }) {
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="挂机收益"><div className="offline-modal"><button className="modal-close" onClick={onClose}>×</button><div className="offline-glow"><span>✦</span><i /><i /></div><p className="eyebrow">灵脉持续运转</p><h2>游历归来</h2><small>离线 {formatDuration(reward.seconds)}，灵息已凝结为奖励</small><div className="offline-loot"><div><span>◉</span><b>{formatNumber(reward.gold)}</b><small>铜钱</small></div><div><span>♢</span><b>{formatNumber(reward.essence)}</b><small>灵蕴</small></div></div><button className="primary-btn full" onClick={onClaim}>收入行囊</button><em>挂机收益最多累积 {maxHours} 小时</em></div></div>;
}

function BottomSheet({ type, player, state, snapshots, leaders, onClose, onRestore, onSettings }: { type: "cloud" | "settings" | "leaderboard"; player: Props["player"]; state: GameState; snapshots: SaveSnapshot[]; leaders: { rank: number; name: string; power: number; stage: number; level: number }[]; onClose: () => void; onRestore: (id: string) => void; onSettings: (key: keyof GameState["settings"]) => void }) {
  return <div className="sheet-backdrop" onClick={onClose}><section className="bottom-sheet" onClick={(event) => event.stopPropagation()}><div className="sheet-handle" /><button className="modal-close" onClick={onClose}>×</button>{type === "cloud" && <><p className="eyebrow">数据安全中心</p><h2>云端存档</h2>{player ? <><div className="cloud-summary"><span className="cloud-big">☁</span><div><b>当前进度已受保护</b><small>第 {state.progress.bestStage} 关 · 战力 {formatNumber(state.profile.power)}</small></div><i>已连接</i></div><div className="snapshot-title"><b>自动恢复点</b><small>保留最近 12 份</small></div><div className="snapshot-list">{snapshots.length ? snapshots.map((snapshot) => <div key={snapshot.id}><span>↺</span><p><b>第 {snapshot.stage} 关 · Lv.{snapshot.level}</b><small>{new Date(snapshot.createdAt).toLocaleString("zh-CN")} · {snapshot.reason}</small></p><button onClick={() => onRestore(snapshot.id)}>恢复</button></div>) : <div className="empty-state">完成几次远征后会自动生成可恢复存档</div>}</div></> : <div className="signin-card"><span>☁</span><h3>登录后开启跨设备云存档</h3><p>游客进度保存在当前设备；登录后，后续更新与换设备都能继续。</p><a href="/signin-with-chatgpt?return_to=%2F">使用 ChatGPT 登录</a></div>}</>}{type === "settings" && <><p className="eyebrow">玩家设置</p><h2>云境行囊</h2><div className="profile-sheet"><span>云</span><div><b>{state.profile.name}</b><small>{player ? "已绑定云端身份" : "游客模式"}</small></div>{player ? <a href="/signout-with-chatgpt?return_to=%2F">退出</a> : null}</div><div className="settings-list"><Setting label="背景音乐" description="后续可加入环境音轨" checked={state.settings.music} onClick={() => onSettings("music")} /><Setting label="触感反馈" description="关键操作提供轻微震动" checked={state.settings.haptics} onClick={() => onSettings("haptics")} /><Setting label="减少动效" description="适合省电或易晕动用户" checked={state.settings.lowMotion} onClick={() => onSettings("lowMotion")} /></div><div className="version-note"><b>存档结构 v{state.schemaVersion}</b><small>升级时自动迁移，不会覆盖旧数据</small></div></>}{type === "leaderboard" && <><p className="eyebrow">全服战力排行</p><h2>云境榜</h2><div className="leader-list">{leaders.length ? leaders.map((leader) => <div key={`${leader.rank}-${leader.name}`}><span className={`rank rank-${leader.rank}`}>{leader.rank}</span><p><b>{leader.name}</b><small>Lv.{leader.level} · 第 {leader.stage} 关</small></p><strong>{formatNumber(leader.power)}</strong></div>) : <div className="empty-state">云境榜正在汇聚各路修士</div>}</div></>}</section></div>;
}

function Setting({ label, description, checked, onClick }: { label: string; description: string; checked: boolean; onClick: () => void }) {
  return <button className="setting-row" onClick={onClick}><span><b>{label}</b><small>{description}</small></span><i className={checked ? "on" : ""}><em /></i></button>;
}
