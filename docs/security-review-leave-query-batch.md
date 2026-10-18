# 审批列表批量查询审查

H10进行中，当前实现未完成最终验收。范围为WorkflowLeaveService的mine/handled分页投影与pending页内业务行、角色资格复用。

## 行为与一致性边界

mine/handled保持原账号校验、where条件、count、created_at/id降序、offset/limit。直接选择当前页完整业务行，用与详情相同的行映射器代替逐ID读取；handled继续使用EXISTS，不能因多条审批审计重复申请。

pending保持Flowable公开查询、active/businessType、candidateOrAssigned/candidateGroupIn、原排序及分页。对当前页distinct processId用参数化IN一次读取，最终仍按原任务顺序输出，不合并同流程的多个任务或改写引擎total。空页跳过IN。当前API页大小上限100，参数量有界。

每次pending调用已读取的活跃角色仅用于本次资格判断；直接assignee/candidateUsers及原模型candidateGroups核验保持。已领取但已撤权的任务仍展示且canHandle=false。claim/decide/withdraw仍在业务行FOR UPDATE后重新校验身份、角色与任务；详情、命令路径不复用先前列表缓存。没有跨请求缓存，也没有改变事务隔离或锁。

若引擎任务找不到业务行，明确触发DataAccessException，经原database边界转安全503，与旧queryForObject缺失行为一致，不静默漏项。SQL失败也继续使用原脱敏边界。没有改变引擎表、API DTO或OpenAPI。

## 验证

新增WorkflowLeaveQueryBudgetTest使用真实Flowable引擎和执行级PreparedStatement计数；计数只覆盖业务JdbcTemplate，明确不包含引擎SQL。TransactionAwareDataSourceProxy复用原事务连接，计数代理不创建独立业务事务。

旧实现h10-leave-query-red.log实际记录5项mine=8、5项pending=17、2项handled=5，测试因预算3而失败。新实现h10-leave-query-green.log针对测试及原WorkflowLeaveServiceTest通过，查询降至3/3/3。扩展空页2次、缺失业务关联503/恢复、分页和排序后h10-leave-query-final-target.log通过。

同组断言接入WorkflowLeaveMysqlTest既有并发领取、锁后撤权、旧版本绑定和审计故障回滚检查；用独立申请人/审批人避免与原场景数据混合。实际MySQL大小写模式0/1正在顺序运行h10-leave-query-mysql-0/1.log，未终态不宣称通过。完整Maven、最终两配置API/浏览器、精确OpenAPI与云端验收尚待；不把H2针对测试替代真实环境门槛。

实际MySQL终态：4554 exit0，两配置h10-leave-query-mysql-0/1.log均BUILD SUCCESS，查询3/3/3及空页/缺失恢复断言通过，原并发领取/锁后撤权/审计回滚同次保留。完整Maven现运行h10-leave-batch-full-maven.log；最终API及云端尚待。

完整Maven83829终态exit0（h10-leave-batch-full-maven.log，全模块BUILD SUCCESS）。最终jar开始唯一顺序进程97504：h10-leave-default-runtime.log/openapi.json，然后h10-leave-enabled-runtime.log/openapi.json；每配置完整API与68真实浏览器，不能在运行中重复打包或启动同端口回归。当前未终态，源码未提交。

默认配置h10-leave-default-runtime.log已终态PASS，68真实浏览器及完整API/37故障诊断通过，实时OpenAPI与契约JSON精确一致。唯一97504已进入启用配置，仍待终态；不重复启动。

最终本地验收97504终态exit0：默认与启用配置各68真实浏览器、完整API、SQL/Redis/Quartz/Flowable/生成器原回归与37/39故障诊断均通过，两份实时OpenAPI与契约完整JSON精确一致。完整Maven、两模式真实MySQL与本次HTTP全部通过；待提交精确云端验收，不提前声明云端成功。
