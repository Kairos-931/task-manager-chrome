# Popup 今日聚焦独立筛选与操作收敛

- Status: completed
- Priority: P1
- Target version: 3.17.0
- Confirmed date: 2026-09-10
- Queued date: 2026-09-10
- Development start date: 2026-09-10
- Completed date: 2026-09-10
- GitHub Issue: https://github.com/Kairos-931/task-manager-chrome/issues/56
- Commit: `aac2c0067f12cbd83a28c1ebb2cbe1b303cc3a12`
- Verification: `npm run check`, `npm run build`, `git diff --check` and 400px generated Popup bundle validation passed.

## Objective and user value

- User goal: 每次打开 Popup 都稳定看到今天的任务，不受管理标签页筛选影响，并能在一行内完成常用操作。
- Current problem: Popup 与管理标签页共享筛选状态时，管理页的“隐藏已完成”等选择会让 Popup 今日内容意外消失；今日任务的次要操作也不够紧凑。
- User-visible outcome: Popup 今日聚焦拥有独立默认规则；今日任务右侧操作单行排列，移除不适合今日场景的拆分入口。

## Scope

### Included

- Popup 不跟随管理标签页的优先级、分类、隐藏已完成和隐藏今日之前筛选。
- Popup 今日聚焦默认显示已完成任务；今日之前任务继续使用原有折叠区，默认收起。
- “今日之前”区域必须完整复用现有实现，包括分组、默认折叠、展开/收起、任务内容及操作；本需求不得重写、删减或改变其行为。
- 管理标签页筛选状态保持原样，不被 Popup 打开或操作覆盖。
- Popup 今日任务保留重新排期、编辑和更多三个右侧操作，单行右对齐。
- 今日任务移除“加入今天/安排到今天”和“拆分任务”入口；删除任务置于更多菜单。
- 左侧完成按钮保持现有位置和行为。

### Not included

- 不改变管理标签页筛选交互。
- 不删除任务池或全部任务视图的拆分能力。
- 不改变父任务添加子任务能力。
- 不修改数据结构、同步协议、手机端或 Worker。

## User flow

1. 用户在管理标签页任意调整筛选。
2. 用户打开 Popup，默认进入今日聚焦并仍能看到今天的已完成与未完成任务。
3. 今日之前的任务保留在原有折叠区，默认收起，用户可按需展开。
4. 用户在任务行右侧直接选择重新排期、编辑或更多；更多菜单中可删除任务。

## Interaction specification

- Entry point: Chrome 插件 Popup → 今日聚焦。
- Default state: 显示今日已完成与未完成；今日之前折叠区默认收起；不读取管理标签页筛选。
- Actions and feedback: 重新排期、编辑、更多在任务行右侧同一行；拆分不出现；删除收进更多菜单。
- Responsive behavior: 约 400px Popup 下标题可省略，右侧三个操作不可换行或掉到下一行。
- Demo: `demo/popup-focus-independent-filters.html`。

## Data and safety boundaries

- Reads: 任务数据及 Popup 专属展示规则；管理页仍读取原有持久化筛选。
- Writes: Popup 不应因初始化默认值而覆盖管理标签页筛选设置。
- Must not do: 不通过修改共享筛选值来临时实现 Popup 独立；不让 Popup 与管理页互相污染状态。
- Effect on external systems: 仅扩展端；重载扩展生效，无需部署 Worker。

## Failure and edge cases

- Empty state: 今日确实没有任务时显示正常空状态。
- Completed task: 今日已完成任务仍显示并保持已完成样式。
- Overdue task: 今日之前任务保留原有折叠区并默认收起；展开后可查看，不由管理标签页筛选决定。
- Long title: 标题省略，右侧操作不换行、不溢出。

## Acceptance criteria

1. 管理标签页勾选“隐藏已完成”后打开 Popup，今日已完成任务仍然显示。
2. Popup 打开和切换视图不修改管理标签页已有筛选值。
3. Popup 今日聚焦保留原有“今日之前”折叠区并默认收起，可独立展开；管理标签页筛选值保持自身原值。
4. 今日普通任务右侧同一行显示重新排期、编辑、更多，菜单中无拆分任务且可删除。
5. 任务池、全部任务及父任务原有适用操作不因本需求被误删。
6. 400px Popup 下至少三项任务可见，任务标题与右侧操作均不产生横向溢出。

## Development execution profile

- Assessment status: approved
- Recommended model: `gpt-5.6-luna`
- Recommended reasoning effort: high
- Approved model: `gpt-5.6-luna`
- Approved reasoning effort: max
- Approved date: 2026-09-10
- User override: 使用 Luna Max 开始开发。
- Rationale: 改动涉及 Popup 与管理标签页共享筛选状态的解耦，同时必须严格避免影响既有“今日之前”折叠能力，需要完整梳理状态读写与两端回归测试。
- Engineering effort: small-to-medium，预计 45–90 分钟；主要成本是筛选状态边界、400px 操作布局和既有折叠行为回归。
- Expected AI usage/cost: 低到中，约 15k–35k tokens 的产品计划用量估计；不含当前正在处理的拆分回归、人工验收、API 或基础设施费用。
- Confidence: medium-high；现有 Popup/newtab 共用渲染与筛选状态，解耦点需由开发定位，但不涉及数据迁移。
- Lower-cost alternative: `gpt-5.6-luna` medium；用量更低，但遗漏共享状态副作用或误改“今日之前”行为的风险略高。
- Escalation condition: 若必须改变持久化设置结构、同步字段或“今日之前”现有交互才能完成，停止开发并返回产品任务确认。
- Delivery state: queued behind the active split-form regression.

## Open decisions

- None. 用户已要求按更新后的 Demo 转交开发；右侧三个操作定为“重新排期、编辑、更多”。

## Git delivery policy

- 验证通过后自动创建仅包含本需求相关改动的本地 Conventional Commit。
- 未经用户明确要求，不 push、tag、发布或部署。
