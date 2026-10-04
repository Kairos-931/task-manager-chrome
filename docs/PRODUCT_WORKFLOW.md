# Product workflow

- Project: `TaskMaster`
- Requirements task title: `【TaskMaster】产品`
- Developer task title: `【TaskMaster】开发·过去日期排期`
- Developer task: `codex://threads/01a0f6ce-2b91-7343-bb37-1b3f5d3d467a`
- Shared checkout: `C:\Users\Kairos\Documents\Codex-Case-Collisions\TASK_MASTER`
- Initialized: `2026-09-04`
- Status: active
- Active developer requirement: none; the developer slot is released after Issue #75 implementation. Issue #75 (`REQ-20261004-task-save-destination.md`) is delivered as 4.2.0 and awaits user acceptance. Issue #74 was delivered as 4.1.0 and also awaits user acceptance. The stable loaded directory remains `C:\Users\Kairos\Documents\TASK_MASTER\outputs\TaskMaster-3.16.2` and now contains 4.2.0; its 4.1.0 backup is recorded with Issue #75. Issue #73 was accepted after the user confirmed an added task appeared.
- Other acceptance work remains separate: #71 Worker release is at the unchanged URL; Google sync Issue #62 remains open for multi-device, deletion, account isolation, and old-data ownership decisions. No sync work is included in #75.
- UX-05 extension v3.19.0 at `outputs/TaskMaster-3.19.0-ux05-20261003`; public key and permissions match the stable loaded directory `C:\Users\Kairos\Documents\TASK_MASTER\outputs\TaskMaster-3.16.2`. Pre-update backup: `C:\Users\Kairos\AppData\Local\TaskMaster\backups\extension-before-ux05-71-20261003`. Worker deployed as Version ID `96d6b39d-a3d5-4972-ab4f-b91d505dee05`; prior rollback point `b327393b-e2f0-4ced-bdda-ec4a3ae30664`. The #62 Google sync candidate was 3.16.2 at `outputs/google-account-sync-candidate-v3.16.2-20261002`.
- Verified live acceptance: user manually loaded the candidate and confirmed Google sign-in plus same-account mobile-add → computer display.
- Remaining #62 acceptance and old-data ownership confirmation are pending; two-computer, deletion, and full isolation acceptance are not inferred.
- Issue #64: product approved the candidate identity configuration; product-side issue status remains authoritative.
- Mobile save-feedback Issue #66 was introduced in `84f0f06` at version 3.17.0, hardened in `1853e52` at 3.17.2, and given centered feedback in `b093cbe` at 3.17.3; the latest Worker is deployed and real phone visual acceptance is pending.
- Mobile legacy-entry Issue #67 was implemented in `d5e5555` at version 3.17.1; included in the 3.17.2 Worker deployment and production redirect/page checks passed, with product acceptance pending.
- Mobile session-restore Issue #68 was implemented in `51a0399` at version 3.17.4; deployed and production-read-only checks passed, with real browser reopen acceptance pending.
- Last completed requirement: Issue #73, 4.0.3 newtab add recovery; user confirmed the new task was added successfully (`2026-10-04`).
- Queue: empty
## Operating contract

1. Product discussion, specifications, acceptance criteria, and demos live in the requirements task.
2. Confirmed production implementation lives in the developer task.
3. `docs/requirements/` is the authoritative handoff channel.
4. “确认开发” means the current confirmed specification may be sent to the developer task.
5. Product-impacting ambiguity returns to the requirements task; implementation details remain with the developer task.
6. After required verification passes, the developer creates one local Conventional Commit per independent requirement or fix. Push, tag, release, and deployment still require explicit user authorization.

## 2026-09-30 迁移后的交付记录

- Product task: codex://threads/01a0f1af-be64-7860-8c0d-660fdb71e2c9
- Developer baseline: gpt-6-luna / max; per-message override.
- Historical developer history unavailable; historical in_development flag is not proof of current work. User authorizes continuation in latest 3.16.0 checkout with newly linked idle developer.
- Current authoritative specification: docs/requirements/REQ-20260930-google-account-sync.md; supplements and supersedes historical scope where clarified.
- Dispatch state: sent successfully 2026-09-30; in_development.
- Do not add physical migration/export/import features. Preserve existing manual export.




