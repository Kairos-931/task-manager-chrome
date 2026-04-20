# 更新日志

所有重要的项目变更都记录在此文件中。

本项目使用 AI 编程助手（Coze / Claude）迭代开发，通过快照存档保存每个版本。

---

## [1.0.0] - 2026-04-18

### 新增功能

- **跨设备数据同步** — 新增 `shared/sync.ts`，基于 chrome.storage.sync 实现多设备同步
  - 同步状态指示器（空闲/同步中/已同步/远程更新/错误）
  - 分块存储突破 chrome.storage.sync 单条 8KB 限制
- **双重存储机制** — 改进 `shared/storage.ts`，同时写入 local 和 sync
  - 优先读取 sync 数据
  - sync 被清空时自动从 local 恢复
  - 双写确保数据安全，防止卸载插件导致数据丢失
- **艾森豪威尔矩阵迁移** — 新增 `convert-eisenhower.cjs` 迁移脚本
  - 自动将四象限任务转换为新格式
  - 优先级映射：重要紧急→高、重要不紧急→中
  - 生成 `taskmaster-import.json` 供插件导入
- **数据导入** — 支持从旧系统（艾森豪威尔矩阵）导入任务数据
- **构建产物** — 新增 `chrome-extension-sync/` 可直接加载的扩展目录
- **发布资源** — 新增 `release/` 目录、`README.md`、`GITHUB_GUIDE.md`、`LICENSE`

### 改进

- 简化安装流程：直接加载 `chrome-extension-sync/` 文件夹即可使用
- 构建系统优化，使用 esbuild 打包生成单个 JS 文件
- 增强导入数据格式验证

---

## [0.7.0] - 2026-04-18

### 改进

- UI 渲染与交互细节优化
- 业务逻辑持续完善

---

## [0.6.0] - 2026-04-18

### 改进

- UI 与业务逻辑迭代优化
- 数据存储层稳定性提升

---

## [0.5.0] - 2026-04-18

### 新增

- `shared/background.ts` + `background.js` — Chrome 扩展后台脚本（Service Worker）
- `shared/chrome.d.ts` — Chrome API TypeScript 类型声明
- `scripts/package-for-store.sh` — Chrome 商店打包脚本
- UI 预览图

### 改进

- TypeScript 类型安全性增强

---

## [0.3.0] - 2026-04-17

### 变更（重大重构）

- **架构重构**：放弃 Vite + Node.js 服务端架构，转为纯 Chrome 扩展项目
- 移除 `server/`、`src/`、`vite.config.ts`
- 项目目录扁平化
- 移除 pnpm，切换到 npm

### 新增

- `shared/entry.ts` 打包入口
- `.npmrc.json` 配置
- AI Agent 协作文件：`PROMPT.md`、`NEXT_AGENT_PROMPT.txt`、`AGENTS.md`
- `PRD.md` 产品需求文档

---

## [0.2.0] - 2026-04-16

### 新增

- `chrome-extension-loadable/` 目录 — 构建产物可直接加载到 Chrome
- `scripts/bundle.mjs` 打包脚本

### 改进

- 移除冗余的 HTML/JS 重复文件和 SVG 图标源文件

---

## [0.1.0] - 2026-04-16

### 新增

- 项目初始化
- Vite + Node.js 服务端架构
- TypeScript + Tailwind CSS + pnpm
- Chrome 扩展基础结构：popup、newtab、shared 模块
- 服务端（server/）和 Web 前端（src/）
- 基础任务增删改查功能

---

## 功能演进全景

```
v0.1.0      基础框架 — Vite 全栈 + Chrome 扩展雏形
    ↓
v0.2.0      构建优化 — 可加载到 Chrome 的构建产物
    ↓
v0.3.0      架构重构 — 去掉服务端，纯扩展项目
    ↓
v0.5.0      核心功能 — Service Worker + 类型系统
    ↓
v0.6.0~0.7.0  功能完善 — UI/逻辑持续优化
    ↓
v1.0.0      正式发布 — 数据同步 + 迁移工具 + 开源
```

---

*格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。*