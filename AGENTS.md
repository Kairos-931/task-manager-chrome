# TaskMaster 项目协作规则

## 项目目标

TaskMaster 是一个 Chrome 扩展任务管理项目，同时包含 Cloudflare Worker 手机端页面与后端 API。

所有实现决策优先保证用户体验：为用户目标设计、减少思考与手动步骤、逐步展示复杂度，并用反馈引导下一步行动。

## 开发前置要求

- 新功能开发前先整理 PRD，至少包含目标、用户、核心功能、视觉风格、约束和竞品参考，并与用户确认后再编码。
- 修复问题前先定位用户实际使用的端、对应源码、发布路径，并尽可能验证线上实际返回内容。
- 调整本文件约定时，先修改规则，再按新规则实施。
- 编辑前核对绝对路径，避免在名称相似的项目副本中误改。

## 代码分层与生效方式

- Chrome 扩展端：源码主要位于 `shared/*.ts`，通过 `npm run build` 生成根目录的 `popup.js` 和 `newtab.js`；重载扩展后生效，不经过服务器。
- 手机端添加页：位于 `backend/index.js` 内嵌的 `MOBILE_HTML`；修改后需在 `backend/` 使用项目既有部署命令上线。
- 后端 API：同样位于 `backend/index.js`，与手机端通过同一次 Cloudflare Worker 部署上线。
- 扩展配置与入口：`manifest.json`、`background.js` 以及相关 HTML/CSS 文件。

修改前必须回答：

1. 症状属于哪一层？
2. 改动如何到达用户正在使用的端？
3. 能否先验证线上当前实际行为？

## Chrome 扩展约束

- 禁止 HTML 内联事件处理器；统一在 JavaScript/TypeScript 中使用 `addEventListener`。
- 隐藏文件输入框时不要使用 `display: none`；使用 `opacity: 0` 与 `position: absolute`。
- 本地日期不要使用 `toISOString()`；使用 `Date` 手动提取年、月、日，避免 UTC 时区偏移。
- `chrome.storage.local` 是主存储；同步数据使用 `chrome.storage.sync` 分块保存，单项不得超过 8KB。
- 跨设备同步依赖一致的扩展 ID；`manifest.json` 必须保留稳定的 `key`。
- 用户反馈修改未生效时，先检查浏览器/扩展缓存并引导硬刷新或重载，再继续定位根因。

## 样式与构建约束

- Tailwind 源文件与生成文件必须分离：`styles/tailwind.css` 是唯一输入，`styles/main.css` 是构建产物；禁止让同一个文件同时作为 `tailwindcss -i` 和 `-o`，也禁止手工修改生成后的 `styles/main.css`。
- 新增或修改 Tailwind 工具类后，不能只检查源码中的 `class` 字符串；必须运行 CSS 构建，并确认最终 `styles/main.css` 与 `chrome-extension-sync/styles/main.css` 中存在所需规则。
- 控件宽度、Grid 列宽、溢出边界等会直接决定布局正确性的关键尺寸，优先使用语义化组件类和明确 CSS 规则，不依赖可能被扫描或裁剪遗漏的工具类作为唯一约束。
- CSS 构建必须可重复：连续执行两次应得到等价产物，第二次构建不能因为第一次覆盖源指令而丢失新工具类。
- UI 验收必须覆盖 Chrome Popup 的真实约 `400px` 宽度和新标签页宽屏两种场景；不能只根据宽屏 Demo 判断响应式布局已经生效。

## 目录与文件约定

- `shared/`：扩展共享 TypeScript 业务逻辑。
- `popup/`、`newtab/`：对应界面的源文件与模块。
- `styles/`：样式源文件。
- `backend/`：Cloudflare Worker、手机端页面和后端 API。
- `demo/`：公开展示用的静态演示页面与样例数据；禁止连接真实 API 或包含真实任务。
- `deploy/`：服务器部署配置、容器和反向代理示例，不存放密钥。
- `scripts/`：项目自动化脚本。
- `docs/`：长期维护的项目文档。
- `docs/requirements/`：需求任务与开发任务之间的正式交接规格；仅将用户已确认的需求交付开发。
- `icons/`：扩展图标资源。
- `work/`：Codex 临时分析、草稿和一次性脚本；任务结束时清理不再需要的内容。
- `outputs/`：仅存放需交付给用户的产物，不放源码或临时文件。
- 根目录构建产物仅由项目既有构建流程生成，不手工改写生成文件，除非确认它本身就是源码。

