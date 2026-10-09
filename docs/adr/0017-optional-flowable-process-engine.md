# ADR 0017：可选的 Flowable Process 引擎

状态：Accepted（用户于 2026-10-09 明确授权集成；兼容性与交付状态见任务清单）。

采用官方 7.2.0 Process Starter 嵌入现有模块化单体，保留 Java 17 / Spring Boot 3.5 基线。通过独立模块隔离 Flowable 类型；业务接口不依赖引擎实体。默认禁用、显式数据库运维、不自动部署，复用当前身份体系及同一 Spring 事务。

理由：用户提出审批与 Agent 配置维护的明确产品需求，满足 AGENTS 架构规则 17。官方引擎负责流程、任务、历史与执行；框架仅实现业务绑定、权限、版本发布与共享 UI。不复制引擎、不引入微服务或 MQ。

后果：新增数据库 schema 生命周期与引擎升级回归责任；事务、受限 BPMN、实例访问权及发布权限须有真实验证。生产发布和实例迁移不由普通开发授权隐式开启。

依据：https://github.com/flowable/flowable-engine/releases/tag/flowable-7.2.0
规格：`spec/flowable-integration.md`；任务：`tasks/flowable-integration.md`。
