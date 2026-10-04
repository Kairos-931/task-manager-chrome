# 开放事项

## 新设备云端恢复失败（P1）

已登录 Chrome/Cloudflare 账号的新电脑，TaskMaster 仍缺少产品 API 连接配置；“从云端拉取”未恢复已有任务，且按钮实际可能同时上传本地变更。要求提供产品内认证/恢复引导、明确失败反馈与只读拉取语义。详见 [BUG-20260930-new-device-cloud-recovery.md](requirements/BUG-20260930-new-device-cloud-recovery.md)。状态：待修复，未进入开发；实现前关联独立 GitHub Issue。

## 同步协议后续优化

当前增量同步已保护记录级写入、删除和手机导入。仍有两项刻意保留的后续工作：

1. **任务字段级合并**：两台设备同时修改同一任务的不同字段时，当前仍采用确定性的“最后修改优先”。后续应保存每个字段的版本，并在同一字段被同时修改时给出清晰的解决方式。
2. **安全的历史清理**：`sync_changes` 和删除墓碑会保留，避免长期离线的设备复活已删除数据。清理前必须增加设备确认记录和不活跃设备保留策略；按时间直接删除历史会有数据复活风险。

跟踪 Issue：[GitHub Issue #16](https://github.com/Kairos-931/task-manager-chrome/issues/16)。本文件保留产品上下文，确保不依赖 GitHub 时也能继续处理。

## 手机添加保存反馈（2026-10-02）

用户确认手机新增可同步到电脑，但缺少清晰保存成功/失败反馈。已记录 docs/requirements/REQ-20261002-mobile-save-feedback.md，暂未进入开发；实施前关联独立Issue。


## 移除手机管理员旧版入口（2026-10-02）

用户要求记录移除管理员旧版入口及旧手机连接设置页面，后台旧API/Telegram暂保留。需求：docs/requirements/REQ-20261002-remove-mobile-legacy-entry.md；仅记录，未批准实现。

