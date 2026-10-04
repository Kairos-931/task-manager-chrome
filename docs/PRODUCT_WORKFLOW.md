# Product workflow

## 2026-10-03 产品交互评审与独立工具排查

- 用户确认本阶段先服务个人日常使用，核心目标为随手记录不遗漏，以及安排今天/本周任务。随后明确批准按评审意见逐项解决，进入串行需求交付。
- 用户另要求记录并新建聊天解决“重新连接”，已进一步确认是 Codex 对话自身反复重新连接，并非 TaskMaster 手机登录或扩展同步。
- 已建立独立聊天 `codex://threads/01a0fff4-6d12-79b2-b89c-9a2bd62c6344`，位于“codex的使用”项目，负责该工具故障的记录和排查。不替换本项目主开发，不登记为 TaskMaster 产品缺陷。本聊天继续产品交互评审。

- Project: `TaskMaster`
- Requirements task title: `【TaskMaster】产品`
- Requirements task: `codex://threads/01a0f1af-be64-7860-8c0d-660fdb71e2c9`
- Developer task title: `【TaskMaster】开发`
- Developer task: `codex://threads/01a0f6ce-2b91-7343-bb37-1b3f5d3d467a`
- Shared checkout: `C:\Users\Kairos\Documents\Codex-Case-Collisions\TASK_MASTER`
- Initialized: `2026-09-04`
- Status: active
- Next-development profile: gpt-6-luna / max（2026-10-03 用户再次明确后续统一使用；覆盖所有历史Sol/low后续偏好）。
- Active developer requirement: #74 core capture fields visible, in_development, gpt-6-luna/max; #73 user accepted and closed.
- Outstanding previous work: #69插件Reload与真人表单验收；#62 Google 同步剩余验收与历史数据归属，#64 密钥与身份历史事项，#66/#68 手机真人视觉及关闭重开验收；保留已交付成果，不占当前实现槽。真实登录与手机添加同步已有用户成功反馈，不能再写为尚未配置。
- Latest implementation delivery: #73 extension 4.0.3 / 523b16f, stable directory updated, user confirmed add succeeds. Worker 3.19.0; #72/#62 acceptance separate.
- Queue: 用户确认的其余交互目标依次为 UX-03 保存去向、UX-04 筛选空态、UX-06 周卡片改期、UX-08 本周剩余工作量、UX-07 硬截止可见性。逐项补充独立规格与验收后交付，不向忙碌开发注入其他目标；UX-09 撤销未纳入本次授权。

### 2026-10-03 UX-01 交付与默认日期决定

用户明确要求按评审意见逐项解决，并决定“随手新增任务，如果没有指定时间那就是任务池”。按既有字段解释为未指定计划日期就进入任务池；指定日期则按所选日期，包括过去日期，不变更文案。后续 UX-05 独立实施此规则。

主开发最新状态 idle/最新轮次 completed（01a0fd27-3378-7c70-9bea-58ed7543f469），与已收到手机交付报告一致；执行槽可用。第一项规格、评估、Issue #69 均已完成，沿用已批准 Luna Max、小型低至中等用量、单人串行和确定性验证。再次即时核对仍 idle 后成功发送，工具回执 threadId 01a0f6ce-2b91-7343-bb37-1b3f5d3d467a；仅 UX-01 开发中。

不默认创建后台监控；下一次产品检查或收到有效开发反馈时对账后续需求。用户本次授权后续目标，不代表它们已开始实现或已完成完整技术评估。

### 2026-10-03 用户调整后续执行配置

本节下方Sol/low为历史决定，已被用户随后“继续使用露娜max开发，我已经手工切到luna了”覆盖。当前#70及后续使用gpt-6-luna/max；模型修正已通过同项消息成功送达，Next-development字段与Approved profile已一致。

