# 拆分子任务允许暂不排期

- Status: implemented; awaiting user acceptance
- Priority: P1
- Target version: next minor release
- Confirmed date: 2026-09-12
- Queued date: not queued
- Development started date: 2026-09-12
- Completed date: 2026-09-12

## Objective and user value

- User goal: 拆分任务时先把任务结构和子任务内容整理出来，不必同时决定每个子任务具体在哪天执行。
- Current problem: 当前每个子任务都必须选择计划日期；用户尚未决定排期时无法完成拆分，结构整理与时间规划被强制绑在一步完成。
- User-visible outcome: 子任务标题和预计时长有效即可完成拆分；未选择日期的子任务自动进入任务池，之后可复用现有“安排时间”能力再排期。

## Scope

### Included

- “拆分任务”弹窗中的每个子任务计划日期改为可选。
- 允许同一次拆分中混合保存：
  - 已选日期的子任务进入对应日期。
  - 未选日期的子任务进入任务池。
- 保留未来 7 天快捷日期与每天已安排时长，用户需要时仍可直接排期。
- 日期区域提供清晰的“暂不安排”状态；默认不替用户选择日期。
- 完成拆分后反馈本次结果，例如“已拆分 3 个子任务，其中 2 个待安排”。
- 未排期子任务后续复用任务池现有“安排到今天”和“安排时间”能力。

### Not included

- 不改变子任务标题、预计时长的现有必填及校验规则。
- 不改变父任务、子任务关系及父任务时长汇总规则。
- 不新增每日容量、剩余工时或新的排期算法。
- 不修改普通任务新增、可拆分任务新增、手机端或 Cloudflare Worker。
- 不自动猜测未排期子任务的日期。

## User flow

1. 用户打开“拆分任务”弹窗，填写至少两个子任务标题和预计时长。
2. 用户可为任意子任务选择未来 7 天或自定义日期，也可以保持“暂不安排”。
3. 用户点击“完成拆分”。
4. 系统一次性建立父子任务：有日期的进入相应日期，无日期的进入任务池。
5. 用户之后可在任务池为未排期子任务安排时间。

## Interaction specification

- Entry point: 任务更多操作 → 拆分任务。
- Default state: 新增的子任务行默认“暂不安排”，日期为空；不再自动填入今天。
- Actions and feedback:
  - 点击未来 7 天中的某天，只更新该子任务行的选择状态。
  - 点击“暂不安排”清除该行已经选择的日期。
  - 点击“完成拆分”统一保存，不需要逐行确认。
  - 成功反馈同时说明子任务总数与待安排数量。
- Responsive behavior: Popup 约 400px 和新标签页均不得横向溢出；日期能力继续限制在各自子任务行内，避免串行选择。
- Demo or visual references: 复用现有拆分弹窗和未来 7 天日期组件，不新增独立弹窗。

## Data and safety boundaries

- Reads: 每个拆分子任务的标题、预计时长及可选计划日期。
- Writes: 有日期时沿用现有 `dueDate`；无日期时按现有任务池语义保存（`noTimeLimit: true`，日期字段遵循现有任务池数据约定）。
- Must not do:
  - 不用占位日期伪装“未排期”。
  - 不因某一行未选日期阻止整个拆分。
  - 不让某一行的快捷日期选择影响其他子任务行。
  - 不部分保存；任一必填内容无效时全部不写入。
- Effect on original files or external systems: 仅扩展端共享拆分交互、任务创建逻辑、测试及构建产物；重载扩展后生效，无 Worker 部署。

## Failure and edge cases

- Empty state: 至少保留两个子任务；日期可以全部为空。
- Invalid input: 标题为空或预计时长不合法时继续阻止提交并聚焦对应字段；日期为空不再视为错误。
- Mixed scheduling: 同一次拆分可同时产生已排期和任务池子任务。
- Editing rows: 已选日期后选择“暂不安排”，必须清除日期高亮与待保存日期。
- Persistence failure: 本地保存失败时保留弹窗和全部填写内容，提示“保存失败，请重试”，不得出现部分子任务。

