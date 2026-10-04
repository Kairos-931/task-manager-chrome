# 重复任务必须设置重复截止日期

- Status: regression fixed; awaiting user acceptance
- Priority: high
- Target version: next minor release
- Confirmed date: 2026-09-12

## Objective and user value

- User goal: 创建重复任务时明确这组重复安排何时结束，避免任务无限重复。
- Current problem: 当前重复任务只有首次计划日期和重复规则，没有重复系列的结束边界；`硬截止日期`表达的是任务不可延期的外部期限，不能替代重复截止日期。
- User-visible outcome: 用户选择任一重复规则后，必须选择“重复截止日期”；任务只在首次计划日期至重复截止日期之间发生。

## Scope

### Included

- 普通任务新增与编辑弹窗中，选择“每天、每周几、每月、工作日、自定义间隔”任一重复规则后，展示必填字段“重复截止日期”。
- 沿用现有“计划日期”作为重复任务的首次发生日期，不新增单独的“重复开始日期”字段。
- 如果用户没有主动修改计划日期，则使用弹窗当前默认的计划日期作为第一次发生日期。
- 重复截止日期必须晚于或等于首次发生日期。
- 日、周、月、今日聚焦及统计只计算截止日期以内的重复实例。
- 完成重复任务的最后一次实例后，不再生成或推进到截止日期之后的实例，并将该重复系列置为已结束状态。
- 新字段随现有本地存储和分块同步数据传递；使用本地日期 `YYYY-MM-DD`，不做 UTC 转换。
- 新版创建的重复任务必须有重复截止日期。

### Not included

- 不改变“硬截止日期”的现有含义。
- 不增加一天中的具体时分选择；本需求中的“时间”按日期处理。
- 不改变现有重复频率类型和算法。
- 不修改父任务、子任务拆分规则。
- 不修改手机端页面或 Cloudflare Worker。
- 不自动为历史重复任务猜测或批量填写截止日期。

## User flow

1. 用户打开新增任务弹窗，计划日期默认沿用现有逻辑。
2. 用户把“重复”从“不重复”改为某一重复规则。
3. 表单立即展开“重复截止日期（必填）”，其可选最早日期为当前计划日期。
4. 用户选择截止日期并保存。
5. 系统以计划日期作为首次发生日期，仅在该日期至重复截止日期之间计算实例。
6. 最后一次实例完成后，这组重复任务结束，不再出现在后续日期。

## Interaction specification

- Entry point: 新增任务和编辑任务弹窗中的“重复”区域。
- Default state: “不重复”时不显示重复截止日期；计划日期继续使用现有默认值。
- Actions and feedback:
  - 开启重复后立即展示必填的日期控件。
  - 未填写时点击保存，阻止提交，并在字段附近提示“请选择重复截止日期”。
  - 截止日期早于计划日期时，阻止提交，并提示“重复截止日期不能早于首次计划日期”。
  - 用户修改计划日期导致原截止日期失效时，保留已填值并显示错误，不静默替用户改日期。
  - 切回“不重复”后隐藏该字段，保存时不让隐藏值影响普通任务。
- Responsive behavior: Popup 约 400px 与新标签页均使用同一字段和校验，不增加横向滚动。
- Demo or visual references: 无；沿用现有日期输入控件即可确认交互。

## Data and safety boundaries

- Reads: `dueDate`、`repeatType`、`repeatDays`、`repeatInterval`、历史任务是否已有重复截止日期。
- Writes: 为重复任务新增可选兼容字段 `repeatEndDate`；新建或编辑重复任务保存时该字段必填。
- Must not do:
  - 不把 `hardDeadline` 改名或挪作重复系列边界。
  - 不使用 `toISOString()` 生成本地日期。
  - 不让截止日期后的实例进入列表、日历、统计或工作量汇总。
  - 不因历史数据缺少新字段而导致加载失败或任务消失。
- Effect on original files or external systems: 仅扩展端源码与构建产物；重载 Chrome 扩展后生效，不需要 Worker 部署。

## Failure and edge cases

- Empty state: 开启重复但未设置截止日期时不能保存。
- Invalid input: 截止日期早于首次计划日期时不能保存；每周重复仍需满足原有星期选择规则。
- Last occurrence:
  - 截止日期恰好符合重复规则时，该日是最后一个实例。
  - 截止日期不符合重复规则时，截止日前最后一个符合规则的日期是最后一个实例。
  - 完成最后一个实例后，不得回退到一个并不符合规则的日期，也不得继续产生未来实例。
- Legacy data:
  - 已存在且没有 `repeatEndDate` 的重复任务继续按原规则运行，避免升级后突然消失。
  - 用户编辑这类历史重复任务并保持重复状态时，必须补填重复截止日期后才能保存。
- Failure message and next action: 校验失败时保留用户已填内容、聚焦对应字段，并给出可直接纠正的中文提示。

## Acceptance criteria

