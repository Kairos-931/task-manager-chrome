# 任务池未来 7 天快捷排期

- Status: confirmed
- Priority: high
- Target version: 3.16.0
- Confirmed date: 2026-09-04
- Tracking issue: [GitHub Issue #46](https://github.com/Kairos-931/task-manager-chrome/issues/46)

## Objective and user value

- User goal: 在 Popup 任务池中用最少步骤把未排期任务安排到未来一周。
- Current problem: 任务池虽然能打开现有重新排期弹窗，但弹窗只有原生日期输入；用户需要打开日期控件、判断星期并再次确认，无法直接看到未来几天的排期负荷。
- User-visible outcome: 点击“安排时间”后直接看到今天起连续 7 天的快捷日期；选择日期只更新弹窗内的待确认状态，点击“确认安排”后才真正完成排期。

## Scope

### Included

- 仅优化约 400px Chrome Popup 的任务池排期入口与重新排期弹窗。
- 任务池“更多操作”中的排期入口统一命名为“安排时间”。
- 对任务池任务，不再同时展示“加入今天”和“重新排期”两个重叠入口；“安排时间”的未来 7 天中包含今天。
- 弹窗复用项目现有未来 7 天快捷日期能力，显示今天起连续 7 个本地日期，即今天加未来 6 天。
- 每个快捷日期必须复用现有 `renderQuickDates` 的负荷计算和展示：显示星期/今天或明天、日期，以及该日期当前已安排任务的预计总时长。
- 当天已有排期时以小时显示，例如 `3h`、`3.5h`；没有排期时沿用现有空负荷标记；超过现有 8 小时阈值时沿用现有超负荷强调样式。
- 负荷表示确认前已经安排在该日期的工作量；当前正在安排的任务在点击“确认安排”前不计入负荷。
- 点击快捷日期只选中并高亮该日期，不修改任务、不保存、不关闭弹窗。
- 快捷日期与自定义日期共用同一个“确认安排”按钮；只有点击该按钮才设置计划日期、保存并关闭弹窗。
- 保留自定义日期输入，用于安排到 7 天以外的今天或未来日期；快捷日期和自定义日期的当前选择双向同步。
- 完成排期后任务立即离开任务池，并按计划日期出现在今日聚焦或相应日期视图。

### Not included

- 不修改任务预计时长、硬截止日期、优先级、分类、重复规则或描述。
- 不允许通过本入口安排到过去日期。
- 不改变新标签页现有任务池操作布局；后续是否统一由独立需求决定。
- 不改变同步协议、手机端、Cloudflare Worker 或任务数据结构。
- 不重新实现第二套快捷日期组件。

## User flow

1. 用户打开 Popup，进入“任务池”，点击某任务的“点点点”。
2. 用户点击“安排时间”，系统打开复用的排期弹窗，并展示今天起连续 7 天。
3. 用户点击快捷日期或选择自定义日期，弹窗只更新当前选择。
4. 用户点击“确认安排”后，任务保存并离开任务池；点击取消或关闭则放弃选择，不修改任务。

## Interaction specification

- Entry point: Popup → 任务池 → 任务“更多操作” → “安排时间”。
- Default state: 弹窗打开时没有预选日期，“确认安排”不可用；未来 7 天完整可见，自定义日期区域作为次要入口。
- Date selection: 点击未来 7 天任一日期只选中并高亮；选择自定义日期时同步清除或切换快捷日期高亮。选择行为不写入任务，也不改变各日期显示的已安排负荷。
- Daily load: 7 个日期始终显示各自已安排的预计总时长，计算口径、循环任务处理、小时格式和超负荷状态与现有快捷日期能力一致，不另建第二套统计逻辑。
- Confirmation: 快捷日期和自定义日期都必须点击同一个“确认安排”按钮才提交；选择有效日期后按钮可用。
- Cancel and close: 点击取消、关闭按钮或按 `Esc` 直接放弃本次选择并关闭，不修改任务，不额外弹出二次确认框。
- Feedback: 成功后显示明确日期反馈；保存失败时保留弹窗和用户选择，并提示重试。
- Responsive behavior: 7 个日期在 400px Popup 内完整可见，不依赖横向滚动；关键宽度使用明确组件样式。
- Visual style: 沿用新增/编辑任务和拆分任务中的快捷日期视觉，不新增一套颜色或控件语言。
- Demo or visual references: 无；现有 `renderQuickDates` 交互作为复用基线。

## Data and safety boundaries

- Reads: 目标任务、当前本地日期、未来 7 天的计划任务、循环日期匹配结果和预计时长。
- Writes: 只修改目标任务的计划日期及现有更新时间字段，并沿用当前保存与同步流程。
- Must not do: 不修改硬截止日期；不重复创建任务；取消时不写入；不得使用 `toISOString()` 生成本地日期。
- Effect on original files or external systems: Chrome 扩展 Popup 构建并重载后生效；不需要 Worker 部署。

## Failure and edge cases

- Empty state: 任务池为空时不显示排期入口。
- Invalid input: 自定义日期为空或早于今天时不保存，并在弹窗内说明原因。
- Date boundary: 月末、年末和 UTC+8 环境下仍按本地日期生成连续 7 天。
- Concurrent change: 任务在弹窗打开期间已被删除或排期时，安全关闭并刷新列表，不修改其他任务。
- Save failure: 保持用户选择和弹窗，不把未保存状态显示为成功。
- Repeated action: 快速切换快捷日期只保留最后一次选择；快速重复点击“确认安排”只执行一次排期。

## Acceptance criteria

1. Given 用户在 Popup 任务池点击“安排时间”，when 弹窗打开，then 同屏完整显示今天起连续 7 个本地日期和自定义日期入口。
2. Given 弹窗已打开，when 用户点击任一快捷日期，then 该日期高亮且同步到日期输入，但任务仍留在任务池，弹窗保持打开且没有保存或同步。
3. Given 未来 7 天已有不同数量的排期任务，when 弹窗打开，then 每个日期显示该日现有任务的预计总时长，格式与当前快捷日期组件一致；无任务和超过 8 小时的日期分别显示现有空负荷与超负荷状态。
4. Given 用户在日期之间切换选择但尚未确认，when 查看负荷，then 各日期仍显示确认前的已安排工作量，当前任务不被提前计入。
5. Given 用户已选择日期，when 点击“确认安排”，then 任务只保存一次、弹窗关闭、任务离开任务池，并显示具体日期反馈。
6. Given 用户选择今天并点击“确认安排”，when 保存成功，then 任务立即出现在今日聚焦，硬截止日期及其他字段不变。
7. Given 用户需要第 8 天或更远日期，when 使用自定义日期并点击“确认安排”，then 任务按该日期排期；过去日期和空日期无法提交。
8. Given 用户选择日期后点击取消、关闭按钮或按 `Esc`，then 弹窗关闭且任务仍在任务池，任何任务字段均未改变。
9. Given Popup 宽度约 400px，then 7 个快捷日期及其每日负荷无需横向滚动即可完整使用。
10. Given 新标签页、手机端和同步协议，then 本需求不改变其现有布局、数据结构或行为。
11. Given 开发完成，then `npm run check`、`npm run build` 与 `git diff --check` 通过，并确认 Popup 与 `chrome-extension-sync` 构建产物更新。

## Development handoff

- Version impact: feat
- Relevant modules: developer task determines after inspection; likely existing replan modal, quick-date rendering/event binding and targeted Popup UI tests.
- Required verification: project-defined tests, lint, type checks and build；额外覆盖本地日期边界、单次提交和 400px 布局。
- Deployment or desktop update: 不部署 Worker；在 Chrome 扩展管理页重载扩展后生效。
- Git and push constraints: 不执行 `git push`；不得覆盖工作区中与本需求无关的未提交改动。

## Development execution profile

- Assessment status: approved
- Assessed requirement date or revision: 2026-09-04 revision including two-stage confirmation and reused daily-load display
- Complexity and dominant cost drivers: small-to-medium UI integration; dominant work is reusing `renderQuickDates` inside the replan modal, isolating Popup behavior from newtab, preserving selection without writes, preventing duplicate confirmation, and extending targeted tests in an already dirty worktree.
- Recommended model: gpt-5.6-luna
- Recommended reasoning effort: medium
- Recommendation rationale: the requirement is explicit and existing rendering, event, persistence, and test primitives are available; medium reasoning is sufficient to handle shared-event coupling and 400px layout without paying for a frontier model.
- Lower-cost alternative and tradeoff: gpt-5.6-luna with low reasoning; likely adequate for the markup change, but more likely to miss the no-write-before-confirm boundary, duplicate-submit protection, or newtab isolation and require a correction turn.
- Engineering effort range: approximately 30–60 minutes including targeted tests, full check, build, and dirty-worktree review; manual Chrome visual acceptance remains separate.
- AI usage or API cost range: low-to-medium Codex plan usage, approximately 1–3 development turns and 3–6 tool/test cycles; this is a product-plan usage estimate, not an API-dollar quote.
- Estimate basis and excluded costs: based on current TypeScript modules, existing `renderQuickDates`, replan events, package scripts, and automated tests; excludes subscription price, external API billing, infrastructure cost, human visual acceptance time, release/tagging, push, and deployment.
- Confidence: high
- Assumptions and unknowns: existing quick-date load semantics remain authoritative; no new visual design or newtab parity is required; the current dirty changes remain compatible.
- Escalation condition: stop and return to the requirements task if implementation requires changing shared replan behavior in newtab, modifying task/sync data semantics, or reveals conflicts that cannot be isolated without rewriting unrelated dirty changes; reassess with gpt-5.6-terra medium if that occurs.
- User decision: approved recommendation
- Approved model: gpt-5.6-luna
- Approved reasoning effort: medium
- Approved budget or usage range: low-to-medium Codex plan usage, approximately 1–3 development turns and 3–6 tool/test cycles
- Profile approved date: 2026-09-04

## Open decisions

- None.
