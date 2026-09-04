# 新建时直接创建父任务和子任务

- Status: released in v3.16.0
- Priority: high
- Target version: 3.16.0
- Confirmed date: 2026-09-04
- Tracking issue: [GitHub Issue #48](https://github.com/Kairos-931/task-manager-chrome/issues/48)

## Objective and user value

- User goal: 新建大任务时直接完成拆分，不必先保存普通任务再进入“拆分任务”。
- Current problem: 现有流程必须先创建普通任务，再从任务菜单进入拆分弹窗，产生两次提交和一个没有意义的中间状态。
- User-visible outcome: 添加任务时可选择“普通任务”或“大任务”；选择大任务后在同一个弹窗中一次性创建父任务及至少两个子任务。

## Scope

### Included

- Chrome Popup 与新标签页共用的新增任务弹窗顶部提供“普通任务 / 大任务”模式，默认保持“普通任务”。
- 大任务模式显示父任务名称、备注、优先级、分类、可选硬截止，以及至少两个子任务编辑行。
- 每个子任务填写标题、预计时长和计划日期，并复用现有未来 7 天快捷日期与每日已安排时长展示。
- 子任务继承父任务的优先级、分类和可选硬截止；父任务自身不设置计划日期、预计时长和重复规则。
- 点击“创建大任务”后一次性、原子地创建父任务与全部子任务；成功前不产生临时普通任务。
- 创建后的父任务进入“全部任务”的大任务进度区，子任务按各自计划日期进入今日聚焦和日期视图。
- 沿用现有拆分数据结构、进度统计、删除父任务规则和同步协议。

### Not included

- 不支持在本入口把新任务直接挂到一个已有父任务下。
- 不给子任务增加独立优先级、分类、硬截止或重复规则。
- 不修改手机端添加页、Worker 或同步数据结构。
- 不改变已有普通任务的“拆分任务”能力。

## User flow

1. 用户点击“添加任务”，默认进入普通任务模式。
2. 用户切换到“大任务”，填写父任务信息和至少两个子任务。
3. 用户为每个子任务设置预计时长和计划日期，可直接查看未来 7 天各日已安排时长。
4. 用户点击“创建大任务”，系统一次性保存父任务及所有子任务并给出成功反馈。

## Interaction specification

- Entry point: Popup / 新标签页 → 添加任务 → 大任务。
- Default state: 普通任务模式；切换大任务后默认提供两个空子任务行。
- Mode switch: 已填写内容切换模式时不得静默丢失；优先保留共有字段，删除仅属于另一模式的已填写内容前需要明确确认。
- Child editor: 复用现有拆分弹窗的子任务行、时长步进器、七日快捷日期和自定义日期能力。
- Validation: 至少两个子任务；标题非空；预计时长有效；计划日期有效。错误定位到第一处无效字段。
- Confirmation: 有效提交只执行一次；保存期间禁用提交按钮。
- Cancel and close: 表单有未保存内容时沿用当前关闭确认规则。
- Responsive behavior: 约 400px Popup 与新标签页均可使用；子任务区域内部滚动，不让整个弹窗失控增长。

## Data and safety boundaries

- Reads: 默认分类、当前本地日期、未来 7 天任务负荷。
- Writes: 一条父任务和至少两条带 `parentId` 的子任务，使用现有保存与同步流程一次落盘。
- Must not do: 不先创建再转换；部分子任务无效时不得留下父任务或部分子任务；不得重复统计父任务时长。
- Effect on external systems: 扩展构建与发布后生效；不部署 Worker。

## Failure and edge cases

- 保存失败时保留弹窗和用户输入，不显示成功。
- 快速重复提交只创建一组父子任务。
- 月末、年末和 UTC+8 下的七日日期保持本地连续日期。
- 普通任务与大任务模式之间的快捷日期事件不得串扰。

## Acceptance criteria

1. Given 新增任务弹窗打开，then 默认仍是普通任务模式，现有普通任务创建流程不变。
2. Given 用户切换到大任务，then 同一弹窗出现父任务信息和至少两个子任务行，不先创建普通任务。
3. Given 两个子任务填写有效内容并选择不同日期，when 点击“创建大任务”，then 一次保存一条父任务和两条日期正确的子任务。
4. Given 任一子任务无效，when 提交，then 不写入任何父子任务，并聚焦第一处错误。
5. Given 快速重复点击提交，then 只产生一组父子任务。
6. Given 创建成功，then 父任务不计入时长，子任务按各自日期出现在对应视图。
7. Given 400px Popup，then 子任务编辑和七日负荷无需页面横向滚动即可完成。

## Development handoff

- Version impact: feat, bundled into unreleased 3.16.0
- Relevant modules: developer task determines after inspection; likely task modal render/events, parent-child creation service, shared quick-date binding and tests.
- Required verification: atomic state test, real production event binding tests, duplicate-submit test, Popup 400px layout, `npm run check`, `npm run build`, `git diff --check`.
- Deployment or desktop update: include in a formal `v3.16.0` extension release; no Worker deployment.
- Git and push constraints: release/tag/push only after the user approves the combined development and release confirmation.

## Development execution profile

- Assessment status: approved
- Recommended model: gpt-5.6-terra
- Recommended reasoning effort: medium
- Engineering effort range: 1.5–3 hours for shared modal integration, atomic parent-child creation, interaction tests, build and release preparation.
- AI usage range: medium Codex plan usage, approximately 3–6 development turns and 8–14 tool/test cycles across both new requirements; excludes human Chrome acceptance and infrastructure cost.
- Confidence: medium-high; existing split UI and data model are reusable, but shared modal state and atomic save failure behavior require care.
- Lower-cost alternative: gpt-5.6-luna medium; likely workable, but has higher risk of another iteration around mode-switch state, partial writes, or Popup layout.
- Escalation condition: stop and return to requirements if implementation requires changing the task/sync schema, adding per-child advanced fields, or cannot preserve ordinary-task creation behavior.
- User decision: approved recommendation and authorized `v3.16.0` release after acceptance
- Approved model: gpt-5.6-terra
- Approved reasoning effort: medium
- Approved usage range: medium Codex plan usage, approximately 3–6 development turns and 8–14 tool/test cycles across both requirements
- Profile approved date: 2026-09-04

## Open decisions

- None. “副任务”按用户澄清确定为“新建父任务并立即创建子任务”。
