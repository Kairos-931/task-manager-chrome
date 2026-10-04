# Google 登录与账号自动同步

- Status: awaiting_configuration
- Revision: 2026-09-30-r1
- Product approval: 用户要求沿用原 Google 登录同步方向并转开发。
- GitHub Issue: 既有需求关联 #62；开发前核对实际状态，避免重复实施。
- Reference: C:\Users\Kairos\Documents\Codex-Case-Collisions\TASK_MASTER\docs\requirements\REQ-20260924-optional-google-sync.md
- Target checkout: C:\Users\Kairos\Documents\Codex-Case-Collisions\TASK_MASTER

## 产品目标与范围

用户无需配置 Worker URL 或 API 密钥；Google 登录后自动恢复并持续同步自己的任务。未登录可完整使用本机任务。Google 负责身份认证，TaskMaster Worker 与 D1 负责用户隔离与任务存储，后端验证凭证并使用稳定 sub 关联账号，不能信任客户端自行声明的用户 ID。

沿用原需求的扩展与手机端账号隔离、增量同步、离线编辑、冲突收敛、删除墓碑、状态反馈和旧管理员通道隔离要求。不增加 Google Drive 存储、多人协作或其他登录方式。

## 本轮范围澄清

- 不新增物理迁移、数据导出或 JSON 导入功能；已有手动导出保留。
- 新设备恢复是账号同步的自然结果，不另建一套迁移产品流程。
- 内部数据备份及已有云端记录归属处理是上线数据保护措施，不增加用户侧迁移功能。
- 既有未绑定用户的云端数据不能自动归属第一个登录者；归属不明时返回产品侧确认。

## 用户流程与验收

1. 未登录可新增、编辑、完成任务，重启后仍保留。
2. Google 登录成功后显示当前账号并自动同步；空新设备先获取云端，不以空数据覆盖云端。
3. 云端为空时同步本机任务；两边有数据时保护原数据并安全合并。
4. 两台设备登录同一账号后任务与分类收敛；另一账号不能读取或修改其数据。
5. 离线可编辑，显示已保存本机、等待同步；联网后自动补同步，删除记录不复活。
6. 登录失效显示重新登录入口，不清空任务；网络错误与认证失败区分。
7. 退出停止云同步并保留本机任务；切换账号不能静默上传上一账号的数据。
8. 手机端使用同一身份、仅访问当前用户数据；旧管理员及 Telegram 通道不越过账号隔离。

## 开发交付边界

先核对 Issue #62、目标代码与线上实际状态，再补齐缺口。扩展源码通过既有构建流程生成并重载；Worker 与 D1 变更需独立获准部署。不得自动安装依赖、push 或部署。最终版本以实际基线评估，不能照搬历史计划 3.17.0。

## 验证

采用账号隔离与伪造凭证测试、两设备同步测试、空设备和首次合并测试、离线重试与删除测试，以及项目 test/lint/typecheck/build。真实桌面控制未授权，本轮不调用，真实 Google 授权界面和视觉验收留待明确安排。

## Development execution profile

- Assessment status: approved
- Recommended model: gpt-6-luna
- Recommended reasoning effort: max
- Rationale: 沿用项目已保存的 Luna Max 选择策略；有明确原规格，跨扩展、Worker、D1 的认证与隔离需要深入验证。
- Engineering effort: large; 约 3–10 个工程工作日的工作量，取决于原需求完成程度，不是实际交付时间承诺。
- AI usage: 粗估 100k–400k tokens，为工作量估计而非订阅扣费预测；不含基础设施费用、生产部署及人工验收。
- Confidence: low; 目标项目副本、已有实现、OAuth 配置及历史数据归属待核对。
- Lower-cost alternative: 当前不建议降低推理配置，认证及隔离缺陷会影响用户数据。
- Escalation condition: 无法证明账号隔离、旧数据归属或迁移安全时停下返回产品侧，不自行改变模型或扩大范围。
- User profile decision: option 0, gpt-6-luna / max; approved 2026-09-30
- Runtime: send_message_to_thread 支持单次消息 model/thinking 覆盖，不能据此宣称永久配置。
- Delivery state: delivered to developer 2026-09-30; latest 3.16.0 checkout confirmed by user.



## 2026-10-01 产品决策全权委托

用户明确授权产品对话自行决定 Google 登录同步开发中的产品问题、记录决定并推进开发完成。开发可直接向产品对话提问，产品对话可回复，无须将普通产品选择再次转交用户。

- 产品协调：codex://threads/01a0f1af-be64-7860-8c0d-660fdb71e2c9。
- 当前实施：codex://threads/01a0f6ce-2b91-7343-bb37-1b3f5d3d467a；用户已在该对话授权继续 Google 同步 #62。
- 默认决策原则：登录即自动恢复与持续同步；离线编辑不受阻；账号隔离和不丢任务优先；不新增迁移导入导出产品功能。
- 账号切换时旧账号在途响应不得写入新账号数据；服务端并发不得丢更新，属于既有账号隔离与收敛要求，开发可直接修复验证。
- 缺真实 OAuth 配置或凭据时，先完成可测试的代码、失败反馈、配置模板、发布检查与上线步骤；明确列出不能真实验证的项目，不伪造成功，不将配置项暴露为普通用户操作。
- 不推断旧云端数据所有者；先完成安全管理员认领机制和演练，未知实际账号归属留为上线前阻塞。
- 本次授权是产品决策与开发协调；不自动扩大为 push、生产部署、删除生产数据或使用用户登录身份的桌面控制授权。
- 交付报告分别说明实现、自动验证、真实授权、部署状态；测试通过不能等同生产可用。

## 决策 D-20261001-01：旧云端数据管理员认领

- 来源：开发提出旧全局数据没有 Google sub，产品侧依据用户全权委托决定。
- 结论：纳入 #62，属于账号数据归属和上线保障，不增加用户侧迁移/导入/导出功能。实现最小管理员命令/脚本与操作说明，优先沿用现有运维能力；不建设公开认领 API、通用迁移平台或新的用户界面。
- 认领前：旧通道与 account_sync_* 隔离，Google 账号只能看到自己的账号空间；旧数据不自动出现、不分给第一个登录者。若尚未认领，不能宣称旧用户历史数据恢复验收已完成。账号已有本机任务则仍按原规格正常安全同步。

