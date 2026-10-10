# 可视化设计器实施

状态：in_progress。规格：[workflow-designer](../spec/workflow-designer.md)。沿用已授权开发/验证/普通提交推送，不部署生产。

| 阶段 | 验收 | 状态 |
|---|---|---|
| D01 | 安全布局元数据与官方建模库固定版本 | done |
| D02 | 真实画布、受限节点、属性、撤销/重做与源码往返 | done |
| D03 | 草稿集成、保护与响应式/键盘交互 | done |
| D04 | 实际引擎执行、全量前后端与精确云端验收 | in_progress |

依据：[官方模型扩展](https://github.com/bpmn-io/bpmn-js-example-model-extension)、[官方建模器机制](https://bpmn.io/toolkit/bpmn-js/walkthrough/)。当前原引擎规则拒绝所有 DI 与 incoming/outgoing，必须用定向安全测试证明仅放开惰性图形数据。

本地证据：designer-di-red/green.log（16 定向测试，正例修复前失败）；designer-full-maven.log（完整构建成功）；designer-units.log（130 单元）；designer-all-browser.log（221 浏览器）。真实引擎首轮实际画布审批/拒绝/撤回成功，但另一个浏览器捕获关闭时零尺寸缩放错误，已加 ResizeObserver 尺寸保护；designer-resize-browser.log 最终 9 项通过。两配置真实回归及精确云端仍待验收，不能把首轮 3/4 当作通过。

架构：[ADR 0019](../docs/adr/0019-bounded-bpmn-visual-designer.md)；[安全审查](../docs/security-review-workflow-designer.md)；[使用说明](../docs/workflow-designer-guide.md)。
