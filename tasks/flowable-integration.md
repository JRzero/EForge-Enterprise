# Flowable 集成实施与证据

规格：[flowable-integration](../spec/flowable-integration.md)。状态：in_progress。

按依赖顺序交付，每个阶段必须保留实际命令、结果及限制。日常迭代已授权，无需逐项再询问。

| ID | 任务 | 依赖 | 验收/验证 | 状态 |
| --- | --- | --- | --- | --- |
| F01 | 官方版本与可选 Starter | 无 | 编译、启用/禁用上下文测试；默认无引擎/作业/部署 | in_progress |
| F02 | 主数据源事务及显式 schema 运维 | F01 | MySQL 真实业务+引擎共同回滚，安全默认、升级说明 | pending |
| F03 | 请假业务契约与提交闭环 | F02 | 提交/重复/失败回滚/真实引擎实例 | pending |
| F04 | 当前身份和任务处理 | F03 | 领取/批准/拒绝/撤回/并发/越权/撤权 | pending |
| F05 | 规范查询及审批 UI | F04 | DTO/客户端/列表详情/端到端审批与历史 | pending |
| F06 | 流程包安全验证 | F02 | 允许子集及 XML/脚本/表达式拒绝，真实引擎部署校验 | pending |
| F07 | 草稿/差异/场景/候选发布 | F06 | 不可变摘要、乐观锁、失败无激活、旧实例不变 | pending |
| F08 | 流程管理与运维 UI | F07,F05 | 发布/激活/版本详情/失败重试及权限 E2E | pending |
| F09 | Agent 维护入口 | F07 | 同 API 权限、结构化失败、幂等和使用文档 | pending |
| F10 | 全量回归与交付 | 全部 | 前后端、本地真实环境、云端精确提交终态；更新 roadmap | pending |

## 当前证据

- 工作开始时仓库干净，基于技能安装提交 6a80fdf 新建 codex/flowable-integration。
- 官方 7.2.0 release 确认为 Spring Boot 3.5.4 基线；项目当前 3.5.16 的实际启用/禁用应用已验证兼容。
- 已接入官方 Starter、默认关闭及引擎限制；新增主库事务边界与受限审批 BPMN 校验，均未冒充完整业务交付。
- `flowable-foundation-isolated-final.log`：隔离目录 Maven verify 终态成功，23 framework + 18 workflow + 812 boot 测试，0 failures/errors；7 项既有条件性跳过保留。
- `flowable-foundation-web.log`：客户端复现、lint、typecheck、126 单元及 build 通过。
- `flowable-disabled-runtime.log`：默认关闭模块的完整真实 MySQL/Redis/API 回归终态通过；OpenAPI 与契约 Git diff 无差异（本地换行字节不同）。
- 显式官方 SQL 初始化、禁用自动更新、动态主库下的 MySQL 0/1 模式回滚已通过；`flowable-boundary-mysql-final.log` / `flowable-boundary-mysql-final-mode1.log` 正式 WorkflowUnitOfWork + 受校验 BPMN 最终两模式增强验证均终态成功。
- `flowable-policy-red.log`：仅 XML 解析时 12 项中 10 项失败；加入安全策略后通过。独立审查发现无人工任务路径漏洞，`flowable-policy-bypass-red.log` 修前失败、`flowable-policy-bypass-green.log` 修后 18 项通过；复核无阻断。
- 现有预览进程占用默认 jar，因此默认目录 verify 的 repackage 失败；采用 `target-flowable` 隔离构建，不重启预览。隔离 verify 发现生成器测试硬编码目录的 3 项失败，改为实际 CodeSource 路径并保留隔离断言后全绿。
- `flowable-enabled-runtime.log` 首轮真实浏览器 61 通过、3 因搜索字段与列显示复选框同名而定位失败；限定搜索区域后 `flowable-enabled-runtime-final.log` 64 真实浏览器与完整真实 API 终态成功。此构建尚不含之后的场景校验 HTTP 接口。
- 场景校验接口与真实引擎回滚已实现；`flowable-validation-red.log` 两项修前失败，`flowable-validation-mvc.log` 4 MVC 通过。审查补充缓存残留，`flowable-validation-cache-red.log` 两项证明缓存多 1；唯一资源精准清理后 `flowable-validation-cache-green.log` 23 工作流测试通过，连续校验保留正式缓存及原定义执行、嵌套事务拒绝不影响调用方均验证。
- `flowable-foundation-final-verify.log` 最新全量 Maven verify 终态成功：23 framework + 24 workflow + 816 boot，共 863 项，0 failures/errors，7 项既有条件性跳过。SQL 故障分类曾在真实 H2 中返回 400，`flowable-validation-sql-red.log` 证明失败；修为 503 后 `flowable-validation-sql-green.log` 24 项通过且恢复后可重新校验。
- 最新场景接口的真实 HTTP/MySQL 校验（批准/拒绝、精确摘要、重复校验、错误场景/不安全 XML、实体回滚）及启用配置完整 API 已通过 `flowable-validation-enabled-runtime.log`；禁用配置仍在同一顺序进程中。该运行 jar 不含最后 SQL 错误分类修改，不能代替该修改的真实 MySQL 故障验收。
- 依据实时规范契约生成客户端，复现/lint/typecheck/126 单元/build 均通过。后续最终真实 SQL 故障脚本及精确提交云端仍待终态。业务提交、任务处理、发布及 UI 均不得据基础阶段标为完成。
