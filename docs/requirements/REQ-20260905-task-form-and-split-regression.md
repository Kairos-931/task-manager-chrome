# 恢复普通新增与完整拆分流程

- Status: completed (regression verified 2026-09-10)
- Priority: P0
- Target version: 3.16.1
- Confirmed date: 2026-09-05
- GitHub issue: #54 — https://github.com/Kairos-931/task-manager-chrome/issues/54

## Objective and user value

- User goal: 普通任务能正常新增；已有任务能完成“拆分 → 添加步骤 → 完成拆分”。
- Current problem: 隐藏的可拆分任务输入仍启用且带 `required`，浏览器在 JavaScript 提交处理之前拦截普通任务表单；用户同时报告完整拆分路径失效。
- User-visible outcome: 非当前模式的控件完全不参与原生校验和提交；完整拆分路径恢复。

## Scope

### Included

- 切换普通/可拆分模式时，禁用非当前区的表单控件并启用当前区控件。
- 新增弹窗初始化时立即应用普通任务模式状态。
- 行为级复现并修复“点击拆分 → 添加一个步骤 → 填写 → 完成拆分”。
- 同页保留隐藏新增弹窗与可见拆分弹窗，验证两者不串扰。

### Not included

- 不改变任务数据结构、同步协议、拆分业务规则、手机端或 Worker。
- 不增加新功能或重新设计弹窗。

## User flow

1. 用户新增普通任务，填写必填字段并提交，任务成功保存。
2. 用户切换到可拆分任务，只校验该模式可见字段。
3. 用户对已有任务点击拆分，可添加步骤并完成拆分。

## Interaction specification

- Entry point: 添加任务；任务更多操作 → 拆分。
- Default state: 普通任务为默认模式，隐藏可拆分字段禁用。
- Actions and feedback: 切换模式后只校验当前可见字段；真实错误继续提示并聚焦。
- Responsive behavior: Popup 400px 与新标签页共用相同行为，不改变布局。
- Demo or visual references: 用户现场复现。

## Data and safety boundaries

- Reads: 当前可见模式或当前拆分弹窗的输入。
- Writes: 沿用现有任务新增与拆分保存流程。
- Must not do: 不读取或提交隐藏模式字段；失败时不得部分写入。
- Effect on original files or external systems: 仅扩展共享表单/事件与测试。

## Failure and edge cases

- Empty state: 普通模式不应被隐藏空子任务阻止；可拆分模式仍要求至少两个有效子任务。
- Invalid input: 只提示当前可见模式中的真实无效字段。
- Missing path or unavailable service: 本地保存失败时沿用现有提示，不关闭弹窗。
- Failure message and next action: 错误必须指向用户当前可见且可修改的字段。

## Acceptance criteria

1. Given 可拆分任务区隐藏且其中标题为空，when 提交有效普通任务，then 原生校验不拦截并成功保存。
2. Given 切换到可拆分任务，then 普通专属控件禁用，当前子任务控件启用并正常校验。
3. Given 用户打开已有任务拆分并添加一个步骤，when 所有可见行有效并点击完成拆分，then 成功保存且弹窗关闭。
4. Given 同页另有隐藏空白子任务行，then 拆分提交、删除和数量判断不读取这些行。
5. Given 当前可见行无效，then 提示并聚焦正确字段。

## Development handoff

- Version impact: fix, patch release 3.16.1
- Relevant modules: `shared/events.ts`, `shared/render.ts`, split scope helper, behavior tests, generated assets
- Required verification: browser-form behavior test, full split interaction test, `npm run build`, `npm run check`, `git diff --check`
- Deployment or desktop update: local extension rebuild; release only after user acceptance
- Git and push constraints: no push/tag/release until explicitly authorized

## Development execution profile

- Assessment status: approved as an in-scope regression correction
- Assessed requirement date or revision: 2026-09-05 root-cause revision
- Complexity and dominant cost drivers: small-to-medium; native constraint validation and end-to-end event wiring were not covered by prior tests
- Recommended model: gpt-5.6-luna
- Recommended reasoning effort: max
- Recommendation rationale: continue the user-selected developer profile and require deeper behavioral verification
- Lower-cost alternative and tradeoff: none requested
- Engineering effort range: 30–60 minutes including regression harness improvement
- AI usage or API cost range: low to medium product-plan usage
- Estimate basis and excluded costs: confirmed HTML constraint root cause plus static event inspection; excludes manual Chrome visual acceptance
- Confidence: high for ordinary task root cause, medium for the additional split-click symptom until behavior reproduction runs
- Assumptions and unknowns: user is running the freshly rebuilt local extension; no stale extension cache
- Escalation condition: stop for product confirmation if restoring the flow requires data migration or changing split semantics
- User decision: regression reported during acceptance; fix required before acceptance
- Approved model: gpt-5.6-luna
- Approved reasoning effort: max
- Approved budget or usage range: no explicit token budget
- Profile approved date: 2026-09-05

## Open decisions

- None

## Regression recurrence — 2026-09-10

- Completion: 根因修复并通过连续 3 轮生成 bundle 交互验证；`npm run check`、`npm run build`、`git diff --check` 均通过。

- User reproduction: 新增子任务 → 点击“添加任务”增加一行 → 点击“完成拆分”，按钮无效/无法完成。
- Frequency: 用户反馈该流程经常反复失效，不能只针对单次异常做表面修补。
- Required diagnosis: 在真实 Popup 与管理标签页生成产物中复现完整点击链，确认事件绑定、原生表单校验、重复提交保护、DOM 重渲染、保存失败处理与隐藏表单隔离的实际状态。
- Required fix: 修复根因，并增加能够在未来代码变化时稳定阻止该回归的行为级测试；不得通过移除校验或吞掉真实保存错误来让按钮表面可点。
- Acceptance: 连续多轮执行“打开拆分 → 添加任务 → 填写标题 → 完成拆分”均只保存一次、弹窗关闭、父子任务数据正确且控制台无未处理异常；普通新增任务流程保持可用。
