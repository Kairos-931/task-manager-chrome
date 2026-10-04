# 可选 Google 登录与账号隔离的自动同步

- Status: in_development
- GitHub Issue: https://github.com/Kairos-931/task-manager-chrome/issues/62
- Priority: high
- Target version: 3.17.0 (planned feature release; final version set by developer after verification)
- Confirmed date: 2026-09-24 (user: “按照这个方案写需求，更新 README，更新 ISSUE，更新产品版本，开干”)
- Queued date: not queued
- Development started date: 2026-09-24 (resumed with user-approved `gpt-6-luna / max`)
- Completed date: not completed

## Objective and user value

- User goal: 新用户安装后立即使用；需要跨电脑同步时，仅用 Google 登录，无需接触 Cloudflare、Worker URL 或 API 密钥。
- Current problem: 扩展本地可用，但云同步需手动配置 URL/密钥；Worker 当前用一把全局密钥，D1 记录没有用户归属。
- User-visible outcome: 未登录可完整管理本机任务；登录后本地优先、自动同步到用户自己的 D1 数据空间；新电脑登录同一 Google 账号后恢复任务。

## Product framework

- 目标用户：单机使用者、跨电脑用户、手机快速录入用户。
- 核心功能：可选登录、账号隔离、自动同步、旧数据迁移、清晰的同步状态。
- 视觉风格：沿用现有设置与同步面板；首屏不放登录门槛；以普通语言呈现本机/云端状态。
- 约束：扩展离线可用；服务端统一提供 Worker + D1；不要求最终用户自行配置 Cloudflare；原有任务不可丢失或跨账号泄露。
- 竞品/平台参考：Chrome 扩展 Identity 的一次授权和后续非交互获取令牌、Google OIDC 服务端验签；仅借鉴授权模式，不增加第三方任务存储。

## Scope

### Included

- 扩展访客模式：安装后直接进入现有任务界面，任务、分类、设置存本机，可导出文件。
- 用户主动点击“使用 Google 登录”后授权；Worker 验证身份凭证，以稳定的 Google `sub` 标识用户，D1 同步记录按用户隔离。客户端不能自行声明用户 ID。
- 保留现有增量同步、离线编辑、冲突收敛和删除墓碑；登录后自动同步，首次在另一台电脑登录后自动拉取。服务异常时本地编辑继续有效，明确显示“已保存本机，等待同步”。
- 对账号内首次同步：云端为空时上传当前本机任务；云端已有数据时安全合并，不能直接用空本机数据覆盖云端。
- 退出登录后停止云同步并保留本机任务；如在同一电脑切换 Google 账号，先给出账户数据隔离与本机数据处理选项，且留有可恢复本机备份，不能静默把 A 账号任务送到 B 账号。
- 现有全局 API 密钥数据由管理员在迁移中认领到指定 Google 账号；迁移前备份 D1 和扩展数据，验证数量/关键任务后才撤销旧通道。新用户无权认领旧数据。
- 手机快速添加页如继续面向同步账号使用，沿用同一 Google 身份与用户隔离；登录前不读取任何账号数据。Telegram 暂不向新账号开放；现有管理员通道在迁移期间必须保持隔离，不得通过旧全局密钥读取或写入任意新用户数据。开发交付需明确该旧通道的停用/迁移路径，不能静默失效。
- README 区分当前版本和规划版本；完成后同步中英文文档及用户迁移说明。

### Not included

- 非 Google 的账号/密码、第三方登录或给用户分发 API 密钥。
- Google Drive 任务存储；任务仍位于浏览器本机和 TaskMaster 管理的 Cloudflare D1。
- 实时多人协作、任务共享、付费/配额体系。

## User flow

1. 新用户安装后立即添加任务，无需登录。
2. 需要多端同步时，在设置中点击“使用 Google 登录”，完成 Google 授权。
3. 扩展显示登录账号及同步状态；自动上传或安全合并本机任务。
4. 新电脑安装同一扩展，登录同一 Google 账号后自动拉取任务。
5. 退出登录后，当前电脑任务仍可用，但不再与云端交换。

## Interaction specification

- Entry point: 现有同步设置/状态入口；不阻塞弹窗的今日任务。
- Default state: 未登录显示“任务仅保存在本机”与可选登录动作。
- Actions and feedback: 登录、同步中、已同步、离线待同步、认证过期需重新登录、退出。登录授权失败时保留本机数据并给出重试动作。
- Responsive behavior: Popup 保留简短同步状态；详细账号与恢复说明放新标签页。手机页用窄屏登录入口。
- Demo or visual references: 现有同步面板；开发前按项目桌面视觉控制规则决定是否做真实 UI 检查。

## Data and safety boundaries

