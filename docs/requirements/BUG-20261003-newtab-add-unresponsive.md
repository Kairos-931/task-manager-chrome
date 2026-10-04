# 新标签页新增点击添加无反应

- Status: awaiting_user_retest
- Reported: 2026-10-03
- User symptom: 网页端管理新开页面，新建任务，添加任务，点击添加没有反应。
- Confirmed surface: Chrome 扩展新标签页（不是手机添加页）。用户验收前版本 4.0.1，扩展 ID `gjifmpjgedleemhkikajgepickfphflo`。

## 目标和范围

恢复新增基本路径：填写合法标题，日期/估时可不填，点击添加应保存一个任务并显示明确结果；缺少必填信息或保存失败应给出可见反馈，不能看似无响应。保留未排期入池、过去日期、未估时、草稿和登录同步能力。不做任务列表全量重设计。

## 定位与发布

shared/render.ts、events.ts、task-form.ts 以及新标签页构建入口；源码改动经build生成newtab.js，更新原稳定安装目录后用户Reload和重新打开页面生效。已有打开的页面可能运行旧脚本；引导重载后重新打开但不归因于缓存，先核查根因。当前静态检查只发现潜在原生校验/事件/草稿上下文分支，未确定根因，不声称修好。

核对新增普通模式时隐藏父子控件是否disabled、折叠高级控件是否造成原生validation拦截、脚本初始化/运行异常、提交处理是否触发、草稿冲突提示可见、是否已经保存到任务池但今天视图未显示。不能把成功存储与列表未显示混为一谈。测试使用虚构数据，不操作生产任务。

## 验收及约束

普通新增只填标题一次成功、无日期进任务池；所选过去日期按选定日期保存；更多折叠/展开均可保存；草稿恢复后可保存；重复点击不重复；本地失败保留内容并明确错误；编辑与父子模式不回归。相关行为测试、typecheck/lint/build/release checks。未获GUI授权，不控制浏览器/桌面或声称视觉复现完成。配置Luna/max。

当前开发忙于72，已请求用户选择是否暂停72优先修复本BUG；答复前不向忙碌开发注入无关任务或要求切换。此记录不代表已复现或开发已开始。

- Issue: https://github.com/Kairos-931/task-manager-chrome/issues/73

用户已选择：先完成导入合并，再修复添加问题。72保持当前唯一实施事项；完成后73优先于其他评审队列，配置Luna/max。不向当前忙碌开发注入73。


执行评估：Luna/max，单开发串行，工程小至中型、AI用量低至中，根因未确认故置信度中。当前最新226b64b/4.0.0保留导入合并作基线；fix下一交付4.0.1。无GUI授权，以行为回归和构建产物验证，原症状真人验收待用户；禁止混入其他需求或改变数据/ID。


72明确完成报告、干净commit及产物核验后，已成功发送串行接续73，工具Luna/max。运行快照仍旧轮次active，消息明确须收尾72后开始，不并行注入实施。


## DEC-newtab-add-01：保存成功反馈，不自动切换视图

开发静态路径及task-form-regression/task-pool-view/task-draft/task-modal-sync-stability/task-save-failure测试未发现明确事件/原生校验阻断，未GUI复现原始症状。已确认无日期新增成功后进入任务池，focus今日视图不显示，成功分支无提示。因此批准修复这个可证实的反馈缺口，不能将其宣称已证明是用户原始点击无响应唯一根因。

新建本地持久化成功后提供沿用现有统一toast的明显反馈：未排期“已添加到任务池”；有日期“任务已添加”。保持当前视图，避免打断连续捕获。提示必须发生在本地真正保存成功后，失败/冲突不能成功提示，异步云失败不能称本地失败；保留输入和幂等保护。普通和大任务新建路径都核对，父子模式如用不同结果文案应说明准确保存结果，不称全部子任务都入池。不要新增“应该哪天完成”文案。