### 所有权证明与操作条件

1. 必须记录指定旧数据集的实际所有者确认，以及精确的目标 Google sub。目标 sub 必须来自服务端验证过的 Google 身份，不接受邮箱字符串或客户端自报 ID 作为证明。
2. 管理员权限/API_TOKEN/Cloudflare 登录仅证明操作权限，不证明业务数据归属；账号同邮箱或同浏览器也不自动构成归属证明。不得认为不同旧表、Telegram 用户数据必然同属一个人。
3. 单一所有者的旧个人数据允许由原所有者明确确认认领到其经验证账号；多用户、归属不明或混合数据不得整体认领。当前没有实际所有者/目标 sub 证据时只完成工具和非生产演练，将真实认领列为上线前阻塞，不伪造证据。
4. 实际生产写入仍需独立部署/数据操作授权。工具默认 dry-run，显式 apply 才写入；不得把管理员密钥纳入扩展或公开产物。

### 认领与回滚要求

- 执行前用既有手段备份相关旧数据及目标账号数据，记录数据版本/摘要、记录数、有效任务/分类与删除记录数；dry-run 显示源范围、目标账号、预计差异和冲突。不得在日志输出密钥或任务全文。
- 从旧数据生成一致快照；源写入暂停或具备可靠快照/版本检查，不能读取期间持续变更而得到混合结果。旧 user_data 与 sync_records 不一致时停下，不猜测覆盖顺序；删除记录和稳定 ID 必须保留。
- 最小版本只对无任务/分类/设置业务记录及墓碑的目标账号执行，不直接覆盖已存在的账号数据；目标非空则拒绝并报告，不擅自做合并迁移。与正常登录后安全同步的原规格不冲突，此限制仅针对管理员旧数据认领工具。
- 写入以同一可验证提交完成；可采用事务/批处理或暂存后原子激活，避免对用户暴露部分导入。执行前再次确认目标未变化。
- 认领操作有唯一 operation ID，审计源数据集、验证目标 sub、操作者、所有权确认引用、时间、摘要、计数和结果；重复同一操作不重复新增，同一源不能默默再次认领到别的账号。
- 校验目标数量、关键字段和删除语义成功后才标记完成；旧源保持可恢复，禁止由认领脚本自动删除旧源或撤销旧通道。旧通道停止/隔离与新版启用顺序写入上线说明，避免双轨继续写入导致遗漏。
- 回滚只撤销本次操作创建的目标记录与归属标记，不清空整个数据库。仅在目标自认领后没有新业务变更时允许自动回滚；发现新增、编辑或删除则拒绝破坏性回滚，保留数据并输出需要进一步处理的阻塞。
- 非生产验证覆盖 dry-run 无写入、无凭据/伪造身份被拒绝、目标非空/源变更被拒绝、重复执行幂等、任务分类与墓碑保留、写入失败不暴露半成品、安全回滚及变更后回滚拒绝。

### 交付与资源

沿用已批准 gpt-6-luna / max 与单人串行。提供最小工具、演练证据、上线前条件与回滚说明即可；不得让等待真实归属确认阻塞其余代码/测试交付。实际历史数据恢复在认领完成前标为未验收。若最小工具需要新增通用平台或改变账号同步规则，再返回产品决策。

## 决策 D-20261001-02：认领源范围

- 确认采用单一旧个人扩展同步数据集：user_data.full_sync 与对应 sync_records。两者须按同一语义规范化比对任务、分类、设置及删除信息；矛盾拒绝执行，不能挑一份覆盖。没有对应信息时不得据此伪造一致或完整证明，报告缺口。
- 排除 user_data.categories 独立条目、pending_tasks 及 Telegram 绑定/关联行；这些数据不继承 full_sync 的所有权证明。保留原数据，不消费队列、不改绑定、不删除排除项。
- full_sync 或对应 sync_records 内已有且属于该个人数据集的分类正常包含；排除独立 categories 条目不代表丢弃已确认同步数据集中的分类。
- 不增加逐表确认的通用 CLI。本次工具 dry-run 与执行报告仅列排除数据的非敏感计数、未迁移范围和原因，不显示任务内容、Telegram ID 或令牌。
- 若排除项影响该用户历史数据完整性，标注历史恢复仍有缺口，不能声称全部旧数据已恢复；后续只有证明各自归属后再单独评估处理，当前不自动扩大工具范围。
- 验证：包含范围准确、独立分类不自动补入、pending_tasks 不被消费、Telegram 绑定不变、报告不暴露敏感数据。

## 决策 D-20261002-01：manifest 私钥暴露与发布门槛

- 开发报告已本地验证 canonical manifest.key 为 PKCS#8 RSA 私钥且存在于公开 origin/main；产品侧不复制、打印或再次传播密钥内容。
- 作为独立安全用户目标建立独立 GitHub Issue（仅说明文件位置、已暴露事实、影响和验收，不粘贴密钥）；#62 链接该事项并把安全可发布状态列为上线门槛。不是把所有安全处置混成 #62 一项，也不因此阻止其余同步代码交付。
- 允许本地只读检查和从现有密钥在内存提取 SPKI 公钥、检查各 manifest/构建产物、增加发布前校验，禁止导出额外私钥文件。构建校验须拒绝私钥进入发布包，拒绝 OAuth client_id 占位符被当作可登录正式包。
- 提取公钥不代表撤销泄露，也不能假定扩展 ID 不变。先记录用户当前实际使用扩展的已安装 ID（仅只读且不启动未授权 GUI），当前 manifest 值推导 ID、正确公钥推导 ID和OAuth绑定；推导结果不能代替实际安装身份依据。
- 若可证明替换为正确公钥保持实际扩展 ID，授权本地更新 canonical 公钥并经既有构建生成其他副本，验证所有发布产物不含私钥、身份一致。禁止手工改生成产物。
- 若 ID 改变或实际 ID 证据缺失，不授权身份迁移或生成新密钥直接替换；保留候选公钥修复为不发布的方案，阻止不安全正式包，记录兼容性缺口。不得重载/卸载用户扩展、清空存储、改变 OAuth 回调配置或假称无影响。
- 评估该私钥是否用于自托管 CRX 签名、商店身份或其他用途；已泄露私钥不再视为可信签名凭据。同一公钥可保持某些身份关联，但不能宣称消除签名冒用风险。未发现用途不等同已证明无用途。
- 不自行 git push、历史重写/force push、撤销远程凭据、轮换生产身份、部署或 D1 写入。移除工作树内容不能消除公开历史暴露；历史处置、必要轮换与兼容迁移单独记录实际所需维护者动作。
- 缺真实 OAuth 客户端、Cloudflare 凭据与Wrangler时，完成非敏感配置模板、发布校验、操作步骤与全部可运行测试；不生成伪造实际值，不静默安装工具。真实登录、生产部署、安全身份处置未完成前，只报告本地实现/验证状态，不报告功能已上线可用。
- 开发可立即完成上述局部代码保障与独立安全事项记录。优先使用现有测试/构建能力；需要新的身份迁移方案时向产品侧提供准确 ID 证据、数据影响和最小建议，产品側继续决策。
- 官方依据：https://developer.chrome.com/docs/extensions/reference/manifest/key （key 为 public key，用于保持扩展 ID）。