- Reads: 本机 `chrome.storage.local`、经服务端认证的当前用户 D1 记录。
- Writes: 本机任务；仅当前用户命名空间内的 D1 记录；迁移时经管理员确认的旧数据归属。
- Must not do: 把 Google 邮箱作为可伪造的身份声明；把全局 API 密钥或 Google 长期令牌放入公开构建；跨账号读取、合并或清空数据；在云端未确认前宣称“已同步”。
- Effect on original files or external systems: 需迁移 D1 schema、部署 Worker、配置 Google OAuth 客户端、更新扩展权限与稳定 ID；实际部署/密钥配置需单独执行与验收。

## Failure and edge cases

- 空白新电脑：不上传默认空数据覆盖云端任务，先拉取或安全收敛。
- 离线或 Google 暂不可达：仍可本机使用；恢复后同步；给出清晰状态。
- 令牌失效：停止云端请求并引导重新登录，不清空任务。
- 同机换账号：阻止跨账号静默上传，用户明确处理本机数据后继续。
- 旧数据迁移失败：旧通道和原数据保持可恢复，禁止部分切换导致历史任务不可见。
- 无法访问 Worker：提示网络/服务问题与重试，不把认证错误误报成网络错误。

## Acceptance criteria

1. 全新安装且未登录时，用户可创建、编辑、完成任务，重启浏览器后本机数据仍在；没有 Google/Cloudflare 配置流程。
2. 账号 A 在电脑 1 登录并添加任务后，电脑 2 登录 A 自动获取；账号 B 无法读取或修改 A 的任务。
3. 登录前本机已有任务且账号云端已有任务时，首次登录不丢失任一侧独有记录；空新设备不会覆盖云端。
4. 断网时新增任务显示本机已保存、云端待同步；恢复后自动收敛，删除不会在旧设备复活。
5. 退出后本机任务仍可用且云同步停止；切换账号不能静默混入旧账号数据。
6. 现有管理员旧数据经备份和校验后只归属指定账号；未认领旧数据不暴露给新用户。
7. 手机端用相同账号访问时仅能提交/读取自己的任务；Telegram 旧通道不会越过账号隔离。
8. 同步失败、认证过期和服务异常时有准确状态及下一步动作；扩展 Popup 与新标签页主要操作仍可使用。

## Development handoff

- Version impact: feat → planned 3.17.0; developer confirms current baseline and synchronizes package/manifest/changelog/tag only when release is approved.
- Relevant modules: `shared/storage.ts`, `shared/task.ts`, `shared/render.ts`, `shared/events.ts`, `manifest.json`, `backend/index.js`, `backend/schema.sql`, backend migration, tests, README.
- Required verification: account isolation and spoofing tests; migration and rollback rehearsal on non-production D1; fresh install, existing local data, two accounts/two devices, offline/online, mobile/Telegram; typecheck, lint, tests, build.
- Deployment or desktop update: Worker/schema and OAuth configuration before enabling new extension; extension reload for local checkout. Do not deploy without a separate explicit deployment request.
- Git and push constraints: project rules; no automatic push.

## Development execution profile

- Assessment status: approved
- Assessed requirement date or revision: 2026-09-24 confirmed
- Complexity and dominant cost drivers: account isolation across D1/Worker/extension, OAuth, data migration, mobile/Telegram compatibility.
- Recommended model: `gpt-6-luna` (user override)
- Recommended reasoning effort: `max`
- Recommendation rationale: 项目双任务流程的默认配置；让开发先完成可验证的扩展、Worker 与迁移方案，遇到无法证明安全的数据归属问题时暂停并升级评估。
- Lower-cost alternative and tradeoff: none proposed; reducing reasoning effort would save usage but is inappropriate for authentication and migration work.
- Engineering effort range: large, approximately 5–10 focused engineering days including migration rehearsal and multi-client regression verification.
- AI usage or API cost range: high, roughly 150k–400k tokens over implementation and review; rough product-plan usage estimate, not an API billing promise.
- Estimate basis and excluded costs: targeted repository inspection; excludes Google/Cloudflare service charges, human review and production rollout time.
- Confidence: low
- Assumptions and unknowns: current production D1 state and OAuth credentials must be checked by developer.
- Escalation condition: stop and return for product decision if production legacy data ownership or Telegram migration cannot be proved safe; never guess ownership.
- User decision: “现在使用陆六陆达Max来开发”，随后明确更正为“6 luna”；按上下文采用 `gpt-6-luna / max`。
- Selected confirmation option: custom override
- Approved model: `gpt-6-luna`
- Approved reasoning effort: `max`
- Approved budget or usage range: no explicit cap; prior rough usage estimate only.
- Profile approved date: 2026-09-24

## Open decisions

- None. Telegram 不向新账号开放；现有管理员链路需隔离并明确迁移/停用路径。
