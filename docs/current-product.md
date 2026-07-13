# TaskMaster 当前产品说明

> 更新日期：2026-07-13 | 当前扩展版本：3.10.0

## 产品目标

TaskMaster 是用于快速安排日常任务和追踪长期执行节奏的 Chrome 任务管理工具。它提供弹窗与新标签页两种使用方式，并通过 Cloudflare Worker 支持手机快速添加和跨设备数据收敛。

## 当前能力

- 列表、日、周、月视图与任务池；支持优先级、分类、截止日期、时长、重复和完成状态管理。
- 每周目标追踪，展示期望时长、已完成时长、执行节奏和差距。
- 添加或编辑任务时提供未来七天快捷日期选择。
- 手机快速添加页支持分类、时长、无截止日期和已完成；Worker 继续支持 Telegram 录入。
- 任务、分类和设置采用离线优先的增量同步；删除会留下墓碑，旧设备不会重新创建已删除任务。
- 提供本地备份、导入导出，并明确区分“已保存到本机”和“已确认同步到云端”。

## 当前架构

| 层级 | 源码 | 生效方式 |
| --- | --- | --- |
| Chrome 扩展 | `shared/*.ts` | `npm run build`，再重载 `chrome-extension-sync/` |
| 手机快速添加 | `backend/index.js` 的 `MOBILE_HTML` | 部署 Cloudflare Worker |
| 同步 API | `backend/index.js` + D1 | 同一次 Worker 部署 |
| 数据协议 | `sync_records` / `sync_changes` | 按记录变更与服务端游标同步 |

## 权威记录

- 面向用户的变更：[CHANGELOG.md](../CHANGELOG.md)
- 发布版本与 Issue 对应关系：[release-history.md](release-history.md)
- 未完成工程事项：[open-issues.md](open-issues.md)
- 历史产品快照：[PRD.md](PRD.md)

## 已知边界

同一任务的不同字段被两台设备同时修改时，当前采用整条记录的“最后修改优先”。同步历史的安全清理也需要先实现设备确认记录。这两项均由 GitHub Issue #16 跟踪。