### D-20261002-01 核验进展与上线状态（开发报告）

- 独立安全 Issue：https://github.com/Kairos-931/task-manager-chrome/issues/64；已关联 #62 作为上线阻塞。MCP 写入被403拒绝，开发通过已登录 gh CLI 完成创建。
- 初次本机 Chrome Default/Profile 扫描未找到 TaskMaster 安装目录；之后用户提供了实际 extension ID，不能据初次扫描判断用户没有安装或数据不存在。
- canonical key 为 PKCS#8 RSA 私钥。产品侧只读核验确认：用户提供的实际 ID 与现有私钥 DER 字节推导值一致；正确 SPKI 公钥推导出的 ID 不同，身份不兼容已确认。
- 仓库商店脚本只生成 ZIP，未发现仓库内使用该字段做 CRX 签名；未发现 PEM/CRX 文件，不足以证明仓库外没有用途。
- OAuth client_id 仍是占位符；真实 Google 登录、扩展身份兼容、生产配置与部署仍未验收。
- 开发报告 npm run check 已通过；新增发布检查要求两个扩展 manifest 使用合法 SPKI 公钥，并拒绝私钥。当前 check-release 预期失败，这是发布阻塞被正确识别，不算 build/可发布验收通过。
- 产品决定：不替换 key、不改变扩展 ID、不改生成产物来绕过检查。允许提交已验证的发布检查及同步配置文档，保留身份修复为未完成安全事项。
- 最终交付应记录实际 commit、实现/自动验证完成项、完整构建或发布检查失败项、真实登录/部署未完成项。#64 与 #62 不因局部检查通过而关闭；缺少身份及OAuth证据不阻塞其他可完成代码交付。

### 2026-10-02 局部交付：发布密钥检查

- 开发报告本地 commit：cd37d4a，fix: reject private keys in extension release manifests。
- 提交范围：scripts/check-release.mjs 与 docs/google-account-sync.md。
- 开发报告 npm run check（typecheck、lint、整套测试）通过；产品侧未独立重跑。
- release checker 因现存私钥正确拒绝；完整发布构建与正式包未通过，不记为可发布。
- 未替换 key、未改生成产物、未 push、未部署、未写 D1。
- 局部工程保障交付完成；#64 身份兼容与暴露处置、#62 真实Google配置/登录及上线验收仍开放。此记录不将整体需求标记 completed。

### 2026-10-02 验收映射与执行槽状态

- 当前状态：`awaiting_configuration`。本地实现与自动化检查完成，开发执行槽已释放；#62 仍开放，未完成产品验收或生产上线。
- #64 状态：`blocked_identity_migration`，是 #62 可发布的安全门槛。实际扩展 ID 已由用户提供并核验与旧密钥一致；正确公钥会改变 ID，待产品明确迁移边界及配置方案。OAuth ID 仍是占位符。

| 验收项 | 本地证据 | 尚未完成的验收 |
|---|---|---|
| 1. 未登录本机使用和重启保留 | 原本机优先存储路径保留；`npm run check` 通过 | 新装/重启的真实扩展验收未做 |
| 2. 同账号跨设备恢复、不同账号隔离 | Worker 自动化用模拟身份覆盖账号隔离及跨账号读取保护 | 真实 Google OAuth、两台设备登录未验收 |
| 3. 首次同步安全合并 | 扩展与 Worker 同步逻辑已实现；自动化检查通过 | 真实本机/云端双边数据首次合并未验收 |
| 4. 离线编辑、恢复同步和删除墓碑 | 增量同步与服务端墓碑逻辑有自动化覆盖 | 真实断网后多设备收敛未验收 |
| 5. 退出和切换账号隔离 | 本地账号上下文保护已实现 | 真实授权、退出/切换账号流程未验收 |
| 6. 管理员旧数据认领 | SQLite 自动化覆盖 dry-run、范围校验、幂等、回滚和排除数据 | 非生产 D1 演练、所有者证明、目标 sub、备份及生产操作授权未完成 |
| 7. 手机端和 Telegram 隔离 | 自动化覆盖模拟身份、拒绝伪造身份及旧令牌访问新账号路由 | 真实手机 Google 登录及线上 Telegram 兼容验收未做 |
| 8. 同步状态及失败反馈 | 状态处理和失败路径已实现；类型检查、Lint、测试通过 | 真实 OAuth 失败/过期、界面交互和视觉验收未做 |

- 真正可用前需产品明确身份迁移边界：实际扩展 ID 已确认，公钥身份变化意味着新扩展 ID；随后需维护者配置与新 ID 绑定的 Chrome Extension OAuth Client ID 和 Web Client ID，并提供 Cloudflare/Wrangler 授权与可演练的非生产 D1。秘密值通过受控本地环境配置，不通过聊天传递。
- 如要认领历史数据，还需明确实际所有者确认、服务端验证的目标 Google `sub`、备份与独立生产数据操作授权；不影响新账号空数据安全同步的本地代码交付。
- 不得将自动化模拟结果当作真实登录、非生产 D1 或生产数据验收；补齐外部条件后再恢复开发执行槽并继续验收。

