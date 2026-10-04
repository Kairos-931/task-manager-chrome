# “大任务”统一更名为“可拆分任务”

- Status: implemented, pending manual product acceptance
- Priority: P2
- Target version: 3.16.1
- Confirmed date: 2026-09-04
- GitHub issue: #50 — https://github.com/Kairos-931/task-manager-chrome/issues/50

## Objective and user value

- User goal: 用名称直接说明这种任务可以拆成多个子任务，避免“大任务”的模糊含义。
- Current problem: “大任务”只描述规模，不说明父子关系或拆分能力。
- User-visible outcome: 扩展界面中面向用户的“大任务”统一显示为“可拆分任务”。

## Scope

### Included

- 新建模式、提交按钮、成功提示、列表分区、任务徽标、编辑/删除提示中的“大任务”统一改为“可拆分任务”。
- 相关说明继续使用“子任务”；需要解释层级时可写“可拆分任务（父任务）”。
- 更新相关测试和产品文档。

### Not included

- 不重命名内部 `isParent`、`parentId` 等代码字段。
- 不迁移历史数据，不改变拆分、进度或删除规则。
- 不改手机端未提供的功能。

## User flow

1. 用户点击添加任务。
2. 用户在“普通任务 / 可拆分任务”之间选择。
3. 用户创建后，在列表和提示中继续看到一致的“可拆分任务”名称。

## Interaction specification

- Entry point: 添加任务弹窗及所有父子任务相关提示。
- Default state: 仍默认普通任务。
- Actions and feedback: 可拆分任务提交按钮显示“创建可拆分任务”；成功反馈说明创建的子任务数量。
- Responsive behavior: 新文案在 400px Popup 中不得挤压或截断关键按钮。
- Demo or visual references: 无；仅替换现有用户可见文案。

## Data and safety boundaries

- Reads: 无新增读取。
- Writes: 无新增数据写入。
- Must not do: 不修改内部字段名、存储格式或同步数据。
- Effect on original files or external systems: 仅扩展端文案与测试；历史任务无需迁移。

## Failure and edge cases

- Empty state: 不适用。
- Invalid input: 沿用现有表单校验。
- Missing path or unavailable service: 不适用。
- Failure message and next action: 沿用现有保存错误反馈，仅替换对象名称。

## Acceptance criteria

1. Given 用户打开新增任务弹窗，then 看到“普通任务 / 可拆分任务”，不再看到“大任务”。
2. Given 用户创建、编辑或删除该类任务，then 相关按钮、提示和列表标识使用“可拆分任务”。
3. Given 已有父子任务数据，when 升级版本，then 无需迁移且行为保持不变。
4. Given 开发完成，then 用户可见扩展界面不存在遗留“大任务”文案。

## Development handoff

- Version impact: fix, bundled into patch release 3.16.1
- Relevant modules: shared render/events text, tests, product documentation, generated extension assets
- Required verification: string audit, `npm run build`, `npm run check`, `git diff --check`
- Deployment or desktop update: publish extension package v3.16.1; no Worker deployment
- Git and push constraints: release/tag/push only after the user approves this revision

## Development execution profile

- Assessment status: approved
- Assessed requirement date or revision: 2026-09-04 initial revision
- Complexity and dominant cost drivers: small; user-visible terminology audit plus responsive text verification
- Recommended model: gpt-5.6-terra
- Recommended reasoning effort: medium
- Recommendation rationale: bundle with the scheduling correction and audit all existing parent-task branches without touching storage identifiers
- Lower-cost alternative and tradeoff: gpt-5.6-luna medium; adequate for text replacement but slightly more likely to miss contextual wording or generated assets
- Engineering effort range: 20–40 minutes, mostly overlapping the same build/release cycle
- AI usage or API cost range: low product-plan usage; no reliable currency estimate available
- Estimate basis and excluded costs: targeted string search and existing release pipeline; excludes human visual acceptance and store review time
- Confidence: high
- Assumptions and unknowns: all user-visible parent-task wording is generated from the shared extension code
- Escalation condition: stop for product confirmation if a wording change would require renaming persisted fields or migrating historical data
- User decision: confirmed override — use Luna Max
- Approved model: gpt-5.6-luna
- Approved reasoning effort: max
- Approved budget or usage range: low product-plan usage; no explicit token budget
- Profile approved date: 2026-09-04

## Open decisions

- None
