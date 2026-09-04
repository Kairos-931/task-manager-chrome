# 拆分任务选择快捷日期后无法完成

- Status: implemented and product-reviewed
- Priority: high
- Target version: 3.16.0
- Confirmed date: 2026-09-04
- Parent requirement: `REQ-20260904-pool-seven-day-scheduling.md`
- Tracking issue: [GitHub Issue #47](https://github.com/Kairos-931/task-manager-chrome/issues/47)

## Objective and user value

- User goal: 在拆分任务时为子任务选择未来 7 天日期，并正常完成拆分。
- Current problem: 点击拆分弹窗中的快捷日期后，“完成拆分”失败；日期按钮被拆分弹窗处理器和页面级通用处理器重复处理，存在跨弹窗状态污染。
- User-visible outcome: 每个子任务的快捷日期只更新本行日期；填写有效内容后一次点击即可完成拆分。

## Scope

### Included

- 隔离新增/编辑任务、排期弹窗和拆分弹窗的快捷日期事件与高亮刷新范围。
- 保证拆分弹窗每一行的快捷日期只修改该行 `.split-child-date`。
- 增加真实 DOM 交互回归测试，覆盖选择未来 7 天日期后提交拆分，而非仅匹配源码字符串。
- 保留现有日期负荷展示、日期格式和拆分数据结构。

### Not included

- 不改变拆分规则、子任务字段、任务池排期流程或新标签页布局。
- 不修改同步协议、手机端或 Cloudflare Worker。

## User flow

1. 用户从任务的更多操作进入“拆分任务”。
2. 用户填写至少两个子任务，并为任一子任务点击未来 7 天快捷日期。
3. 该行日期输入与高亮同步，其他行和其他隐藏弹窗不被修改。
4. 用户点击“完成拆分”，系统保存父子任务并给出成功反馈。

## Failure and edge cases

- 多行选择不同日期时，各行保持独立。
- 点击日期内的文字、数字或负荷区域，与点击按钮空白处结果一致。
- 重复点击提交不得创建重复子任务。
- 输入本身无效时继续显示对应字段错误，不误报为循环任务或静默失败。

## Acceptance criteria

1. Given 拆分弹窗有两个有效子任务，when 用户为其中一行点击未来 7 天内任一日期并点击“完成拆分”，then 拆分成功且子任务保存为所选日期。
2. Given 两行分别选择不同日期，when 提交，then 两个子任务分别保存各自日期，不发生串行或跨弹窗污染。
3. Given 页面同时渲染隐藏的新增任务与排期弹窗，when 操作拆分快捷日期，then 这些弹窗的日期字段和高亮状态不被修改。
4. Given 开发完成，then 交互级回归测试、`npm run check`、`npm run build` 与 `git diff --check` 通过。

## Development handoff

- Version impact: fix within unreleased 3.16.0
- Relevant modules: `shared/events.ts`、拆分交互测试；仅在确有需要时调整渲染选择器。
- Required verification: 使用 DOM 交互测试实际触发点击和提交，不能只增加正则源码断言。
- Deployment or desktop update: Chrome 扩展重载后生效；不部署 Worker。
- Git and push constraints: 不执行 `git push`，不覆盖无关未提交改动。

## Development execution profile

- Assessment status: inherited for direct defect correction
- Approved model: gpt-5.6-luna
- Approved reasoning effort: medium
- Expected usage: low，预计 1 个修复回合和 2–4 次测试/构建调用。
- Escalation condition: 如果真实根因不是事件选择器越界，或需要改变拆分数据语义，停止实现并返回需求任务重新评估。

## Open decisions

- None.

## Implementation result

- Completed: 2026-09-04
- Root cause: 页面级 `.quick-date-btn` 监听越过弹窗边界，把拆分日期同时绑定到隐藏的新增/编辑任务日期字段。
- Resolution: 将新增/编辑与拆分快捷日期绑定拆成独立、限定根节点的生产函数；拆分日期只更新当前子任务行；提交增加单次执行保护。
- Verification: 生产事件绑定交互测试、实际 `splitTask` 子任务日期断言、重复提交保护、`npm run check`、`npm run build` 与 `git diff --check` 均通过。
- Remaining manual check: 在 Chrome 扩展管理页重载后，用真实 Popup 再走一次“拆分 → 两行选择不同日期 → 完成拆分”。
