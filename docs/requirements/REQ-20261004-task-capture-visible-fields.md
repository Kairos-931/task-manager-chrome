# 新增任务核心字段直接可见

- Status: awaiting_user_acceptance
- Confirmed date: 2026-10-04
- Source: 用户明确要求任务时长、优先级和分类不应被更多选项折叠。

## PRD摘要与范围

目标：新增时无需展开即可估时和指定优先级/分类。用户：本人日常捕获任务。核心：将任务时长、优先级、分类移出更多选项，默认直接可见；仍沿用现有控件与文字。视觉：保持当前风格，核心区域有清晰排列，适应Popup窄屏、新标签宽屏及手机添加页。参考：TaskMaster已有字段，恢复可发现性，不增加新功能。

已确认：标题、可选计划日期、预计时长、优先级和分类初始可见；备注、硬截止、重复等其余高级字段仍保留更多选项，不改变任务模式。新建任务预计时长默认1小时；用户清空后可按未估时保存。日期空则任务池、过去日期允许。优先级/分类默认值及已保存数据不变。编辑和草稿保持已有值，父子模式只显示适用字段，不对父容器强加时长。

## 代码层与生效

扩展shared/render.ts/相关事件与样式，build/Reload生效；若手机已有这些字段也被折叠，当前账号手机页backend/account-mobile.js一致调整，经既有Worker发布上线。用户明确新增任务字段可见性，默认覆盖已有新增入口一致规则，不新增手机管理能力；新增不支持的字段不擅自补功能。部署正式URL/身份/数据不变。

## 验收

普通新增不点更多就可见并操作三字段，展开收起不丢值；未填写时长可正常保存；任务模式切换和草稿恢复正常；原生隐藏校验不拦截保存。确定性DOM/事件与构建/CSS验证，typecheck/lint/build及发布核对，未获GUI授权不声称视觉验收。

## 顺序及执行配置

先完成73真实添加阻断修复，再交付本项，配置Luna/max，单开发串行。工程小至中、用量低至中；跨手机时按原授权dry-run及同地址可回退部署。开始实现前建立独立GitHubIssue，不作为73无关代码混入。无需重新确认已明确修改；保存失败修复不因可见性需求延期。禁止push、真实数据改写、GUI、新依赖安装。

- Issue: https://github.com/Kairos-931/task-manager-chrome/issues/74


发送前主开发idle/最新轮次completed；已成功派发74，model gpt-6-luna、thinking max，基线523b16f/4.0.3。用户既有明确修改授权，73完成后串行启动。

## 开发执行记录（2026-10-04）

- 开发启动时状态：in_development。独立分支 `codex/task-capture-visible-fields-74`，基线 `523b16f4e9d07b61b8082354d133a99111c0d27a`（4.0.3）；执行配置按派发及用户后续明确指令。
- 代码范围：`shared/render.ts` 把时长、优先级、分类放回普通新增表单可见区；`backend/account-mobile.js` 将同三项移出手机页“更多选项”，其余高级字段、默认值和保存逻辑不变；增加字段位置、父子模式切换和手机表单回归断言。
- 手机线上基线：`https://taskmaster-api.yx9391.workers.dev/` GET 返回 200；三项当前均在 `#moreOptions` 内。正式地址来自现有 Google Worker 配置，源码入口为 `backend/account-mobile.js`，发布目标仍为 `taskmaster-api`。
- 发布边界：扩展更新到稳定加载目录前先留完整备份并逐项核对产物哈希、扩展 ID、公钥和权限；Worker dry-run 与生产回退版本核对通过后，在原 URL 发布并只读验证。禁止 push、真实任务写入和 GUI 操作。
- 视觉验收：本轮没有获得桌面控制授权；使用 DOM/事件、构建与 CSS 产物核验，最终交由用户 Reload 扩展并刷新手机页确认视觉与操作路径。

## DEC-visible-fields-01：新建任务默认一小时（2026-10-04）

用户明确确认普通新增默认预计时长 1 小时（存储 60 分钟），覆盖“新建默认未估时”的早期描述。用户主动清空仍为未估时；成功重置后恢复 1 小时。支持估时的手机新增和新建子任务行一致默认 1 小时；父任务容器不赋时长。编辑旧任务、恢复草稿、已有未估时记录与不确定重试均保留各自原值，不批量改历史数据。

## 最终实现及验证记录（2026-10-04）

- 状态：awaiting_user_acceptance。扩展/手机普通新增字段均默认可见，普通及新子任务默认 60 分钟；主动清空保持 0 分钟未估时语义。父模式字段禁用和隐藏仍沿用原逻辑；编辑旧任务、草稿、保存结果未知时的冻结重试保留既有值。
- 扩展最终候选：`outputs/TaskMaster-4.1.0-task-capture-visible-fields-74-r2-20261004`；已更新原稳定加载目录 `C:\Users\Kairos\Documents\TASK_MASTER\outputs\TaskMaster-3.16.2`。更新前 4.0.3 备份：`C:\Users\Kairos\AppData\Local\TaskMaster\backups\extension-before-core-fields-74-20261004-4.0.3`。14 个文件哈希逐项一致，扩展公钥/ID/权限不变。
- 手机正式 URL `https://taskmaster-api.yx9391.workers.dev/`，Worker 名称/URL/账号/API 数据保持不变。最终 Version ID `0e29621a-1665-48f3-a50d-8b451b9f20e0` 已部署且 100% 流量；其前一版本为同项首版 `66577cb8-85b6-451a-a029-d1f065ea37de`，回退整个 #74 可用原版本 `96d6b39d-a3d5-4972-ab4f-b91d505dee05`。最终 dry-run 通过；生产只读检查首页 200/no-store、三字段可见且预计时长 value=60、其余高级字段仍折叠、Google 登录/会话恢复存在；未认证分类 API 401。未写任务、未迁移 D1。
- 验证通过：新增表单/模式切换/编辑旧值/新子任务默认、手机默认/主动清空/重置/幂等重试/会话恢复、Google API 隔离、完成状态、草稿、拆分日期与过去日期、重复、筛选、CSS 候选一致性；`npm run typecheck`、`npm run lint`、`npm run build` 与 release checker 通过。全量 `npm test` 停在既有 `tests/ui-layout.test.mjs:32` 静态顺序断言；单独 `tests/newtab-favicon.test.mjs` 仅因 Windows CRLF/LF 严格相等断言失败；未改动无关 UI/测试。
- 未进行 GUI/视觉验收；用户下一步为 Reload 扩展并重新打开新增页，刷新手机页检查字段及默认值。未 push/tag。Google 多设备同步 #62 保持开放，与 #74 分开。
- Git 同步授权：用户随后明确要求同步近期未同步内容，并明确覆盖本项原先“不 push”边界；在本需求通过验证并本地提交后，仅将 `codex/task-capture-visible-fields-74` 快进推送到 `origin`，不强推、不打 tag，不推送其他分支。