### 2026-10-02 实际扩展 ID 证据与兼容结论

用户提供当前实际使用扩展 ID：bnodekgdlgbjfddgeglnjgmfiebhjbnp。产品侧以本地 Node crypto 只读验证：与现有私钥 DER 字节推导 ID 完全一致；正确 SPKI 公钥推导 ID 为 gjifmpjgedleemhkikajgepickfphflo，不一致。未输出或保存密钥内容。

结论：不能通过简单公钥替换保持当前扩展身份。禁止以同 ID 兼容修复名义发布；新 ID 方案属于显式身份迁移。最小建议是保留旧扩展及数据，先配置和部署账号同步并准备正确公钥的新扩展，以既有云端数据在确认归属后绑定账号，验证新扩展登录恢复后再停用旧入口；不新增用户导出导入功能。旧设备未上传的本机数据必须核对，不以云端存在就认定全部已保存。实际执行身份迁移/部署仍未授权，先准备方案。

### 2026-10-02 身份迁移方案确认与准备边界

用户在“保留旧扩展、通过账号恢复到正确公钥新扩展；核验后停用旧扩展”方案后回复 OK，并询问配置操作。该回复批准产品方案及本地迁移准备，不批准立即生产部署、停用旧入口或清理本机存储。

允许开发准备正确公钥、新ID配置及兼容说明的本地变更，不能将变更后的目录直接要求用户重载为旧扩展；需要保留用户当前实际加载目录和旧数据，不覆盖其可用安装。若无法确认当前加载路径，先只准备候选源改动/补丁，保持现有加载产物不动。准备新身份安装应使用项目约定内清晰独立的交付路径，先明确目录约定，不覆盖旧扩展。

- 新身份：gjifmpjgedleemhkikajgepickfphflo；旧身份：bnodekgdlgbjfddgeglnjgmfiebhjbnp。
- 当前等待用户提供绑定新身份的 Google 扩展 OAuth 客户端 ID；该 ID 非私密值，禁止索取或传播密码/客户端密钥。
- 迁移前核对本机未上传记录及旧云端归属；新扩展登录后恢复和持续同步经过验证，才停用旧入口。保留既有管理员认领边界，无用户侧新导入导出功能。
- 本地安全公钥替换只是停止继续分发私钥，不代表撤销公开私钥；旧签名用途及安全处置仍作为#64未完成条件。
- 开发记录提交1f2012a：身份阻塞改为blocked_identity_migration；该提交先于本次产品方案确认，后续状态应反映方案已确认、真实配置和切换验收待完成。

### 2026-10-02 Google 扩展 OAuth 配置已提供

- 用户提供 Chrome 扩展 OAuth client ID（非密钥）：987569356526-au9e8a8bjqog3fidalu2rujsru3tqu6q.apps.googleusercontent.com。
- 预期绑定新扩展 ID：gjifmpjgedleemhkikajgepickfphflo；绑定配置由用户按产品指导创建，仍需真实授权验收证明，不将收到ID等同配置已验证。
- 授权开发按此前批准方案继续本地配置、发布包准备与确定性检查。保护现有旧扩展安装及存储，候选新身份交付不得覆盖旧加载目录。
- 后端预期客户端 allowlist 与手机 Web 客户端需求由开发核对，禁止把扩展客户端当 Web 客户端直接使用。
- 尚未授权实际部署、生产数据操作或桌面控制；缺必要配置列出精确下一步，不重复要求用户提供已收到的ID。

### 2026-10-02 新身份候选包及手机配置（开发报告）

- 独立临时 worktree 从已验证提交构建，候选版本3.16.0，新ID gjifmpjgedleemhkikajgepickfphflo，绑定用户提供的Chrome扩展OAuth client ID。
- 开发报告 npm run build 成功，构建目录及ZIP不含旧私钥材料；canonical旧扩展/产物未改变。候选为测试交付，不代表正式发布或真实登录已验收。
- 候选目录：outputs/taskmaster-google-new-id-candidate/；ZIP：outputs/taskmaster-google-new-id-candidate.zip（均在最新项目根）。
- 手机Google客户端类型Web application；authorized JavaScript origin为https://taskmaster-api.yx9391.workers.dev；当前实现popup + JavaScript callback，不配置redirect URI。
- Worker手机ID token的预期受众配置为GOOGLE_WEB_CLIENT_ID，需独立Web客户端值。扩展access token走Google UserInfo，产品侧要求开发补核验其客户端绑定验证是否充分；不得把只有UserInfo成功视为所有认证验收已完成。
- 等待Web客户端ID、Cloudflare/Wrangler、非生产D1环境；未部署、未写D1、未push、未GUI验收。

### 2026-10-02 手机 Web OAuth 客户端已提供

- 用户提供Web客户端ID（非密钥）：987569356526-2horbu7l43kh4l09kf4g366u2th1mvrl.apps.googleusercontent.com。
- 预期JavaScript origin：https://taskmaster-api.yx9391.workers.dev；按当前popup/callback实现不配置redirect URI。控制台实际配置及真实授权仍待验收。
- 允许开发写入合适的非敏感配置/模板，完成扩展与手机客户端校验及必要测试、部署前检查，整理最小上线步骤。
- 此值用于GOOGLE_WEB_CLIENT_ID，不与Chrome扩展客户端混用。收到ID不代表已部署或真实登录验证通过。
- 不自动安装Wrangler、部署、写生产D1或进行桌面控制；继续保护旧扩展数据。

## 决策 D-20261002-02：扩展认证采用可验证 ID token 方向

