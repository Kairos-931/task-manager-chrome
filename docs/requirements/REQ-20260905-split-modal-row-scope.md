# 拆分弹窗误校验隐藏子任务

- Status: implemented, pending manual product acceptance
- Priority: P1
- Target version: 3.16.1
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

- Version impact: fix, bundled into patch release 3.16.1
- Relevant modules: `shared/events.ts`, split interaction tests, generated extension assets
- Required verification: targeted dual-modal regression test, `npm run build`, `npm run check`, `git diff --check`
- Deployment or desktop update: include in extension package v3.16.1; no Worker deployment
- Git and push constraints: implement and verify now; do not push, tag, or release until explicitly authorized after acceptance

## Development execution profile

- Assessment status: approved
- Assessed requirement date or revision: 2026-09-05 root-cause revision
- Complexity and dominant cost drivers: small selector-scope correction; main risk is covering submit, remove, count and focus consistently
- Recommended model: user requested gpt-5.6-luna when work resumes
- Recommended reasoning effort: max
- Recommendation rationale: preserve the user's chosen combined development configuration
- Lower-cost alternative and tradeoff: not requested
- Engineering effort range: 15–30 minutes plus combined regression build
- AI usage or API cost range: low incremental product-plan usage
- Estimate basis and excluded costs: confirmed static root cause and existing tests; excludes manual extension visual acceptance
- Confidence: high
- Assumptions and unknowns: both modal trees remain rendered concurrently as in the current shared app
- Escalation condition: return for confirmation if the fix requires changing split persistence or parent-child data semantics
- User decision: confirmed override — start combined development with Luna Max
- Approved model: gpt-5.6-luna
- Approved reasoning effort: max
- Approved budget or usage range: low product-plan usage; no explicit token budget
- Profile approved date: 2026-09-05

## Open decisions

- None