## 2026-10-01 用户授权接续开发

- 用户确认开发空闲并指示转开发，已成功交付任务池过去日期需求。
- Google 同步历史需求状态：suspended pending reconciliation；无可靠完成证据，不标记 completed。本次用户授权切换，开发不并行继续该项。


## 2026-10-01 专门开发对话接手

- 用户明确要求创建新开发对话执行当前排期需求，已创建并交付 r2。
- 当前开发：codex://threads/01a0f6ce-2b91-7343-bb37-1b3f5d3d467a，gpt-6-luna / max。
- 已通知旧开发停止该需求，保留成果；新开发须确认无并发写入后接续。
- 保存项目入口仍是旧目录，开发提示已明确指定最新目录，不代表旧副本可用于开发。


## 2026-10-01 用户授权恢复 Google 同步开发

- 用户明确要求继续已批准的 `docs/requirements/REQ-20260930-google-account-sync.md` 并完成，恢复 Issue #62 开发。
- 当前开发事项从任务池过去日期排期切换为 Google 登录与账号同步；不并行扩展其他需求。
- 保留此前过去日期需求提交 `960c15a` 和工作区其他未提交改动。


## Google 同步产品协调授权 2026-10-01

用户委托产品对话全权处理当前同步需求产品问题；允许开发直接提问与产品回复，决策记录写入当前需求。当前开发对话为 01a0f6ce-2b91-7343-bb37-1b3f5d3d467a。

## 2026-10-02 Google 同步执行槽释放

- 本地实现提交：7132a47；发布密钥保护提交：cd37d4a。`npm run check` 已通过，release checker 按预期阻止含私钥的当前清单；完整发布构建及生产验收未完成。
- Issue #62 状态为 `awaiting_configuration`；本地开发执行槽释放，等待真实扩展身份、Google OAuth 客户端和 Cloudflare/Wrangler 非生产验证条件。
- Issue #64 状态为 `blocked_identity_migration`，保持开放；用户已提供实际扩展 ID，核验确认正确公钥会改变 ID。等待产品确认迁移边界及配置方案；#62 不得宣告生产可用。
- 不存在运行中的开发实现任务；配置与身份材料准备好后，再恢复 #62 开发和验收。队列保持为空。

## 2026-10-02 Google 登录桥本地接续

- 按产品决定 D-20261002-03 实现 Worker Web OAuth 回调、手机 GIS nonce、扩展固定 chromiumapp.org 回调、PKCE 一次码交换和按客户端隔离的七天 TaskMaster 会话。
- 账号 API 改为仅接受 TaskMaster 会话；旧 Google access token/UserInfo 认证不再授权账号路由。Google token 不持久化。
- 增加 `0004-google-auth-sessions.sql`；自动验证覆盖 state、nonce、受众、固定回调、verifier、并发单次消费、会话期限/撤销和跨端隔离，并在 SQLite 中实际执行迁移和关键 D1 查询。
- SemVer 修复版本更新为 3.16.1；`npm run check` 和隔离的新身份候选包 `npm run build` 均通过。未写入 D1、配置 Wrangler secret、push、部署或进行真实 OAuth/GUI 演练；Issue #62 继续开放，等待配置与线上验收。

## 2026-10-02 D-20261002-04 扩展候选与账号入口

- 产品确认登录可选；未登录任务继续保存在 `chrome.storage.local` 并可离线使用。popup/newtab 共用账号会话；登录/退出通知另一界面刷新，退出不删除本机任务。
- 产品确认基于已验证密钥派生公开 key，扩展 ID 与已部署回调一致；`launchWebAuthFlow` 不使用 `manifest.oauth2/getAuthToken`。候选清单仅保存公钥和 `identity` 权限。
- popup 增加“账号同步”入口；扩展候选构建路径为 `outputs/google-account-sync-candidate-v3.16.2-20261002`。旧 `chrome-extension-sync` 包未覆盖。
- `npm run build` 通过；typecheck、lint 与 Google 账号定向回归通过。完整 `npm run check` 会停在既有 `tests/ui-layout.test.mjs` 静态断言（检查错误源码文件）；按产品边界未把无关 UI/拆分测试修正混入本需求。
- 未安装扩展、未启动 GUI、未执行真实 Google 授权、未部署、未写生产数据、未 push/tag。Issue #62 保持开放，等待手动演练和产品验收。