用户要求“下次使用 gpt 6 sol 轻度进行开发”，后续确认事项默认使用 gpt-6-sol / low。对范围明确的小修复和交互调整可从该力度开始，以必要行为测试作为验证；出现数据并发、账号/同步协议等具体风险再提出评估，不默认增加推理力度。未向正在执行的开发注入无关后续需求，未中断或宣称改变当前 #69 的运行设置。官方模型页确认支持 low：https://developers.openai.com/api/docs/models/gpt-6-sol；主机 send_message_to_thread 同样暴露此组合。
## Operating contract

### 2026-10-03 #70 候选复核

收到ef13e56/3.18.0候选；发布核对、草稿存储与清理测试通过，身份/权限一致。产品发现newtab按tab-ID保存但仅读同ID，关闭标签页后新标签无法恢复旧草稿，回开发补齐已有验收。安装目录暂保持3.17.5，#70继续占实现槽，UX-05不提前派发；当前模型Luna/max。

### 2026-10-03 收到 #69 交付并推进后续

开发交付事件 TM-20261003-task-save-failure-69 与终态轮次01a10000-18d4-7520-a2f9-f1905e7ce2a5 completed对账，runtime idle，无在跑写入者。#69实现与候选已核验，改awaiting_user_acceptance，不继续占实施槽。产品核对候选身份/权限、备份并更新稳定已加载目录，14文件哈希匹配、manifest3.17.5；后续Reload由用户操作，保持Issue开放。此前开发终态“旧目录未覆盖”是产品更新前状态，以本记录为准。

下一项UX-02已形成独立规格docs/requirements/REQ-20261003-task-form-draft.md及Issue#70，沿用用户指定gpt-6-sol/low，单人串行，确定性验证；须临发送再核对空闲。#69等待验收不阻塞独立草稿实现，但新基线必须保留#69修复。

即时空闲核对后已成功发送#70，工具回执threadId 01a0f6ce-2b91-7343-bb37-1b3f5d3d467a，model gpt-6-sol/low。本项唯一占槽，其余六项待后续规格与交付，不假称后台自动并行执行。

### 状态反馈规则（2026-10-02 更新）

总规则：开发只要停了就反馈原因，正常干完也必须反馈。报告已完成/未完成、验证与交付状态，以及下一步及负责人；完全完成且无后续动作时明确说明。主动停止前发送，意外中断在恢复后补报；开发聊天的最终回复不能代替发给产品的报告。

开发暂停、受阻、未完成退出、本地完成或进入待配置/验收/部署状态时，在结束回复前将事件写入需求并主动发送产品。用户已授权这类状态反馈；收件人为上方登记的产品对话。记录事件 ID、状态、已做/未做、下一责任人和发送凭据；只有开发侧最终回复不算送达。工具失败需明确说明，结果未知先查收件记录防重复。

产品每次交付/状态检查同时对账最新结束轮次与反馈记录，发现漏报当次补查。开发角色以当前聊天 ID 与项目映射为准，不能因继承了“这里聊产品”的旧消息而自行切换角色。本次规则更新不改变下方各需求已有执行/验收状态，也不启动后台监控。

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

## 2026-10-02 开发批准

用户明确批准两项已记录优化进入开发。沿用gpt-6-luna / max、单人串行，独立Issue及本地提交；先保存反馈，再移除旧页面入口。先核对线上实际行为并执行相关行为回归及项目检查；不调用GUI、不安装新依赖、不自动部署或push，发布前提供准确diff与验证证据。

旧页面兼容策略：移除管理员旧入口和连接页面，旧页面导航到当前根登录页，不转发旧连接参数或密钥；后台旧API与Telegram不变。

### 2026-10-02 用户验收更正与弹窗添加阻塞

用户反馈3.16.2 popup添加按钮被block，无法添加；已授权检查修复，优先恢复核心新增功能。两项手机体验优化暂停实施但保留成果，不标完成。
手机仅快速添加入口，不增加任务管理。用户暂不执行未登录验收，暂无其他设备，其他设备恢复验收未执行；同一账号重新登录不必另一设备，但不强制用户本轮执行。
新独立bug须实现前关联Issue，修复采用本地源码/行为验证，不擅自覆盖用户实际加载候选。用户加载路径为旧项目outputs中的交付包，只读定位，正式源码仍是最新Codex-Case-Collisions项目。

