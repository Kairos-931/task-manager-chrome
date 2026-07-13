[English](README_EN.md) | **中文**

# TaskMaster - Chrome 任务管理插件

一款功能完整的 Chrome 浏览器任务管理扩展，支持四种视图、分类管理、深色模式、多设备数据同步。

## 功能特性

- **四种视图** — 列表 / 日 / 周 / 月视图自由切换
- **任务管理** — 添加、编辑、删除、完成任务
- **丰富属性** — 优先级（高/中/低）、分类、截止日期、预计时长、重复任务
- **分类管理** — 预设分类（工作/生活/学习）+ 自定义分类（支持颜色）
- **筛选过滤** — 按优先级/分类筛选，隐藏已完成或过期任务
- **拖拽操作** — 任务拖拽到不同日期
- **深色模式** — 明暗主题一键切换
- **数据同步** — 通过 Cloudflare Worker 实现离线优先的跨设备增量同步，支持 Telegram Bot 添加任务
- **同步管理面板** — 手动上传到云端、从云端拉取、导出文件、导入文件
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
│   ├── storage.ts             # 存储层（分块 sync + local 备份）
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

插件通过 **Cloudflare Worker + D1 数据库** 实现跨设备同步，不依赖 chrome.storage.sync。

### 同步架构

```
设备 A（Chrome 插件）
  → 增删改任务 → POST /api/sync/incremental → Cloudflare D1 变更日志
                                                    ↓
设备 B（Chrome 插件）
  ← 游标拉取增量变更 ← POST /api/sync/incremental
```

| 功能 | API | 说明 |
|------|-----|------|
| 增量同步 | `POST /api/sync/incremental` | 每次操作自动发送变更并按游标接收远端更新 |
| 旧版兼容 | `GET/POST /api/fullsync` | 仅供未升级的扩展继续使用 |
| 创建任务 | `POST /api/tasks` | 手机网页 / Telegram Bot 使用 |
| Telegram Bot | `POST /api/telegram/webhook` | 通过 Telegram 消息添加任务 |

### 后端部署（Cloudflare Worker）

后端代码在 `backend/` 目录，部署步骤：

1. **创建 D1 数据库**
   ```bash
   npx wrangler d1 create taskmaster-db
   ```

2. **初始化或迁移数据库表结构**
   ```bash
   npx wrangler d1 execute taskmaster-db --remote --file=backend/schema.sql
   ```

3. **配置 wrangler.toml**
   - `backend/wrangler.toml` 中填入 D1 database_id
   - 设置环境变量：`API_TOKEN`（自定义密钥，插件设置中填写同一个值）、`TELEGRAM_BOT_TOKEN`（可选）

4. **部署**
   ```bash
   cd backend
   npx wrangler deploy
   ```

   部署成功后会得到 Worker URL（如 `https://taskmaster-api.your-name.workers.dev`）。

### 插件端配置

1. 打开 TaskMaster 弹窗 → 点击齿轮进入设置
2. 在「手机同步设置」中填入：
   - **API 地址**：你的 Worker URL（如 `https://taskmaster-api.your-name.workers.dev`）
   - **API 密钥**：你设置的 `API_TOKEN`
3. 保存后即可使用同步功能

### Telegram Bot（可选）

1. 通过 [@BotFather](https://t.me/BotFather) 创建 Bot，获取 Token
2. 在 Cloudflare Worker 环境变量中设置 `TELEGRAM_BOT_TOKEN`
3. 设置 Webhook：`https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-worker.workers.dev/api/telegram/webhook?secret=<TOKEN>`
4. 在 Telegram 中发送 `/token <你的API密钥>` 绑定账号
5. 之后直接发消息即可添加任务

**注意事项**：
- 扩展会在联网后自动收敛任务、分类和设置；同一任务并发编辑时采用较新的修改
- 删除任务会同步为墓碑记录，旧设备恢复联网后不会把它重新创建
- 国内使用无需 VPN（Cloudflare Worker 全球可达）
- 建议定期使用"导出数据"功能备份重要数据

## 常见问题

### 同步不生效

1. **确认 API 地址和密钥正确** — 打开设置面板检查是否填写
2. **确认 Worker 已部署** — 直接访问 Worker URL，应返回 `{"error":"Not Found"}`（说明 Worker 在线）
3. **确认 D1 数据库已绑定** — 检查 wrangler.toml 中的 database_id 是否正确

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

本项目经历了 20+ 个版本的迭代，从 Vite 全栈架构逐步演化为纯 Chrome 扩展，v1.2.0 实现了统一存储架构、同步管理面板和多设备冲突合并。

## 许可证

[MIT](LICENSE)