## 2026-10-02 Google 同步真实验收回报

- 用户手动加载短路径候选 3.16.2，Google 登录成功，并明确确认“已经同步 手机添加电脑已经同步显示”。这是同账号手机新增任务在电脑出现的验收证据。
- 仅记录该扩展登录与手机到电脑新增路径；不推断双电脑、删除墓碑、全部账号隔离或历史未认领数据已验收。旧扩展仍保留，Issue #62 等剩余验收和旧数据归属确认后再决定完成。
- 用户另要求记录手机添加保存状态反馈问题；产品已登记 `docs/requirements/REQ-20261002-mobile-save-feedback.md`，当前仅记录、未批准开发，不改手机端代码或部署。


## 2026-10-02 手机端 #66/#67 本地实现完成

- #66：`84f0f06`，版本 3.17.0；保存状态反馈、超时幂等重试与回归完成。
- #67：版本 3.17.1；移除旧连接页面、旧 URL 安全重定向与旧 API 保留回归完成。
- #66 并发补强：版本 3.17.2；D1 batch 内仅在任务记录不存在时写入 revision/change/record，避免并发同 UUID 请求重复增加 revision；无 migration。
- 两项随后部署记录见下文；未 push、未打 tag、未运行 GUI。Google 同步主需求 #62 仍保持开放，既有同账号手机新增到电脑的用户验收不代表所有同步验收完成。

## 2026-10-02 #66/#67 Worker 部署

- 用户批准部署手机优化后，从干净提交 `1853e52ed5d084437bab3039c9448ce2916744cf` 发布 Worker；Cloudflare Version ID：`5c1ef64a-9ba5-4ef4-8d4d-3a482f54b798`。部署前线上版本 `adb413a1-4bbe-4c02-8697-3c6c6bfad853`，部署后确认新版本流量 100%。
- 生产只读检查通过：`/` 返回 200，含 Google 登录控件、已配置的 Web Client ID 与保存状态文案，不含旧版入口；`/legacy` 和 `/index.html` 均 302 到同源 `/` 且丢弃查询参数；未认证的账号分类及旧任务/分类 API 均返回 401。
- 未发起真实 Google 登录、未创建或修改生产任务、未执行迁移、GUI、push 或 tag。#66 手机真实保存体验与 #67 产品验收仍待用户确认；Google 同步 #62 的双设备、删除、隔离和旧数据归属验收仍未完成。

## 2026-10-02 #66/#68 手机体验发布

- 从干净提交 `51a03998084dd375b455c70986eaaf15b7907556` 发布版本 3.17.4；#66 弹层为独立提交 `b093cbe`，#68 会话恢复为独立提交 `51a0399`。Cloudflare Version ID：`b327393b-e2f0-4ced-bdda-ec4a3ae30664`，生产流量 100%；发布前回退点 `5c1ef64a-9ba5-4ef4-8d4d-3a482f54b798`。
- 定向手机交互与 Google 授权桥回归、类型检查、lint、Worker dry-run 通过；完整 `npm run check` 的相关测试通过，停在既有 `tests/ui-layout.test.mjs:32` 无关共享 UI 静态断言。
- 生产只读检查通过：`/` 返回 200 且包含居中保存提示、自动关闭和持久会话恢复代码；Google Web Client ID 已配置；旧入口仍 302 到同源 `/` 并丢弃查询参数；未认证账号与旧任务 API 返回 401。未执行生产任务写入、真实 Google 登录、GUI、迁移、扩展更新、push 或 tag。
- 开发执行槽已释放。用户下一步：在同一常规手机浏览器刷新页面，验收实际保存反馈；若此前标签页已关闭导致旧 `sessionStorage` 消失，登录一次后再关闭重开页面，确认七天内自动恢复。产品下一步：收集真实手机验收并维护 Issues #66/#68 状态；Issue #62 的剩余验收继续独立跟进。
- 开发→产品反馈事件 `TM-20261002-mobile-66-68-deploy`，收件产品任务 `01a0f1af-be64-7860-8c0d-660fdb71e2c9`；2026-10-02 15:39 UTC 已发送，`send_message_to_thread` 返回同一 `threadId` 且 `isError=false`。

