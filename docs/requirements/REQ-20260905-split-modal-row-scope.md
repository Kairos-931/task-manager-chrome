# 拆分弹窗误校验隐藏子任务

- Status: awaiting_user_acceptance
- Priority: P1
- Target version: 4.3.2
- Confirmed date: 2026-09-05
- GitHub issue: #52 — https://github.com/Kairos-931/task-manager-chrome/issues/52

## Objective and user value

- User goal: 已填写拆分弹窗中的子任务标题后，可以正常完成拆分。
- Current problem: 提交拆分时使用页面级 `.split-child-row` 查询，把隐藏的新增可拆分任务弹窗中的空白行一起校验，错误提示“请填写子任务标题”。
- User-visible outcome: 拆分校验只检查当前拆分弹窗中的子任务，不受其它隐藏弹窗影响。

## Scope

### Included

- 将拆分提交、删除按钮绑定和子任务数量判断限定到 `#splitTaskModal` / `#splitChildren`。
- 增加“拆分弹窗与新增可拆分任务弹窗同时存在”的回归测试。
- 校验失败时继续聚焦当前拆分弹窗内真实无效的字段。

### Not included

- 不改变拆分规则、父子任务数据结构、同步协议或日期交互。
- 不修改手机端或 Worker。

## User flow

1. 用户对任务点击拆分并填写至少两个子任务。
2. 用户点击完成拆分。
3. 系统只校验当前可见拆分弹窗的行，并正常保存有效内容。

## Interaction specification

- Entry point: 任务更多操作 → 拆分。
- Default state: 沿用现有两个子任务行。
- Actions and feedback: 真实缺失标题时提示并聚焦对应行；隐藏弹窗内容不参与校验。
- Responsive behavior: 无布局变化。
- Demo or visual references: 用户现场复现描述。

## Data and safety boundaries

- Reads: 当前 `#splitChildren` 内的输入行。
- Writes: 沿用现有确认后的父子任务保存。
- Must not do: 不读取其它隐藏弹窗的 `.split-child-row`；不得部分保存。
- Effect on original files or external systems: 扩展端事件选择器和测试；无数据迁移。

## Failure and edge cases

- Empty state: 少于两个当前拆分行时提示至少保留两个。
- Invalid input: 标题、时长或日期无效时只定位当前拆分弹窗中的对应字段。
- Missing path or unavailable service: 沿用现有本地保存失败处理。
- Failure message and next action: 错误信息必须与当前可见的真实无效字段一致。

## Acceptance criteria

1. Given 页面同时渲染隐藏的新增可拆分任务行，when 当前拆分弹窗所有子任务有效并提交，then 拆分成功且不出现错误标题提示。
2. Given 当前拆分弹窗某一行标题为空，when 提交，then 提示该行标题缺失并聚焦它。
3. Given 当前拆分弹窗有两行、其它弹窗也有行，when 删除或统计数量，then 只计算当前拆分弹窗的行。
4. Given 修复完成，then 任务结构和同步数据保持不变。

## Development handoff

- Version impact: fix, bundled into patch release 4.3.2 from 4.3.1
- Relevant modules: `shared/events.ts`, split interaction tests, generated extension assets
- Required verification: targeted dual-modal regression test, `npm run build`, `npm run check`, `git diff --check`
- Deployment or desktop update: include in extension package v4.3.2; no Worker deployment
- Git and push constraints: normal push of the independent fix branch is authorized by the recent product handoff; no force-push, tag, or Issue closure before user acceptance

## Development execution profile

- Assessment status: approved
- Assessed requirement date or revision: 2026-09-05 root-cause revision
- Complexity and dominant cost drivers: small selector-scope correction; main risk is covering submit, remove, count and focus consistently
- Recommended model: gpt-6.1-sol
- Recommended reasoning effort: low
- Recommendation rationale: follow the user's latest explicit instruction to continue with gpt-6.1-sol/low
- Lower-cost alternative and tradeoff: not requested
- Engineering effort range: 15–30 minutes plus combined regression build
- AI usage or API cost range: low incremental product-plan usage
- Estimate basis and excluded costs: confirmed static root cause and existing tests; excludes manual extension visual acceptance
- Confidence: high
- Assumptions and unknowns: both modal trees remain rendered concurrently as in the current shared app
- Escalation condition: return for confirmation if the fix requires changing split persistence or parent-child data semantics
- User decision: confirmed override — continue development with gpt-6.1-sol/low
- Approved model: gpt-6.1-sol
- Approved reasoning effort: low
- Approved budget or usage range: low product-plan usage; no explicit token budget
- Profile approved date: 2026-09-05