## Acceptance criteria

1. Given 用户填写至少两个合法子任务但均未选择日期，when 点击“完成拆分”，then 拆分成功，所有子任务进入任务池。
2. Given 同一次拆分中一部分子任务选择日期、一部分未选择，when 完成拆分，then 前者进入对应日期，后者进入任务池。
3. Given 子任务已选择日期，when 点击该行“暂不安排”后完成拆分，then 该子任务进入任务池且不保留原日期。
4. Given 子任务日期为空，when 提交，then 不提示“请选择计划日期”。
5. Given 标题为空或预计时长无效，when 提交，then 不保存任何子任务，并聚焦真实无效字段。
6. Given 拆分成功且存在未排期子任务，then 成功提示包含待安排数量，任务池可使用现有 7 天排期能力安排它们。
7. Given Popup 约 400px，when 操作多个子任务行，then 无横向溢出，且每行日期状态互不干扰。
8. Given 修改完成，when 执行针对性测试、项目检查和构建，then 全部通过并更新扩展构建产物。

## Development handoff

- Version impact: feat（MINOR）
- Relevant modules: expected `shared/split-interaction.ts`, `shared/task.ts`, `shared/render.ts`, split tests and generated extension bundles; developer confirms after inspection
- Required verification: optional-date unit/interaction tests, mixed scheduling test, submission atomicity regression, `npm run check`, `npm run build`, `git diff --check`, Popup 400px generated-bundle smoke test
- Deployment or desktop update: 不部署 Worker；构建后由用户重载 Chrome 扩展。
- Git and push constraints: 实现前建立独立 GitHub Issue；验证通过后自动创建独立本地 Conventional Commit；不自动 push、tag、release 或部署。
- GitHub issue: #59
- Implementation commit: `536b4cf` (`feat: allow unscheduled split child tasks`)
- Verification result: `npm run check`、`npm run build`、`git diff --check`、仅 HEAD 与本需求组成的干净构建，以及 400px 实际生成 Popup 的 CDP 交互验收均通过。

## Development execution profile

- Assessment status: approved
- Assessed requirement date or revision: 2026-09-12 initial handoff-ready revision
- Complexity and dominant cost drivers: small-to-medium；主要风险不是数据结构，而是拆分弹窗曾出现多次选择器、校验和重复提交回归，需要同时保护每行日期隔离、混合排期与原子保存。
- Recommended model: `gpt-5.6-luna`
- Recommended reasoning effort: `max`
- Recommendation rationale: 拆分链路近期回归较多，使用 Luna Max 做小范围实现和完整交互回归，比节省一次模型档位更重要。
- Lower-cost alternative and tradeoff: `gpt-5.6-sol` / `medium`；足以完成字段可选化，但对历史拆分交互耦合和脏工作区精确提交的漏检风险更高。
- Engineering effort range: 30–75 minutes including tests, build and generated-bundle interaction verification
- AI usage or API cost range: 产品套餐用量低到中等，预计约 15k–35k tokens；不含返工、人工验收、发布与部署
- Estimate basis and excluded costs: 已有任务池语义、7 天日期组件及拆分交互测试可复用；未知点是当前 `splitTask` 是否把空日期视为结构性非法
- Confidence: high
- Assumptions and unknowns: 现有任务池以 `noTimeLimit` 表达未排期，且子任务允许进入任务池；无需迁移历史数据
- Escalation condition: 如果实现需要改变父子任务数据结构、同步协议、任务池语义或拆分保存原子性，停止开发并返回需求任务确认
- User decision: confirmed recommendation
- Approved model: `gpt-5.6-luna`
- Approved reasoning effort: `max`
- Approved budget or usage range: 产品套餐用量低到中等，预计约 15k–35k tokens
- Profile approved date: 2026-09-12

## Open decisions

- None. 推荐默认不选日期；用户主动选择日期时才排期。
