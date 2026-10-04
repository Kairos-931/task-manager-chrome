# 全部任务增加回到顶部入口

- Status: implemented, pending manual product acceptance
- Priority: P2
- Target version: 3.16.1
- Confirmed date: 2026-09-05
- GitHub issue: #53 — https://github.com/Kairos-931/task-manager-chrome/issues/53

## Objective and user value

- User goal: 浏览较长的全部任务列表后，不必手动长距离滚动即可回到页面顶部。
- Current problem: 右侧已有“今”按钮可定位今天，但没有与之配套的回到顶部入口。
- User-visible outcome: 全部任务右侧显示一组按需出现的悬浮导航，“↑”回到顶部，“今”定位今天。

## Scope

### Included

- 在 Popup 与新标签页的“全部任务”视图增加“↑”回到顶部按钮。
- “↑”位于“今”上方，两者竖排、尺寸与视觉风格一致，但独立决定是否显示。
- 页面离开顶部一定距离后显示“↑”；接近顶部时隐藏。
- 点击后滚动到页面顶部；系统启用减少动态效果时取消平滑动画。
- 复用现有列表滚动监听和导航逻辑，避免重复监听。

### Not included

- 不在今日聚焦、任务池、日/周/月视图显示。
- 不增加滚动进度条或记忆上次滚动位置。
- 不修改任务数据、同步协议、手机端或 Worker。

## User flow

1. 用户进入全部任务并向下浏览。
2. 离开顶部后，右侧出现“↑”；“今”按今天锚点是否可见独立显示。
3. 用户点击“↑”，页面回到顶部，按钮自动隐藏。

## Interaction specification

- Entry point: Popup / 新标签页 → 全部任务 → 右侧悬浮导航。
- Default state: 页面接近顶部时“↑”隐藏；“今”沿用现有可见性规则。
- Actions and feedback: 点击“↑”滚动到顶部；无需 Toast。
- Responsive behavior: 400px Popup 与宽屏新标签页均保持右下安全间距，不覆盖任务菜单和关键操作。
- Accessibility: 按钮提供“回到顶部”的 aria-label/title；支持键盘操作与 `prefers-reduced-motion`。

## Data and safety boundaries

- Reads: 当前页面滚动位置和减少动态效果偏好。
- Writes: 不写任务或设置数据，只改变页面滚动位置和按钮显示状态。
- Must not do: 不改变“今”按钮的定位语义，不创建重复滚动监听，不在其它视图残留按钮。
- Effect on original files or external systems: 仅扩展共享 UI、事件、样式与测试。

## Failure and edge cases

- Empty state: 列表不足一屏时按钮保持隐藏。
- Invalid input: 不适用。
- Missing path or unavailable service: 不依赖外部服务。
- Failure message and next action: 不需要错误提示；滚动 API 不可用时保持页面不变。

## Acceptance criteria

1. Given 全部任务列表超过一屏，when 用户向下滚动离开顶部，then 右侧“↑”按钮出现并位于“今”上方。
2. Given 用户点击“↑”，then 页面回到顶部且“↑”自动隐藏。
3. Given 今天锚点可见或不可见，then “今”按钮仍按原规则独立显示，不受“↑”影响。
4. Given 页面不足一屏或位于顶部，then “↑”不占用界面空间。
5. Given 系统启用减少动态效果，when 点击“↑”，then 使用立即滚动而非平滑动画。
6. Given 用户切换出全部任务，then 两个列表导航按钮均不存在。

## Development handoff

- Version impact: fix, bundled into patch release 3.16.1
- Relevant modules: `shared/events.ts`, `shared/render.ts`, `shared/list-navigation.ts`, `styles/tailwind.css`, navigation tests, generated assets
- Required verification: navigation unit/interaction tests, `npm run build`, `npm run check`, `git diff --check`, Popup 400px and newtab smoke test
- Deployment or desktop update: include in extension package v3.16.1; no Worker deployment
- Git and push constraints: do not push/tag/release until explicitly authorized after implementation acceptance

## Development execution profile

- Assessment status: approved
- Assessed requirement date or revision: 2026-09-05 initial revision
- Complexity and dominant cost drivers: small; extend the existing today-navigation listener into a two-button state machine and verify responsive stacking
- Recommended model: gpt-5.6-terra
- Recommended reasoning effort: medium
- Recommendation rationale: Terra medium was the economical baseline; the user explicitly overrides it to Luna Max for the combined implementation
- Lower-cost alternative and tradeoff: gpt-5.6-terra medium; sufficient for the change but not selected by the user
- Engineering effort range: 20–40 minutes, largely overlapping the active v3.16.1 build/test cycle
- AI usage or API cost range: low product-plan usage; no reliable currency estimate available
- Estimate basis and excluded costs: existing today-navigation implementation and tests; excludes human visual acceptance and store review time
- Confidence: high
- Assumptions and unknowns: page scroll remains on `window` in both Popup and newtab; the navigation buttons can share one fixed wrapper
- Escalation condition: stop for product confirmation if either surface uses a different scroll container or the buttons would cover persistent task actions at 400px
- User decision: confirmed override — start combined development with Luna Max
- Approved model: gpt-5.6-luna
- Approved reasoning effort: max
- Approved budget or usage range: low to medium product-plan usage; no explicit token budget
- Profile approved date: 2026-09-05

## Open decisions

- None