### 2026-10-02 Issue联动

#65用户验收后已关闭；手机保存反馈#66进入开发，移除旧入口#67串行排在其后。#62保留未完成验收与历史归属事项，不标全部完成。


## 2026-10-02 用户授权的常规发布边界

用户明确授权产品侧自行决定已确认需求内的低风险发布，不逐次申请部署批准。产品侧可安排同一项目既定地址、已有工具/账号、可回退且不破坏数据的常规Worker发布，须先完成相关验证、核对干净候选及回滚点，记录发布和结果。

不自动扩大到业务数据删除/归属认领、破坏性迁移、扩展身份或正式地址变更、不可逆外部操作、收费套餐购买、git push或未授权GUI控制。涉及这些边界仍需明确授权。此具体用户授权优先于此前默认每次部署必须单独询问的约定。

### 2026-10-02 第二轮手机优化生产交付（开发报告）

#66提交b093cbe：居中非模态提示卡，成功1.8秒收起，失败/未知状态保留与安全重试。#68提交51a03998084dd375b455c70986eaaf15b7907556：原sessionStorage关闭标签丢失，改有限期TaskMaster会话localStorage，迁移当前标签旧会话；启动先经服务端身份核验，临时错误保留凭证，明确失效/退出清理。7天不变。

已发布3.17.4，Worker version b327393b-e2f0-4ced-bdda-ec4a3ae30664，100%流量，正式URL不变；回退5c1ef64a-9ba5-4ef4-8d4d-3a482f54b798。开发报告定向回归/typecheck/lint/dry-run通过，全量测试仍原ui-layout断言阻断。线上只读页面与路由核对通过，不算真实视觉/登录验收。未GUI、任务写入、迁移、扩展更新或push/tag。

状态awaiting_user_acceptance：真人手机弹层与保存操作、同一常规浏览器关闭重开待用户验收。旧sessionStorage若已丢失先登录一次，隐私/内置浏览器站点存储限制仍存在。暂不关闭#66/#68，#62剩余验收不扩大。


## 2026-10-03 UX-05 串行派发

#70闭标签恢复补丁复核通过并安装3.18.0，14文件哈希匹配，有原包备份；没有GUI或用户验收，Issue70保留开放。临发送开发snapshot idle/最新轮次completed，#71独立规格r1及Issue已建，成功发送主开发，明确工具覆盖gpt-6-luna/max。唯一实现槽归#71，其他五项继续等待。用户已批准按评审逐项解决，最新配置明确Luna/max；本项单开发、工程中型、中等用量，不新增并行写入者。

## #71 最终交付对账

18afff9/3.19.0已更新扩展稳定目录；Worker96d6b39d-a3d5-4972-ab4f-b91d505dee05已上线，回滚b327393b-e2f0-4ced-bdda-ec4a3ae30664。产品线上GET、manifest与最新祖先链核对通过，待用户Reload/手机刷新和真实界面验收，Issue71保持开放，槽释放。后续首项UX-03尚未派发。实际71因用户在开发对话17:21:35更晚直接指令改为Sol/low，原Luna/max派发记录保留；后续默认配置不由该单项指令擅自改变。


## 用户再次确认后续Luna/max

用户明确要求后续继续使用luna max完成开发任务。所有后续派发使用gpt-6-luna/max工具覆盖，无需重复确认；#71历史Sol/low执行记录保留。本次仅更新配置，不向空闲开发发送会启动新轮次的纯确认消息，也不提前派发尚未完善规格的UX-03。


## 2026-10-03 导入去重合并能力确认（暂缓）

