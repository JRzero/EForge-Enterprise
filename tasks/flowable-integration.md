# Flowable 集成实施与证据

规格：[flowable-integration](../spec/flowable-integration.md)。状态：done（2026-10-10；约定范围，不含后续扩展及生产部署）。

按依赖顺序交付，每个阶段必须保留实际命令、结果及限制。日常迭代已授权，无需逐项再询问。

| ID | 任务 | 依赖 | 验收/验证 | 状态 |
| --- | --- | --- | --- | --- |
| F01 | 官方版本与可选 Starter | 无 | 编译、启用/禁用上下文测试；默认无引擎/作业/部署 | done |
| F02 | 主数据源事务及显式 schema 运维 | F01 | MySQL 真实业务+引擎共同回滚，安全默认、升级说明 | done |
| F03 | 请假业务契约与提交闭环 | F02 | 提交/重复/失败回滚/真实引擎实例 | done |
| F04 | 当前身份和任务处理 | F03 | 领取/批准/拒绝/撤回/并发/越权/撤权 | done |
| F05 | 规范查询及审批 UI | F04 | DTO/客户端/列表详情/端到端审批与历史 | done |
| F06 | 流程包安全验证 | F02 | 允许子集及 XML/脚本/表达式拒绝，真实引擎部署校验 | done |
| F07 | 草稿/差异/场景/候选发布 | F06 | 不可变摘要、乐观锁、失败无激活、旧实例不变 | done |
| F08 | 流程管理与运维 UI | F07,F05 | 发布/激活/版本详情/失败重试及权限 E2E | done |
| F09 | Agent 维护入口 | F07 | 同 API 权限、结构化失败、幂等和使用文档 | done |
| F10 | 全量回归与交付 | 全部 | 前后端、本地真实环境、云端精确提交终态；更新 roadmap | done |

## 当前证据

最终状态：F01–F10 已完成。实现 e7cfae4 的 server 38039102287 全四项及 web 38039102297 均终态成功；见文末最终验收。下文早期“待完成/验收中”保留为历史，不覆盖最终结果。

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

## 流程包草稿增量（尚未发布）

- 基础提交 `c5a854b` 的 web 37950844360 成功；server 37950844350 的启用浏览器任务因缓存响应读取时序失败。修复 `1d3b493` 改为响应到达即读取，`flowable-cache-fix-runtime.log` 7 项真实缓存浏览器和完整 API 终态通过。新 server 37953276346 / web 37953276312 的精确云端结果仍待终态，不将首轮失败称为成功。
- `flowable-final-runtime.log` 已证明最终基础源码的真实 SQL 故障安全 503、引擎状态回滚、恢复重试及完整 API；之前两配置 `flowable-validation-*-runtime.log` 均终态通过。
- 草稿规范 API 支持创建、读取、分页、CAS 更新及真实场景证明；审计与草稿同事务，编辑清除证明，验证只返回最小版本/摘要而不绕过读取权限。十进制字符串版本保留精确 long，达到上限仍可读取校验，后续更新明确 409。
- `flowable-package-review-red.log` 记录权限/最大版本回归失败；`flowable-package-review-green.log` 4 存储测试和 5 MVC 通过。独立复核脚本、SQL 初始化和 CI 未发现阻断；复核者未独立运行测试。
- `flowable-package-mysql-locks-0.log` / `flowable-package-mysql-locks-1.log` 均终态成功：真实引擎校验无持久部署、两个 JDBC 写入实际等待同一行锁，释放后 200/409 且仅一个版本提交；审计表故障整体回滚及恢复重试通过。最初使用 INNODB_TRX 观察锁等待时读到过期快照，改用 performance_schema 实际锁关系，未降低双等待断言。
- `flowable-package-final-verify-unrestricted.log` 全量 Maven 873 项（23 framework、29 workflow、821 boot），0 failures/errors，8 条件性跳过；其中 MySQL 测试另由上述两个真实模式实际执行。首次隔离环境停在 Mockito 附加工具初始化，仅终止已核实的本轮进程后重验成功，预览服务保持运行。
- `flowable-package-enabled-runtime.log` / `flowable-package-disabled-runtime.log` 两配置完整真实 HTTP 回归均终态 PASS；流程包权限、源内容、版本冲突、校验、真实 SQL 审计故障回滚与恢复全部通过。两实时 OpenAPI 与契约 SHA256 都为 `049A1E54EBD6FF3B7A2BD3CFDEE71D5FDF72820A144501556681B7969F15E125`。生成复现、lint、typecheck、126 单元及 build 通过。
- 基础最终提交 `1d3b493f35dcc01a838541c34e0a9d6a4c7000ab` 的 server `37953276346` 四项及 web `37953276312` 全部终态成功。草稿新增源码需等待自己的精确提交云端，不能沿用基础提交验收。草稿完成不代表不可变发布、激活、审批业务、Agent 或 UI 已完成。

