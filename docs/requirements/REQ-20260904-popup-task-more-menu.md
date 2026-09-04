# Popup 任务“更多操作”菜单可见性修复

- Status: confirmed
- Priority: high
- Target version: 3.15.2
- Confirmed date: 2026-09-04
- Tracking issue: [GitHub Issue #45](https://github.com/Kairos-931/task-manager-chrome/issues/45)

## Objective and user value

- User goal: 在紧凑的 Chrome Popup 中通过任务右侧“点点点”完成低频任务操作。
- Current problem: 点击“点点点”后只看到被裁切的空白区域；菜单实际内容受父级面板 `overflow: hidden` 影响而不可见。
- User-visible outcome: 菜单完整显示、位置稳定、能关闭，并保留 Popup 精简前已有的任务操作能力。

## Scope

### Included

- 修复约 400px Chrome Popup 中普通任务、任务池任务和父任务的“更多操作”菜单显示。
- 菜单内容继续使用当前按任务状态生成的操作，不改变业务含义：包括适用时的“加入今天、重新排期、拆分任务/添加子任务、编辑、删除”。
- 菜单不得被“今日聚焦”、任务池、全部任务等列表容器裁切。
- 同一时间只展开一个任务菜单。
- 点击菜单外部、点击另一任务的“点点点”或执行菜单动作后，当前菜单关闭。
- Popup 靠近底部或左右边缘的任务仍能完整访问菜单；空间不足时允许向上展开或采用其他不超出可视区的定位方式。

### Not included

- 不新增、删除或重新定义任务操作。
- 不改变任务数据结构、保存逻辑、同步协议或权限。
- 不改变新标签页任务卡片和直接操作布局。
- 不修改手机端页面或 Cloudflare Worker。
- 不在本需求中重新设计任务详情或编辑弹窗。

## User flow

1. 用户在 Popup 的今日聚焦、任务池或全部任务中点击某个任务右侧“点点点”。
2. 系统在该任务附近显示完整菜单，菜单文本和点击区域均可见。
3. 用户选择操作后进入现有处理流程；或点击菜单外部关闭，不修改任务。

## Interaction specification

- Entry point: Popup 紧凑任务卡片右侧“点点点”按钮。
- Default state: 所有任务菜单关闭，任务列表不额外占用高度。
- Open state: 当前任务菜单显示在可视区内，位于其他任务和面板之上，不被圆角面板边界裁切。
- Actions and feedback: 菜单项复用已有事件和反馈；删除仍保留原确认机制，重新排期、拆分和编辑仍进入原有弹窗。
- Dismissal: 点击菜单外部或另一个“点点点”关闭当前菜单；关闭本身不得触发任务完成、编辑或拖拽。
- Responsive behavior: 以真实约 400px Chrome Popup 为主要验收宽度；菜单不得造成横向滚动。
- Demo or visual references: `C:\Users\yanxu\AppData\Local\Temp\codex-clipboard-6e7da50f-2d13-402a-9b7e-39fee8642e92.png` 展示了当前被裁切为空白的失败状态。

## Data and safety boundaries

- Reads: 当前任务 ID、类型、日期、重复状态和菜单适用性。
- Writes: 打开和关闭菜单不写数据；选择菜单项时仅沿用该操作现有的数据写入。
- Must not do: 不复制任务操作逻辑，不绕过删除确认，不因菜单开关触发同步或保存。
- Effect on original files or external systems: 仅扩展 Popup UI 行为变化；构建并重载 Chrome 扩展后生效，不需要 Worker 部署。

## Failure and edge cases

- Empty state: 没有任务时不显示“点点点”，无需菜单占位。
- Invalid input: 菜单关联任务已不存在时应安全关闭，不执行其他任务的操作。
- Missing space: 菜单下方空间不足时必须保持完整可见，不能再次显示为被裁切的空白块。
- Re-render: 任务操作、筛选或同步导致列表重绘后，不保留悬空菜单。
- Failure message and next action: 菜单定位失败不应影响任务列表；开发验证应覆盖首项、中间项和末项任务。

## Acceptance criteria

1. Given 400px Popup 的今日聚焦中存在任务，when 点击任一任务的“点点点”，then 该任务适用的菜单项完整可见且可点击，不被面板裁切。
2. Given 菜单已展开，when 点击菜单外部或另一任务的“点点点”，then 原菜单关闭，且同一时间最多存在一个展开菜单。
3. Given 任务位于 Popup 可视区底部或右侧，when 展开菜单，then 菜单仍位于可视区内，不产生横向滚动，也不要求用户先滚动才能选择菜单项。
4. Given 用户选择重新排期、拆分/添加子任务、编辑或删除，then 系统复用现有操作流程、弹窗和确认机制；适用时“加入今天”同样正常工作。
5. Given 用户打开新标签页，then 现有任务卡片和直接操作布局不发生变化。
6. Given 开发完成，then `npm run check`、`npm run build` 与 `git diff --check` 通过，并验证生成的 Popup 及 `chrome-extension-sync` 产物已更新。

## Development handoff

- Version impact: fix
- Relevant modules: developer task determines after inspection; likely Popup rendering/event code and targeted UI tests.
- Required verification: project-defined tests, lint, type checks, build, plus 400px Popup interaction verification.
- Deployment or desktop update: 不部署 Worker；用户在 Chrome 扩展管理页重新加载扩展后生效。若看不到改动，先重载扩展并重新打开 Popup。
- Git and push constraints: 不执行 `git push`；不要覆盖工作区中与本需求无关的未提交改动。

## Open decisions

- None.
