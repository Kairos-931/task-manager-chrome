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

## 目录与文件约定

- `shared/`：扩展共享 TypeScript 业务逻辑。
- `popup/`、`newtab/`：对应界面的源文件与模块。
- `styles/`：样式源文件。
- `backend/`：Cloudflare Worker、手机端页面和后端 API。
- `scripts/`：项目自动化脚本。
- `docs/`：长期维护的项目文档。
- `icons/`：扩展图标资源。
- `work/`：Codex 临时分析、草稿和一次性脚本；任务结束时清理不再需要的内容。
- `outputs/`：仅存放需交付给用户的产物，不放源码或临时文件。
- 根目录构建产物仅由项目既有构建流程生成，不手工改写生成文件，除非确认它本身就是源码。

新增文件应放入职责最明确的现有目录；只有形成新的稳定职责边界时才新建目录。文件名沿用所在目录已有风格，代码标识符使用英文。

## 修改与验证

- 不通过注释或绕过报错来让代码运行；必须定位根因。
- 修改完成后按风险运行相关的 test、lint 和 build；无法运行时说明原因与未验证范围。
- 不自动安装依赖、部署或 `git push`，除非用户明确要求。
- 不修改或删除用户无关的已修改、未跟踪文件。

## Git 与版本

- Commit message 使用英文 Conventional Commits：`type: concise change intent`。
- `fix:` 对应 PATCH，`feat:` 对应 MINOR，`feat!:` 或 `BREAKING CHANGE:` 对应 MAJOR；`docs:`、`chore:`、`refactor:` 默认不发版。
- 发版时同步源码版本字段与 `vX.Y.Z` Git tag；Chrome `manifest.json` 的 `version` 只允许纯数字点分格式。
- `git push` 仅在用户明确要求时执行；部署使用项目自身命令，不以 push 代替部署。

## 沟通约定

- 默认使用中文，代码、命令、变量名使用英文。
- 结论先行，并说明技术决策的原因和对用户的影响。
- 需求模糊时先提出最合理方案；存在更直接或体验更好的方案时主动指出。