## 不可变发布与激活增量（2026-10-10，验收中）

- 草稿实现已推送 `cf2c9ed2168073a1013fcb20d92323aa47fcf6f7`；精确 server `38030409259` 四项、web `38030409300` 及技能检查 `38030409250` 均终态成功。
- 已实现当前证明绑定下的真实引擎部署、不可变发布记录、同包同版幂等（草稿升版后仍返回旧发布）、分页读取、独立权限的激活 CAS。每次发布/激活检查当前静态候选账号与角色；未注册动态绑定显式拒绝。发布不隐式激活，旧实例保留原 definitionId。
- 独立审查发现嵌套事务返回不等于最终提交：`flowable-release-nested-red.log` 修前失败，入口拒绝已有实际事务后 `flowable-release-nested-green.log` 3 真实引擎测试通过；拒绝时无部署/缓存且独立重试成功。复核未发现新的确定阻断，审查者未执行测试。
- `flowable-release-mvc.log`：真实引擎/上下文与 4 MVC 通过，发布、读取、激活权限独立，字符串版本保持精确，安全 ProblemDetail。
- `flowable-release-final-verify.log`：全量 Maven 881 项（23 framework、33 workflow、825 boot），0 failures/errors，9 条件性跳过。之后仅加强真实 MySQL 测试的激活审计回滚断言，不改变生产 jar。
- `flowable-release-audit-mysql-0.log` / `flowable-release-audit-mysql-1.log` 均终态成功：两个真实 SQL 请求等待同包锁后返回同发布记录，单 deployment/单 audit；激活双 SQL 等待后 200/409；发布及激活审计故障均完整回滚，缓存不残留，恢复可重试；角色停用拒绝激活，切换后旧实例仍按原定义实际完成。
- `flowable-release-enabled-runtime.log` / `flowable-release-disabled-runtime.log` 两配置完整真实 HTTP 均终态 PASS；发布幂等、独立权限、激活冲突、审计故障回滚和恢复通过。两实时 OpenAPI 与契约 SHA256 为 `45080E03B5D8EBEF2824DA664997C883CE1AB9344E8059818F46562FF0C3E810`。`flowable-release-web.log` 生成复现、lint、typecheck、126 单元和 build 通过。精确云端仍待验收；此阶段不代表审批业务或流程管理页面完成。

## 流程管理页面增量（2026-10-10）

