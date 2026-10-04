# 全部任务增加回到顶部入口

- Status: awaiting_user_acceptance
- Priority: P2
- Target version: 4.3.1
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

## 2026-10-04 已交付版本回归：恢复53

用户在4.3.0全部任务滚动发现原今上方回顶部按钮消失。产品核对最新干净388d82c分支shared/render.ts只有jumpToTodayBtn，list-navigation无顶部可见helper/events无backToTop；canonical未提交旧实现含backToTopBtn与滚动绑定，已保存GitHub snapshot。确定是最新交付链缺失这项功能，不能归因为浏览器缓存。沿用开放Issue53恢复，无需新建重复Issue，不直接合并全部旧脏代码。

恢复原目标：全部任务页可滚动且离开顶部时显示↑，在今上方同一悬浮导航组，滚动时固定在可视区域；今/↑各自可见性独立，无今天分组仍能↑，回顶部后↑隐藏。支持Popup与newtab的实际滚动容器、无水平溢出、可访问键盘及reduced-motion；其他视图不冒出。点击不改任务/筛选/同步。

最新4.3.0/388d82c基线保持所有新增日期池切换、Google、导入、历史兼容，按fix PATCH构建4.3.1。配置Luna/max、单开发，小型工程/低至中用量；无GUI授权，定位真实滚动事件/容器的行为测试及生成CSS规则验证，typecheck/lint/build/release、既有静态失败单列。旧canonical实现作为参考，精准适配当前代码而非merge整个snapshot。构建/备份/hash原固定目录交付，完成分支正常push按近期同步授权，不强推、不Worker/依赖安装/生产数据。76/75验收仍独立，62保持开放。
### r2 开发执行记录（2026-10-04）

- 状态：in_development；唯一活动项 Issue #53。基线 `388d82c`（4.3.0），分支 `codex/list-back-to-top-53`。
- 当前开发任务：`codex://threads/01a0f6ce-2b27-7c90-adaa-1564721cb1b8`；本轮无子代理/后台写入进程。
- 执行配置：按用户最新要求切换 gpt-6-sol / light（low）；串行。Popup 与新标签页沿用窗口视口滚动事件；实现需确认两端滚动指标一致，不得调用 GUI。
- 验收重点：回顶部阈值和内容溢出条件、独立“今”状态、没有 todayAnchor 时回顶部仍工作、reduced-motion、视图切换卸载监听/按钮、按钮点击滚动以及生成 CSS。
- 交付：4.3.1 PATCH 候选、固定扩展目录备份与哈希核验；Issue #76/#75 的用户验收和 Issue #62 保持原状态。
- 生命周期事件：`REQ-20260905-list-back-to-top#r2-20261004-start-388d82c`；工作已启动，待实现与验证。

### r2 交付记录（2026-10-04）

- 恢复列表视图的双按钮导航：4.3.1 的 Popup/新标签页均渲染“↑”和“今”；共用固定竖排容器。↑按真实滚动位置与页面总高度独立显示，无 todayAnchor 时仍能回顶；点击跟随 reduced-motion 设置。“今”继续按 todayAnchor 可见性独立工作，其他视图不显示导航。
- 根因是 4.3.0 渲染树和事件绑定均未包含 backToTop 控件；不是缓存问题。滚动事件仍用 `window`，位置/高度从 `document.scrollingElement` 读取；回归测试覆盖短/长内容、阈值、独立可见性、无 todayAnchor 点击、平滑/减少动态效果和监听清理。
- 验证：`npm run typecheck`、`npm run lint`、导航与渲染定向测试、`npm run build`、release checker、重复 CSS 构建及候选 CSS 构建测试通过。`npm run check` 在既有 `tests/ui-layout.test.mjs` 中断言 `events.ts` 包含拆分子任务 DOM 顺序处失败；该测试文件未修改。未做 GUI/视觉检查。
- Candidate：`outputs/TaskMaster-4.3.1-list-back-to-top-53-20261004`。已在稳定加载目录 `C:\Users\Kairos\Documents\TASK_MASTER\outputs\TaskMaster-3.16.2` 更新至 4.3.1；14 个文件与候选 SHA-256 一致，Chrome key 和权限与 4.3.0 一致。更新前 4.3.0 备份：`C:\Users\Kairos\AppData\Local\TaskMaster\backups\extension-before-list-back-to-top-53-20261004-4.3.0`，14 个文件备份哈希核验通过。用户需 Reload 扩展验收。
- 仓库默认的 `chrome-extension-sync/` 仍是旧 3.16.0 包，检查发现其中含私钥材料；构建脚本也明确拒绝覆盖已有默认目录。本次没有触碰它，CSS 生成/发布校验针对 4.3.1 候选与实际稳定加载目录。
- 没有修改任务数据、同步协议、API 或 Worker；没有部署、推送、打 tag 或关闭 #53。#62 保持开放，#76/#75 继续等待用户验收。生命周期事件：`REQ-20260905-list-back-to-top#r2-20261004-delivered-4.3.1`。
