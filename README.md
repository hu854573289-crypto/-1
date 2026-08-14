# 云境远征 / Cloudrealm Idle RPG

一款从零构建的东方奇幻放置冒险 PWA 手游。手机浏览器可直接游玩并安装到桌面，支持自动战斗、离线挂机、角色与境界成长、功法、装备、任务、排行榜、账号云存档和历史恢复点。

## 已实现玩法

- 五大主界面：云城、远征、修行、行囊、征途
- 自动战斗与 1×/2× 速度，首领关卡、动态敌方战力、装备掉落
- 最多 12 小时离线收益，按最高关卡动态计算
- 角色等级、九重境界、三套功法、属性与战力计算
- 四类装备、四级品质、一键最优、装备淬炼
- 每日任务、远征成就、签到、永久统计
- 全服战力排行榜
- PWA 安装、离线外壳、触感反馈与减少动效设置

## 云存档与数据安全

玩家用 ChatGPT 身份登录后，存档写入 D1 数据库；游客进度保存在本机，登录后使用独立云档案。

数据保护不是简单覆盖 JSON，而是以下组合：

1. `game_saves.revision` 使用乐观锁，多设备同时保存时不会静默覆盖。
2. 冲突中的本地版本先写入 `conflict-backup` 恢复点，再读取远端新版本。
3. 存档和快照均保存 SHA-256 校验值；读取异常时自动从最近一份校验通过的快照恢复。
4. 每 10 关、破境、结构迁移、手动恢复前自动留档；每名玩家轮转保留最近 12 份。
5. 恢复历史版本前，当前版本也会先生成恢复点，因此可以反向撤销。
6. `schemaVersion` 与 `migrateGameState()` 负责把旧存档补齐到新结构，不删除已有资源和进度。

### 后续升级必须遵守

- 永远不要修改已经部署过的 `drizzle/*.sql`；修改 `db/schema.ts` 后运行 `npm run db:generate`，提交新增迁移。
- GameState 新增字段时，同时提高 `GAME_SCHEMA_VERSION`，并在 `migrateGameState()` 中提供默认值和旧字段转换。
- 不要直接删除玩家字段。至少跨一个版本保留兼容读取，确认迁移完成后再用后续迁移清理。
- 经济系统或战力公式大改前，新增一次强制快照原因，并先在测试存档上验证迁移。
- 云端玩家数据只通过 `/api/game` 和 `/api/game/snapshots` 修改；浏览器存储不是登录玩家的权威数据源。

## 技术结构

```text
app/
  api/game/                 云存档读取与带 revision 的保存
  api/game/snapshots/       恢复点列表与安全恢复
  api/leaderboard/          战力排行榜
  components/GameClient.tsx 手机游戏界面与交互
db/
  schema.ts                 玩家、存档、快照、排行榜表
drizzle/                    只增不改的数据库迁移
lib/
  game-data.ts              世界、敌人、装备静态数据
  game-state.ts             战斗、成长、挂机和存档迁移引擎
  game-types.ts             游戏与云存档类型
  server/game-store.ts      身份散列、校验、快照和排行榜服务
public/
  assets/                   原创世界场景和角色立绘
  manifest.webmanifest      PWA 配置
  sw.js                     离线外壳
```

## 本地开发

要求 Node.js `>=22.13.0`。

```bash
npm ci
npm run dev
```

常用检查：

```bash
npm run lint
npm test
npm run db:generate
```

`npm test` 会构建并验证生产 Worker，同时测试新档、战斗推进、旧档迁移和挂机上限。

## 数据表

| 表 | 用途 | 更新策略 |
| --- | --- | --- |
| `players` | 匿名化玩家 ID 与显示名 | 登录时 upsert |
| `game_saves` | 当前权威存档、revision、schema、checksum | 条件更新，冲突返回 409 |
| `save_snapshots` | 里程碑、迁移、冲突、恢复前备份 | 每玩家保留最近 12 份 |
| `leaderboard` | 只读排行榜摘要 | 每次成功保存后更新 |

玩家 ID 由标准化账号邮箱的 SHA-256 摘要生成；数据库不保存原始邮箱。

## 美术与产品方向

整体采用暗青、翡翠和暖金的东方奇幻视觉。主视觉与角色立绘均为本项目原创生成资产，不含第三方品牌、水印或外部热链。

## License

Private project. Add a license before公开分发或商业化。
