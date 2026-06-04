#!/bin/bash
# Batch create GitHub issues for TaskMaster
# Usage: bash scripts/create-issues.sh

REPO="Kairos-931/task-manager-chrome"
CD="C:/chromeextence_my/task-manager-chrome"

create_and_close() {
  local title="$1"
  local body="$2"
  local labels="$3"
  echo "Creating (closed): $title"
  gh issue create -R "$REPO" -t "$title" -b "$body" -l "$labels" 2>&1
  # get the issue number from output and close it
}

create_open() {
  local title="$1"
  local body="$2"
  local labels="$3"
  echo "Creating (open): $title"
  gh issue create -R "$REPO" -t "$title" -b "$body" -l "$labels" 2>&1
}

close_latest() {
  # Close the most recently created issue
  local last=$(gh issue list -R "$REPO" -L 1 --json number -q '.[0].number' 2>&1)
  if [ "$last" != "null" ] && [ -n "$last" ]; then
    echo "Closing issue #$last"
    gh issue close "$last" -R "$REPO" 2>&1
  fi
}

cd "$CD"

# ============================================================
# PART 1: Retrospective issues (create then close)
# ============================================================

echo "=== Creating retrospective issues ==="

# --- Milestone: v1.0 MVP ---
create_and_close "v1.0 MVP: 核心任务管理" "$(cat <<'BODY'
## 概述
实现 TaskMaster 的核心功能，作为 MVP 版本发布。

## 功能清单
- 任务 CRUD（创建、编辑、删除、完成切换）
- 列表/日/周/月四种视图
- 优先级（高/中/低）+ 分类系统
- 截止日期 + 预计时长
- 任务池（无截止日期任务）
- 重复任务（每天/每周/每月/工作日/自定义间隔）
- 深色模式
- 过滤筛选（优先级、分类、隐藏已完成、隐藏过期）
- Popup + New Tab 双入口

## 关键文件
- shared/task.ts, shared/render.ts, shared/events.ts
BODY
)" "completed"

close_latest

# --- v1.2.0: Sync ---
create_and_close "v1.2.0: chrome.storage.sync 跨设备同步" "$(cat <<'BODY'
## 概述
实现基于 chrome.storage.sync 的跨设备数据同步，突破 8KB 限制。

## 技术方案
- **分块存储**：每 chunk ≤ 7KB，动态拆分/合并
- **三级回退加载**：chunked sync → old simple key → local backup → 默认数据
- **自动备份**：sync 加载成功后写入 chrome.storage.local
- **远端监听**：`chrome.storage.onChanged` 检测变更 → 自动 merge
- **冲突策略**：基于 `updatedAt` 的 last-write-wins
- **手动同步面板**：四宫格 UI（上传/下载/导出/导入 JSON）

## 关键文件
- shared/storage.ts, shared/sync.ts
BODY
)" "completed"

close_latest

# --- v3.1.1: Mobile ---
create_and_close "v3.1.1: 手机端任务添加（Web + Telegram Bot）" "$(cat <<'BODY'
## 概述
集成 Cloudflare Worker 后端，支持从手机添加任务到 Chrome 插件。

## 功能
- **手机网页**：极简表单，可添加到手机主屏幕，体验接近原生 App
- **Telegram Bot**：发消息即可创建任务，支持中文自然语言解析
  - `买牛奶` → 标题，今天
  - `明天 高 完成报告` → 高优先级，明天
  - `#工作 后天 低 准备演示` → 分类+优先级+日期
- **自动同步**：打开插件时自动拉取，每 5 分钟后台同步
- **设置面板**：New Tab 头部手机图标 → API 地址 + 密钥配置

## 后端
- Cloudflare Workers + D1 数据库
- RESTful API：GET/POST tasks, GET/POST settings
- Telegram Bot Webhook

## 关键文件
- background.js (sync logic), Worker 端 API
BODY
)" "completed"

close_latest