- 问题：现getAuthToken access token + UserInfo仅得到用户信息，缺预期OAuth客户端绑定；不能以UserInfo成功替代应用受众核验。
- 官方后端身份指南明确tokeninfo不适合生产代码，可能限流或间歇失败；因此不采用依赖tokeninfo的方案A作为正式认证核心，即使缓存也不把它称为生产推荐。产品侧初步考虑A，查阅官方证据后更正。
- 选择B的目标：签名Google ID token，服务端验证签名/iss/aud/exp/sub及适用azp，公钥按官方缓存头刷新。GOOGLE_EXTENSION_CLIENT_ID与GOOGLE_WEB_CLIENT_ID独立配置，身份统一映射Google sub；不要混用access token与ID token。
- B实施前必须预检：当前Chrome extension类型OAuth客户端、Google授权端点及code/PKCE/回调/换token组合是否实际受支持，是否可取得预期受众ID token。不得把通用OAuth流程误认为Google对当前客户端必然支持，不将客户端secret放扩展。
- 先用官方协议和现客户端配置确定支持路径，不伪造真实登录测试。若Chrome客户端类型无法安全取得ID token或需要新的客户端类型/授权回调，暂停具体流程改写，向产品提供一个官方支持的最小替代（例如受控Web登录桥接），说明配置变化；不能退回无受众验证或生产tokeninfo路径。
- 用户体验不变：一次主动Google授权，后续自动同步；客户端ID仍保留，用户不重复创建配置直到替代确实必要。支持的最终登录交换完成后可建立短期TaskMaster会话，具体方式由开发选最小可靠实现，不扩展成通用身份平台。
- 保持账号切换/退出在途响应隔离、认证过期反馈及本机离线可用；获取或验证失败不触碰云端账号数据、不清空本机任务、不降级接受未验证身份。令牌/授权码不进入日志或公开产物。
- 沿用Luna Max、串行、本地准备边界。真实Chrome授权需后续明确视觉/交互验收授权，当前不调用GUI、不部署、不安装依赖。新增工程量需开发先报告；流程不可支持时由产品继续决策。
- 证据：https://developers.google.com/identity/sign-in/web/backend-auth （tokeninfo生产限制与ID token验签要求）。

## 决策 D-20261002-03：采用受控 Worker Web 登录桥

依据开发官方预检，现Chrome extension客户端直连code+PKCE的支持证据不足；不拼接未经验证的协议、不使用生产tokeninfo、不保留无客户端绑定认证上线。产品侧依据用户全权决策委托，批准最小Worker Web登录桥，沿用已有Web OAuth客户端。

### 产品行为及配置

- 用户仍一次点击Google登录，账号恢复与后续自动同步体验不变；取消授权返回原状态、本机任务保留。
- 沿用Web client ID 987569356526-2horbu7l43kh4l09kf4g366u2th1mvrl.apps.googleusercontent.com，不要求新建客户端。
- 用户后续需给该Web客户端增加精确redirect URI：https://taskmaster-api.yx9391.workers.dev/api/google/callback。此前“留空”适用于旧popup/callback设计，此决策替代该配置边界。
- Web client secret只存Worker secret，由维护者直接配置，不在聊天粘贴、不入Git、扩展或日志。
- 扩展专用client ID保留为历史配置，不在本路径当Worker受众或继续调用getAuthToken+UserInfo认证；发布前确认不遗留可绕过登录桥的旧认证路径。
- Worker验证Web客户端受众Google ID token；扩展与手机可使用同一验证身份映射Google sub，TaskMaster会话须保留客户端/用途边界，不能让任意网页取得扩展兑换结果。

### 最小安全与交付边界

1. 仅增加必要的登录发起/Google回调/扩展一次性交换和会话机制，不做账号密码、通用SSO平台或新迁移产品功能。
2. 使用不可预测、单次、短期的state/nonce，将发起设备、预期回调与兑换绑定；授权code服务端兑换并验证Google签名/iss/aud/exp/sub和nonce（适用时azp）。拒绝缺失、过期、错误绑定和重放。
3. 扩展返回地址只允许已确认的新扩展ID对应精确chromiumapp.org回调，禁止任意redirect/开放跳转；不能以CORS或extension ID本身当登录证明。
4. 浏览器回调只返回短时一次性兑换码，建议有效期不超过60秒，并使用客户端持有的随机verifier绑定兑换；一次码需原子消费。长时Google令牌及TaskMaster会话凭证不放URL、日志、Referrer或可缓存页面。
5. 建立有限期限、可撤销TaskMaster会话；可采用固定期限且闲置到期的持久会话，避免每次同步弹Google授权。具体短期凭证/会话延续机制由开发选最小可靠实现；不得无限续期，退出和账号切换需失效旧会话并隔离在途响应。若实现需要Google离线refresh token，先报告用途，不默认增加scope/长期凭据。
6. 手机与扩展认证/会话路径分别测试，支持网络失败重试但不能重复消费授权、自动换账号或清空本机数据。Google暂不可达时仍可本机使用。
7. 测试覆盖state/nonce/受众/返回地址、code/verifier错误和重放、原子消费、超时、退出/换账号、会话失效及跨账号隔离。Google真实授权与Chrome桥接交互仍待明确实际验收授权，不以mock替代声称成功。
8. 现线上根页面及401证据不足以证明新版本上线；必须在明确授权部署后核对实际版本与路由、登录和两设备数据流。

### 执行评估与状态

批准沿用gpt-6-luna / max、单人串行，本地实现与确定性验证。开发估计新增约1.5–3人日工程量，非实际交付时间承诺；AI用量随回调和会话测试增加，暂无可靠计费预测，不宣称固定成本。用户全权委托覆盖此次产品分支决策，不需常规再次确认。依然不授权自动安装依赖、push、生产部署、D1写入、用户GUI或旧扩展停用。维护者所需新操作仅现Web客户端追加callback及直接配置Worker secret，产品侧提供步骤。

## 2026-10-02 开发本地实现结果

