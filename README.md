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
- **数据同步** — 通过 chrome.storage.sync 跨设备同步，chrome.storage.local 本地兜底防丢失
- **同步管理面板** — 手动上传到云端、从云端拉取、导出文件、导入文件
- **冲突合并** — 多设备离线编辑时按时间戳自动合并，两端修改不丢失
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
| chrome.storage.sync | 跨设备数据同步 |
| chrome.storage.local | 本地数据备份 |

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
├── chrome-extension-sync/     # 可直接加载的构建产物（推荐）
├── popup/                     # 弹窗入口 HTML
├── newtab/                    # 全屏管理页入口 HTML
├── styles/                    # Tailwind CSS 源文件
├── icons/                     # 插件图标（16/48/128px）
└── scripts/                   # 构建脚本
```

## 数据同步说明

插件使用 `chrome.storage.sync` 实现跨设备数据同步，配合 `chrome.storage.local` 作为本地备份：

- **自动同步**：添加、编辑、删除任务后自动同步到同一 Chrome 账号的其他设备
- **本地备份**：每次保存同时写入本地存储，防止因其他设备卸载插件导致数据丢失
- **自动恢复**：检测到 sync 数据被清空时，自动从本地备份恢复

**注意事项**：
- 所有用户共享同一个 Extension ID（manifest 中的 `"key"` 字段确保），无需手动检查
- 需要登录同一个 Chrome 账号并开启同步
- 国内使用需要 VPN，且需确保 Google 同步域名走代理（详见下方 FAQ）
- `chrome.storage.sync` 总容量限制为 100KB，任务数据采用分块存储突破单条 8KB 限制
- 建议定期使用"导出数据"功能备份重要数据

## 常见问题

### 跨设备同步不生效（控制台显示 "local和sync都为空"）

**排查步骤：**

1. **确认 Chrome 同步已开启** — `chrome://settings/syncSetup` 确认已登录同一 Google 账号且同步开关打开
2. **检查同步引擎状态** — 打开 `chrome://sync-internals/`，查看顶部 Summary：
   - `Server Connection` 应无报错（如有 `auth error` 说明同步认证失败）
   - `Updates Downloaded` / `Successful Commits` 应大于 0
3. **国内用户：确认 VPN 覆盖 Google 同步域名** — Chrome 同步使用 `clients4.google.com`，普通 VPN 规则可能未包含此域名。解决方法：
   - **推荐**：开启 Clash 的 TUN 模式，所有流量自动走代理
   - 或在 Clash Merge 配置中添加规则：`DOMAIN-SUFFIX,google.com,你的代理组名`
4. **修改后等待** — 数据变更后同步通常需要 1-3 分钟生效

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

本项目经历了 20+ 个版本的迭代，从 Vite 全栈架构逐步演化为纯 Chrome 扩展，v1.2.0 实现了统一存储架构、同步管理面板和多设备冲突合并。

## 许可证

[MIT](LICENSE)