# TaskMaster - Chrome Extension

## 项目结构（单一目录）

**只有一个项目目录**：`C:\chromeextence_my\task-manager-chrome\`

- Chrome 加载路径：`C:\chromeextence_my\task-manager-chrome`（直接从根目录加载）
- Git 仓库：同上
- 源码：`shared/*.ts`（TypeScript）
- 构建产物：`popup/popup.js`, `newtab/newtab.js`, `background.js`（根目录下）
- 后端 + 手机端页面：`backend/`（项目内目录，Cloudflare Worker `taskmaster-api`）
  - `backend/index.js` 既是 API，**手机端添加页的 HTML 也内嵌在其中**（`MOBILE_HTML` 常量）。手机端改 UI = 改这个文件，与 `shared/*.ts` 无关。
  - 部署命令（**必须带 --cwd 和 --no-autoconfig**，否则 wrangler 在错误目录跑 autoconfig、缓存写到不可写路径而失败）：
    ```bash
    npx wrangler deploy --cwd "C:\chromeextence_my\task-manager-chrome\backend" --no-autoconfig
    ```
  - Worker URL：https://taskmaster-api.yx9391.workers.dev ；D1：taskmaster-db

## 构建流程（仅限扩展端）

```bash
npm run build
# 等价于：tsc && generate-icons && tailwindcss && bundle.mjs && copy-assets.js
```

- `bundle.mjs`：esbuild 打包 TypeScript → IIFE 格式，输出到根目录的 popup/newtab/background.js
- `copy-assets.js`：复制一份到 `chrome-extension-sync/` 子目录（分发用）

## 关键文件：manifest.json

**manifest.json 包含 `key` 字段，绝对不能丢失。** 这个 key 决定 extension ID，丢了 chrome.storage.sync 数据就废了。

任何涉及 manifest.json 的操作必须：
1. 先读取当前内容
2. 只修改需要改的字段
3. 保留 key、permissions、host_permissions 不变

**禁止用其他版本的 manifest 覆盖当前版本。**

## 开发规范

- 双目录同步已取消，不再存在独立的 `chrome-extension-sync` 顶层目录
- 每次改完源码必须 `npm run build` 验证
- 版本号在 manifest.json 中维护，功能更新时递增
- commit message 用英文，push 节奏由用户决定

## 技术约束

- 禁止 inline event handlers（CSP 违规）
- 禁止 `element.style.display = 'none'` 隐藏 file input（阻止文件对话框）
- 禁止 `toISOString()` 格式化本地日期（UTC+8 偏移 bug）
- chrome.storage.sync 有 8KB 限制，大数据用分块存储
