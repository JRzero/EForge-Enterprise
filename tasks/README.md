# 迭代任务索引

已完成：[可视化流程设计器](workflow-designer.md)（done，2026-10-11），[规格](../spec/workflow-designer.md)。包含界面优化与新增独立页签；精确实现 7235812 的服务器四项、前端和技能检查全部成功，已获用户授权合并 main。

流程规则：[Agent 工作流](../docs/agent-workflow.md)。每轮使用一个 `tasks/<initiative>.md` 同时管理计划、依赖和执行状态，模板为 `_template.md`。

已完成：[Flowable 集成](flowable-integration.md)（done，2026-10-10），[规格](../spec/flowable-integration.md)。精确实现 e7cfae4 的服务器四项及前端云端全部成功；后续扩展与生产部署不在本次完成声明内。
已完成：Agent Skills 安装与项目配置；25 个 Skill、40 个上游文件哈希及 24 个共享参考路径本地校验通过。此记录不代表模型行为评测通过。
官方 Starter、真实事务/审批闭环、配置维护、共享 UI、Agent 入口及失败作业恢复均已有实际验收，证据见任务文件。表单构建器继续暂缓。

接续时检查当前 Git 状态、关联规格、任务证据和仍在运行的验证进程。不能仅按历史摘要将任务标为完成。
