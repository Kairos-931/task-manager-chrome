# Google 账号同步配置与数据边界

> 状态：代码和本地演练已准备；正式 Worker、Google OAuth 客户端和 D1 迁移尚未配置或部署。正式 API 地址仍为 `https://taskmaster-api.yx9391.workers.dev`。

## OAuth 配置

扩展和手机网页使用各自的 Google OAuth 客户端。用户只需主动登录；客户端由项目维护者配置。

1. 创建 Chrome Extension OAuth 客户端，绑定 `manifest.json` 中稳定 `key` 对应的扩展 ID，并把客户端 ID 填入 `manifest.json` 的 `oauth2.client_id`。
2. 创建 Web application OAuth 客户端，将 `https://taskmaster-api.yx9391.workers.dev` 加入获准来源，并将 Web 客户端 ID 配置为 Worker secret `GOOGLE_WEB_CLIENT_ID`。
3. 扩展请求 `openid`、`email`、`profile`。Worker 验证扩展访问令牌时向 Google UserInfo 查询身份；手机端 ID Token 由 Worker 验证签名及 `iss`、`aud`、`exp`、`sub`。
4. 发布检查会拒绝 `YOUR_GOOGLE_EXTENSION_CLIENT_ID...` 占位值。不要把 Google 凭证写入源码、D1 或普通日志。

## 账号隔离和迁移顺序

Google 账号数据写入 `account_sync_state`、`account_sync_records`、`account_sync_changes`。Worker 从已验证的 Google 凭证取得稳定 `sub`，所有读写都由该身份限定；客户端提交的 `userSub` 不作为授权依据。

旧版 `user_data`、`sync_records`、`pending_tasks`、全局 `API_TOKEN` 接口和 Telegram 通道仍分开保存。第一个 Google 登录者不会自动得到旧云端数据。账号表与认领审计表通过 `backend/migrations/0002-google-account-sync.sql` 和 `backend/migrations/0003-legacy-account-claim.sql` 创建。上线前须先备份 D1，在非生产库演练迁移和新 API，再按获准的发布步骤配置 Worker 与扩展；代码不会自动迁移或部署。

## 旧数据认领工具

`scripts/legacy-account-claim.mjs` 是一次性运维工具，不提供公开 API 或用户迁移界面。它只处理一个旧扩展数据集：`user_data.full_sync` 与其对应的全部 `sync_records`。任务、分类、设置和已有删除墓碑必须语义一致；缺项、冲突或来源变更会阻止认领。独立的 `user_data.categories`、`pending_tasks` 和 Telegram 绑定不纳入认领、不被改写，只报告非敏感计数，因此存在这些排除数据时不能宣称完整恢复了全部历史资料。

认领只允许写入没有任何记录、墓碑、同步历史或先前认领的目标账号。工具从 Worker `/api/google/identity` 验证访问令牌并取得目标 `sub`，不接受邮箱或命令行自报的 `sub`。运维权限不能证明业务数据所有权：操作前必须有实际所有者针对精确源摘要和目标账号的确认记录；所有者本人应在场核对摘要和 `sub` 并输入终端确认短语。当前没有生产所有权证据，不能执行真实认领。

### 非生产演练

先将以下凭证放在当前终端的环境变量中，不要把 token 放入命令参数或提交到仓库：

```powershell
$env:CLOUDFLARE_ACCOUNT_ID = '<Cloudflare account ID>'
$env:CLOUDFLARE_API_TOKEN = '<D1 query permission token>'
$env:TASKMASTER_CLAIM_DATABASE_ID = '<explicitly selected D1 database ID>'
$env:TASKMASTER_GOOGLE_ACCESS_TOKEN = '<operator Google access token>'
```

默认命令只做 dry-run，不写数据库，也不输出任务正文：

```powershell
node scripts/legacy-account-claim.mjs --operation-id '<unique-operation-id>'
```

确认报告里的源 SHA-256、目标 `sub`、任务/分类/设置/墓碑数量和排除计数。暂停旧通道写入，完成所有者确认，并在 D1 控制台建立可恢复备份。随后显式提供同一个 operation ID 和 dry-run 摘要执行非生产演练：

```powershell
node scripts/legacy-account-claim.mjs --apply --environment non-production `
  --operation-id '<same-operation-id>' --source-sha256 '<sourceSnapshotHash>' `
  --operator '<operator-id>' --owner-confirmation-ref '<owner-approval-reference>' `
  --backup-reference '<D1-backup-reference>' --backup-file '<private-path-outside-repository.json>' `
  --legacy-writes-paused
```

本地备份文件包含任务全文，必须放在仓库外并按敏感数据保护。工具会在 apply 前再次比较源数据和目标账号，并在同一 D1 批处理中检查版本、写入数据、变更日志及审计记录；成功后再核对记录摘要和数量。源数据不会被删除。同一 operation ID 重试不会重复导入，同一源也不能再次认领给其他账号。

若认领后尚无任何账号数据变化，可用 `--rollback <operation-id>` 回滚。回滚通过同步墓碑撤回本次导入，使已同步设备也能移除这些记录；检测到任何目标变化时会拒绝回滚，避免覆盖用户工作。操作记录和旧源都会保留。生产操作和生产回滚都需要本工具之外单独批准；对应命令还要求 `--environment production --production-authorized --production-authorization-ref <approval-reference>`。本轮没有生产写入授权。

## 用户端生效方式和验证边界

扩展源码由 `shared/*.ts` 构建成扩展文件，配置 OAuth ID 后构建并重新加载扩展即可生效。Worker 手机端和 API 位于 `backend/`，必须在 D1 迁移后按独立授权流程部署。真实 Google 登录需要已配置的 OAuth 客户端；线上 D1 认领需要所有权证明、备份和单独生产授权。自动测试及 SQLite 演练不能替代真实授权或生产验收。

自动验证位于 `tests/google-account-sync.test.mjs` 和 `tests/legacy-account-claim.test.mjs`，分别覆盖账号隔离/凭证验证和旧数据认领/回滚。协议参考：[Chrome Identity API](https://developer.chrome.com/docs/extensions/reference/api/identity)、[Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect) 和 [Google UserInfo](https://developers.google.com/identity/openid-connect/reference)。