- 发布/激活精确提交 `7253ac32479129a8e7ef8be1559875a0ccab8fd9` 的 server `38031651604` 四项与 web `38031651581` 全部终态成功。
- 新增流程管理路由、GROUP/ROUTE/F 菜单及独立编辑/校验/发布/激活权限，没有授予普通角色默认权限。页面复用列表、分页、表单、详情和弹窗；长版本保留字符串，编辑冲突保留草稿，发布不隐式激活。
- `flowable-workflow-ui-maven.log` 全量 Maven verify 成功（本切片 881 项），保留旧预览服务；`flowable-workflow-ui-final-web.log` 客户端复现/lint/typecheck/128 单元/build 通过。
- `flowable-workflow-ui-enabled-final-runtime.log` / `flowable-workflow-ui-disabled-runtime.log` 两配置均完整 API PASS、各 2 项新真实浏览器通过；实际新建/场景校验/发布/独立激活/编辑清除证明/旧发布不变、只读角色和即时撤权已验证。两 OpenAPI 与契约均为 `45080E03B5D8EBEF2824DA664997C883CE1AB9344E8059818F46562FF0C3E810`。
- 首轮真实浏览器因宽泛 status 定位及空参数请求先触发 400 而失败，修正为具体反馈和合法权限夹具后通过。最终弹窗宽度/详情模板/显式主题按钮又由 `flowable-workflow-ui-buttons-final.log` 4 项浏览器与桌面/320px 截图验证；后端行为不变。
- 全量模拟浏览器首轮 209 通过，新增路由的通用模板夹具缺少启用响应导致 1 失败；补充真实形状响应后 `flowable-workflow-ui-layout-final.log` 全部 21 项（所有列表模板+流程交互）通过，不排除新路由验收。窄屏头部溢出修复前失败，修后 320/768/1024/1440 通过。
- 独立只读审查未发现确定阻断，审查者未执行测试。页面新增源码的精确云端尚待验收；请假业务服务、Agent 入口、差异及运维页面仍未作为本页面切片完成。

## 请假审批与 Agent 增量（2026-10-10）

- 管理页 `efb6e58` 的 web `38032939746` 成功，server `38032939807` 的 verify/runtime/default 三项成功，enabled 为 65 个真实浏览器通过、1 个缓存统计测试失败；失败是登录导航释放了响应资源，不将其标为云端通过。已改为登录稳定后显式刷新再读取该次响应，保留真实统计值和图形/刷新断言。
- 请假样例已接入规范接口、生成客户端、我发起/待办/已办及详情历史；V028 不默认授予普通角色。实际申请、引擎操作和审计同事务；申请和命令幂等，字符串版本，SQL 等待后重新核验账号/角色。具体边界见 [安全审查](../docs/security-review-workflow-leave.md)。
- `flowable-leave-capability-verify.log` 最终生产源码 889 项 Maven 测试通过（23 framework + 37 workflow + 829 boot，10 条件性跳过）。随后仅加强 MySQL 测试，不改变生产 jar。
- `flowable-leave-capability-mysql-0.log` / `flowable-leave-capability-mysql-1.log` 都终态成功：首次双提交同一申请、实际 SQL 双等待冲突、等待中撤权、审计 CHECK 故障引擎/业务共同回滚、旧实例在激活新版后完成且新申请使用新版。
- 独立审查指出列表缓存的处理资格不应支配详情刷新。修复前 `flowable-leave-revocation-red.log` 失败；修复后详情每次计算 Task.canHandle，H2 撤权/恢复断言通过，`flowable-leave-revocation-green.log` 23 项统一列表/审批交互通过。独立复核关闭该问题，未发现新确定阻断，审查者未跑测试。
- Agent 命令使用相同规范 HTTP；`flowable-agent-final-unit.log` 5 项通过，包括真实本地重定向不转发令牌。真实创建/更新/冲突/场景/同版发布重试/显式激活/无效令牌均通过运行脚本。
- 第一轮最终启用配置中，新增工作流及修复后的缓存 10 个真实浏览器均通过；其后参数配置检查出现一次连接失败，因此该轮整体未完成。新临时环境重跑已再次通过 10 个浏览器及原失败阶段，最终两配置完整回归仍在等待终态。未把中间浏览器成功称为整体成功。
- 最终顺序进程 98746 终态成功：`flowable-leave-final-enabled-runtime.log` / `flowable-leave-final-disabled-runtime.log` 均完整 API PASS，各 10 个真实浏览器通过。两实时 OpenAPI 与契约 SHA256 均为 `0BD127CEDC7B2FC0F599232D61DC374B26D788F9358D88156F98E9C94DC56DFC`。
- `flowable-leave-all-browser.log` 全量 216 项通过；`flowable-leave-accepted-web.log` 最终 lint/typecheck/128 单元/build 通过，客户端复现另已通过。此阶段本地验收完成，精确提交云端仍待终态。
- 流程差异与失败任务运维尚未交付，完整集成未完成。
- 请假/Agent 精确实现 `19da992e7cfa6f1eb37e5708b5ce67eb0f26e2e6` 的 server `38035410035` 全四项、web `38035410023`、skills `38035410020` 终态成功。直接日志 `flowable-leave-cloud-accepted.log` 证明两配置各 67 真实浏览器与完整 API、真实审批/Agent 和精确 OpenAPI；此前缓存测试失败由 `38317ca` 修复，随该精确提交完整通过。

