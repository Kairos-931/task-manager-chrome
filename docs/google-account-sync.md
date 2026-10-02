# Google 账号同步配置与数据边界

> 状态：受控 Worker 登录桥和有限会话已在本地实现；真实 Google 授权、Cloud Console 回调绑定、Worker secret、D1 迁移、部署和扩展身份切换尚未验证。正式 API 地址仍为 `https://taskmaster-api.yx9391.workers.dev`。

> 安全阻塞（[#64](https://github.com/Kairos-931/task-manager-chrome/issues/64)）：根目录扩展清单中的 `key` 是已出现在公开仓库历史中的私钥；发布检查会拒绝私钥或无效公钥进入源码/构建清单。用户提供的当前扩展 ID `bnodekgdlgbjfddgeglnjgmfiebhjbnp` 与现有私钥 DER 字节推导值一致，而正确 SPKI 公钥推导的新 ID 为 `gjifmpjgedleemhkikajgepickfphflo`，因此正确修复会改变扩展身份。迁移方案已确认，真实扩展 OAuth 绑定和旧数据验证仍未完成，当前不能发布可登录扩展。已公开的历史密钥仍须按泄露处理，单改工作树文件不代表问题消失。

## OAuth 配置

扩展和手机网页共用已提供的 Web application OAuth 客户端完成身份验证，最终统一映射到 Google `sub`。Chrome 扩展客户端 ID 仅保留在旧 manifest 中作为历史配置，不再用于账号认证。

1. Google Web application OAuth 客户端须保留获准来源 `https://taskmaster-api.yx9391.workers.dev`，并在 **Authorized redirect URIs** 中添加精确地址 `https://taskmaster-api.yx9391.workers.dev/api/google/callback`。扩展回调固定为 `https://gjifmpjgedleemhkikajgepickfphflo.chromiumapp.org/google-auth`，Worker 不接受请求传入的任意返回地址。
2. 公开 Web 客户端 ID 已写入 `backend/wrangler.toml` 的 `GOOGLE_WEB_CLIENT_ID`。Web client secret 只通过 Wrangler secret 配置：在 `backend/` 目录执行 `wrangler secret put GOOGLE_WEB_CLIENT_SECRET`，在 Wrangler 的安全提示中直接输入；不要把 secret 写进命令参数、聊天、文件或日志。
3. 扩展使用 `chrome.identity.launchWebAuthFlow()` 打开 Worker 固定授权入口。Worker 服务端兑换 Google 授权码并本地验证签名 ID token 的 `iss`、`aud`、`exp`、`sub`、适用的 `azp` 和本次 flow nonce；扩展回调只拿到 60 秒有效、单次使用且绑定客户端 PKCE verifier 的 TaskMaster 兑换码。
4. 手机页继续使用 Google Identity Services，但先向 Worker 领取一次性 nonce，再将 ID token 发给 Worker。两端都只获得固定 7 天、按端区分、服务端保存 token 哈希且可撤销的 TaskMaster 会话。账号同步 API 拒绝 Google access token、ID token 和旧全局 `API_TOKEN`。
5. Worker 不请求 Google 离线授权，不保存 Google access token 或 refresh token。Google ID token 只在登录请求内存中验证，不写入 D1、扩展存储或普通日志。OAuth client ID 是公开标识符；client secret 始终只作为 Worker secret。

## 账号隔离和迁移顺序

Google 账号数据写入 `account_sync_state`、`account_sync_records`、`account_sync_changes`。登录 flow、一次性兑换码和 TaskMaster 会话分别写入 `google_auth_flows`、`google_auth_codes`、`google_auth_sessions`，只保留必要哈希、账号 `sub`、端类型和期限。Worker 从已验证 Google ID token 确认身份，并从有效 TaskMaster 会话取得 `sub`；客户端提交的 `userSub` 不作为授权依据。

旧版 `user_data`、`sync_records`、`pending_tasks`、全局 `API_TOKEN` 接口和 Telegram 通道仍分开保存。第一个 Google 登录者不会自动得到旧云端数据。账号数据与认领审计表由 `0002`、`0003` migration 创建；登录会话表由 `backend/migrations/0004-google-auth-sessions.sql` 创建。上线前须先备份 D1，在非生产库演练全部迁移和新 API，再按获准的发布步骤配置 Worker 与扩展；代码不会自动迁移或部署。

## 旧数据认领工具

`scripts/legacy-account-claim.mjs` 是一次性运维工具，不提供公开 API 或用户迁移界面。它只处理一个旧扩展数据集：`user_data.full_sync` 与其对应的全部 `sync_records`。任务、分类、设置和已有删除墓碑必须语义一致；缺项、冲突或来源变更会阻止认领。独立的 `user_data.categories`、`pending_tasks` 和 Telegram 绑定不纳入认领、不被改写，只报告非敏感计数，因此存在这些排除数据时不能宣称完整恢复了全部历史资料。

认领只允许写入没有任何记录、墓碑、同步历史或先前认领的目标账号。一次性本地认领工具直接向 Google UserInfo 验证运维人员提供的 Google access token 并取得目标 `sub`；该运维身份核验不用于 TaskMaster 登录，也不接受邮箱或命令行自报的 `sub`。运维权限不能证明业务数据所有权：操作前必须有实际所有者针对精确源摘要和目标账号的确认记录；所有者本人应在场核对摘要和 `sub` 并输入终端确认短语。当前没有生产所有权证据，不能执行真实认领。

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

扩展源码由 `shared/*.ts` 构建成扩展文件；正式候选包重载后才会使用新身份登录桥。Worker 手机端和 API 位于 `backend/`，必须在备份并应用 D1 `0004` 后按独立授权流程部署。真实 Google 登录需要已添加精确 callback 且已配置 Worker secret。自动测试和模拟 OAuth 回调不能替代真实 Google 授权、两设备同步和生产验收。

自动验证位于 `tests/google-account-sync.test.mjs`、`tests/google-auth-bridge.test.mjs` 和 `tests/legacy-account-claim.test.mjs`，覆盖账号隔离、OAuth state/nonce、受众校验、固定回调、PKCE、一次码并发消费、期限、退出撤销和旧数据认领/回滚。协议参考：[Chrome Identity API](https://developer.chrome.com/docs/extensions/reference/api/identity)、[Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)、[Google 后端认证](https://developers.google.com/identity/sign-in/web/backend-auth) 和 [Google UserInfo](https://developers.google.com/identity/openid-connect/reference)。