- 按 D-20261002-03 实现 Worker Web OAuth code callback 与签名 ID token 验证；扩展固定回调为 `https://gjifmpjgedleemhkikajgepickfphflo.chromiumapp.org/google-auth`，只返回 60 秒、单次使用、PKCE S256 绑定的短码。
- 扩展与手机各自领取一次性 nonce，兑换为客户端类型隔离、7 天固定期限、服务端只存哈希且可撤销的 TaskMaster 会话。Google access/refresh token 不落库；账号 API 拒绝 Google 原始令牌和旧全局 API_TOKEN。
- 增加 D1 migration `backend/migrations/0004-google-auth-sessions.sql`，并同步更新 `backend/schema.sql`。旧数据认领 CLI 的运维身份校验改为直接调用 Google UserInfo，不再依赖已改为 POST 会话创建的 Worker `/api/google/identity`。
- `npm run check` 通过。新增 bridge 自动验证通过；测试对 `0002` 与 `0004` migration 使用真实本地 SQLite 执行，并模拟 Google JWKS/token endpoint，覆盖 state/nonce/audience/固定回调/PKCE/60 秒过期/并发单次兑换/跨端会话/退出撤销。它不等于真实 Google OAuth 验收。
- 按 `fix:` 规则将源码和候选包版本更新到 3.16.1。在隔离副本运行 `npm run build` 通过，产物更新到 `outputs/taskmaster-google-new-id-candidate/` 及同名 ZIP；未覆盖现有加载目录。构建警告仅提示 Browserslist 数据过期，没有自动安装或更新依赖。
- 未配置 Google Console callback、未设置 Worker secret、未执行 D1 migration、未部署或 push、未做桌面 GUI 检查。线上服务目前不能据本地测试宣称可用；Issue #62 保持开放，等待精确 callback 配置、非生产 D1 演练和获准的线上验收。独立的 Issue #64 身份迁移/历史密钥问题仍阻止正式发布。

### 维护者后续配置

1. 在既有 Web application OAuth 客户端的 Authorized redirect URIs 添加精确地址：`https://taskmaster-api.yx9391.workers.dev/api/google/callback`；保留既有 JavaScript origin `https://taskmaster-api.yx9391.workers.dev`。
2. 在 `backend/` 安全交互终端执行 `wrangler secret put GOOGLE_WEB_CLIENT_SECRET` 并直接输入 client secret；不要把 secret 发到聊天或保存进仓库。
3. 先备份并准备非生产 D1。当前 `backend/wrangler.toml` 只有正式 D1 绑定，没有 staging 环境；因此不要把 `0004` 直接应用到现有正式库。完成非生产 migration 与 Worker 配置后，再按单独批准的发布步骤部署、加载候选扩展并做真实单设备/双设备授权同步验收。

### 2026-10-02 Google回调配置确认

用户确认已在TaskMaster Mobile Web客户端保存redirect URI：https://taskmaster-api.yx9391.workers.dev/api/google/callback。记为用户侧配置已完成；控制台实际值与端到端授权仍待真实验收，不要求用户重复设置。Worker client secret尚未配置确认。


### 2026-10-02 Worker Secret用户配置确认

用户确认已完成Cloudflare生产 GOOGLE_WEB_CLIENT_SECRET 配置。只记为用户配置完成，不读取密钥、不等同真实OAuth已验证。下一步准备D1备份/迁移及新版Worker部署方案，生产执行仍需明确授权。


### 2026-10-02 上线准备核对结果

开发只读核对：最新实现c7c107c，新身份ZIP/目录为3.16.1，含launchWebAuthFlow、不含getAuthToken；生产根页面仍旧版。实际迁移状态/CLI账号未知，Wrangler未安装；工作区backend/index.js有用户原有修改，未来必须从干净c7c107c发布，不能上传dirty目录。

上线准备先安装获准Wrangler、交互Cloudflare登录、whoami核对、记录现Worker版本、仓库外受保护完整SQL备份、只读info/migrations list及必要schema核对。0001非幂等，不可直接对所有pending apply；先比较实际结构与迁移账本，预期新增0004但不能先认定。生产迁移与部署须在准备结果明确后获准。回滚优先Worker版本回退，新增表保留，不以全库恢复常规回退。

新版account接口拒绝旧Google access token；旧API_TOKEN任务/增量接口保留。已安装旧扩展实际使用哪个认证路径尚需核对，不根据源码猜其都失效。旧本机独有任务必须保护，继续采用账号恢复切换方案；不新增用户迁移导入导出功能。既有手动导出只可作为现有保护能力，不默认让用户先承担手工搬运。

### 2026-10-02 上线准备授权

用户明确回复“允许安装并做上线准备”。允许安装Wrangler及必要工具自身依赖、发起Cloudflare登录由用户本人完成浏览器授权、核对账号权限及当前Worker版本、只读查询D1信息/迁移账本/必要schema，以及完整SQL备份到仓库外受保护位置。保护凭据与任务内容，不输出到聊天或普通日志。

不包含生产D1迁移/认领/业务写入、Worker部署、Secret读取、git push、用户扩展重载/停用或GUI自动控制。CLI自行打开授权浏览器不等同允许自动操作桌面；按正常交互引导用户完成。若工具或登录失败先自行恢复，只有确需用户动作才提出精准步骤。

开发执行准备后报告Wrangler版本、账号匹配结果、备份路径和校验、实际迁移差异、部署版本/回滚点及剩余阻塞，产品侧据此准备下一次明确生产操作授权，不重复要求本次准备批准。

### 2026-10-02 登录权限与操作边界澄清

Wrangler 4.146.0已安装于仓库外 C:\Users\Kairos\AppData\Local\Codex\tools\wrangler-4.146.0；备份目录准备于 C:\Users\Kairos\AppData\Local\TaskMaster\backups，尚未连接或导出。开发因默认OAuth包含写入scope取消了首次登录。

产品决定：原用户授权已包含正常Wrangler登录；只读准备限定实际执行动作，并不要求凭据仅具只读能力。可继续标准OAuth登录，必须向用户说明授权页含部署/数据库写权限，由用户在Cloudflare页本人判断并确认；不自动点击。获授权凭据不等于生产写入授权，仍只执行whoami、查询、导出等已批准动作。不得apply迁移、deploy、认领或改生产数据。无需要求用户为此另建一套复杂API Token；若用户在授权页拒绝，尊重拒绝并提供只读token方案，不规避授权。

### 2026-10-02 生产只读准备完成与迁移账本决策