新增文件应放入职责最明确的现有目录；只有形成新的稳定职责边界时才新建目录。文件名沿用所在目录已有风格，代码标识符使用英文。

## 修改与验证

- 不通过注释或绕过报错来让代码运行；必须定位根因。
- 修改完成后按风险运行相关的 test、lint 和 build；无法运行时说明原因与未验证范围。
- 不自动安装依赖、部署或 `git push`，除非用户明确要求。
- 每个独立需求或修复在项目规定的测试、检查和构建验证通过后，自动创建本地 Git commit；不需要为 commit 再次向用户确认。提交只包含该需求相关文件，不得混入无关改动。
- 不修改或删除用户无关的已修改、未跟踪文件。

## Git 与版本

- Commit message 使用英文 Conventional Commits：`type: concise change intent`。
- 验证通过后按独立用户目标自动创建本地 commit；一个 commit 对应一个可独立理解和回退的需求或修复。工作区存在其他未提交改动时，必须精确选择相关文件，不得使用覆盖全部改动的宽泛提交。
- `fix:` 对应 PATCH，`feat:` 对应 MINOR，`feat!:` 或 `BREAKING CHANGE:` 对应 MAJOR；`docs:`、`chore:`、`refactor:` 默认不发版。
- 发版时同步源码版本字段与 `vX.Y.Z` Git tag；Chrome `manifest.json` 的 `version` 只允许纯数字点分格式。
- `git push` 仅在用户明确要求时执行；部署使用项目自身命令，不以 push 代替部署。

## 变更记录

- 每一项独立的功能、用户可感知的修复、数据/架构行为调整或工程保障改动，都必须关联一个 GitHub Issue；不能只用发布总单替代多个独立目标。
- 开始实现前，Issue 至少记录目标、影响范围和验收方式；历史补录时也要写明对应版本与验证结果。
- 一个 Issue 只覆盖同一个用户目标。同步、手机体验、工程保障等可独立验收的工作必须分别建 Issue。
- 发布总单只用于汇总本次版本，必须链接到各变更 Issue。交付完成后，在每个 Issue 中留下版本/标签/Release，并关闭已完成事项；未完成后续工作保留独立的开放 Issue。
- 纯拼写、格式或不影响行为的文档整理可不建 Issue；其余无法判断时默认建 Issue。

## 沟通约定

- 默认使用中文，代码、命令、变量名使用英文。
- 结论先行，并说明技术决策的原因和对用户的影响。
- 需求模糊时先提出最合理方案；存在更直接或体验更好的方案时主动指出。

## Product and development task roles

- Project: `TaskMaster`
- Requirements task: owns requirement clarification, prioritization, PRD/specification, user flows, acceptance criteria, and approved demos.
- Developer task: `codex://threads/01a0f6ce-2b91-7343-bb37-1b3f5d3d467a`; owns technical design, production code, tests, versioning, Git, build, and deployment.
- The requirements task does not edit production code unless the user explicitly asks for that exception.
- Draft requirements do not enter development. After explicit confirmation, the requirements task saves the specification and sends its path to the developer task.
- The developer task must not expand confirmed scope. Product-impacting ambiguity returns to the requirements task for a decision.

## Product workflow files

### 开发状态反馈约定（2026-10-02）

- 总规则：开发只要停止执行，就必须向产品反馈原因，包含正常完成、阶段完成、等待、受阻、暂停、取消和未完成退出。反馈必须说明已做/未做、验证与交付状态、下一步及负责人；正常干完明确写“已完成”，没有后续动作则明确写“无需后续动作”。主动停止前发送；意外中断后在恢复时补报。

