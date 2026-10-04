# 新标签页使用 List Todo 页签图标

- Status: implemented; awaiting user acceptance
- Priority: P2
- Target version: next patch
- Confirmed date: 2026-09-22
- Development started: 2026-09-22
- Development completed: 2026-09-23
- GitHub Issue: #61 (closed)
- Implementation commit: `5b3bfd6` (`fix: add newtab list todo favicon`)
- Verification result: targeted favicon test, `npm run check`, `npm run build`, and `git diff --check` passed in the developer task.

## Objective and user value

- User goal: 新标签页在浏览器页签中显示清晰、符合任务管理语义的图标。
- Current problem: `newtab/newtab.html` 没有显式 favicon，页签缺少稳定的专属识别。
- User-visible outcome: TaskMaster 新标签页显示蓝底白色 Lucide List Todo 图标；在 16px 页签尺寸下仍可识别为任务清单。

## Scope

### Included

- 以用户确认的 Lucide `list-todo` 轮廓为基础制作专用新标签页 favicon。
- 使用 TaskMaster 现有主蓝色 `#3b82f6` 与白色线条，简化并适配 16px 显示。
- 在 `newtab/newtab.html` 显式引用该 favicon。
- 由现有构建脚本复制到 `chrome-extension-sync` 生成包。
- 增加静态回归检查，确认源码、图标和生成包引用一致。

### Not included

- 不替换扩展工具栏、扩展管理页和应用商店使用的现有 `icon16/48/128`。
- 不修改 Popup 图标、展示页图标、页面标题或功能交互。
- 不引入图标库运行时依赖或外部网络资源。

## User flow

1. 用户打开或切换到 TaskMaster 新标签页。
2. 浏览器加载扩展内置的专用 favicon。
3. 页签显示蓝底白色任务清单图标，便于在多个页签间识别。

## Interaction specification

- Entry point: Chrome 新标签页的页签栏。
- Default state: favicon 始终显示，不依赖主题或网络。
- Actions and feedback: 无新增操作。
- Responsive behavior: 重点保证浏览器约 16px 页签尺寸；源图形保持矢量清晰。
- Visual reference: 用户确认的 Lucide `list-todo` 图标方向。

## Data and safety boundaries

- Reads: 扩展内置图标文件。
- Writes: 无用户数据写入。
- Must not do: 不加载第三方图标 URL，不修改任务数据或权限。
- Effect on original files or external systems: 仅扩展静态资源与新标签页 HTML；重载扩展后生效。

## Failure and edge cases

- Missing icon: 构建/测试应失败，避免生成包出现断链。
- Unsupported external dependency: 不使用，图标直接随扩展打包。
- Cache: 重载扩展并重新打开新标签页后使用新图标。

## Acceptance criteria

1. Given 用户打开 TaskMaster 新标签页，then 页签显示蓝底白色 List Todo 图标。
2. Given 扩展处于离线状态，then favicon 仍正常显示且无外部请求。
3. Given 查看扩展工具栏图标，then 原有 `icon16/48/128` 保持不变。
4. Given 完成构建，then `chrome-extension-sync/newtab/newtab.html` 与对应专用图标均存在且引用路径有效。
5. `npm run check`、`npm run build` 与 `git diff --check` 通过。

## Development execution profile

- Assessment status: approved
- Selected confirmation option: 1
- Approved profile: `gpt-5.6-luna` / `high`
- Primary recommendation: option 1 — `gpt-5.6-luna` / `high`
- Default option: option 0 — `gpt-5.6-luna` / `max`
- Engineering effort: small, expected 20–45 minutes; dominant work is 16px asset construction and generated-package verification.
- Expected AI usage: low, approximately 10k–30k model tokens under product-plan usage; excludes account quotas and external infrastructure.
- Confidence: high. Newtab HTML and asset-copy paths are explicit, and the change is isolated and reversible.
- Lower-cost tradeoff: Luna High is sufficient; Luna Max adds review margin but should not alter the solution.
- Escalation condition: stop and return for reassessment if Chrome rejects an SVG favicon in the generated extension and a multi-size raster pipeline is required.
- Delivery state: ready to start; workflow has no active requirement and the linked developer task is idle.

## Development handoff

- Version impact: fix (PATCH visual asset)
- Relevant modules: `newtab/newtab.html`, `icons/`, static tests, generated `chrome-extension-sync` assets.
- Required verification: targeted asset/reference test, `npm run check`, `npm run build`, `git diff --check`.
- Deployment or desktop update: no server deployment; reload extension and reopen new tab.
- Git and push constraints: create one local Conventional Commit after verification; do not push, tag, release, or deploy without explicit authorization.
- GitHub Issue: developer must create or link a dedicated issue before implementation.

## Open decisions

- None. Selected visual: Lucide `list-todo`, blue background, white strokes, newtab-only.