确保toast在弹窗关闭重渲染后仍能显示，不立即被旧container销毁；符合现有反馈组件时长与可访问性。用实际事件链行为测试证明成功持久化后的提示，以及失败不成功提示，而非仅字符串断言。界面真人验证未做，Issue73保持待用户验收；如重载后仍无反应，继续定位运行异常/校验，不能以“任务池里有任务”代替根因验证。

本项只补成功反馈、不自动跳转或重做界面；UX-03保存去向评审项有范围重叠，后续对账已覆盖无日期提示，不再重复开发同一能力，其余不同日期定位等需求另行明确。

## 4.0.1交付

086f3d8已修复普通新增本地成功后无提示的确定性缺口；父任务沿用原反馈。原始真人点击未复现不改写为已证明根因。稳定目录4.0.1，产品独立发布检查与newtab-add-feedback行为测试通过，14文件哈希一致；原4.0.0备份extension-before-newtab-add-73-20261003。typecheck/lint通过，全量test既有ui-layout断言仍失败。未GUI、生产写入、Worker部署或push。73等待用户Reload后新标签页验证，Issue保持开放，实现槽释放。


## 用户验收失败：添加仍无反应，弹窗未正确关闭

用户在收到4.0.1重载验收步骤后报告“添加仍然无反应，弹窗未正确关闭”。成功反馈缺口修复不能作为原症状的修复证据。73继续开放，原始BUG未解决；优先于后续需求，Luna/max继续同项排查。

必须定位真实提交路径，检查原生校验是否阻止submit、事件初始化/同步渲染更换container、草稿初始化/保存队列等待、账号确认、同步等待和异常是否有可见反馈。无日期只填标题必须能完成本地持久化并正常关闭；失败明确显示阻塞原因且保留输入。不能通过清空数据/禁用账号保护/绕过所有校验来解决，也不能仅追加toast再报告成功。优先构建真实表单事件与validation可验证链路测试；无GUI授权，不声称真人复现完成。当前基线4.0.1/086f3d8，保留4.0导入合并。已知数据与安装路径不变。

## 2026-10-03 #73 浏览器提交链核查（根因未确认）

- 新增真实浏览器回归脚本 `tests/newtab-native-submit.browser.test.mjs`：使用隔离临时 profile 和真实扩展 API/DOM；Edge 154 加载稳定目录 `outputs/TaskMaster-3.16.2` 的 4.0.1 后，空标题受原生 required 校验拦截；只填标题后，真实按钮点击只产生一次 submit，本机存储恰好一条无日期、duration=0 的任务，成功提示“已添加到任务池”，弹窗关闭。没有接触用户任务数据。
- 同一 4.0.1 在隔离 Chrome 154 中未进入扩展运行时：目标页被浏览器显示为 `ERR_BLOCKED_BY_CLIENT`；当前进程只有扩展页面访问被拦截，不能据此判断用户 Chrome 的提交表现。Chrome 官方文档说明 `--headless=new` 可用于扩展端到端测试；企业策略也存在禁止命令行加载扩展的选项，但本机对应注册表策略未发现，具体拦截原因未确认。
- 目前在真实扩展事件链没有复现点击无响应：原生校验、普通新建、本机持久化、成功提示和关闭均在 Edge 通过。因此未改应用源码、未升版本、未覆盖稳定目录、未 commit/deploy/push；#73 仍开放，不能报告已修复或验收通过。
- 下一步请产品核对真人验收使用的扩展 ID/版本/加载目录和最短点击步骤；确认仍是稳定目录 4.0.1 后，收集点击后按钮/错误提示/任务池表现，再依该路径继续定位。开发继续保持单项占用；无子代理、GUI 操作、生产写入或部署进程。

## 2026-10-03 #73 自动化回归与产品核对状态