## 2026-10-03 Issue #69 UX-01 候选完成

- 用户按本轮指令将执行配置改为 gpt-6-sol / low。实现提交 `bf203ba` 位于分支 `codex/task-save-failure-69`，候选版本 3.17.5，待用户加载后验收。
- 候选目录：`outputs/TaskMaster-3.17.5-final-20261003`。扩展 manifest 公钥与现有已加载目录 `C:\Users\Kairos\Documents\TASK_MASTER\outputs\TaskMaster-3.16.2` 一致；旧加载目录没有被覆盖。
- typecheck、lint、build 和 UX-01 故障注入回归通过。完整测试仍被既有 `ui-layout` 静态断言阻断；`optional-split-child-dates` 另有跨区块静态正则误报，详情记录在 `docs/requirements/REQ-20261003-task-save-failure.md`。
- 未执行 GUI/视觉验收、push 或 Worker 部署。Google 同步 Issue #62 仍单独开放，已有手机到电脑新增路径的确认不代表其余账号隔离、删除与数据归属验收完成。
- 开发→产品反馈事件 `TM-20261003-task-save-failure-69` 于 2026-10-03 04:53 UTC 发送至任务 `01a0f1af-be64-7860-8c0d-660fdb71e2c9`；工具返回相同 `threadId` 且 `isError=false`。

## 2026-10-03 Issue #73 新标签页添加反馈修复

- 本地修复提交 `fix: close newtask modal after local save`，版本 4.0.2；稳定加载目录保持原路径，更新前 4.0.1 备份为 `C:\Users\Kairos\AppData\Local\TaskMaster\backups\extension-before-newtab-add-73-20261003-4.0.1`。更新后扩展 ID、公钥、权限不变，14 个加载文件 SHA-256 与候选逐项一致。
- 已定位可复现的代码阻塞：本地任务持久化成功后等待草稿删除回调才关弹窗和解锁；修复使本地成功先完成 UI 收尾，迟到清理继续按原 store/key/context 串行处理。Edge 隔离 E2E 覆盖延迟清理下立即开新表单、保留新草稿、重载时抑制指向已保存任务的旧草稿、失败重试、合成账号远端刷新。
- 候选目录 `outputs/TaskMaster-4.0.2-newtab-add-73-20261003-r3`。release build/check、typecheck、lint、4 项定向回归及 Edge 154 `test:newtab-browser` 通过；Edge 用例包含普通/大任务延迟草稿清理。此前已知 `npm test` 有无关旧 `ui-layout` 静态断言失败，本次不报告全量测试通过。
- 开发→产品状态已发送。Issue #73 保持开放，待用户 Reload 原扩展并重新打开新标签页做一次 title-only 新增验收；未触碰真实 Google 凭据/任务、GUI、部署或 push。产品核对后的错误触发仍为假设，不能宣称已唯一归因真人卡顿。

## 2026-10-04 Issue #73 4.0.3 PATCH 与待验收（历史记录）

