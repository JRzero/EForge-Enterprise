# 请假审批与 Agent 入口审查

状态：实现与本地验证进行中，未作为完整 Flowable 交付。关联 [规格](../spec/flowable-integration.md) 与 [任务](../tasks/flowable-integration.md)。

## 业务和权限边界

`WorkflowLeaves` 是样例业务契约，Flowable 实体仅留在适配模块。申请固定使用已激活的不可变发布 ID；结束节点绑定 `approvedEnd` / `rejectedEnd`，发布时即检查，申请时再次检查。现有实例不按最新流程 key 重新启动。

提交、领取、批准、拒绝、撤回与业务审计使用同一主数据源 Spring 事务。申请人取已认证账号；任务操作额外读取当前有效账号、当前角色及原定义的静态候选绑定。超级管理员菜单权限不绕过任务候选资格。领取后撤销候选角色仍拒绝处理；历史参与者可继续读本人参与的历史。详情每次返回实时任务处理资格，页面刷新后不沿用列表中的旧资格。

发起列表按本人过滤，已办按本人实际批准/拒绝审计过滤；待办通过官方候选用户/组和已分配用户查询后分页。分配给本人但资格已撤销的任务可以显示为不可处理，不会在分页之后丢弃数据。其他无关账号读详情返回安全 404。

同一申请人和 `submissionId` 唯一，同内容重试返回原申请，不同内容冲突。申请行锁序列化状态修改，身份检查在等待行锁之后执行。每次任务命令携带 UUID 和精确字符串版本；同一账号/命令的动作、版本、任务和意见摘要一致时返回既有结果，不再次完成任务。过期版本返回 409。已完成命令重试可能返回申请的当前状态，不承诺冻结为第一次响应。

## Agent

[维护命令](workflow-agent.md) 仅调用同一规范 API。HTTPS 为远程默认要求，明文 HTTP 仅允许回环地址；拒绝跨源重定向。令牌通过环境变量输入，不使用命令行参数、不写输出。只输出安全错误码，不传播后端 SQL/detail 或网络异常文本。超时后不自动重试写操作；调用方先读取确认，发布可按同版本重试，激活使用独立 CAS。创建草稿尚无幂等键，不得自动重试创建。

## 已有证据及待验收项

- `flowable-leave-final-verify.log`：889 项 Maven 测试（23 framework、37 workflow、829 boot）通过；之后增加详情实时能力字段，最终验证另记。
- `flowable-leave-final-mysql-0.log` / `flowable-leave-final-mysql-1.log`：实际双 SQL 等待的领取/决策冲突、等待时撤权、审批审计故障引擎与业务回滚通过。
- `flowable-leave-enabled-runtime.log`：完整既有 API 回归，以及真实登录、提交重试、当前角色领取、即时撤权、审计 CHECK 故障后回滚/重试、批准/拒绝/撤回、历史顺序、Agent 创建/编辑/CAS/验证/幂等发布/独立激活通过。此轮早于详情实时资格字段及 V028，不能作为最终 UI 证据。
- `flowable-leave-revocation-red.log`：审查指出的旧资格按钮问题修复前失败；`flowable-leave-revocation-green.log`：修复后全部列表模板和审批交互共 23 项通过。
- 最终生产源码 `flowable-leave-capability-verify.log` 889 项 Maven 通过；`flowable-leave-capability-mysql-0.log` / `-1.log` 两种真实 MySQL 模式通过，另加强旧实例在新版激活后仍按原定义完成的断言。
- `flowable-leave-final-enabled-runtime.log` / `flowable-leave-final-disabled-runtime.log` 两配置完整 API 均终态 PASS，各 10 项真实浏览器通过（流程管理、请假审批与缓存统计）。前一轮浏览器通过后出现的连接失败没有被当作整体成功；新独立临时环境完整重验通过。
- 两实时 OpenAPI 与契约 SHA256 均为 `0BD127CEDC7B2FC0F599232D61DC374B26D788F9358D88156F98E9C94DC56DFC`。最终前端 lint/typecheck/128 单元/build 与客户端复现通过；`flowable-leave-all-browser.log` 全量 216 项交互通过。
- 精确提交 `19da992e7cfa6f1eb37e5708b5ce67eb0f26e2e6`：server `38035410035` 四项、web `38035410023` 与技能检查 `38035410020` 全部终态成功。`flowable-leave-cloud-accepted.log` 直接证明两配置各 67 真实浏览器、完整 API、审批/Agent、新旧能力回归及实时 OpenAPI 一致。独立审查未执行测试，其审查结果不冒充验证证据；详情资格问题已经修复并复核关闭。

测试容器及故障约束只存在于父脚本创建的一次性数据库，不触碰本地预览数据库。生产安装使用显式脚本，不自动初始化或删除引擎历史。
