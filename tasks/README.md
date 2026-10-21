# 迭代任务索引

2026-10-21：已将验收工作分支以快进方式合并到 main 并推送（11e9c6f），下文“未合并”均为阶段历史记录。统一 Windows 本地服务管理已实现并实测启动/重复启动/停止/重启、端口冲突与 PID 身份保护，见 [本地开发指南](../docs/local-development.md)。真实业务示例、生产部署与升级演练仍为后续建议，未标记完成。

已完成：[框架可靠性与组件契约](framework-hardening.md)（done，2026-10-19），[规格](../spec/framework-hardening.md)、[最终验收](../docs/framework-hardening-final-audit.md)。H01–H13全部验收，最终后端9f6ae55的server39152321902四作业及技能检查成功；前端保持已验收c76c1cb源码。已推送工作分支，尚未合并main；表单构建器仍暂缓。

已完成：[公共组件与页面模板抽象](shared-ui-abstraction.md)（done，2026-10-13），[规格](../spec/shared-ui-abstraction.md)、[验收](../docs/shared-ui-completion-audit.md)。完整组件及五类模板已接入实际消费者和示例；精确46da40a云端全绿，本地两配置各68真实浏览器及完整API通过，尚未合并main。

组件样式：[页签与下拉细节](component-details.md)，已完成公共页签与单选下拉的本地验证；截图多选组件未覆盖，详见范围说明。

已完成：[紧凑列表布局](compact-list-layout.md)（done，2026-10-12），[规格](../spec/compact-list-layout.md)。共享筛选折叠、间距与分页布局优化；131 项单元和最终 34 项相关浏览器复验通过，完整验证边界见任务记录。

已完成：[可视化流程设计器](workflow-designer.md)（done，2026-10-11），[规格](../spec/workflow-designer.md)。包含界面优化与新增独立页签；精确实现 7235812 的服务器四项、前端和技能检查全部成功，已获用户授权合并 main。

流程规则：[Agent 工作流](../docs/agent-workflow.md)。每轮使用一个 `tasks/<initiative>.md` 同时管理计划、依赖和执行状态，模板为 `_template.md`。

已完成：[Flowable 集成](flowable-integration.md)（done，2026-10-10），[规格](../spec/flowable-integration.md)。精确实现 e7cfae4 的服务器四项及前端云端全部成功；后续扩展与生产部署不在本次完成声明内。
已完成：Agent Skills 安装与项目配置；25 个 Skill、40 个上游文件哈希及 24 个共享参考路径本地校验通过。此记录不代表模型行为评测通过。
官方 Starter、真实事务/审批闭环、配置维护、共享 UI、Agent 入口及失败作业恢复均已有实际验收，证据见任务文件。表单构建器继续暂缓。

接续时检查当前 Git 状态、关联规格、任务证据和仍在运行的验证进程。不能仅按历史摘要将任务标为完成。
