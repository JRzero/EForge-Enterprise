# Flowable 集成规格

状态：agreed；2026-10-09 用户明确要求继续并完成集成开发。
任务：[实施与证据](../tasks/flowable-integration.md)。授权包含开发、验证及日常提交推送，不包含生产发布或破坏业务数据。

## 目标与结构

在现有模块化单体中集成官方 Process Starter。`eforge-workflow-api` 提供不依赖 Flowable 的业务契约，`eforge-workflow` 承担引擎适配、流程配置、身份解析和规范接口。业务侧复用现有账号、角色、部门及事务。前端复用 `web/ui`，接口由 OpenAPI 生成。Agent 通过同一受权 API 维护流程包，不直连数据库。

## 当前交付范围

1. 可选引擎、锁定版本、显式数据库初始化、禁用状态及事务回滚证据。
2. 请假审批样例：提交、领取、批准、拒绝、撤回、历史和详情；重复提交、并发处理、越权和失效账号保护。
3. 流程包草稿、校验、差异、真实隔离场景验证、不可变发布及新实例版本选择。旧实例保持原版本。
4. 待办、已办、我发起、流程管理与失败任务运维页面；规范 DTO、生成客户端。
5. Agent 命令行维护入口，结构化结果、乐观锁、幂等、审计和独立权限边界。

后续扩展保留：通用可视化 BPMN 设计器、任意节点跳转、实例迁移、复杂会签。表单构建器按用户要求暂缓，不算已完成。

## 安全与维护约束

- 锁定 Flowable 7.2.0（官方基线 Boot 3.5.4），与本项目 Boot 3.5.16 / Java 17 通过实际测试验证；不升级到 Boot 4。
- 默认不创建引擎、不部署流程、不启动作业执行器；开启后生产不自动建表或升级表。
- 同步业务写入、引擎变更、关联与审计在同一个 Spring 事务/主数据源中提交；不得以第二数据源冒充原子事务。
- BPMN 是唯一流程图来源；清单描述业务绑定与格式版本。XML 禁用外部实体；拒绝任意脚本、类、URL、监听器及未注册表达式。无候选审批人显式失败，不能自动放行。
- 后端每次操作重新核验当前用户及任务资格；菜单权限不能代替任务归属。表单绑定来自静态注册表。
- 业务关联包含 businessType/businessId/submissionId。变量保持小型明确类型，不存完整业务对象或秘密。
- `/api/v1/workflow/**` 使用具体 DTO、PageResponse、ProblemDetail；兼容接口和 Flowable 内部实体不泄漏。
- 发布候选绑定内容摘要、环境绑定及验证结果；激活旧版本仅影响新实例。Agent 不具有隐式生产发布权限。

## 验收与命令

每项范围必须有真实行为证据，不能以工具类或 Starter 加入代表集成完成。

- `mvn -B -ntp -f server/pom.xml verify`，含定向权限、事务、并发、幂等测试和既有数据范围回归。
- 真实 MySQL/Redis 下执行审批闭环及回滚；既有 `server/scripts/verify-auth-integration.ps1 -VerifyWeb` 回归。
- `npm --prefix web run lint/typecheck/test/build` 分别执行；生成客户端可复现；导航契约及真实浏览器覆盖启用/禁用、错误重试与键盘操作。
- Agent 与 UI 使用同一权限边界；失败返回安全的结构化错误。
- 精确提交云端终态成功后记录验收，不用旧提交证明新源代码。

## 官方依据

- https://github.com/flowable/flowable-engine/releases/tag/flowable-7.2.0
- 版本化源码：https://github.com/flowable/flowable-engine/tree/flowable-7.2.0/modules/flowable-spring-boot