- 将真实浏览器回归提供为独立命令 `npm run test:newtab-browser`（不并入常规 `npm test`，避免没有浏览器的环境无法运行）；在本机需显式指定 Edge：`$env:CHROME_PATH='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'`。
- 最终检查：`npm run typecheck`、`npm run lint`、真实浏览器回归均通过。回归使用临时浏览器 profile，关闭后清理，不创建生产任务。
- 开发→产品核对事件 `TM-20261003-newtab-add-73-browser-triage-01` 已发至产品任务 `01a0f1af-be64-7860-8c0d-660fdb71e2c9`；发送工具返回同一 threadId、`isError=false`。请求产品确认验收扩展 ID/版本/加载路径、复现步骤和点击后可观察现象。
- 产品确认真人环境前，开发停在诊断检查点；Issue #73 未关闭，4.0.1 未重打包或覆盖用户加载目录。测试脚本及 package.json 独立浏览器命令为当前唯一未提交文件变更；未创建子代理或遗留进程。

## TM-20261003-newtab-add-73-browser-triage-01

开发报告使用Edge154隔离profile、真实扩展API/原生DOM测试稳定目录4.0.1：有效标题、无日期/估时点击一次本地保存一条、提示及关弹窗均通过；空标题原生校验拦截。Chrome154隔离headless在扩展启动前ERR_BLOCKED_BY_CLIENT，不能解释用户提交失败。未修改应用源码/升版，73仍未解决。隔离测试不等于用户当前Chrome实际路径验收，不据此关闭Issue。

产品已向用户请求实际Chrome版本/扩展ID以及点击后保存中状态/错误文字，不要求生产数据导出或截图。加载目录需后续在必要时核对，不能要求用户长篇诊断；等待这些决定分支的信息期间保持已有数据和页面。无Windows前台控制授权。

## 2026-10-03 #73 4.0.2 PATCH 候选与待验收

- 根因证据：普通新增的 `persistTaskMutation` 在本地任务保存成功后，原代码仍 `await clearDraft()` 才清表单、重渲染、解锁按钮和显示成功反馈。隔离 Edge 真实扩展测试将 `chrome.storage.local.remove` 回调延迟 1.5 秒，能稳定复现任务已落盘但旧弹窗仍开、按钮仍禁用；第二次点击无法提交。修复把 UI 收尾跟随本地持久化完成，草稿清理异步继续，清理失败仍提示“任务已保存，但草稿清理失败”。这证明代码里有与用户描述吻合的阻塞点和有效修正，不能证明用户那次 Chrome 卡顿一定由 remove 回调导致。
- 普通新增与大任务新增的成功收尾都已改为不等待草稿删除回调。按产品补充，表单监听绑定创建时的 `TaskDraftStore/context`，避免迟到清理使用后来切换的全局 store。测试在旧 clear 延迟时立即重开并填写新草稿，确认新写入排在同一 store/key 的旧 remove 后并保留；还模拟已提交任务仍有旧草稿时重载，确认待提交草稿 ID 已存在会阻止恢复且不会重复建任务。合成账号、任务和同步响应仅存在隔离 Edge profile；未接触真实 Google 凭据、线上任务或用户 Chrome。
- 版本 4.0.2（PATCH），本地 commit `3147f3d`。候选 `C:\Users\Kairos\AppData\Local\Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Local\TaskMaster\worktrees\google-sync-c7c107c\outputs\TaskMaster-4.0.2-newtab-add-73-20261003-r3`；已更新原稳定加载目录 `C:\Users\Kairos\Documents\TASK_MASTER\outputs\TaskMaster-3.16.2`。更新前 4.0.1 备份：`C:\Users\Kairos\AppData\Local\TaskMaster\backups\extension-before-newtab-add-73-20261003-4.0.1`。候选、备份与落地目录均为 14 个文件，落地文件 SHA-256 与候选逐项相同；原 extension ID、public key 和权限不变，正式路径不变。
- 验证通过：4.0.2 release build/check、typecheck、lint、`newtab-add-feedback`、`task-save-failure`、`task-draft`、`task-modal-sync-stability` 及 Edge 154 `test:newtab-browser`。浏览器测试覆盖原生必填校验、首次/二次点击保护、普通/大任务延迟草稿保存与清理、登录态合成远端重渲染、快速重开、失败重试和重载后旧草稿抑制。没有声称全量 `npm test` 通过；此前已知其受无关的旧 `ui-layout` 静态断言阻断。
- Issue #73 保持开放、状态等待用户在原 Chrome Reload 后重开新标签页，以一个标题-only 任务点击一次并确认列表恰有一条、成功提示出现且弹窗关闭。未操作 GUI、生产 Google 会话/数据、部署或 push。