- 用户授权开发向产品反馈已交付需求的暂停、受阻、未完成退出、本地完成及等待配置/验收/部署等状态；无需每次重新请求发送权限。产品与开发的当前 ID 以本项目 `docs/PRODUCT_WORKFLOW.md` 为准，先核对映射，不能沿用历史案例中的旧 ID。
- 开发主动结束上述工作轮次前，先在对应需求记录已做/未做、阻塞原因、下一步及负责人、验证与产物、执行槽是否释放，再向产品发送一次实质状态报告。只有开发聊天里的最终回复，不算已经通知产品。
- 反馈记录包含事件 ID、收件产品 ID、发送时间及成功凭据；失败或结果未知则明确标记，并在本轮最终回复说明。结果未知先核对收件记录，再至多重试一次，避免重复发送。
- 产品在下一次状态检查或交付前核对开发最新结束轮次与反馈记录，发现漏报当次读取并补记；不能等待用户再来提醒。意外中断/崩溃只能在恢复后补报或由产品下次检查补查，未配置的后台监控不能被当作已经运行。
- 产品可在已确认目标、范围、验收和用量内处理可逆细节并记录、汇报；需要改变范围、数据或部署边界时仍请求用户决定。产品仅在有具体决策或后续动作时回复开发，避免纯确认消息循环。

- `docs/PRODUCT_WORKFLOW.md` records the linked requirements/development tasks and shared operating contract.
- `docs/requirements/` stores requirement handoff documents; `_TEMPLATE.md` is the structure baseline for new requirements.

## 2026-09-30 开发位置与验收约定

- 用户确认唯一开发目录为 C:\Users\Kairos\Documents\Codex-Case-Collisions\TASK_MASTER，基线 3.16.0；旧 TASK_MASTER 副本不再开发。
- 产品对话仅维护规格；开发对话按已批准 gpt-6-luna / max 执行。本轮未授权桌面控制，使用确定性验证，真实授权交互与视觉验收明确标记未验证。



## 2026-10-03 后续开发模型偏好

- 最新用户指令覆盖下方早前偏好：用户要求“继续使用露娜max开发”，并说明已手工切到Luna。当前#70及后续开发使用 `gpt-6-luna` / `max`；交付或同项消息使用对应工具覆盖，不能再按旧Sol/low配置把用户手工设置切回。

- 历史偏好（已被上方最新指令覆盖）：用户曾指定下一次开发使用 `gpt-6-sol` / `low`。保留此条仅为解释历史派发记录，当前不执行此配置。
- 当前已交付的 UX-01 / Issue #69 保持其批准的 Luna Max 配置，用户说“下次”不表示中途切换。
- 后续已确认队列统一使用 gpt-6-luna / max；每项仍核对范围、验收和风险，不自行更换配置。Sol / low 仅保留为历史执行记录。

## 2026-10-02 用户授权的常规发布边界

用户明确授权产品侧自行决定已确认需求内的低风险发布，不逐次申请部署批准。产品侧可安排同一项目既定地址、已有工具/账号、可回退且不破坏数据的常规Worker发布，须先完成相关验证、核对干净候选及回滚点，记录发布和结果。

不自动扩大到业务数据删除/归属认领、破坏性迁移、扩展身份或正式地址变更、不可逆外部操作、收费套餐购买、git push或未授权GUI控制。涉及这些边界仍需明确授权。此具体用户授权优先于此前默认每次部署必须单独询问的约定。

## 最新后续开发配置确认（2026-10-03）

用户在产品对话明确要求：后续继续使用luna max来完成开发任务。后续开发统一使用 gpt-6-luna / max，每次派发明确应用该配置；#71已完成的Sol/low属于历史执行，不改写其记录，不视作后续默认值。


## 2026-10-03 用户批准4.0产品阶段

用户明确将Google账号同步及架构升级定义为4.0阶段，下一次本地交付版本为4.0.0，取代本轮按feat默认递增3.20.0的规则；这是明确产品阶段命名决定，不宣称有新增破坏性数据变更。版本统一源码字段、manifest及候选记录，保留稳定扩展key/权限/正式URL和已有数据，不通过新扩展ID重装实现升版。Git push仍须明确跨设备代码同步授权；真实业务数据导入不因升版自动执行。
