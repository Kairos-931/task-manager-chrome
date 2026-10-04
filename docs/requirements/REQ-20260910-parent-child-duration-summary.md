# 父任务显示子任务时长汇总

- Status: completed
- Priority: P1
- Target version: 3.17.0
- Confirmed date: 2026-09-10
- Development start date: 2026-09-10
- Completed date: 2026-09-10
- GitHub Issue: https://github.com/Kairos-931/task-manager-chrome/issues/55
- Verification: `npm run check`, `npm run build`, `git diff --check` passed on 2026-09-10

## Objective and user value

- User goal: 在父任务卡片上直接看到这组子任务总共预计需要多少时间。
- Current problem: 父任务只显示子任务完成进度，用户必须逐个查看并心算子任务时长。
- User-visible outcome: 父任务显示由其直属子任务自动汇总的预计时长，同时统计结果仍只计算子任务一次。

## Scope

### Included

- Popup 与新标签页中所有父任务卡片显示“子任务合计 Xh”。
- 汇总父任务全部直属子任务的预计时长，包括已完成和未完成子任务。
- 新增、编辑、删除子任务后，父任务显示值随下一次界面渲染自动更新。
- 父任务的汇总值仅用于展示，不写入父任务自身的 `duration` 字段。
- 今日、周/月、摘要等既有统计继续排除父任务，只统计子任务，避免重复计算。

### Not included

- 不新增独立的父任务时长输入框。
- 不把父任务汇总时长计入任何任务量或完成量统计。
- 不修改任务数据结构、同步协议、手机端或后端。
- 不改变父子任务完成规则和子任务层级。

## User flow

1. 用户创建或拆分出一个父任务及其子任务。
2. 父任务卡片在完成进度旁显示全部直属子任务的预计时长合计。
3. 用户修改任一子任务时长后，父任务合计自动反映最新结果。
4. 用户查看顶部摘要、日/周/月统计时，数值不因父任务汇总而重复增加。

## Interaction specification

- Entry point: Popup 与新标签页的父任务卡片。
- Default state: 在现有“已完成/总数 个子任务”信息附近显示“子任务合计 Xh”。
- Actions and feedback: 汇总值无独立操作；由子任务数据派生并实时随重渲染更新。
- Responsive behavior: Popup 保持紧凑，不新增独立卡片或额外操作行；允许与子任务进度同一信息行展示。
- Demo or visual references: 无；沿用现有父任务元信息样式。

## Data and safety boundaries

- Reads: 当前父任务 ID 及 `parentId` 与之匹配的直属子任务 `duration`。
- Writes: 无新增数据写入。
- Must not do: 不回写汇总到父任务 `duration`，不将父任务加入统计任务集合。
- Effect on original files or external systems: 仅扩展端渲染与测试；重载本地扩展后生效，无需部署 Worker。

## Failure and edge cases

- Empty state: 历史异常数据中父任务没有子任务时显示“子任务合计 0h”。
- Invalid input: 缺失或非有效数值的子任务时长按 0 处理，不产生 `NaN`。
- Missing path or unavailable service: 本地派生计算不依赖网络或同步服务。
- Failure message and next action: 无单独失败态；仍保留现有父任务信息，不能因汇总失败阻断任务列表渲染。

## Acceptance criteria

1. Given 父任务有 30 分钟和 90 分钟两个直属子任务，when 渲染父任务卡片，then Popup 与新标签页均显示“子任务合计 2h”。
2. Given 其中一个子任务已完成，when 渲染父任务卡片，then 合计仍包含该子任务，因为这里展示的是整组任务预计总量。
3. Given 子任务被新增、编辑或删除，when 界面重新渲染，then 父任务合计与当前直属子任务之和一致。
4. Given 父任务显示了汇总时长，when 计算今日、周/月及顶部摘要统计，then 父任务不另计，统计结果与仅对子任务求和一致。
5. Given 历史父任务没有子任务或子任务时长异常，when 渲染任务列表，then 显示 0h 且页面不报错。
6. 构建后 Popup 约 400px 宽度下信息不溢出，新标签页父任务样式保持一致。

## Development execution profile

- Assessment status: approved
- Approved model: `gpt-5.6-luna`
- Approved reasoning effort: medium
- Approved date: 2026-09-10
- Recommended model: `gpt-5.6-luna`
- Recommended reasoning effort: medium
- Rationale: 改动集中在已有父任务渲染与纯计算测试，数据边界明确且无需迁移。
- Engineering effort: small，预计 20–40 分钟；主要工作是复用/新增汇总 helper、覆盖两类父任务卡片并补回归测试。
- Expected AI usage/cost: 低，约 8k–20k tokens 的产品计划用量估计；不含此前上下文、人工操作、API 或基础设施费用。
- Confidence: high；假设现有父任务均通过 `parentId` 关联直属子任务，Popup 与新标签页共用 `shared/render.ts`。
- Lower-cost alternative: `gpt-5.6-luna` low；可能减少分析用量，但遗漏 Popup/新标签页双入口或统计回归的风险略高。
- Escalation condition: 若发现父任务时长已被其他统计链路隐式读取，或父子关系存在多层嵌套/迁移需求，停止扩展范围并回到需求任务确认。
- Delivery state: ready to start；已确认关联开发任务上一轮已完成。

## Development handoff

- Version impact: feat，建议 MINOR（3.17.0）
- Relevant modules: `shared/render.ts`、父子任务 helper、相关渲染与统计测试；由开发任务最终确认。
- Required verification: 相关单元/回归测试、`npm run check`、`npm run build`、`git diff --check`，并核对生成产物。
- Deployment or desktop update: 不部署；用户重载本地解压扩展后生效。
- Git and push constraints: 未经用户明确要求不 commit、tag、push 或发布；不得纳入无关的 `backend/index.js` 修改。

## Open decisions

- None.