- 真人 Chrome Console 已将当前卡住的直接根因定位到 `cloneTask` 在 `persistTaskMutation` 创建保存快照时展开缺失/异常的 `completedDates`；local backup 有 197 条任务。4.0.2 的延迟草稿清理修复不是这次异常的根因。
- 4.0.3 对本机加载数据、备份导入及 mutation 快照中的 `repeatDays` / `completedDates` 做可选字段兼容；无法确认的完成日期不补造。按产品 DEC-newtab-add-02，改 `dueDate` 不推断完成历史；无历史时保留原 `completed` 标记，有明确历史时维持有截止日期系列的既有判定。mutation 准备异常显示可见错误、保留输入并恢复提交按钮。
- 合成数据回归覆盖缺失/null/错类型/部分无效完成历史、合法日期、父子关联；真实 Edge 154 隔离浏览器加载 4.0.3，表单仅提交一次并保留全部记录。`npm run build`、typecheck、lint、newtab feedback、task save failure、task draft、modal-sync、repeat-end-date、import storage 与 Edge `test:newtab-browser` 通过。
- 完整 `npm test` 仍被旧 `optional-split-child-dates` 静态正则断言阻断；与本次代码无关，没有改写该断言。未进行 GUI、生产任务读写、Google 授权、Worker 部署或 push。
- 4.0.3 候选：`C:\Users\Kairos\AppData\Local\Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Local\TaskMaster\worktrees\google-sync-c7c107c\outputs\TaskMaster-4.0.3-newtab-legacy-history-73-20261004`。稳定路径 `C:\Users\Kairos\Documents\TASK_MASTER\outputs\TaskMaster-3.16.2` 保持不变；原 4.0.2 备份位于 `C:\Users\Kairos\AppData\Local\TaskMaster\backups\extension-before-newtab-add-73-20261004-4.0.2`。14 个文件逐项 SHA-256 一致，扩展 ID `gjifmpjgedleemhkikajgepickfphflo`、公钥及权限未变。
- Issue #73 仍开放，等用户 Reload 后进行一次普通新增验收；失败时请不要反复创建，用单条最早 Console 错误继续定位。Google 同步 Issue #62 仍单独开放，本次没有更改同步协议或其验收状态。

## 2026-10-04 Issue #73 用户验收与 #74 交付

- 用户确认 4.0.3 普通新增已成功；#73 验收完成并关闭，开发执行槽转入已确认的 Issue #74。
- #74 独立分支 `codex/task-capture-visible-fields-74`，基线提交 `523b16f4e9d07b61b8082354d133a99111c0d27a`（4.0.3）。最终范围依产品 DEC-visible-fields-01：普通新增与已有手机添加入口直接显示预计时长、优先级、分类；新建默认 1 小时，主动清空仍表示未估时；编辑、草稿、历史任务和不确定重试保留原值；新子任务行默认 1 小时，父容器不赋时长。不改保存/API/同步协议。
- 扩展候选 `outputs/TaskMaster-4.1.0-task-capture-visible-fields-74-r2-20261004` 已核对 14 个文件并复制到稳定目录 `C:\Users\Kairos\Documents\TASK_MASTER\outputs\TaskMaster-3.16.2`。更新前版本 4.0.3 的完整备份位于 `C:\Users\Kairos\AppData\Local\TaskMaster\backups\extension-before-core-fields-74-20261004-4.0.3`。候选与稳定目录文件 SHA-256 一致，公钥、扩展 ID、权限未变；用户须 Reload 扩展验收。
- 手机正式入口 `https://taskmaster-api.yx9391.workers.dev/` 保持不变。原 4.0.3 相关 Worker `96d6b39d-a3d5-4972-ab4f-b91d505dee05` 上，#74 首版部署 `66577cb8-85b6-451a-a029-d1f065ea37de` 后收到同项 1 小时默认决定，已由最终版本 `0e29621a-1665-48f3-a50d-8b451b9f20e0` 替换且 100% 流量。最终版本前一回退点是 #74 首版 `66577cb8-85b6-451a-a029-d1f065ea37de`；回退整个 #74 可恢复 `96d6b39d-a3d5-4972-ab4f-b91d505dee05`。
- 验证：相关表单、手机保存/清空/安全重试、账号隔离、完成状态、草稿、拆分日期/过去日期/重复与筛选用例通过；typecheck、lint、构建和发布校验通过。全量测试被既有 `tests/ui-layout.test.mjs:32` 拆分字段顺序静态断言阻断；单独 `tests/newtab-favicon.test.mjs` 在 Windows 被 CRLF/LF 严格比较阻断。未改动无关测试；无 GUI、生产任务写入、D1 迁移、push 或 tag。
- Worker 部署后正式首页只读 GET 200/no-store，三字段默认在“更多选项”外、时长值为 60，备注/完成仍在高级区；Google 登录和会话恢复代码仍在；未认证分类 API 为 401。手机须刷新页面。
- Issue #74 等用户完成扩展 Reload 和手机页刷新后的真人验收；本轮没有 GUI 视觉验收。Google 同步 #62 保持独立开放，本项没有验证或更改同步行为。