用户确认导出后再导入时必须去重合并，不能生成两份任务，不覆盖当前独有数据。规格 docs/requirements/REQ-20261003-import-deduplicate-merge.md，状态confirmed_deferred。用户明确暂时不用，未派发、未加入自动启动队列、未执行真实数据导入；开发前需细化冲突及删除历史规则并建立独立Issue。当前3.19.0导入仍直接保存文件快照，不得宣称已实现安全合并。后续配置Luna/max。

## #72 用户解除暂缓并交付开发

用户明确要求转开发，产品补齐r2预览、默认保留当前冲突、删除记录保护、旧格式提示、账号及并发保存规则，建立独立Issue72，展示Luna/max及中型偏大工程/中高用量。发送前开发idle/最新轮次completed，成功派发并工具覆盖Luna/max，从18afff9/3.19.0继续。72唯一占槽，优先于原评审队列；71真人验收保持开放。禁止真实用户数据导入或无授权GUI。


## 本轮4.0.0版本决定

用户批准以Google同步架构升级作为4.0产品阶段，72下一交付版本4.0.0。当前源码/稳定包仍3.19.0，72运行中且未交付，不混淆待发布与当前安装。版本规则例外已先保存AGENTS与DEC-import-merge-01；保持Luna/max。本地升版授权明确，用户所指相关同步待澄清，未执行push/tag/真实数据导入。

## 新标签页添加无反应 / Issue73 等待

用户报告当前管理新标签页新增点击添加没有反应；产品只读确认稳定包3.19.0，未复现GUI，未确认根因。独立BUG-20261003-newtab-add-unresponsive.md与Issue73已建。用户明确选择先完成72导入合并，再修73；72仍唯一在开发，73队列首位，后续UX-03等保持等待。73配置Luna/max，未向忙碌开发发送无关任务，未使用桌面控制。72完成清晰释放槽后按已授权范围派发73，不重复请求优先级。

## 72交付及73接续准备

72代码226b64b/4.0.0已构建更新稳定目录；产品发布检查、两组导入行为测试、14文件哈希复核通过。72待用户验收、Issue开放；62独立仍待剩余验收。73按用户指定顺序下一项，待本开发轮次完成后派发，勿将临终回报前active误当新写入者。未push/真实导入/GUI。


73串行接续已成功发送主开发Luna/max；72已明确报告完成、工作区干净并核验交付，runtime仍显示其临终回报轮次active，已在消息明确先结束72再单开发接续73，不将它称为idle。73唯一下一实施事项，其余队列不派发。


## 73产品决策DEC-newtab-add-01

批准确定性反馈缺口修复：本地成功无日期新增提示已添加到任务池，有日期任务已添加，当前视图保留。尚无原始真人事件阻断根因证据，不声称已复现；成功/失败提示事件链行为验证，待用户Reload验收。UX-03后续扣除本次已覆盖部分，不重复开发。


## 73交付复核

086f3d8/4.0.1原稳定目录已更新，产品release检查/反馈行为测试及14文件哈希通过。实现槽释放，73仍等待Reload/新标签页真人验收，原始无响应未复现，不能标完全验收或关闭Issue。72导入验收及62同步剩余验收保持独立。无push/Worker/生产任务写入。后续UX-03先核对已覆盖反馈后再完善剩余规格，不重复做已交付提示。


## 73验收失败再排查

用户报告4.0.1添加仍无反应、弹窗未正确关闭，73尚未解决。反馈缺口补丁不等于根因修复，73优先继续同项纠正；Luna/max。其余评审队列不派发，不使用未授权GUI。


73纠正派发成功：发送前runtime idle/最新轮次completed，工具gpt-6-luna/max。同BUG继续定位真实提交阻断，用户无需重复批准。


73真人环境已确认4.0.1、ID gjifmpjgedleemhkikajgepickfphflo；首次点击瞬间闪过未知内容，随后点击无反应。补给开发作为保存锁/重渲染/监听/登录异步分支证据，不再假设版本错误。


## 73纠正候选4.0.2交付

