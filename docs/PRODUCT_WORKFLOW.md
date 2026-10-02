# Product workflow

- Project: `TaskMaster`
- Requirements task title: `【TaskMaster】产品`
- Developer task title: `【TaskMaster】开发·过去日期排期`
- Developer task: `codex://threads/01a0f6ce-2b91-7343-bb37-1b3f5d3d467a`
- Shared checkout: `C:\Users\Kairos\Documents\Codex-Case-Collisions\TASK_MASTER`
- Initialized: `2026-09-04`
- Status: active
- Active developer requirement: none (execution slot released 2026-10-02)
- Awaiting configuration: docs/requirements/REQ-20260930-google-account-sync.md (Issue #62; status `awaiting_configuration`, not completed)
- Security blocker: Issue #64 (status `blocked_identity_evidence`; gates #62 release)
- Last completed requirement: `C:\Users\Kairos\Documents\Codex-Case-Collisions\TASK_MASTER\docs\requirements\REQ-20260922-newtab-list-todo-favicon.md` (`2026-09-23`, implemented; awaiting user acceptance)
- Queue: empty
## Operating contract

1. Product discussion, specifications, acceptance criteria, and demos live in the requirements task.
2. Confirmed production implementation lives in the developer task.
3. `docs/requirements/` is the authoritative handoff channel.
4. “确认开发” means the current confirmed specification may be sent to the developer task.
5. Product-impacting ambiguity returns to the requirements task; implementation details remain with the developer task.
6. After required verification passes, the developer creates one local Conventional Commit per independent requirement or fix. Push, tag, release, and deployment still require explicit user authorization.

## 2026-09-30 迁移后的交付记录

- Product task: codex://threads/01a0f1af-be64-7860-8c0d-660fdb71e2c9
- Developer baseline: gpt-6-luna / max; per-message override.
- Historical developer history unavailable; historical in_development flag is not proof of current work. User authorizes continuation in latest 3.16.0 checkout with newly linked idle developer.
- Current authoritative specification: docs/requirements/REQ-20260930-google-account-sync.md; supplements and supersedes historical scope where clarified.
- Dispatch state: sent successfully 2026-09-30; in_development.
- Do not add physical migration/export/import features. Preserve existing manual export.




## 2026-10-01 用户授权接续开发

- 用户确认开发空闲并指示转开发，已成功交付任务池过去日期需求。
- Google 同步历史需求状态：suspended pending reconciliation；无可靠完成证据，不标记 completed。本次用户授权切换，开发不并行继续该项。


## 2026-10-01 专门开发对话接手

- 用户明确要求创建新开发对话执行当前排期需求，已创建并交付 r2。
- 当前开发：codex://threads/01a0f6ce-2b91-7343-bb37-1b3f5d3d467a，gpt-6-luna / max。
- 已通知旧开发停止该需求，保留成果；新开发须确认无并发写入后接续。
- 保存项目入口仍是旧目录，开发提示已明确指定最新目录，不代表旧副本可用于开发。


## 2026-10-01 用户授权恢复 Google 同步开发

- 用户明确要求继续已批准的 `docs/requirements/REQ-20260930-google-account-sync.md` 并完成，恢复 Issue #62 开发。
- 当前开发事项从任务池过去日期排期切换为 Google 登录与账号同步；不并行扩展其他需求。
- 保留此前过去日期需求提交 `960c15a` 和工作区其他未提交改动。


## Google 同步产品协调授权 2026-10-01

用户委托产品对话全权处理当前同步需求产品问题；允许开发直接提问与产品回复，决策记录写入当前需求。当前开发对话为 01a0f6ce-2b91-7343-bb37-1b3f5d3d467a。

## 2026-10-02 Google 同步执行槽释放

- 本地实现提交：7132a47；发布密钥保护提交：cd37d4a。`npm run check` 已通过，release checker 按预期阻止含私钥的当前清单；完整发布构建及生产验收未完成。
- Issue #62 状态为 `awaiting_configuration`；本地开发执行槽释放，等待真实扩展身份、Google OAuth 客户端和 Cloudflare/Wrangler 非生产验证条件。
- Issue #64 状态为 `blocked_identity_evidence`，保持开放；公开密钥暴露处置和身份兼容证据到位前，#62 不得宣告生产可用。
- 不存在运行中的开发实现任务；配置与身份材料准备好后，再恢复 #62 开发和验收。队列保持为空。
