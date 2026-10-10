# 工作流运行与维护

交付状态以 [任务清单](../tasks/flowable-integration.md) 为准。当前基础接入不代表完整审批功能可用。

## 引擎与数据库

锁定官方 Flowable Process Starter 7.2.0，使用本项目 Java 17 / Spring Boot 3.5.16。应用默认 `EFORGE_WORKFLOW_ENABLED=false`，不创建流程引擎；启用后仍禁用自动部署、IDM、事件注册和异步执行。所有应用 Bean 默认不向流程表达式公开。

部署前由运维审核并在同一个业务主数据库显式安装 [官方初始 SQL](../sql/workflow/flowable-7.2.0/README.md)。应用始终保持 `flowable.database-schema-update=false`。已有表不得重新初始化或自动删除；升级需要独立的官方版本升级链和恢复演练。

流程包管理另需显式安装 [EForge 流程包元数据 SQL](../sql/workflow/04-eforge-workflow.sql)，位于官方三个脚本之后。它只创建 EForge 自有草稿和审计表，不改写引擎表。禁用工作流时无需安装这些表。已有安装不要重复执行初始脚本；停止使用功能通过配置关闭，不能删除流程历史作为回退手段。

草稿读取、编辑和校验分别需要 `workflow:definition:list`、`workflow:definition:edit`、`workflow:definition:validate`。版本在 API 中使用十进制字符串，更新及校验必须提交读取时的 `expectedRevision`；冲突返回 409 后重新读取，不自动覆盖。每次编辑清除旧校验证明。校验只运行回滚的真实引擎场景，不发布或激活流程。

完整业务和管理接口尚未验收前，不应为生产开启此模块。

不可变发布另需按顺序安装 [05 发布元数据](../sql/workflow/05-eforge-workflow-releases.sql)。它预置 `leave` 的未激活版本 0，发布不隐式激活。发布从独立主库事务入口执行，同一包的锁仅持续本次发布，部署、不可变记录与审计共同提交；已有外层事务会被拒绝，避免外层回滚留下引擎缓存。切换激活版本只用于后续申请，不迁移旧实例。`-Releases` 的两种 MySQL 模式验证并发发布、并发激活和真实部署回滚。

## 开发验证

`mvn -B -ntp -f server/pom.xml test` 验证内存数据库与既有测试；`pwsh -File server/scripts/verify-workflow-engine.ps1` 在脚本独占的一次性 MySQL 中安装官方 SQL，关闭自动建表，验证与业务行共同提交、启动失败回滚、完成失败回滚。追加 `-LowerCaseTableNames 1` 验证大小写模式。

追加 `-Packages` 验证草稿、真实场景、双 SQL 等待并发写入的 200/409 分离及审计失败整体回滚；两种大小写模式均由 CI 执行。并发断言读取 MySQL `performance_schema.data_lock_waits` 和 `data_locks`，不依赖可能滞后的 `INNODB_TRX` 快照。

已有本地预览正在使用默认 jar 时，使用隔离输出，不能重新打包该文件：

```powershell
mvn -B -ntp -f server/pom.xml verify -Deforge.build.directory=target-flowable
pwsh -File server/scripts/verify-auth-integration.ps1 -JarPath server/eforge-boot/target-flowable/eforge-boot.jar
```

隔离输出不会修改现有预览数据库或重启预览进程。真实环境脚本继续只清理自己创建的容器。

## 后续验收边界

引擎事务测试不等于审批服务的并发、资格校验、幂等、业务状态与审计已经通过。后续必须在当前身份与动态数据源下验证这些行为，并对 UI 与 Agent 入口使用同一后端权限边界。
