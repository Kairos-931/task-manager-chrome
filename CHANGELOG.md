# 更新日志

所有重要的项目变更都记录在此文件中。

本项目使用 AI 编程助手（Coze / Claude）迭代开发，通过快照存档保存每个版本。

---

## [1.0.0] - 2026-04-18

### 插件18（最终发布版）

项目从 `task-manager` 重构为 `task-manager-fixed`，新增跨设备数据同步、艾森豪威尔矩阵迁移、GitHub 开源发布等功能。

#### 新增功能

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

#### 改进

- 简化安装流程：直接加载 `chrome-extension-sync/` 文件夹即可使用
- 构建系统优化，使用 esbuild 打包生成单个 JS 文件
- 增强导入数据格式验证

---

## 迭代开发历史

### 阶段一：初始开发（插件01 ~ 07）

基于 Vite + Node.js 全栈架构开发 Chrome 扩展。

| 版本 | 变更说明 |
|------|---------|
| **插件01** | 项目初始化：Vite + Node.js 服务端架构，TypeScript + Tailwind CSS + pnpm；包含 popup、newtab、shared 模块，服务端（server/）和 Web 前端（src/） |
| **插件02** | 基础微调 |
| **插件04** | 清理冗余：移除根目录下重复的 HTML/JS 文件和 SVG 图标源文件 |
| **插件05** | 持续微调优化 |
| **插件06** | 新增 `chrome-extension-loadable/` 目录，构建产物可直接加载到 Chrome |
| **插件07** | 新增 `scripts/bundle.mjs` 打包脚本，移除旧的 `generate-icons.mjs` |

### 阶段二：架构重构（插件08 ~ 09）

放弃 Vite 服务端架构，转为纯 Chrome 扩展项目。

| 版本 | 变更说明 |
|------|---------|
| **插件08** | **重大重构**：移除 server/、src/、vite.config.ts，项目目录扁平化；引入 AI Agent 协作文件（PROMPT.md、NEXT_AGENT_PROMPT.txt、AGENTS.md）；新增 PRD.md 产品需求文档 |
| **插件09** | 新增 `shared/entry.ts` 打包入口；移除 pnpm 切换到 npm；新增 `.npmrc.json` |

### 阶段三：功能完善（插件10 ~ 17）

逐步添加核心功能，文件结构趋于稳定。

| 版本 | 变更说明 |
|------|---------|
| **插件10** | 新增 UI 预览图（image.png） |
| **插件11** | 新增 `shared/chrome.d.ts` Chrome API TypeScript 类型声明 |
| **插件12** | **新增后台脚本** `background.js` + `shared/background.ts`（Chrome Service Worker） |
| **插件13** | 新增 `scripts/package-for-store.sh` Chrome 商店打包脚本 |
| **插件14 ~ 17** | 持续迭代优化，主要修改业务逻辑和 UI 细节 |

### 阶段四：最终发布（插件18）

在 `task-manager` 基础上重构为 `task-manager-fixed`，解决数据同步和安全性问题，准备开源发布。

---

## 功能演进全景

```
插件01~07  基础框架 → Vite全栈 → Chrome扩展 → 可构建加载
    ↓
插件08~09  架构重构 → 去掉服务端 → 纯扩展项目 → npm切换
    ↓
插件10~12  核心功能 → 类型声明 → 后台脚本(Service Worker)
    ↓
插件13~17  功能完善 → 商店打包 → UI/逻辑持续优化
    ↓
插件18     最终发布 → 数据同步 → 数据迁移 → 开源准备
```

## 相关资源

| 文件 | 说明 |
|------|------|
| `前端版本/task_management.html` | 早期纯 HTML 单文件实现（785行） |
| `艾森豪威尔矩阵备份_2026-04-16.json` | 旧系统数据导出 |
| `task-manager-backup-2026-04-18*.json` | 最终版数据备份（共3份） |

---

*格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。*