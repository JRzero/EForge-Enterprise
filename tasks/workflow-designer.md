# 可视化设计器实施

状态：done，2026-10-10。规格：[workflow-designer](../spec/workflow-designer.md)。实现已提交推送，不部署生产。

| 阶段 | 验收 | 状态 |
|---|---|---|
| D01 | 安全布局元数据与官方建模库固定版本 | done |
| D02 | 真实画布、受限节点、属性、撤销/重做与源码往返 | done |
| D03 | 草稿集成、保护与响应式/键盘交互 | done |
| D04 | 实际引擎执行、全量前后端与精确云端验收 | done |

依据：[官方模型扩展](https://github.com/bpmn-io/bpmn-js-example-model-extension)、[官方建模器机制](https://bpmn.io/toolkit/bpmn-js/walkthrough/)。定向安全测试证明仅放开惰性 DI 与标准 incoming/outgoing 引用，执行节点白名单不变。

精确实现 `a72e602b37c63f8127cdd136ddbfaa2ee8dd83bb`：[服务器 38054399126](https://github.com/JRzero/EForge-Enterprise/actions/runs/38054399126) 四项全部成功，[前端 38054399118](https://github.com/JRzero/EForge-Enterprise/actions/runs/38054399118) 成功，技能检查 38054399120 成功。直接证据为 designer-cloud-server-final.log / designer-cloud-web-final.log。

验收结果：902 后端测试声明（23 framework + 47 workflow + 832 boot，11 个环境条件跳过由独立真实数据库任务覆盖）；130 前端单元、221 模拟接口真实浏览器；两配置各 68 真实环境浏览器与完整 API、生成 CRUD/tree/sub 模块及 React 页面回归通过。画布生成的 XML 实际保存、校验、发布、激活，并在独立审批人会话中完成批准/拒绝/撤回及权限撤回验证。

本地证据：designer-di-red/green.log（16 定向安全测试，正例修复前失败）；designer-full-maven.log；designer-units.log；designer-all-browser.log。零尺寸缩放、外部标签误用标识的实际失败均已修复，designer-label-green.log 最终 9 项通过，包含 `${approver}` 兼容。顺序 session 68340 两配置完整 API/各 4 项工作流浏览器终态 0，最终源码仍以以上精确云端证据为准。

两配置实时 OpenAPI 与契约 SHA-256：`3D7FC784F8576A602E8965C07A0CD0C1B6215C0E93750FE07B5E29238AE15F0C`。无新 API 或数据库迁移。代码位于 `codex/flowable-integration`，本任务未合并 main，未重启原本地预览服务。表单构建器仍暂缓；复杂会签与实例迁移不在本次范围。

架构：[ADR 0019](../docs/adr/0019-bounded-bpmn-visual-designer.md)；[安全审查](../docs/security-review-workflow-designer.md)；[使用说明](../docs/workflow-designer-guide.md)。

## 配置界面易用性调整（2026-10-11，本地验收完成，云端待验）

- 有效的受支持模型默认打开画布；旧的无效或不支持模型保留源码修复入口，不覆盖原文。
- 桌面按节点工具、画布、属性分区；窄屏工具换行、属性纵向显示。沿用现有 EForge 控件和主题。
- 审批场景 JSON 与异步执行设置默认折叠，补充用途说明；保存操作保持可见。
- 范围为现有能力的交互整理，无 API、权限、引擎或依赖变化。人员/角色选择器尚未实现，不能把提示优化描述为可视化选人。
- 验证：lint/typecheck、130 单元、生成客户端可复现、构建通过；最终 9 项模拟接口浏览器回归通过，含画布默认入口、折叠场景原值、源码往返、真实拖动、冲突保留和 320/768/1024/1440 尺寸。截图 `web/test-results/designer-guided.png`、`designer-*.png` 已检查。
- 本轮仅前端交互/样式调整，未重跑 Maven 或真实 MySQL/Redis 全量回归，后端沿用已验收版本且不重打运行中的 jar。两个真实环境测试入口已适配默认画布，但本轮未执行；不能将上一版真实环境证据描述为本版重验。构建仍有既有大分包提示，设计器保留懒加载。无后端/API/权限变化，云端状态单独核对。
