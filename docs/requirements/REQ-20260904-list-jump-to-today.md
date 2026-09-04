# 全部任务快速定位到今天

- Status: released in v3.16.0
- Priority: medium
- Target version: 3.16.0
- Confirmed date: 2026-09-04
- Tracking issue: [GitHub Issue #49](https://github.com/Kairos-931/task-manager-chrome/issues/49)

## Objective and user value

- User goal: 在较长的全部任务时间线中，一次点击回到今天所在位置。
- Current problem: 全部任务按日期从旧到新排列，任务较多时用户需要手动滚动并寻找今天。
- User-visible outcome: 今天不在可视区域时出现一个紧凑的悬浮定位按钮；点击后平滑滚动到今天并短暂高亮。

## Scope

### Included

- Popup 与新标签页的“全部任务”视图增加“定位到今天”悬浮按钮。
- 仅在列表发生滚动且今天锚点不在可视区域时显示；回到今天附近后自动隐藏。
- 点击后使用 `scrollIntoView` 平滑定位，并让今天标题短暂高亮。
- 今天没有符合当前筛选的任务时，在日期序列中的正确位置渲染紧凑锚点“今天 · 当前筛选无任务”，保证定位含义准确。
- 按钮使用清晰的定位图标或“今”字、可访问标签和提示文案，不使用无含义的纯装饰小点。
- 保持父任务进度区位于顶部、任务池位于日期组之后的现有结构。

### Not included

- 不改变全部任务的日期排序、筛选逻辑或数据。
- 不增加迷你地图、滚动条拖柄、日期索引面板或自动跳转。
- 不修改日、周、月和今日聚焦视图。

## User flow

1. 用户进入“全部任务”并滚动离开今天。
2. 右下角出现“定位到今天”按钮。
3. 用户点击按钮，列表平滑滚动到今天日期组，日期标题短暂高亮。
4. 今天重新进入可视区域后，按钮自动隐藏。

## Interaction specification

- Entry point: Popup / 新标签页 → 全部任务。
- Visibility: 列表不溢出或今天已可见时不显示按钮。
- Empty today: 渲染紧凑日期锚点，不伪造任务；文案受当前筛选状态约束。
- Feedback: 平滑滚动与约 1–2 秒的高亮共同确认定位完成。
- Placement: 右下角悬浮，不遮挡任务更多菜单、添加按钮和 Popup 底部关键操作。
- Accessibility: 按钮可键盘聚焦，具有 `aria-label="定位到今天"`。

## Data and safety boundaries

- Reads: 当前视图、今天本地日期、筛选后的日期组及锚点可见状态。
- Writes: 不写任务或设置；仅改变滚动位置和临时视觉状态。
- Must not do: 不修改 currentDate、不重新排期、不持久化滚动位置。
- Effect on external systems: 扩展构建与发布后生效；不部署 Worker。

## Failure and edge cases

- 筛选变化或重新渲染后重新计算锚点与按钮可见性。
- Popup 关闭再打开不恢复旧滚动位置。
- 今天位于日期列表首尾、只有父任务、只有任务池任务时仍能定位到准确的今天锚点。
- 降低动态效果偏好下取消平滑动画，但仍立即定位和高亮。

## Acceptance criteria

1. Given 全部任务可滚动且今天不在视口，then 显示“定位到今天”按钮。
2. Given 用户点击按钮，then 平滑滚动到今天，今天日期标题短暂高亮，按钮随后隐藏。
3. Given 今天没有符合筛选的任务，when 点击按钮，then 定位到按时间顺序插入的“今天 · 当前筛选无任务”锚点。
4. Given 今天已可见或列表无需滚动，then 按钮不占用界面空间。
5. Given 点击按钮，then 任务数据、筛选设置和当前日期状态均不改变。
6. Given Popup 约 400px，then 按钮不遮挡任务菜单和关键操作。

## Development handoff

- Version impact: feat, bundled into unreleased 3.16.0
- Relevant modules: developer task determines after inspection; likely list renderer, event binding, scoped scroll/visibility observer and targeted UI tests.
- Required verification: today exists/empty/filter scenarios, Popup and newtab scroll behavior, reduced-motion behavior, `npm run check`, `npm run build`, `git diff --check`.
- Deployment or desktop update: include in formal `v3.16.0` extension release; no Worker deployment.
- Git and push constraints: release/tag/push only after the user approves the combined development and release confirmation.

## Development execution profile

- Assessment status: approved
- Recommended model: gpt-5.6-terra
- Recommended reasoning effort: medium
- Engineering effort range: included in the combined 1.5–3 hour estimate; this item alone is approximately 30–60 minutes.
- AI usage range: included in the combined medium Codex plan estimate.
- Confidence: high; the list already has deterministic date groups and `data-date` anchors.
- Lower-cost alternative: gpt-5.6-luna medium; sufficient for this isolated item, but using one model for the combined batch avoids handoff fragmentation.
- Escalation condition: stop if reliable visibility tracking requires a new scroll container architecture or changes shared view state beyond the list view.
- User decision: approved recommendation and authorized `v3.16.0` release after acceptance
- Approved model: gpt-5.6-terra
- Approved reasoning effort: medium
- Approved usage range: included in the combined medium Codex plan usage estimate
- Profile approved date: 2026-09-04

## Open decisions

- None.
