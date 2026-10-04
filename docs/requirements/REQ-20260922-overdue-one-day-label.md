# 昨日逾期任务显示“已过期 1 天”

- Status: implemented; awaiting user acceptance
- Priority: P1
- Target version: next patch
- Confirmed date: 2026-09-22
- Development started: 2026-09-22
- Development completed: 2026-09-22
- GitHub Issue: #60 (closed)
- Implementation commit: `6da3a20` (`fix: show one day overdue label`)
- Verification result: targeted regression test, `npm run check`, `npm run build`, and `git diff --check` passed in the developer task.

## Objective and user value

- User goal: 逾期任务统一显示逾期天数，昨日逾期也能直接看出已过期多久。
- Current problem: `getRemainingTime` 对逾期 1 天设置了特殊文案“已过期”，导致逾期 2 天及以上显示天数、唯独昨日任务不显示天数；在逾期面板中只能结合“原计划”日期自行判断。
- User-visible outcome: 昨日到期且未完成的任务显示“已过期 1 天 · 原计划 YYYY-MM-DD”，与其他逾期任务保持一致。

## Scope

### Included

- 修改共享剩余时间文案函数：所有未完成且早于今天 1 天的任务返回“已过期 1 天”。
- 覆盖使用该共享函数的 Popup、新标签页日/周相关逾期展示。
- 增加昨日、逾期多日、今天、明天的回归测试。

### Not included

- 不改“原计划 YYYY-MM-DD”信息。
- 不改逾期判断、日期计算、任务排序、折叠、重新排期或重复任务推进逻辑。
- 不使用“昨日任务”文案，避免与任务所属日期混淆。
- 不改手机端、后端、同步协议或数据结构。

## User flow

1. 用户打开 Popup 或新标签页中的任务列表/逾期面板。
2. 系统计算未完成任务距今天的天数。
3. 昨日到期显示“已过期 1 天”；更早任务继续显示对应的“已过期 N 天”。

## Interaction specification

- Entry point: 所有调用共享 `getRemainingTime` 的任务日期元信息。
- Default state: 昨日逾期任务直接显示具体天数。
- Actions and feedback: 无新增操作；纯文案修复。
- Responsive behavior: 不改变现有布局。
- Demo or visual references: 用户反馈的现有逾期面板。

## Data and safety boundaries

- Reads: 任务截止日期和完成状态。
- Writes: 无数据写入变化。
- Must not do: 不修改任务日期、完成状态、重复实例或统计口径。
- Effect on original files or external systems: 仅扩展前端源码、测试与构建产物；重载扩展后生效。

## Failure and edge cases

- Empty state: 无逾期任务时保持现有界面。
- Invalid input: 沿用现有日期解析行为，不扩大本修复范围。
- Missing path or unavailable service: 本功能不依赖网络服务。
- Failure message and next action: 无新增失败状态。

## Acceptance criteria

1. Given 未完成任务的截止日期是昨天，when 渲染日期状态，then 显示“已过期 1 天”，不得只显示“已过期”。
2. Given 未完成任务已逾期 N 天且 N > 1，when 渲染日期状态，then 仍显示“已过期 N 天”。
3. Given 任务今天或明天到期，when 渲染日期状态，then 继续显示“今天到期”或“明天到期”。
4. Given 逾期面板显示昨日任务，then 完整元信息为“已过期 1 天 · 原计划 YYYY-MM-DD”，其余操作不变。
5. 项目测试、类型检查和构建通过；生成包包含新文案逻辑。

## Development execution profile

- Assessment status: approved
- Selected confirmation option: 1
- Approved profile: `gpt-5.6-luna` / `high`
- Primary recommendation: option 1 — `gpt-5.6-luna` / `high`
- Default option: option 0 — `gpt-5.6-luna` / `max`
- Engineering effort: small, expected 15–35 minutes; dominant work is regression coverage and clean build verification.
- Expected AI usage: low, approximately 10k–30k model tokens under product-plan usage; excludes account quotas and external infrastructure.
- Confidence: high. The root cause is the explicit one-day special case in `shared/task.ts`, and the shared function already feeds the affected render paths.
- Lower-cost tradeoff: Luna High is sufficient because the change is localized and reversible; Luna Max adds extra verification margin but should not change the implementation approach.
- Escalation condition: stop and return for reassessment if tests show another independent date-label path or recurring-occurrence semantics must change.
- Delivery state: ready to start; workflow records no active requirement and the linked developer task is accessible.

## Development handoff

- Version impact: fix (PATCH)
- Relevant modules: `shared/task.ts`, focused date-label tests, generated extension bundles.
- Required verification: targeted regression tests, `npm run check`, `npm run build`, `git diff --check`.
- Deployment or desktop update: no server deployment; user reloads the Chrome extension after completion.
- Git and push constraints: create one local `fix:` commit after verification; do not push, tag, release, or deploy without explicit authorization.
- GitHub Issue: developer must create or link one dedicated issue before implementation, per project rules.

## Open decisions

- None. Product decision: use “已过期 1 天”, not “昨日任务”.