1. Given 用户新建任务并选择任一重复规则，when 未选择重复截止日期并保存，then 系统阻止保存并提示“请选择重复截止日期”。
2. Given 用户没有主动修改计划日期，when 创建重复任务，then 当前默认计划日期成为该重复任务的首次发生日期。
3. Given 重复截止日期早于计划日期，when 保存，then 系统阻止保存并说明截止日期不能早于首次计划日期。
4. Given 重复任务有合法截止日期，when 查看日、周、月、今日聚焦和时长统计，then 截止日期之后不出现或统计该任务实例。
5. Given 用户完成截止范围内最后一个有效实例，when 保存完成状态，then 该重复系列结束且不会推进到截止日期之后。
6. Given 历史重复任务缺少新字段，when 升级并加载扩展，then 任务仍可见、仍按旧规则运行；编辑并保存为重复任务时要求补填截止日期。
7. Given 用户把重复规则切回“不重复”，when 保存，then 重复截止日期不影响普通任务。
8. Given Popup 宽度约 400px，when 展开重复设置，then 日期字段完整可用且页面无横向滚动。
9. Given 修改完成，when 执行项目相关测试、类型检查和构建，then 全部通过，并生成根目录及 `chrome-extension-sync` 对应构建产物。

## Regression reported during acceptance

- Reported date: 2026-09-12
- Symptom: 在日视图勾选某一天的重复任务后，任务内部会正确推进到下一次日期，但当前日视图立即把这一行显示为“下一次未完成”，没有保留刚完成实例的勾选状态。
- Root cause boundary: 日视图筛选使用正在查看的 `currentDate`，但任务卡片仍读取任务推进后的全局 `completed` / `dueDate`，且完成按钮没有携带当前实例日期；同一张卡片混用了“当前日期实例”和“重复任务下一次日期”。
- Required behavior:
  1. 日视图查看日期 D 时，完成重复任务的 D 实例后，该行仍留在 D 的页面并显示已勾选、标题划线的完成状态。
  2. 任务可在数据层推进到下一个有效重复日期，但不能用下一次实例的未完成状态覆盖 D 的显示。
  3. 前往下一个有效重复日期时，该实例正常显示为未完成。
  4. 再次点击 D 的已完成实例，可恢复为未完成，且不破坏后续重复日期。
  5. 开启“隐藏已完成”时，日视图根据 D 的实例完成状态隐藏，而不是根据任务全局 `completed` 判断。
  6. 普通任务及周、月、今日聚焦视图的现有行为保持不变；最后一次重复实例仍遵守重复截止日期。
- Verification: 增加日视图日期实例状态回归测试，并执行项目检查、构建及生成包交互验证。

## Development handoff

- Version impact: feat（MINOR）
- Relevant modules: developer task determines after inspection; expected `shared/types.ts`, `shared/render.ts`, `shared/events.ts`, `shared/calendar.ts`, `shared/task.ts`, recurrence tests, and build outputs.
- Required verification: 表单校验测试、重复日期边界单元测试、日/周/月与统计回归测试、TypeScript 检查、CSS/extension build。
- Deployment or desktop update: 不部署 Worker；构建后由用户重载 Chrome 扩展。
- Git and push constraints: 验证通过后自动创建独立本地 Conventional Commit；不自动 push、tag、release 或部署。
- Implementation issue: GitHub Issue #57
- Implementation commit: `0b2be217b3c9ba5f24b10dec6feae96d4a564c77`
- Verification result: `npm run check`、`npm run build`、`git diff --check` 与 Popup/newtab 400px 真实生成包验收通过。
- Acceptance regression issue: GitHub Issue #58
- Acceptance regression commit: `232d648` (`fix: render recurring completion state in day view`)
- Acceptance regression verification: 针对性日视图实例测试、`npm run check`、`npm run build`、`git diff --check`、干净暂存索引构建及 400px 实际生成包 CDP 交互均通过。

## Development execution profile

- Status: approved
- Recommended model: `gpt-5.6-luna`
- Reasoning effort: `max`
- Expected engineering effort: 2–4 hours;主要工作量来自重复日期边界算法、最后一次完成状态、历史数据兼容，以及跨日历/统计的回归验证。
- Expected AI usage/cost: 产品套餐用量中等偏高，预计一个完整开发任务约 30k–60k tokens；不含返工、API 费用、人工时间、发布和部署。
- Confidence: medium-high；现有重复逻辑集中且已有日历计算入口，但“完成最后一个实例”目前没有终止状态，需要开发者谨慎设计兼容行为。
- Lower-cost alternative: `gpt-5.6-sol` / `high`；可完成表单与基础边界，但对历史数据、最后实例推进和统计回归的漏测风险更高。
- Escalation condition: 如果实现需要修改同步协议、迁移全部历史任务，或发现重复实例终止会影响现有完成记录语义，停止扩展范围并返回需求任务确认。
- Delivery state: ready to start；工作流没有活动需求，关联开发任务上一轮已完成。
- Approved model: `gpt-5.6-luna`
- Approved reasoning effort: `max`
- Approved usage range: 约 30k–60k tokens；超出范围或触发升级条件时返回需求任务。
- Development started: 2026-09-12

## Open decisions

- None. 用户已于 2026-09-12 确认只精确到日期，不需要具体时分。
