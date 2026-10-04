[English](README_EN.md) | **中文**

# TaskMaster - Chrome 任务管理插件

TaskMaster 是一款本机优先的 Chrome 任务管理扩展。电脑通过插件弹窗和新标签页管理任务；手机网页仅用于快速添加。不登录也能使用本机任务管理，主动登录 Google 后由 TaskMaster 后端按账号自动同步。

当前已交付并验证新增任务的扩展版本为 **4.0.3**。4.0 代表 Google 账号同步与系统架构升级的产品阶段，延续此前功能和数据。Google 登录及手机新增到电脑已通过真实使用验证；第二台电脑恢复、完整账号隔离及离线删除收敛仍在独立验收中，见 [Issue #62](https://github.com/Kairos-931/task-manager-chrome/issues/62)。

## 功能特性

- **四种视图** — 列表 / 日 / 周 / 月视图自由切换
- **任务管理** — 添加、编辑、删除、完成任务
- **丰富属性** — 优先级（高/中/低）、分类、截止日期、预计时长、重复任务
- **分类管理** — 预设分类（工作/生活/学习）+ 自定义分类（支持颜色）
- **筛选过滤** — 按优先级/分类筛选，隐藏已完成或过期任务
- **拖拽操作** — 任务拖拽到不同日期
- **深色模式** — 明暗主题一键切换
- **可选 Google 登录** — 不登录可本机使用；登录后通过 Cloudflare Worker + D1 按账号自动同步，普通用户无需填写 API 地址或密钥
- **同步管理面板** — 手动上传到云端、从云端拉取、导出文件、导入文件
- **同步冲突处理** — 当前按记录合并，字段级并发合并与安全历史压缩仍为后续规划；多设备删除收敛仍需验收
- **数据导入导出** — JSON 备份；导入先预览再按任务 ID 去重合并，保留两边独有任务，同文件重复导入不生成第二份；内容冲突默认保留当前，已知删除任务恢复需明确选择
- **双模式使用** — 插件弹窗快速查看 + 扩展新标签页完整管理，无需独立完整管理网站
- **任务池与排期** — 新建不选计划日期进入任务池；允许安排任意合法过去日期
- **草稿恢复** — 弹窗或新标签页中断后恢复本机未提交表单，草稿不作为任务同步
- **手机添加** — Google 登录、保存结果提示和有效登录会话恢复；手机不承担管理任务的功能

### 正在开发的调整

[Issue #74](https://github.com/Kairos-931/task-manager-chrome/issues/74)：新增任务的预计时长、优先级、分类直接可见；新建默认 **1 小时**。这是最新确认的目标，尚未交付，当前 4.0.3 不因此自动变更。编辑旧任务和恢复草稿保留原值，历史任务不会批量改为一小时。

## 安装

### 方式一：直接加载（推荐）

1. 下载或克隆本项目
2. 打开 Chrome，地址栏输入 `chrome://extensions/`
3. 打开右上角的 **开发者模式**
4. 点击 **加载未打包的扩展程序**（部分版本称“加载已解压的扩展程序”）
5. 选择项目中的 `chrome-extension-sync` 文件夹
6. 安装完成，点击右上角插件图标即可使用。更新同一扩展时保留原加载目录和稳定扩展 ID，点击“重新加载”后重新打开管理标签页；不要卸载或清理存储来更新

### 方式二：从源码构建

需要支持项目 TypeScript 测试运行方式的 Node.js 环境；当前交付在 Node.js 22.16 上验证。

```bash
git clone https://github.com/Kairos-931/task-manager-chrome.git
cd task-manager-chrome
npm install
npm run build
```

构建完成后，加载 `chrome-extension-sync` 文件夹到 Chrome。

## 使用方式

- **弹窗模式**：点击浏览器右上角插件图标，弹出小窗口快速查看
- **全屏模式**：弹窗中点击"新标签页打开"按钮，进入全屏任务管理页面

## 公开演示页

`demo/` 提供完全隔离真实数据的公开交互式演示页。页面只使用虚构预填任务，不连接 Worker、不读取扩展数据，刷新后恢复初始状态。

```bash
npm run demo
```

打开 `http://127.0.0.1:4173`。服务器与 Docker 部署方式见 [docs/demo-deployment.md](docs/demo-deployment.md)。

## 技术架构

| 技术 | 用途 |
|------|------|
| TypeScript | 主要开发语言 |
| Chrome Extension MV3 | 浏览器扩展框架 |
| Tailwind CSS | UI 样式 |
| esbuild | IIFE 打包 |
| Cloudflare Worker + D1 | 跨设备数据同步 & Telegram Bot |
| chrome.storage.local | 本地数据存储与备份 |

## 项目结构

```
├── manifest.json              # Chrome 插件配置
├── package.json               # 项目依赖与构建脚本
├── tsconfig.json              # TypeScript 配置
├── tailwind.config.js         # Tailwind CSS 配置
├── shared/                    # TypeScript 源码
│   ├── types.ts               # 类型定义
│   ├── storage.ts             # 本机存储、账号同步、导入合并与备份
│   ├── task.ts                # 状态管理与业务逻辑
│   ├── render.ts              # UI 渲染
│   ├── events.ts              # 事件监听
│   ├── entry.ts               # 打包入口
│   ├── background.ts          # Service Worker
│   └── chrome.d.ts            # Chrome API 类型声明
├── backend/                   # Cloudflare Worker 后端（D1 数据库）
├── chrome-extension-sync/     # 可直接加载的构建产物（推荐）
├── popup/                     # 弹窗入口 HTML
├── newtab/                    # 全屏管理页入口 HTML
├── styles/                    # Tailwind CSS 源文件
├── icons/                     # 插件图标（16/48/128px）
└── scripts/                   # 构建脚本
```

## 数据同步说明

### 普通用户

1. 安装扩展后即可本机使用，不必部署服务器或配置密钥。
2. 在插件的账号同步入口选择 Google 登录；任务先保存在本机，联网后自动与该账号同步。
3. 手机打开运营中的添加页 [TaskMaster 手机添加](https://taskmaster-api.yx9391.workers.dev/)，使用同一 Google 账号添加任务。手机不提供完整管理界面。

手机在同一浏览器恢复仍有效的七天 TaskMaster 会话；会话过期、主动退出或站点存储被清除后需要重新登录。不同账号的数据隔离；旧扩展和旧全局密钥数据不会因新账号登录而自动认领。

### 导出、导入与旧数据

在同步管理面板使用“导出文件”和“导入文件”。导入先显示合并预览：同 ID 去重、同 ID 内容冲突明确选择、当前独有数据保留。不同 ID 的同标题任务不直接当成重复；分类与父子关系一并校验。旧备份缺少可靠删除历史时会提示检查待新增任务，不能自动推断它们是否曾被删除。

导入成功指本地持久化成功；云同步暂时失败会单独反馈，避免反复导入产生误操作。导入、草稿恢复、手机保存反馈及登录保持已于 2026-10-04 获用户验收通过。

### 运营及开发者

当前 Google 账号同步使用 `POST /api/account/sync/incremental`，账号任务入口使用 `POST /api/account/tasks`，以经后端验证的 TaskMaster 会话鉴权。后端配置和身份边界见 [Google 同步配置说明](docs/google-account-sync.md) 和 [账号同步需求与交付记录](docs/requirements/REQ-20260930-google-account-sync.md)。普通用户无需操作这些设置。配置文档保留上线前历史状态；当前部署和验收进度以本 README 及需求末尾最新交付记录为准。

旧全局 API 与 Telegram 链路保留兼容边界，不等同于 Google 账号同步；不自动把旧全局任务或 Telegram 队列导入新账号。自建 Worker、D1/OAuth 配置属于运营部署，需按现有迁移与发布流程处理，不对已有生产库重新初始化。手机旧管理员设置页已移除，旧页面链接跳转到当前添加页。

## 常见问题

### 同步不生效

- 确认扩展账号已登录、手机使用同一 Google 账号；退出或会话失效时重新登录。
- 检查同步面板的错误提示。本地保存成功与云端同步成功是两个状态，不要因网络失败清除本地任务。
- 在同一浏览器打开 [手机添加页](https://taskmaster-api.yx9391.workers.dev/) 检查服务连通性；`Failed to fetch` 应优先检查网络、TLS 和代理，认证失效通常返回 `401`。
- 某些网络无法直连 `workers.dev`，需要在自己的网络或代理规则中允许该域名；不必把密钥交给他人排查。

### 更新后仍显示旧行为

在 `chrome://extensions/` 确认实际版本，点击“重新加载”并重新打开管理标签页。文件夹名称可能是旧版本标记，不代表其内部程序版本。保留扩展 ID 和原数据，不通过卸载重装解决更新问题。
## 开发

```bash
# 安装依赖
npm install

# 类型检查
npm run typecheck

# 构建（TypeScript → CSS → esbuild 打包 → 复制资源）
npm run build

# 单独构建步骤
npm run build:css    # 只构建 CSS
npm run icons        # 只生成图标
npm run bundle       # 只打包 JS
npm run copy         # 只复制资源文件
```

## 版本历史

完整的迭代开发记录请查看 [CHANGELOG.md](CHANGELOG.md)。

当前能力与版本、Issue 的对应关系请查看 [docs/current-product.md](docs/current-product.md) 和 [docs/release-history.md](docs/release-history.md)。

当前有效的统一产品需求请查看 [docs/PRD.md](docs/PRD.md)。

变更与发布的记录规则见 [docs/change-recording.md](docs/change-recording.md)。

本项目经历了 20+ 个版本的迭代，从 Vite 全栈架构逐步演化为纯 Chrome 扩展，v1.2.0 实现了统一存储架构、同步管理面板和多设备冲突合并。

## 许可证

[MIT](LICENSE)