## 2026-10-03 Issue #71 UX-05 实施检查点

- 已在 `codex/fast-task-capture-71` 实现扩展普通新增与手机添加的简化录入、无日期任务池、未估时表达、更多选项折叠及子任务可选排期；版本更新为 3.19.0。
- 扩展候选通过构建和发布清单检查，14 个候选文件已核验哈希并复制到用户既有加载目录 `C:\Users\Kairos\Documents\TASK_MASTER\outputs\TaskMaster-3.16.2`。旧 3.18.0 目录备份至 `C:\Users\Kairos\AppData\Local\TaskMaster\backups\extension-before-ux05-71-20261003`；用户只需在 Chrome 扩展页 Reload 以验收电脑端。
- 手机端代码已部署：产品提供已存在的 Wrangler 4.146.0 路径，未安装依赖。dry-run 通过，Worker 版本 `96d6b39d-a3d5-4972-ab4f-b91d505dee05` 已部署且 100% 流量生效；回退点 `b327393b-e2f0-4ced-bdda-ec4a3ae30664`。同 URL 只读检查：首页 200/no-store、日期 optional、未估时空值、“更多选项”存在；Google 客户端配置与会话恢复代码保留；未认证账号分类及旧任务/分类 API 401。没有生产任务写入、迁移或 GUI。
- typecheck、lint、build、CSS build 与其余 27 个独立测试通过。全量历史阻断：`ui-layout.test.mjs` 的旧断言检查错误文件；`newtab-favicon.test.mjs` 的严格换行符比较在 Windows 失败。未改动无关断言。未进行 GUI、生产任务写入、push 或 tag。
- Google 同步 Issue #62 与 #71 分开维护；本次没有修改 #62 同步协议或账号数据行为，也不据此宣告 #62 完成。

## 2026-10-04 Issue #75 UX-03 开发启动

- 按已确认需求从干净提交 `5a99ca8`（4.1.0）开始，唯一活动项为 Issue #75；新分支 `codex/task-save-destination-75`。实现限定扩展端，不修改 Worker、手机端、API 或同步协议。
- 目标：新增成功后说明任务池/本地日期去向；点击“查看”才打开管理页并临时定位任务，不改变用户筛选偏好；父任务反馈定位到父任务。
- 独立提交分支候选为 4.2.0；14 个候选文件已复制到原稳定加载目录 `C:\Users\Kairos\Documents\TASK_MASTER\outputs\TaskMaster-3.16.2`。更新前 4.1.0 完整备份位于 `C:\Users\Kairos\AppData\Local\TaskMaster\backups\extension-before-task-save-destination-75-20261004-4.1.0`；候选与稳定目录 14 个文件 SHA-256 一致，扩展公钥/权限未变。用户需 Reload 扩展验收。
- `npm run typecheck`、`npm run lint`、`npm run build`、release checker、`css-build` 与新增反馈/筛选定位定向测试通过；全量 `npm test` 停在既有 `tests/ui-layout.test.mjs` 拆分字段顺序静态断言，单独 `newtab-favicon.test.mjs` 仍被 Windows CRLF/LF 严格比较阻断。其余本次触达的后续测试单独通过。未修改无关断言。
- 未做 GUI/真人视觉验收；Google 同步 Issue #62 仍开放，本项没有改动或验证同步协议。等待用户 Reload 后点击一条成功提示的“查看”确认定位。
