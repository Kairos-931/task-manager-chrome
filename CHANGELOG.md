# 更新日志

所有重要的项目变更都记录在此文件中。

本项目使用 AI 编程助手（Coze / Claude）迭代开发，通过快照存档保存每个版本。

---

## [1.0.0] - 2026-04-18

### 新增

- **跨设备数据同步** — `shared/sync.ts`，基于 chrome.storage.sync 实现多设备同步
  - 同步状态指示器（空闲/同步中/已同步/远程更新/错误）
  - 分块存储突破 chrome.storage.sync 单条 8KB 限制
- **双重存储机制** — 改进 `shared/storage.ts`，同时写入 local 和 sync
  - 优先读取 sync 数据，sync 被清空时自动从 local 恢复
  - 双写确保数据安全，防止卸载插件导致数据丢失
- **艾森豪威尔矩阵迁移** — `convert-eisenhower.cjs` 迁移脚本
  - 自动将四象限任务转换为新格式
  - 优先级映射：重要紧急→高、重要不紧急→中
- `chrome-extension-sync/` 可直接加载的扩展目录
- `release/`、`README.md`、`GITHUB_GUIDE.md`、`LICENSE` — 开源发布资源

### 改进

- 安装流程简化，构建系统优化（esbuild 单文件打包）
- 增强导入数据格式验证

---

## [0.6.1] - 2026-04-18

### 改进

- UI 渲染与交互细节优化
- 业务逻辑完善

## [0.6.0] - 2026-04-18

### 改进

- UI 与业务逻辑迭代优化
- 数据存储层稳定性提升

## [0.5.3] - 2026-04-18

### 改进

- 持续迭代优化，业务逻辑调整

## [0.5.2] - 2026-04-18

### 改进

- 持续迭代优化，UI 细节调整

## [0.5.1] - 2026-04-18

### 新增

- `scripts/package-for-store.sh` Chrome 商店打包脚本

## [0.5.0] - 2026-04-18

### 新增

- `shared/background.ts` + `background.js` — Chrome Service Worker 后台脚本
- `shared/chrome.d.ts` — Chrome API TypeScript 类型声明
- UI 预览图

## [0.4.1] - 2026-04-18

### 新增

- `shared/chrome.d.ts` Chrome API TypeScript 类型声明

## [0.4.0] - 2026-04-18

### 新增

- UI 预览图

---

## [0.3.1] - 2026-04-17

### 新增

- `shared/entry.ts` 打包入口
- `.npmrc.json` 配置

### 变更

- 从 pnpm 切换到 npm

## [0.3.0] - 2026-04-17

### 变更（重大重构）

- **架构重构**：放弃 Vite + Node.js 服务端架构，转为纯 Chrome 扩展项目
- 移除 `server/`、`src/`、`vite.config.ts`
- 项目目录扁平化

### 新增

- AI Agent 协作文件：`PROMPT.md`、`NEXT_AGENT_PROMPT.txt`、`AGENTS.md`
- `PRD.md` 产品需求文档

---

## [0.2.1] - 2026-04-16

### 新增

- `scripts/bundle.mjs` 打包脚本

## [0.2.0] - 2026-04-16

### 新增

- `chrome-extension-loadable/` 目录，构建产物可直接加载到 Chrome

---

## [0.1.3] - 2026-04-16

### 改进

- 持续微调优化

## [0.1.2] - 2026-04-16

### 改进

- 清理冗余的 HTML/JS 重复文件和 SVG 图标源文件

## [0.1.1] - 2026-04-16

### 改进

- 基础微调

## [0.1.0] - 2026-04-16

### 新增

- 项目初始化：Vite + Node.js 服务端架构
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
v0.6.x      功能完善 — UI/逻辑持续优化
    ↓
v1.0.0      正式发布 — 数据同步 + 迁移工具 + 开源
```

---

*格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。*