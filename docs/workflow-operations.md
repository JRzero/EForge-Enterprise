# 工作流运行与维护

交付状态以 [任务清单](../tasks/flowable-integration.md) 为准。当前提供请假审批、流程包维护、版本对比与失败作业恢复；生产启用必须单独完成环境授权和数据库安装。

## 引擎与数据库

锁定官方 Flowable Process Starter 7.2.0，使用本项目 Java 17 / Spring Boot 3.5.16。应用默认 `EFORGE_WORKFLOW_ENABLED=false`，不创建流程引擎；启用后仍禁用自动部署、IDM、事件注册。异步执行另由默认关闭的 `EFORGE_WORKFLOW_ASYNC_ENABLED=false` 控制。所有应用 Bean 默认不向流程表达式公开。

部署前由运维审核并在同一个业务主数据库显式安装 [官方初始 SQL](../sql/workflow/flowable-7.2.0/README.md)。应用始终保持 `flowable.database-schema-update=false`。已有表不得重新初始化或自动删除；升级需要独立的官方版本升级链和恢复演练。

流程包管理另需显式安装 [EForge 流程包元数据 SQL](../sql/workflow/04-eforge-workflow.sql)，位于官方三个脚本之后。它只创建 EForge 自有草稿和审计表，不改写引擎表。禁用工作流时无需安装这些表。已有安装不要重复执行初始脚本；停止使用功能通过配置关闭，不能删除流程历史作为回退手段。

草稿读取、编辑和校验分别需要 `workflow:definition:list`、`workflow:definition:edit`、`workflow:definition:validate`。版本在 API 中使用十进制字符串，更新及校验必须提交读取时的 `expectedRevision`；冲突返回 409 后重新读取，不自动覆盖。每次编辑清除旧校验证明。校验只运行回滚的真实引擎场景，不发布或激活流程。

本仓库的测试和提交不构成生产部署授权，生产开启需核对数据库、功能权限及当前验收记录。

不可变发布另需按顺序安装 [05 发布元数据](../sql/workflow/05-eforge-workflow-releases.sql)。它预置 `leave` 的未激活版本 0，发布不隐式激活。发布从独立主库事务入口执行，同一包的锁仅持续本次发布，部署、不可变记录与审计共同提交；已有外层事务会被拒绝，避免外层回滚留下引擎缓存。切换激活版本只用于后续申请，不迁移旧实例。`-Releases` 的两种 MySQL 模式验证并发发布、并发激活和真实部署回滚。

## 开发验证

请假样例另需显式安装 [06 申请与审计](../sql/workflow/06-eforge-workflow-leave.sql)。菜单 V028 只声明页面及功能权限，不自动授权普通角色。申请权限为 `workflow:request:list/submit/withdraw`，审批权限为 `workflow:task:list/handle`；审批人同时必须满足已发布流程中的实际候选用户/角色。流程管理权限不等于任务处理资格。

`-Leaves` 验证实际业务行锁、等待后身份、任务冲突及审计失败回滚。Agent 使用 [工作流维护命令](workflow-agent.md)，无额外数据库或内部管理通道。

`mvn -B -ntp -f server/pom.xml test` 验证内存数据库与既有测试；`pwsh -File server/scripts/verify-workflow-engine.ps1` 在脚本独占的一次性 MySQL 中安装官方 SQL，关闭自动建表，验证与业务行共同提交、启动失败回滚、完成失败回滚。追加 `-LowerCaseTableNames 1` 验证大小写模式。

追加 `-Packages` 验证草稿、真实场景、双 SQL 等待并发写入的 200/409 分离及审计失败整体回滚；两种大小写模式均由 CI 执行。并发断言读取 MySQL `performance_schema.data_lock_waits` 和 `data_locks`，不依赖可能滞后的 `INNODB_TRX` 快照。

已有本地预览正在使用默认 jar 时，使用隔离输出，不能重新打包该文件：

```powershell
mvn -B -ntp -f server/pom.xml verify -Deforge.build.directory=target-flowable
pwsh -File server/scripts/verify-auth-integration.ps1 -JarPath server/eforge-boot/target-flowable/eforge-boot.jar
```

隔离输出不会修改现有预览数据库或重启预览进程。真实环境脚本继续只清理自己创建的容器。

## 失败作业恢复

在 06 之后显式安装 [07 作业审计](../sql/workflow/07-eforge-workflow-job-audit.sql)，应用 [V029 功能权限](../sql/migrations/V029__workflow_job_operations.sql)。这些脚本不自动授予普通角色权限，不能重复初始化已有数据库。

普通人工审批默认同步创建待办。只有开始节点直接连接的第一个人工任务可声明 `flowable:async="true"`；使用它需要显式开启两个工作流开关。后台使用独立的 Process 执行池（核心 1、最大 2、队列 32），不占用通用任务池。它只创建人工待办，不自动批准申请。

页面入口：流程管理 → 详情 → 对应发布版本的“失败作业”。读取需要 `workflow:operation:list`，页面进入还需流程定义读取权限；恢复需要独立的 `workflow:operation:retry`。列表仅提供关联标识、节点、次数和时间，不展示驱动错误、变量或异常堆栈。

先修复候选人员或基础设施故障，再确认恢复。接口返回 202 / `QUEUED` 仅表示重新入队；刷新并查看申请待办确认执行结果。一个操作使用固定命令 UUID，网络结果未知时重放相同命令和参数。恢复与审计同事务；审计失败不会留下无审计的已恢复作业。当前操作者、候选人员、待审业务关联、实例及定义未暂停等条件都由后端核验。

禁用异步开关停止新异步流程的激活、提交和失败恢复，保留历史与查询。不要通过删除引擎表、历史或业务行回退。执行中的事务应按实际部署停机方案处理，不承诺配置切换瞬间中止已经在运行的任务。

`verify-workflow-engine.ps1 -Jobs -LowerCaseTableNames 0`（再运行模式 1）验证真实后台执行、SQL 故障死信、双请求行锁等待、撤权、审计回滚和撤回竞争。完整 HTTP/浏览器验证使用 `verify-auth-integration.ps1 -EnableWorkflow -EnableWorkflowAsync -EnableConsoles -VerifyWeb`，只操作脚本独占的临时环境。Agent 使用相同 API，见 [维护入口](workflow-agent.md)。