# ============================================================
# PART 2: Open issues (feature requests & improvements)
# ============================================================

echo ""
echo "=== Creating open issues ==="

# --- Feature: 拖拽设置日期 ---
create_open "周/月视图支持从任务池拖拽设置日期" "$(cat <<'BODY'
## 需求
在周视图和月视图下，能把任务池中的「无截止日期」任务拖拽到具体日期，快速为其设定截止日期。

## 当前行为
任务池任务只能在列表视图中手动编辑设置日期，周/月视图看不到任务池。

## 预期行为
- 周视图/月视图底部固定显示任务池任务区域
- 任务池任务可拖拽到任意日期格子
- 放下后自动清除「无时间限制」标记，设置对应日期

## 涉及文件
- shared/render.ts（周/月视图渲染）
- shared/events.ts（拖拽逻辑）
BODY
)" "feature"

# --- Feature: 双击编辑 ---
create_open "所有视图支持双击任务进入编辑" "$(cat <<'BODY'
## 需求
在所有视图（列表/日/周/月）中，双击任务即可打开编辑弹窗，减少操作步骤。

## 当前状态
- 周视图 `.week-task-item`：✅ 已支持
- 月视图 `.month-task-item`：✅ 已支持
- 列表视图任务项：❌ 不支持（需点击编辑按钮）
- 日视图：❌ 不支持

## 实现方案
为所有 `data-task-id` 元素统一添加 dblclick 事件监听，触发与编辑按钮相同的逻辑。

## 关联
- PRD 3.1 节：编辑任务的优化路径
BODY
)" "UX"

# --- Feature: 任务提醒 ---
create_open "任务到期提醒通知" "$(cat <<'BODY'
## 需求
任务到期前或到期时推送浏览器通知，避免用户遗忘。

## 功能设计
- **提醒时间**：支持「到期当天」「提前 1 天」「提前 1 小时」「自定义」
- **通知方式**：Chrome Notification API
- **免打扰**：已完成任务不触发通知
- **权限管理**：首次使用时请求通知权限

## 技术要点
- 使用 `chrome.alarms` API 设置定时提醒（已有权限）
- background.js 中监听 alarm 触发通知
- 任务编辑弹窗新增「提醒设置」区域

## 关联
- PRD 10.1 未来规划：任务提醒功能
BODY
)" "feature"

# --- Enhancement: 键盘快捷键 ---
create_open "键盘快捷键支持" "$(cat <<'BODY'
## 需求
支持常用键盘快捷键，提高高频用户的操作效率。

## 快捷键方案
| 快捷键 | 功能 |
|--------|------|
| `N` | 新建任务 |
| `E` | 编辑选中任务 |
| `Space` | 切换完成状态 |
| `D` / `Delete` | 删除任务 |
| `1/2/3/4` | 切换列表/日/周/月视图 |
| `Esc` | 关闭弹窗 |
| `J/K` | 上下选择任务 |
| `/` | 聚焦筛选器 |

## 注意事项
- 输入框聚焦时不应触发快捷键
- 首次使用时显示快捷键提示

## 关联
- PRD 10.2：添加键盘快捷键支持
BODY
)" "enhancement,UX"

# --- Feature: 批量操作 ---
create_open "任务批量操作" "$(cat <<'BODY'
## 需求
支持多选任务后批量操作，减少重复操作。

## 功能范围
- **多选**：Shift+点击范围选择，Ctrl+点击逐个选择
- **批量完成**：一键标记多个任务为完成
- **批量删除**：一键删除多个任务
- **批量修改**：批量设置优先级、分类、截止日期
- **全选/反选**：筛选结果的全选和反选

## UI 方案
- 任务项左侧出现复选框（进入批量模式）
- 底部浮动操作栏：显示已选数量 + 操作按钮
- 按 `Esc` 退出批量模式

## 关联
- PRD 10.2：实现任务批量操作
BODY
)" "feature"