## 用户实际环境确认与首次点击状态

用户确认Chrome扩展“任务管理 - TaskMaster”4.0.1，ID gjifmpjgedleemhkikajgepickfphflo，与稳定身份一致；不能再按版本不对/旧ID归因。点击未看到保存中，或瞬间太快无法辨认；原话“确实后一瞬间显示了什么东西 再点就没有反映了”。弹窗此前报告未正确关闭。

新增诊断重点：首次提交后DOM重渲染、保存锁释放、按钮disabled恢复、监听绑定丢失、异步同步/草稿更新刷新与旧container引用，登录状态下与隔离访客测试差异。以上是待验证假设，不是根因。不要因未肉眼看到保存中就直接认定submit未触发，闪现也不能直接认定已经保存。开发应对真实首次→第二次点击序列、远端应用触发rerender分支进行确定性验证，避免让用户反复创建重复任务。

## 草稿清理等待阻塞：4.0.2候选准备

开发在隔离真实浏览器注入清理延迟，复现本地任务已保存但await clearDraft后才收尾，造成弹窗仍开/按钮disabled/二次无效。补丁在本地保存成功后立即做UI收尾，草稿仍串行清理；清理失败单独提示任务已保存但草稿清理失败。E2E覆盖合成登录态、远端消息/重渲染、清理延迟、保存失败后重试及去重。证明可复现代码阻塞点，不证明用户实际Chrome当次回调一定卡住；73保持待验收。

产品要求迟到清理绑定原草稿键/上下文，不删后续新表单草稿；成功保存后尚未清理的旧草稿不得在快速重开中作为未提交任务恢复、诱发重复。补丁保持保存失败恢复按钮/可见错误、不清输入，账号切换边界不变。4.0.2须构建备份核验后交付，不在本记录声称已安装。

## 4.0.2最终候选复核

3147f3d，r3候选与稳定目录manifest4.0.2。产品独立release、task-draft、newtab-add-feedback测试通过，14文件SHA256一致。开发报告typecheck/lint/四项回归及Edge154原生提交隔离E2E通过；4.0.1备份extension-before-newtab-add-73-20261003-4.0.1。普通/大任务本地成功不等待草稿删除，迟到清理不覆盖新草稿，已保存pendingID旧草稿不恢复。未用户ChromeGUI、生产数据、部署或push，旧全量静态失败保留。73仍开放等真人Reload验收，不能宣称实际Chrome唯一原因已证明。


## 2026-10-04 真人Chrome确定性错误

用户Console：newtab.js:2293 Uncaught (in promise) TypeError: task.completedDates is not iterable；cloneTask → Array.map → persistTaskMutation → HTMLFormElement handler newtab.js:6682。后台报告loadData got197 tasks from local backup。按钮未变。此证据证明提交在复制现有任务阶段因某条completedDates非可遍历数组而失败，发生于按钮保存状态前；先前草稿删除延迟修复不是此次错误根因。

纠正产品边界：兼容旧/缺省/异常completedDates，不清空现有197任务，不改有效完成历史；有效数组保留，缺省/null/非法类型安全规范化为可用数组，无法可靠转换的内容不得虚构完成记录。审查其他被spread的可选历史字段及导入/存储边界，避免相同结构异常阻断全部新增。clone/mutation阶段异常亦应捕获并显示可见错误，不能Uncaught导致按钮无响应。新增行为回归必须使用含旧字段缺失/null/非法类型的已有任务集，通过真实persistTaskMutation及表单保存链验证新增成功、原数据关系/有效历史完整。无真实用户数据导出/清库或GUI授权。

继续同Issue73、Luna/max，从最新4.0.2累积基线修复PATCH；用户现已提供足够诊断，不要求再次重复点击。