## Open decisions

- None

## 2026-10-06 用户真实回归及代码证据

用户4.3.1管理新标签页拆分有标题却报请填写子任务1标题，或无反应；同次刷新账号增量同步POST503，本地199任务加载。产品只读发现最新events.ts splitTaskForm提交仍container.querySelectorAll(.split-child-row)，同页render含新增大任务hidden子行。删除按钮计数也使用全container。重现了旧52针对的选择器污染结构，不是用户标题为空，503与此不能因同屏同时发生判定同根因。

恢复52原要求：验证/计数/删除/新增/焦点/日期快捷绑定均限定实际splitTaskForm/splitChildren根，不能读取newParentChildren或别的表单。准备/保存异常可见且输入保留，不要关掉必要校验。修复不清本地199任务，沿最新077fa71/4.3.1交付链，保留Google/历史字段/1小时默认/去向/日期池/↑。首要覆盖两个弹窗树同时在DOM但仅一个活跃时完整拆分点击；再覆盖远端成功/失败/延迟造成重渲染期间拆分目标和输入保留，重试不重复父子。拆分已有任务无日期子项依既有任务池能力，不恢复强制日期。

gpt-6.1-sol/low、单开发，小至中工程/低至中用量，fix PATCH。原规范为参考，不能merge全部旧脏工作区。确定性实际事件链/根scope/同步刷新测试、typecheck/lint/build/release/CSS；旧静态失败单列，无GUI授权。候选备份/hash原稳定目录交付，完成分支正常push按已有近期授权，不强推/依赖安装/生产数据/Worker。62本次503独立记录，52修完后再接62线上排查，避免混入独立目标。

## 2026-10-06 4.3.2 开发交付

- 修复位于 `shared/split-modal.ts`：删除、计数、添加、步进器、日期快捷操作、校验、焦点和提交都限定在真实拆分弹窗及 `#splitChildren`。拆分保存使用记录级回滚，失败时保留输入并允许安全重试；加载或同步刷新保留当前拆分目标，打开的编辑弹窗不会被远端刷新替换。
- 回归覆盖双弹窗同时存在、隐藏行不参与校验/计数/删除/日期、错误字段聚焦、保存延迟期间双击防重、保存失败后输入/目标保留和重试不重复、无日期子任务进入任务池，以及本地加载和远端成功/失败刷新保留拆分目标。
- `npm run check`、`npm run build`、release checker、双弹窗/状态/快捷日期/可选日期用例全部通过。`npm run check` 使用候选目录作为 CSS 对照，未读写旧 `chrome-extension-sync/`。
- 候选 `outputs/TaskMaster-4.3.2-split-modal-row-scope-52-20261006` 为 14 个文件；在稳定目录 `C:\Users\Kairos\Documents\TASK_MASTER\outputs\TaskMaster-3.16.2` 更新前，4.3.1 的 14 个文件已备份到 `C:\Users\Kairos\AppData\Local\TaskMaster\backups\extension-before-split-modal-row-scope-52-20261006-4.3.1` 并逐项核对 SHA-256。稳定目录现为 4.3.2，14 个文件与候选哈希一致；扩展 key、权限及 Worker/API 均未变。
- 未做 GUI 验收（本项未授权桌面控制）。用户需在 Chrome 扩展管理页 Reload 原扩展，后打开 TaskMaster 新标签页复现拆分并确认成功；不需要重新安装，稳定扩展 ID 与任务数据目录未变。
- Issue #62 的 Google 同步 POST 503 不在本次修复范围；199 条本地任务未读取/清除。#52 等待用户重载验收，不打 tag、不关闭 Issue。
- 产品完成报告已发送至需求任务 `01a0f1af-be64-7860-8c0d-660fdb71e2c9`；`send_message_to_thread` 成功返回目标 threadId，发送回执已记录。
- 生命周期事件：`REQ-20260905-split-modal-row-scope#r2-20261006-delivered-4.3.2`。
