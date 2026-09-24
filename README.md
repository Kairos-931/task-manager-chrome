[English](README_EN.md) | **中文**

# TaskMaster - Chrome 任务管理插件

一款离线优先的 Chrome 浏览器任务管理扩展，支持四种视图、分类管理、深色模式和可选的 Google 账号同步。当前代码基线为 3.17.0（开发中，尚未发布）；线上 Worker 仍需完成 OAuth 配置、D1 迁移与安全演练后才能启用登录。

## 功能特性

- **四种视图** — 列表 / 日 / 周 / 月视图自由切换
- **任务管理** — 添加、编辑、删除、完成任务
- **丰富属性** — 优先级（高/中/低）、分类、截止日期、预计时长、重复任务
- **分类管理** — 预设分类（工作/生活/学习）+ 自定义分类（支持颜色）
- **筛选过滤** — 按优先级/分类筛选，隐藏已完成或过期任务
- **拖拽操作** — 任务拖拽到不同日期
- **深色模式** — 明暗主题一键切换
- **访客模式** — 无需注册或登录，任务先保存在本机，离线可用
- **Google 账号同步** — 用户主动登录后，通过 Cloudflare Worker + D1 按 Google 账号隔离增量同步
- **安全切换账号** — 切换账号前明确选择合并本机数据，或备份后改用新账号的云端数据
- **手机快速添加** — 手机页使用相同 Google 账号，只能读取和写入当前账号的任务
- **同步与备份面板** — 查看账号和同步状态，并导出/导入本地 JSON 备份
- **冲突合并** — 多设备离线编辑时按任务时间戳自动合并，删除不会被旧设备复活
- **数据导入导出** — JSON 格式备份与恢复
- **双模式使用** — 弹窗快速查看 + 全屏管理页面

## 安装

### 方式一：直接加载（推荐）

1. 下载或克隆本项目
2. 打开 Chrome，地址栏输入 `chrome://extensions/`
3. 打开右上角的 **开发者模式**
4. 点击 **加载已解压的扩展程序**
5. 选择项目中的 `chrome-extension-sync` 文件夹
6. 安装完成，点击右上角插件图标即可使用

### 方式二：从源码构建

需要 Node.js 18+ 环境。

```bash
git clone https://github.com/你的用户名/task-manager-chrome.git
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
| Google Identity + Cloudflare Worker + D1 | 可选登录与账号隔离同步 |
| chrome.storage.local | 本地数据存储与备份 |

## 项目结构

```
├── manifest.json              # Chrome 插件配置
├── package.json               # 项目依赖与构建脚本
├── tsconfig.json              # TypeScript 配置
├── tailwind.config.js         # Tailwind CSS 配置
├── shared/                    # TypeScript 源码
│   ├── types.ts               # 类型定义
│   ├── storage.ts             # 本机优先存储与 Google 账号增量同步
│   ├── task.ts                # 状态管理与业务逻辑
│   ├── render.ts              # UI 渲染
│   ├── events.ts              # 事件监听
│   ├── entry.ts               # 打包入口
│   ├── background.ts          # Service Worker 与 Google OAuth 授权
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

TaskMaster 默认是访客模式：任务、分类和设置保存在 `chrome.storage.local`，无需 Google、API 密钥或网络即可使用。用户从新标签页的「数据同步」主动登录 Google 后，扩展才会通过 Cloudflare Worker + D1 同步；Worker 只根据验签后的 Google `sub` 选择账号数据空间。新标签页与手机页可以使用同一个 Google 账号。

### 同步架构

```
扩展（Google 账号 A） ── Bearer 会话 ──┐
                                      ├─ /api/account/* ── D1（user_sub=A）
手机页（同一账号 A） ── HttpOnly Cookie ┘

旧 API_TOKEN / Telegram 管理通道 ── 旧全局表（与账号表完全分离）
```

未登录时编辑只影响本机；登录后自动同步。首次登录会合并本机与账号云端的独有记录。换 Google 账号时，必须明确选择合并本机数据到新账号，或先备份本机数据再替换为新账号的云端数据。退出登录不会删除本机任务。

