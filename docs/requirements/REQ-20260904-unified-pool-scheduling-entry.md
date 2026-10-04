# 统一任务池快捷排期入口

- Status: implemented, pending manual product acceptance
- Priority: P1
- Target version: 3.16.1
- Confirmed date: 2026-09-04
- GitHub issue: #51 — https://github.com/Kairos-931/task-manager-chrome/issues/51

## Objective and user value

- User goal: 在任务池点击日期相关按钮时，直接使用未来 7 天排期能力，不必进入编辑任务。
- Current problem: Popup 的“安排时间”会显示 7 天负载，新标签页的“选择日期”只显示普通日期输入；相同目标在两个入口表现不一致。
- User-visible outcome: Popup 与新标签页统一提供“安排到今天”和“安排时间”；“安排时间”始终打开同一个未来 7 天排期面板。

## Scope

### Included

- 新标签页任务池的“选择日期”改名为“安排时间”。
- Popup 与新标签页复用同一排期弹窗：今天起连续 7 天、每天已安排时长、7 天以外的自定义日期。
- 选择日期只更新弹窗内状态；点击“确认安排”后才保存。
- 保留“安排到今天”作为无需二次确认的一步快捷操作。
- 编辑入口继续保留完整任务字段，不作为快捷排期主路径。

### Not included

- 不增加每日剩余容量或 8 小时基准。
- 不修改任务结构、同步协议、手机端或 Worker。
- 不删除完整编辑中的日期设置。

## User flow

1. 用户在任务池点击“安排时间”。
2. 系统显示未来 7 天及每天已安排时长。
3. 用户选择一天，系统只高亮选择，不立即写入。
4. 用户点击“确认安排”，任务写入所选日期并离开任务池。

## Interaction specification

- Entry point: Popup / 新标签页 → 任务池 → 安排时间。
- Default state: 未选日期，确认按钮不可用。
- Actions and feedback: 选中日期后启用确认按钮；保存成功后显示具体排期反馈；取消、关闭或 Esc 不改任务。
- Responsive behavior: Popup 约 400px 与新标签页宽屏均完整显示 7 天按钮，不横向溢出。
- Demo or visual references: 复用当前 Popup `renderQuickDates` 排期面板。

## Data and safety boundaries

- Reads: 未来 7 天日期及每一天现有已安排任务时长。
- Writes: 仅在确认后修改当前任务的计划日期与任务池状态。
- Must not do: 选中日期时不得立即写入；不得重复保存；不得改变硬截止日期。
- Effect on original files or external systems: 仅扩展端共享 UI 与事件逻辑；通过现有本地保存和同步流程生效。

## Failure and edge cases

- Empty state: 某天没有任务时显示 0 或现有空负载样式，仍可选择。
- Invalid input: 过去日期不可确认。
- Missing path or unavailable service: 本地保存失败时保留弹窗并提示重试；云同步失败不撤销已成功的本地排期。
- Failure message and next action: 明确提示“本地保存失败，请重试”。

## Acceptance criteria

1. Given 用户在 Popup 或新标签页任务池点击“安排时间”，when 弹窗打开，then 同屏显示今天起连续 7 天和每天已安排时长。
2. Given 用户选择某一天，when 尚未点击“确认安排”，then 任务数据保持不变。
3. Given 用户点击“确认安排”，then 任务只保存一次并进入所选日期。
4. Given 用户取消、关闭或按 Esc，then 任务仍留在任务池且字段不变。
5. Given 用户点击“安排到今天”，then 维持现有一步完成行为。
6. Given 用户打开新标签页任务池，then 不再出现“选择日期”文字。

## Development handoff

- Version impact: fix, patch release 3.16.1
- Relevant modules: `shared/render.ts`, `shared/events.ts`, targeted task-pool and layout tests, generated extension assets
- Required verification: `npm run build`, `npm run check`, `git diff --check`, Popup 400px and newtab manual smoke test
- Deployment or desktop update: publish extension package v3.16.1; no Worker deployment
- Git and push constraints: release/tag/push only after the user approves this revision

## Development execution profile

- Assessment status: approved
- Assessed requirement date or revision: 2026-09-04 initial revision
- Complexity and dominant cost drivers: small; unify an existing conditional render/event path and protect both responsive layouts with regression tests
- Recommended model: gpt-5.6-terra
- Recommended reasoning effort: medium
- Recommendation rationale: shared Popup/newtab event code has recent related changes, so medium reasoning reduces regression risk while remaining economical
- Lower-cost alternative and tradeoff: gpt-5.6-luna medium; faster and cheaper, with slightly higher risk of missing legacy task-pool branches
- Engineering effort range: 30–60 minutes including build and regression verification
- AI usage or API cost range: low to medium product-plan usage; no reliable currency estimate available
- Estimate basis and excluded costs: targeted code inspection and existing tests; excludes human visual acceptance and store review time
- Confidence: high
- Assumptions and unknowns: the current Popup 7-day panel is the authoritative interaction and can be shared without changing persistence semantics
- Escalation condition: stop for product confirmation if unification requires changing task/sync data semantics or removing the one-click “安排到今天” behavior
- User decision: confirmed override — use Luna Max
- Approved model: gpt-5.6-luna
- Approved reasoning effort: max
- Approved budget or usage range: low to medium product-plan usage; no explicit token budget
- Profile approved date: 2026-09-04

## Open decisions

- None
