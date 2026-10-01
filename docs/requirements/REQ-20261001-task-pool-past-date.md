# 任务排期统一允许过去日期

- Status: in_development
- Revision: 2026-10-01-r2
- Product confirmation: 用户回复“没错”
- GitHub Issue: [#63 feat: allow past dates for task scheduling](https://github.com/Kairos-931/task-manager-chrome/issues/63)
- Priority: normal

## PRD 摘要

目标：补安排历史任务时不被日期下限阻止。
用户：使用任意任务排期入口的用户。
核心功能：安排时间中的自选日期支持任意合法过去日期，包含超过 7 天以前的日期。
视觉风格：沿用现有安排时间弹窗与日期输入，不新增界面。
约束：不按任务类型或来源区分，所有现有排期入口统一允许过去日期；界面文字、按钮、标签、说明保持原样，不新增解释文案。
竞品参考：原生日期选择器的任意合法日期输入能力；不新增竞品功能。

## 范围与用户流程

任务池点击安排时间 → 使用原有快捷日期或“7 天以外的日期”自选日期 → 选择过去日期 → 保存 → 按所选日期展示，沿用现有过期任务规则。
快捷日期与界面文案保持原样。支持普通任务、特殊任务、任务池任务及所有已有排期入口。重复任务仍保留既有重复规则和日期间关系校验，只移除早于今天的限制；不改变完成状态、同步机制、物理迁移或导出。

## 状态与边界

过去日期不报错、不禁用确认、不被改成今天；空日期或非法日期继续拒绝并提示选择合法日期。取消不修改任务。保存失败沿用现有错误处理且不报告成功。使用本地年月日，不用 UTC 转换。

## 验收

1. 所有支持排期的任务类型和入口可安排到昨天、8 天以前、跨月或跨年的合法过去日期，不按普通/特殊/任务池分类限制。
2. 保存后日期精确匹配所选值，重开扩展仍保留，按既有规则展示为过期任务。
3. 空/非法日期不能提交，取消不改数据。
4. 今天、未来日期与快捷日期行为保持现状。
5. Popup 与新标签页中的所有既有排期入口遵守同一规则；界面文字保持不变，不新增“应该哪天完成”等说明。

## 技术定位与交付

shared/render.ts 的 replanDate 设有 min=today；shared/events.ts 还存在按钮禁用、日期错误提示和提交校验。必须同时检查真正的保存逻辑，不能只移除 HTML 下限。实现以最新目录为准，通过 npm run build 生成扩展产物、重载扩展生效，无需 Worker 部署。
验证：日期边界、持久化及共享入口回归的行为测试，加项目 typecheck/lint/test/build。不调用桌面控制；视觉和真实原生日期选择器验收未验证。

## Development execution profile

- Assessment status: approved
- Recommended model: gpt-6-luna
- Recommended reasoning effort: max（沿用项目策略）
- Lower-cost alternative: gpt-6-luna / high；范围小可节省推理用量，但共享校验需仔细回归。
- Engineering effort: small; 约 0.5–2 小时工作量，不是交付时间保证。
- AI usage: 粗估 10k–40k tokens，不等于订阅扣费；不含发布和人工验收。
- Confidence: medium; 已定位三个阻止过去日期的校验与共享弹窗，需进一步核对保存层。
- Escalation: 若需要改变重复规则、完成语义或同步行为，返回产品确认。
- Execution: 单开发者串行，不使用并行代理；沿用最新 checkout，保护已有改动，开发前确认分支与工作树，不为此复制整个项目。
- Integration/review: 开发对话负责最终 diff 审查及项目验证；不自动 push/部署。
- Delivery state: delivered 2026-10-01; user explicitly confirms idle developer and authorizes start.
- Runtime: messaging 支持单次 model/thinking 覆盖。
- Selected option: 0; approved model gpt-6-luna; approved reasoning max; approved date 2026-10-01

- Queued date: 2026-10-01
- Waiting behind: none; user authorized start 2026-10-01.
- Dispatch: successful 2026-10-01; gpt-6-luna / max.



## 2026-10-01 用户范围纠正（r2，优先于早期交付摘要）

用户明确要求：不区分普通任务、特殊任务、任务池任务，任务排期允许过去日期；界面文字保持不变。本次是已交付需求的范围纠正，沿用已获批 gpt-6-luna / max、串行和非视觉验证边界。开发补查所有现有排期入口的日期下限，补齐各任务类型验证；不得将过期任务自动视为完成。更新现有 Issue #63 范围，避免另建同目标事项。工作量暂估 1–3 小时、15k–60k tokens，非预算承诺；如发现涉及重复规则或数据语义改变，先返回产品侧。


- Developer reassigned by user 2026-10-01: codex://threads/01a0f6ce-2b91-7343-bb37-1b3f5d3d467a; r2 delivered in creation prompt; old developer instructed to stop.