### 3.17.0 启用前置条件（尚未发布）

当前生产 Worker 仍是旧版，直接构建/加载本分支不会启用 Google 登录。正式开放前，管理员必须依次完成：

1. 备份生产 D1，并在非生产库演练 `backend/migrations/0002-google-account-sync.sql`；迁移只新增账号表，不修改旧全局表。
2. 配置 Google OAuth Web Client：授权回调必须精确匹配此扩展稳定 ID 的 `chrome.identity.getRedirectURL()`；同时将手机 Worker 页面来源加入 Google Identity 的授权来源。
3. 在 Worker secret/config 中设置 `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET` 和 `GOOGLE_EXTENSION_REDIRECT_URI`。旧数据管理员认领前，另经人工确认归属后才设置 `LEGACY_CLAIM_GOOGLE_SUB`；不要把任何真实值写入仓库。
4. 部署 Worker 并验证 Google 验签、账号 A/B 隔离、手机同账号读写和旧 Telegram 隔离后，才发布扩展。
5. 旧全局数据完成备份、认领和数量/关键任务校验后，可设置 `LEGACY_API_DISABLED=true` 停用旧 `/api/tasks`、`/api/categories`、`/api/sync/incremental` 与 `/api/fullsync` 通道。

Google 登录使用单独账号表；旧 `sync_records`、`user_data` 与 `pending_tasks` 不会自动认领或暴露给新账号。管理员认领仅覆盖旧增量/快照任务、分类和设置，不包含归属不明确的 Telegram `pending_tasks`。

Telegram 仍是独立的旧管理员通道，不会同步到 Google 账号。升级前管理员必须停用旧 Bot Webhook，或另行完成经过确认的 Telegram 迁移方案；否则新扩展不会自动读取该旧队列，待处理消息可能留在 `pending_tasks` 中。不要通过旧全局 API 密钥读取或写入任何账号表。

### 用户使用

- **电脑访客模式**：安装后直接添加和管理任务，数据仅保存在本机。
- **开启跨设备同步**：在新标签页打开「数据同步」并点击「使用 Google 登录」；登录成功后自动合并，另一台电脑登录同一账号即可恢复。
- **手机快速添加**：在新标签页打开「手机同步」，复制页面链接到手机；手机登录相同 Google 账号后才能读取或新增该账号任务。
- **离线**：继续本机编辑；恢复联网后自动同步。认证失效时重新登录，不会清除本机数据。

**兼容边界**：旧 API Token 与 Telegram 仍指向旧全局表。不要把 API Token 当作 Google 登录或账号授权；确认旧数据归属和备份之前，不要执行数据认领或停用旧 Worker。

## 常见问题

### Google 登录或同步不可用

1. **访客模式仍可使用** — 任务保存在本机；Google 登录服务未配置或 Worker 尚未升级时，不会退回旧 API Token 同步。
2. **确认 Worker 已部署并完成 D1 新表迁移** — 开发中的 3.17.0 代码不会自动部署；OAuth 配置和数据库迁移缺一不可。
3. **登录反复失败** — 检查 Google OAuth Client ID、扩展稳定 ID 的回调 URI，以及 Worker 的 `GOOGLE_EXTENSION_REDIRECT_URI` 是否完全一致。
4. **网络错误与认证错误不同** — `TypeError: Failed to fetch` 表示请求未收到 HTTP 响应，优先检查网络、TLS 和代理；过期登录需重新登录。
5. **Clash 规则模式覆盖 Worker** — 在当前订阅关联的 Rules 覆写中，将以下规则放在 `GEOIP`、`GEOSITE` 和 `MATCH` 等兜底规则之前，然后重新加载配置：

   ```yaml
   prepend:
     - DOMAIN,taskmaster-api.yx9391.workers.dev,Proxy
     - DOMAIN-SUFFIX,workers.dev,Proxy
   ```

   `Proxy` 必须替换为配置中实际存在的代理组名。验证时直接在同一个 Chrome 中访问 Worker URL；能打开 TaskMaster 手机添加页，说明浏览器链路已经恢复。

## 开发

```bash
# 安装依赖
npm install

# 类型检查
npx tsc

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