## DEC-newtab-add-02：完成历史不得从改期推断

开发历史证据：toggleTask明确记录实际完成日期并推进dueDate，但moveTaskToDate也可只改dueDate，不意味着完成。storage迁移中的空completedDates按repeatStartDate/dueDate反推完成历史没有可靠前提。因此产品批准本次相关兼容修复去除不可靠反推，不寻找并不存在的“推进一定完成”产品规则。

保留明确存储的有效completedDates；缺失/null/非法类型安全归一为空，不凭日期推进补造完成记录。无可靠有效日期时保留现存task.completed标记，不因归一化将旧完成任务批量改为未完成。明确有效数组场景原重复系列完成判定需回归，不广泛改写所有任务状态。

本次只是阻断兼容路径中的错误推断，不对真实库批量删除完成记录，不清数据；已经持久化的日期即使可能曾推断也不自动回溯删除。用虚构旧循环数据验证只有改期不会新增完成日期、缺失历史不改变原完成标记、合法完成记录与实际完成动作保留。73继续同项，独立74字段可见性等待73完成，不混入。

## 2026-10-04：4.0.3 补丁交付，等待用户验收

- 真人 Console 根因已修复：缺失或异常的 `completedDates` 曾在新增前复制任务列表时触发 `TypeError`，异常没有可见反馈，按钮尚未进入保存状态。存储加载、导入和快照复制现在兼容缺失/null/错类型/部分无效字段；有效日期与父子关系保留，缺失完成历史不会从改期推断，原完成标记保留。
- 4.0.3 候选：`C:\Users\Kairos\AppData\Local\Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Local\TaskMaster\worktrees\google-sync-c7c107c\outputs\TaskMaster-4.0.3-newtab-legacy-history-73-20261004`。已安装到原加载目录 `C:\Users\Kairos\Documents\TASK_MASTER\outputs\TaskMaster-3.16.2`。安装前 4.0.2 备份：`C:\Users\Kairos\AppData\Local\TaskMaster\backups\extension-before-newtab-add-73-20261004-4.0.2`。候选、稳定目录与备份均 14 个文件；安装文件 SHA-256 与候选逐项一致，扩展 ID `gjifmpjgedleemhkikajgepickfphflo`、公钥及权限不变。
- 本地提交：`523b16f fix: normalize legacy task history before add`。`npm run build`（含发布检查）、typecheck、lint、反馈/保存失败/草稿/模态同步/重复日期/导入回归及真实 Edge 154 隔离浏览器 E2E 通过。浏览器用 7 条合成旧任务验证真实新标签表单只新增一条、所有旧记录及父子关系保留、异常字段安全规范化。没有读写 197 条真实任务或真实 Google 会话。
- 完整 `npm test` 仍停在既有 `optional-split-child-dates` 静态正则断言；本次没有改动该无关断言。没有 GUI/视觉验收、push、Worker 部署或生产数据写入。
- Issue #73 保持开放。用户只需在 Chrome 扩展管理页 Reload，确认 4.0.3，然后在新标签页用一个标题点击一次“添加”。若仍失败，无需重试或重建任务，提供首条 Console 错误即可。Google 同步 Issue #62 仍独立开放；Issue #74 的核心字段可见性需求已排队，待 #73 完成后处理。

## 2026-10-04 4.0.3交付复核

523b16f修复用户实际completedDates堆栈，加载/导入/快照兼容旧完成/重复字段，准备异常可见反馈，遵守DEC02不从改期推断历史。产品发布检查、task-save-failure、import-preview-storage通过，14候选/安装文件hash匹配；备份4.0.2在extension-before-newtab-add-73-20261004-4.0.2。开发合成旧数据E2E通过，未读取/写入用户197任务或真实凭据，不宣称真人验收完成。全量旧静态失败保留。73开放等待Reload4.0.3单次验收；74暂等待，62独立。


## 2026-10-04 用户验收通过

用户回复ok 添加完成。4.0.3/523b16f原新增故障验收通过，GitHub73已留记录关闭；62/72等不由本项推断通过。