- 开发报告Wrangler4.146.0登录成功，账号D1 UUID与项目配置一致，未迁移/部署。
- 当前Worker版本c365c0b6-057b-418e-89e1-b4347ea95346（作为后续发布回滚点），部署42576131-96cc-4c38-aaa3-8f5bbcdcafcb，生产仍旧页面。
- 完整备份：C:\Users\Kairos\AppData\Local\TaskMaster\backups\taskmaster-db-20261002-pre-google-auth.sql；31,953,499 bytes；SHA256 6317BE5EADCC82E06BE6A08399E27C4941265731A0E9AE8AA468271DA016191A。开发报告受限ACL、SQLite载入integrity_check=ok、备份及远端计数一致；产品侧未重跑。
- 实际d1_migrations为空，0001–0004被列为pending；pending_tasks已存在0001涉及的completed/completed_at，0002–0004目标表缺失。禁止盲目apply或重跑0001。
- 产品决策：准备最小基线补登记方案，仅在实际schema符合0001全部效果时登记0001已应用，不修改业务行；随后顺序应用0002–0004新增表/索引。不改已有迁移源、不绕过校验、不把历史数据自动认领。
- 下一步先在受限本地副本还原上述SQL并演练精确账本修复及全部迁移，验证旧业务数据摘要/计数保持、目标结构、重复执行边界与Worker回退兼容；避免测试/工具日志输出任务全文。此为既有授权范围内本地验证，不是生产写入。
- 生产SQL登记/迁移/Worker部署仍待单独明确授权；发布须使用干净c7c107c，不能上传用户dirty后台文件。申请时展示精确变更、演练结果、回滚点与实际旧接口兼容条件。
- 临时备份下载URL曾出现在CLI输出；不复制/转发，开发报告2026-10-02 18:06:58 Asia/Shanghai到期；本地备份受限保存。后续导出避免暴露临时下载链接或敏感内容。

### 2026-10-02 生产迁移与部署明确授权

用户明确回复“允许生产迁移并部署”，批准此前展示的一次生产授权卡：复核数据库ID/schema/ledger，条件登记已有0001，再应用0002–0004新增结构；仅从清洁c7c107c2481cefaffc059517834dce3112ae3c8d候选backend部署，维持正式URL；线上确定性检查，异常时允许回退Worker到c365c0b6-057b-418e-89e1-b4347ea95346，保留新增表。

授权不包含旧数据认领/业务数据搬运、删除、整库恢复、安装停用或重载用户扩展、GUI自动控制、git push。前置状态不符立即停止，不擅自修复其他生产问题。真实Google交互与跨设备同步仍单独验收。执行者记录实际迁移列表、版本/deployment ID、正式URL验证、旧数据计数保护结果及残余未验收项，不把部署成功等同全部产品验收完成。

### 2026-10-02 生产上线执行结果（开发报告）

D1 UUID ef726d35-666c-413b-a17d-48902597d449 核对一致；条件登记0001，回读及待应用列表符合前置条件，顺序应用0002–0004成功，无待迁移。新增8表/4索引，8表为空，原五表计数与迁移前一致；无旧数据认领或业务修改。生产PRAGMA integrity_check被SQLITE_AUTH拒绝，不能宣称生产完整性检查通过；本地备份/内存演练此前为ok。

从清洁c7c107c2481cefaffc059517834dce3112ae3c8d部署；Worker版本adb413a1-4bbe-4c02-8697-3c6c6bfad853，deployment abd625da-6567-4643-ab1f-364a9be3afc4，100%流量。正式URL https://taskmaster-api.yx9391.workers.dev 不变。开发报告首页200/no-store/Google登录文案，未认证categories401、OPTIONS200、legacy及manifest200。仅自动HTTP验证，不是实际OAuth验收。

保留预迁移SQL备份及旧Worker回退版本c365c0b6-057b-418e-89e1-b4347ea95346；未回退。未扩展安装/重载/停用、GUI、push。#62继续开放，真实Google登录、扩展新身份切换、旧云端归属认领和两设备同步未验收。先让用户手动验证手机网页Google登录，明确新账号暂无旧任务属未认领，不代表数据丢失；不要求先停用旧扩展。

## 决策 D-20261002-04：现有扩展本地管理与可选登录

用户明确纠正产品解释：不建设独立完整任务管理网站；现有插件弹窗和newtab已经承担管理功能。兼容登录与不登录，不能强制登录。

- 未登录：现有任务创建、编辑、排期、完成、分类和管理能力正常使用，chrome.storage.local持久保存；不得以登录遮挡界面或禁用本地功能。
- 登录：在相同界面附加账号隔离云端自动恢复/同步，不把本机存储替换为只能在线工作的后端。先本机保存，网络不可用时仍可工作并显示待同步。
- 弹窗与newtab共用扩展存储中的登录/会话状态，一处登录另一处同步更新；提供现有界面内非阻断登录入口及简明状态。
- 退出：停止云同步，保留当前本机数据；再次登录或换号按既定隔离规则处理，禁止把原账号数据静默上传给另一账号。
- 手机快速添加页只是额外账号数据入口，验证它的登录不能替代扩展弹窗/newtab验收。
- 不新增独立网站管理端、额外服务器产品或新的用户迁移导出导入功能。后端只承担现有多端账号鉴权、数据隔离与同步职责。
- 产品此前“必须接入登录”的表述仅指实现可选登录能力，不是必须登录才使用；当前说明更正，不授权改变原有访客模式。

### D-20261002-04 验收进展与候选包重建要求

开发已在隔离工作树修改popup账号同步入口、共用同步弹窗打开关闭及登录退出广播，新增google-account-ui测试；只完成语法/diff检查，完整check被隔离目录缺依赖阻断，因此尚未验收。产物目录中的旧3.16.0包不可安装，不得将理论规格当作完成。

产品已确认主项目现有node_modules/typescript存在，允许通过隔离目录链接或显式现有工具路径复用已安装依赖，不需重复下载。若真实缺依赖，先明确具体项，不退回问用户已提供配置。

