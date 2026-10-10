# 工作流失败作业恢复安全审查

日期：2026-10-10。范围：ADR 0018 的有界首个人工任务异步创建，以及 UI / Agent 共用的失败作业查询与恢复。精确提交云端状态以任务清单为准。

## 授权及执行边界

- 引擎与后台执行独立默认关闭，显式 SQL 初始化；没有自动部署、自动表升级或对外开放 Flowable 管理 API。
- BPMN 只允许开始节点直接连接的首个人工任务使用 async；其他异步节点、定时器、脚本、服务调用、监听器仍拒绝。应用 Bean 不向表达式公开。
- 使用官方 Process 专用执行池（1 / 2 / 32），不是仅配置被 Starter 共享执行池覆盖的 core/max 属性。后台只能创建人工待办，不作人工决策。
- 列表与恢复分别要求 `workflow:operation:list` / `workflow:operation:retry`。恢复锁住对应申请后再检查当前操作者、当前候选人员、已发布定义、待审业务关联、实例及定义未暂停，不能通过传入任意引擎 ID 操作未绑定实例。
- 后台创建也对当前角色/账号使用锁定读取，避免旧事务快照看见已撤回资格。与撤回的锁竞争不允许复活已撤回申请。
- 重新入队与审计同一主库事务；同操作者与命令 UUID 重放返回原记录，不产生第二个作业。HTTP 202 / QUEUED 不代表执行成功，更不代表批准。
- API、Agent、页面不输出引擎异常堆栈、SQL、变量或令牌。错误返回安全代码；页面渲染文本，恢复确认与父级激活操作互斥。

## 已验证行为

- `flowable-job-review-red.log` / `flowable-job-review-green.log`：定义暂停与实际执行池问题修前失败、修后通过；实际线程名及池配置验证专用执行器生效。
- `flowable-job-reviewed-verify.log`：最终生产代码完整 Maven verify，900 项声明、0 failures/errors、11 条件性跳过；其中真实数据库用例单独执行。
- `flowable-job-withdraw-mysql-0.log` / `flowable-job-withdraw-mysql-1.log`：真实 MySQL 两种大小写模式，官方后台执行因 SQL CHECK 故障进入死信；同申请双请求实际 SQL 等待后撤权拒绝、审计故障整体回滚；恢复同命令只产生一个实际待办和一条运维审计。后台等待角色锁期间实际撤权并与撤回竞争，最终没有任务、可执行作业、定时作业或死信复活。
- `flowable-job-enabled-runtime.log`：实际 HTTP 与 Agent 恢复返回同一入队结果，真实执行生成唯一待办；安全错误、原权限、默认关闭及完整既有 API 回归通过。
- `flowable-job-ui-lock-red.log` / `flowable-job-ui-green.log`：父弹窗激活响应未完成时恢复入口的互斥缺陷修前失败、修后 8 项通过，含移动布局、失败重试同命令及禁用提示。
- `flowable-job-all-browser.log`：全量 220 项模拟浏览器通过；`flowable-job-frontend.log`：生成可复现、lint、类型、128 单元和构建通过；`flowable-job-agent-unit.log`：7 项 Agent 测试通过。
- 最终两配置真实浏览器与完整 API：`flowable-job-browser-enabled-runtime.log` / `flowable-job-browser-disabled-runtime.log`，执行结果在任务清单追加；未取得云端终态前不将本地证据称为云端验收。

只读独立复核已关闭定义暂停、专用池和页面互斥三项问题，最后一次复核无新的确定阻断；复核者未独立运行测试。

## 保留限制

当前只覆盖注册的请假流程及上述有界作业。没有通用 BPMN 设计器、任意节点跳转、复杂会签、实例迁移或任意服务任务恢复。生产启用需要显式安装 07 审计表、V029 权限及环境授权。表单构建器仍按用户要求暂缓。