3147f3d/r3已安装稳定目录4.0.2，产品发布核对/草稿与反馈回归/14文件hash通过；已验证延迟草稿删除导致的UI阻塞修复，实际用户Chrome触发仍待验收，73不关闭。62/72验收独立，无push/Worker/生产写入。


## 2026-10-04 73真实报错

用户4.0.2Console confirmed completedDates is not iterable：cloneTask→persistTaskMutation→form，197本地任务、按钮未变。此前草稿等待修复未解决该真实分支。73继续优先，Luna/max，兼容历史完成字段并捕获复制阶段错误，保留全部数据/有效历史，不清库。


## 2026-10-04 新增核心字段可见性 / Issue74

用户明确要求新增任务的时长、优先级、分类不要折叠。独立规格REQ-20261004-task-capture-visible-fields.md、Issue74已建，confirmed_queued。三字段移出更多默认可见；时长仍可空为未估时，日期规则不变，其余高级字段继续渐进展示。默认已有新增入口一致，但不新增手机不支持字段。73 completedDates真实阻断修复先完成；随后74排在旧交互队列前，Luna/max单开发，不向忙碌73注入无关修改。74不回改历史已交付UX05规格，仅显式覆盖其字段折叠规则。


## 2026-10-04 Issue #73 4.0.3 PATCH 交付

- 根因是旧任务缺失或异常 `completedDates` 在点击新增后、保存状态开始前触发未捕获异常。已完成加载/导入规范化、快照保护、用户可见失败提示；按 DEC-newtab-add-02 不从 `dueDate` 改动推断完成历史。
- 本地 commit `523b16f`，4.0.3 已覆盖稳定加载目录 `C:\Users\Kairos\Documents\TASK_MASTER\outputs\TaskMaster-3.16.2`。4.0.2 更新前备份 `C:\Users\Kairos\AppData\Local\TaskMaster\backups\extension-before-newtab-add-73-20261004-4.0.2`；14 文件 hash 匹配候选，扩展 ID/公钥/权限未变。
- Build、typecheck、lint、定向回归和 Edge 154 隔离旧数据表单测试通过。完整 npm test 被既有 `optional-split-child-dates` 静态断言阻断；无 GUI、生产任务写入、Google 凭据、部署或 push。
- #73 仍待用户 Reload/一次表单验收；#74 保持 confirmed_queued，本次不实施。#62 Google 同步仍为独立开放需求。

## 2026-10-04 73根因补丁交付4.0.3

523b16f原加载目录4.0.3、14文件hash匹配，产品发布/保存失败/导入集成复核通过；真实197任务未接触。用户明确堆栈分支已修复，73仍待Reload真人验收。74保持排队，62同步验收独立；无push/Worker/GUI。


## 2026-10-04历史Issue审计与74派发

用户确认添加成功并要求排查历史Issue；已关闭73/54/56/67，各附证据，完整对账docs/ISSUE_AUDIT_20261004.md。55历史completed与当前渲染无合计展示不一致，留开放复核；未验收功能不批量关闭。74临发送开发idle，工具Luna/max已派发，从最新4.0.3继续，唯一占槽；其余评审队列等待。

## 2026-10-04 用户补充验收

用户批注明确确认导入合并、草稿恢复、手机反馈与登录保持验收完成。72/70/66/68已附交付凭据并关闭；对应需求改completed。用户明确Google多设备同步保持开放，62不关闭。55仍仅记录旧完成文档与当前无时长合计展示的差异，向用户解释目标为父任务显示全部直属子任务时长合计，不将其当作新增数据丢失或用户已批准重新实现。74仍唯一开发项，不发送无关验收消息干扰。

## 2026-10-04新建估时默认修正

用户明确要求新建默认1小时；DEC-visible-fields-01补入74并覆盖旧UX05默认未估时。只改新建/新行默认，编辑/草稿/历史数据保留，父容器不加时长，主动清空仍可未估时。正在开发74同项补充，Luna/max。