### 下一切片：发布内容对比

- 只读 `GET /api/v1/workflow/packages/{id}/comparison`，复用 `workflow:definition:list`。明确指定基准发布 ID；目标是同包另一发布或当前草稿，跨包返回 404。
- 返回双方精确字符串版本、摘要及名称/业务绑定/BPMN/场景的完整前后内容与变更标识；不以文本变化冒充流程语义等价证明。一个一致读取取得双方，差异请求不改校验证明、发布或激活。
- 发布面板提供基准与目标选择、加载/失败/重新读取、安全文本对照；Agent `diff` 使用同一接口。覆盖同版无差异、草稿变化、不可变旧发布、跨包拒绝、SQL 故障和权限。
- 该切片已实现；`flowable-comparison-verify.log` 完整 892 项 Maven（23 framework + 39 workflow + 830 boot）通过，Agent 6 项、前端 lint/typecheck/128 单元/build/生成复现通过，`flowable-comparison-all-browser.log` 全量 217 项通过。
- 最终 `a722c66db7729c044f7629756fb50c843361a761` 的 server `38036726933` 四项、web `38036726915` 均终态成功；直接 `flowable-comparison-cloud-accepted.log` 证明两配置各 67 真实浏览器与完整 API。顺序本地进程 57400 也已终态成功，`flowable-comparison-verified-enabled/disabled-runtime.log` 各 3 流程浏览器和完整 API PASS，两实时契约及仓库契约 SHA256 都为 `B8715C5E15F07A6160823A095E792159D124D4A782E62863C3539422673F22E8`。
- `flowable-comparison-enabled-runtime.log` 完整真实 API PASS，实际 SQL 对比/证明不变/故障恢复/权限及 Agent diff 通过。最终页面脚本先后修复相对定位范围、组件加载 status 同名的测试错误；`flowable-comparison-verified-enabled-runtime.log` 的 3 项真实流程浏览器已通过，同一进程继续启用完整 API 后默认配置，尚未终态。详见 [对比安全审查](../docs/security-review-workflow-comparison.md)。

## 失败作业运维与后台执行增量（2026-10-10）