已批准新身份SPKI公钥可以从canonical密钥在内存提取，目标ID gjifmpjgedleemhkikajgepickfphflo；实际旧ID bnodekgdlgbjfddgeglnjgmfiebhjbnp保留。当前Worker bridge方案不需要extension oauth client作为认证路径，manifest不应保留getAuthToken占位配置冒充登录所需；Chrome identity权限及固定回调须匹配新ID。由开发负责将批准配置应用到独立候选源，完整验证构建、扫描私钥泄漏及guest能力后交付候选，不改当前旧加载产物。

用户不需重新提供客户端ID或公钥。本地修复/构建属于已批准范围，无新部署或GUI授权。完成报告应提供实际check/build结果、候选绝对路径、身份/版本/bridge一致性，以及可选登录的手动验收步骤。

### 2026-10-02 D04 本地验证与独立候选交付

开发报告npm run check与build/release gate通过，复用现有依赖未安装；popup入口与newtab共用面板、登录退出广播及guest备份保留回归通过。候选3.16.2新ID gjifmpjgedleemhkikajgepickfphflo，保留identity、移除不使用oauth2，bundle走launchWebAuthFlow不含getAuthToken；旧chrome-extension-sync manifest摘要未变。

独立候选：C:\Users\Kairos\AppData\Local\TaskMaster\worktrees\google-sync-c7c107c\outputs\google-account-sync-candidate-v3.16.2-20261002。产品侧已只读确认manifest存在与版本/入口。真实guest使用、Google授权、跨窗账号状态及两设备同步尚未验证；#62继续开放。原用户项目未push/tag，开发本次无部署、GUI、生产写入。开发正在精确本地提交。

手动安装由用户本人加载独立候选目录，保留旧扩展不卸载；若newtab覆盖导致新标签页选择新扩展，只是入口切换，旧扩展及其存储不删除。新扩展是新身份，本机为空属预期；先验证guest、登录，不声称旧任务已恢复（未认领）。测试后退出/删除临时测试任务按用户操作，产品侧不自动改业务数据。

### 2026-10-02 用户真实验收：新扩展登录及手机到电脑同步

用户手动加载3.16.2新身份候选并确认Google登录成功；随后确认同步成功、手机新增任务已在电脑显示。记为真实扩展授权及同账号手机→电脑新增任务同步通过，不扩大为两台电脑、所有任务字段、删除收敛或账号隔离均已验收。旧任务账号认领、其他同步验收与旧扩展退役仍未完成。

用户发现手机保存操作无明确成功/失败状态，要求记录优化；单独记录，不自动增加当前开发范围。

### 2026-10-02 用户验收更正与弹窗添加阻塞

用户反馈3.16.2 popup添加按钮被block，无法添加；已授权检查修复，优先恢复核心新增功能。两项手机体验优化暂停实施但保留成果，不标完成。
手机仅快速添加入口，不增加任务管理。用户暂不执行未登录验收，暂无其他设备，其他设备恢复验收未执行；同一账号重新登录不必另一设备，但不强制用户本轮执行。
新独立bug须实现前关联Issue，修复采用本地源码/行为验证，不擅自覆盖用户实际加载候选。用户加载路径为旧项目outputs中的交付包，只读定位，正式源码仍是最新Codex-Case-Collisions项目。

### 弹窗新增阻塞根因与Issue #65

独立Issue：https://github.com/Kairos-931/task-manager-chrome/issues/65，产品侧已通过gh创建成功。开发报告旧候选仅隐藏父任务子字段，未disable空required标题，原生校验阻断submit；同步网络非根因。当前工作区已有未提交applyTaskEntryMode与针对性回归，需保护和精确整理，不将其他用户改动混入。开发关联#65继续修复验证和同新ID独立候选，不覆盖当前加载包；真实popup提交待用户验收。

### Issue #65 本地修复交付 2026-10-02

开发提交770c24e（隔离codex/fix-popup-task-add-issue65），版本3.16.3；修复模式切换/初始化的隐藏区域disabled，保留父任务required校验。定向回归、typecheck、lint及build/release gate通过。全量测试仍被原有ui-layout静态断言阻断，不宣称全绿。14文件同新ID gjifmpjgedleemhkikajgepickfphflo，旧3.16.2产物不改。

原候选：最新项目outputs/TaskMaster-3.16.3-popup-add-fix-issue65。产品复制并逐文件校验至短交付路径 C:\Users\Kairos\Documents\TASK_MASTER\outputs\TaskMaster-3.16.3（仅artifact，非旧源码开发）。用户加载同新ID包会更新新版实例，应不卸载后切换以保留存储；真实Chrome提交待用户验证。旧3.16.0不操作。

隔离worktree临时构建目录/junction清理被自动策略拦截，保留未清理，不绕过策略或删除其他路径。没有部署/push/GUI。手机两项仍暂停。

### 2026-10-02 Issue #65 用户实际验证通过

用户确认原加载目录更新3.16.3后成功，弹窗添加阻塞修复通过用户实际操作。固定交付安装目录为 C:\Users\Kairos\Documents\TASK_MASTER\outputs\TaskMaster-3.16.2（目录名是旧标记，但内部manifest实际3.16.3）；以后同新ID候选更新该已加载目录并用户手动重载，不不断更换版本目录。旧3.16.0保持不动。

恢复此前已批准的手机保存反馈、移除管理员旧页面入口两项本地开发，串行实施，依然无新增生产部署授权。同步接下来用户可用一条测试任务做popup到newtab显示/编辑/删除及重开持久化；guest与其他设备仍未执行，历史数据认领仍不自动执行。

### 2026-10-02 用户实际验证：弹窗与新标签页

在产品给出三项测试后，用户回复该三项无问题（输入“这三点没有我呢提”，按上下文理解为“这三点没有问题”）：popup新增在newtab显示、修改标题更新、删除后重新打开不再出现。记录为同一电脑两扩展界面的新增/编辑/删除与重开持久化通过，不能替代两台电脑同步或离线删除收敛验收。

当前已确认扩展Google登录、手机新增到电脑、popup新增及同机跨窗口行为；guest、第二电脑、完整账号切换/离线收敛及旧数据认领仍未验收。两项手机优化继续按既有授权开发，尚无新生产发布批准。