# --- Enhancement: 任务标签 ---
create_open "任务标签系统" "$(cat <<'BODY'
## 需求
除分类外，支持为任务添加多个标签，提供更灵活的维度管理。

## 功能设计
- **标签管理**：创建/删除/重命名标签，每个标签有颜色
- **任务关联**：一个任务可以有多个标签
- **筛选支持**：按标签筛选任务
- **标签视图**：按标签分组查看任务

## 与分类的区别
| 维度 | 分类 | 标签 |
|------|------|------|
| 数量 | 一个任务一个分类 | 一个任务多个标签 |
| 性质 | 结构化组织 | 灵活标记 |
| 典型场景 | 工作/生活/学习 | 紧急、等待中、需协作 |

## 关联
- PRD 10.1：支持任务标签
BODY
)" "feature"

# --- Enhancement: 移动端适配优化 ---
create_open "移动端（Chrome Android）交互优化" "$(cat <<'BODY'
## 当前问题
- Popup 在手机上布局拥挤，按钮过小
- 周视图/月视图在窄屏下信息密度过高
- 触摸操作偶尔误触（如拖拽和滚动冲突）

## 优化方向
- **响应式断点**：针对 < 400px 宽度优化 Popup
- **触摸友好**：增大点击区域，最小 44px
- **手势支持**：左滑删除，右滑完成
- **视图适配**：移动端默认列表视图，周/月视图简化展示
- **底部导航**：移动端用底部 Tab 替代顶部按钮

## 关联
- PRD 10.2：优化移动端适配
BODY
)" "enhancement,UX"

# --- Infra: 自定义域名 ---
create_open "后端绑定自定义域名（解决 workers.dev 国内访问问题）" "$(cat <<'BODY'
## 问题
Cloudflare Workers 默认域名 `workers.dev` 在国内需要 VPN 才能访问，导致手机同步功能在国内无法使用。

## 方案
1. **绑定自定义域名**：在 Cloudflare 控制台将自有域名路由到 Worker
2. **备选**：使用国内云函数（如腾讯云 SCF、阿里云 FC）部署后端

## 影响
- 解决后，国内用户无需 VPN 即可使用手机同步和 Telegram Bot

## 当前状态
- Worker URL: `https://taskmaster-api.yx9391.workers.dev`
- 已在 memory 中标记为「待解决」
BODY
)" "infra"

# --- Enhancement: 统计分析 ---
create_open "任务统计与分析面板" "$(cat <<'BODY'
## 需求
提供更丰富的任务统计数据，帮助用户回顾和改进时间管理。

## 统计维度
- **完成趋势**：过去 7/30 天的每日完成任务数折线图
- **分类分布**：各分类任务占比（饼图）
- **优先级分布**：高/中/低优先级任务比例
- **逾期分析**：逾期任务数量和平均逾期天数趋势
- **效率指标**：预计时长 vs 实际完成情况

## UI 方案
- 新增「统计」视图（与列表/日/周/月并列）
- 或在 New Tab 顶部统计区可展开详情

## 关联
- PRD 10.1：添加任务统计和分析功能
BODY
)" "feature"

# --- Enhancement: 数据安全 ---
create_open "数据安全增强" "$(cat <<'BODY'
## 需求
加强数据安全机制，防止数据丢失。

## 改进项
- **自动备份提醒**：超过 N 天未备份时提示用户
- **版本历史**：保留最近 N 次数据快照，支持回滚
- **同步冲突日志**：记录合并被覆盖的任务，允许用户恢复
- **卸载保护**：卸载前强制提示导出备份（或在 background.js 中拦截）

## 当前机制
- chrome.storage.local 自动备份
- 手动导出/导入 JSON

## 风险
- chrome.storage.sync 被清空时已有回写保护
- 卸载扩展会清空所有 storage，数据不可恢复
BODY
)" "enhancement"

echo ""
echo "=== Done ==="