- 实现 ADR 0018：独立默认关闭的首个人工任务后台创建、官方专用执行池、规范失败作业查询/202 重新入队、07 同事务审计、V029 独立功能权限、生成客户端、流程版本运维页面与 Agent jobs/retry。不是通用任意作业执行入口。
- 最终生产源码 `flowable-job-reviewed-verify.log` 完整 Maven 900 项声明，0 failures/errors、11 条件性跳过；真实 MySQL 用例另外实际执行。`flowable-job-withdraw-mysql-0/1.log` 两模式均成功，覆盖官方执行器真实 SQL 失败/死信、双 SQL 等待后的撤权、审计回滚、同命令单入队、实际唯一人工待办，以及角色锁等待/撤权/撤回竞争后零残留。
- `flowable-job-frontend.log` 生成复现、lint/typecheck、128 单元、build 通过；最终样式再由 `flowable-job-final-build.log` 构建，`flowable-job-all-browser.log` 全量 220 模拟浏览器通过；Agent 7 项通过。
- 独立审查发现定义暂停、被 Starter 覆盖的共享执行池配置、父级激活与子级恢复互斥问题；各有修前失败/修后通过，最后只读复核无新的确定阻断。见 [作业安全审查](../docs/security-review-workflow-jobs.md)。
- `flowable-job-enabled-runtime.log` 完整启用 HTTP/Agent 恢复回归 PASS。最终顺序进程 72971 的 `flowable-job-browser-enabled/disabled-runtime.log` 正在验证两配置；启用 4 项真实流程浏览器已通过（实际故障作业恢复后仍需人工审批、手机截图）。完整 API 与禁用配置以进程终态为准，云端尚未提交验收。
- 最终本地进程 72971 已终态 0：`flowable-job-browser-enabled-runtime.log` 与 `flowable-job-browser-disabled-runtime.log` 均完整 API PASS，各 4 项真实流程浏览器通过；启用配置实际执行故障→死信→页面确认恢复→唯一人工待办→撤回，禁用配置保留安全说明与拒绝。最终两实时 OpenAPI 与仓库契约同 SHA256 `3D7FC784F8576A602E8965C07A0CD0C1B6215C0E93750FE07B5E29238AE15F0C`。安全默认脚本与 25 Skills 安装检查通过。
- 实现提交 `e7cfae4a1bd9bdedd2c8e7ee2372c42fe3e49e59` 已推送。web `38039102297` 已终态成功；server `38039102287` 尚在运行，不能将尚未结束的两配置全量浏览器或整套后端标为云端成功。

## 最终当前范围验收（2026-10-10）

实现 `e7cfae4a1bd9bdedd2c8e7ee2372c42fe3e49e59` 已推送到 `codex/flowable-integration`。server [38039102287](https://github.com/JRzero/EForge-Enterprise/actions/runs/38039102287) 的 verify、default/enabled auth-runtime、runtime 全四项终态 SUCCESS；web [38039102297](https://github.com/JRzero/EForge-Enterprise/actions/runs/38039102297) 终态 SUCCESS。观察进程 66415 终态 0，未重试或跳过失败检查。

直接日志 `flowable-job-cloud-server-accepted.log` 与 `flowable-job-cloud-web-accepted.log` 证明：900 后端声明（23 framework + 45 workflow + 832 boot，0 failures/errors，11 条件性跳过）、实际 MySQL 两模式完整 workflow/native 作业恢复、128 前端单元、220 模拟浏览器、启用/禁用各 68 真实浏览器、完整 HTTP/API、精确实时 OpenAPI，以及既有生成模块编译/启动/页面/权限/审计回归全部通过。条件性 MySQL 用例在独立两模式步骤实际执行，非以跳过代替。两个配置的契约与生成客户端对应 SHA256 `3D7FC784F8576A602E8965C07A0CD0C1B6215C0E93750FE07B5E29238AE15F0C`。

可用能力：官方可选引擎与显式 schema；请假提交/领取/批准/拒绝/撤回/历史；草稿修订/回滚场景校验/不可变发布/独立激活/版本对比；我发起/待办/已办与流程管理页面；失败作业查询、确认恢复、审计和真实后台执行；同权限 Agent 维护命令。独立审查问题已修复并有失败→通过证据。

当前交付范围完成。引擎及后台执行默认关闭，现有本地预览未重启，未安装或改写生产数据库，未部署生产，尚未合并 main。可视化 BPMN 设计器、复杂会签、实例迁移及动态主管策略属于后续扩展；表单构建器仍明确暂缓，不计完成。普通开发提交不隐含生产发布/激活授权。后续使用见 [运行维护](../docs/workflow-operations.md)、[Agent](../docs/workflow-agent.md) 和 [流程包](../docs/workflow-package-format.md)。
