# 工作流包 v1

示例位于 `workflows/leave-approval/`。它不是自动部署资源；发布与 Agent 接口尚在开发，以任务清单为准。

`process.bpmn20.xml` 是流程结构唯一来源，清单只声明业务/表单绑定、变量契约和场景文件。示例候选组 `role:2` 指现有普通用户角色，发布前须验证其有效性及实际审批人；不能因找不到审批人自动放行。业务申请不接受调用者随意指定 `approved`，审批动作由服务端写入。

当前安全策略允许一个可执行流程，节点为开始、人工任务、审批布尔分支及结束。每条终止路径必须经过人工任务。流程无环、全部节点可达；标识符最长 64 个 ASCII 字符，显示名称最多 128 字符。任务须且只能绑定指定用户、指定角色组或服务端解析的 `${approver}`。后者的业务解析尚待接入，不能据此宣称部门主管策略已完成。

分支仅允许 `${approved == true}` / `${approved == false}`，每个分支完整覆盖两种结果。任意脚本、Java 类、监听器、外部任务、服务调用、子流程、外部实体、扩展执行属性和未知元素均拒绝。支持范围扩展须新增安全审查和真实引擎场景，不能仅扩大 XML 名称白名单。

当前未纳入 BPMN DI 绘图元素；后续查看器接入时需单独验证惰性坐标数据。通用可视化设计器与表单构建器不属于本轮交付。

## 场景校验接口

`GET /api/v1/workflow/status` 返回引擎是否启用；`POST /api/v1/workflow/validation` 需要 `workflow:definition:validate` 权限，提交 `bpmnXml` 和 `scenarios` 数组。每个场景包含名称、有序 `decisions`（`taskKey`、`approved`）和 `expectedEnd`。最多 20 个场景，每场景最多 100 个决定；本接口验证流程行为，不代表正式审批人的资格验证。

真实引擎在主库事务中部署并执行，成功与失败均回滚数据库。返回精确 UTF-8 源摘要及实际任务、终点；仅清理本次校验唯一资源的引擎缓存，保留正式流程缓存。校验必须在发布事务之外执行，后续发布应重新核对内容摘要及配置版本，不得把前端传入的“通过”结果当作证明。校验不是发布，也不会激活流程。

## 草稿维护接口

| 方法与路径 | 权限 | 行为 |
| --- | --- | --- |
| GET `/api/v1/workflow/packages` | `workflow:definition:list` | 分页摘要，不含 BPMN 源 |
| GET `/api/v1/workflow/packages/{id}` | `workflow:definition:list` | 精确草稿及当前版本 |
| POST `/api/v1/workflow/packages` | `workflow:definition:edit` | 创建，201 和 Location |
| PUT `/api/v1/workflow/packages/{id}` | `workflow:definition:edit` | 版本匹配才更新，否则 409 |
| POST `/api/v1/workflow/packages/{id}/validation` | `workflow:definition:validate` | 对指定版本执行真实场景并记录证明 |

创建内容为 `{name,businessType,source}`，当前静态注册业务为 `leave`；`source` 为上述场景请求。更新内容为 `{expectedRevision,content}`；校验内容为 `{expectedRevision}`。版本和已校验版本都是十进制字符串，不能转为 JavaScript Number。修改后版本递增且旧证明清除；校验期间若有并发修改，证明不落入新版本而返回 409。

草稿可以保存尚未通过 BPMN 校验的内容。验证摘要覆盖精确内容，维护审计采用认证身份，不接受客户端提供操作者。校验响应只返回标识、版本和摘要，不能用校验权限读取源文件。工作流禁用时，具备权限的维护请求返回安全 503；未授权请求先返回 401/403。

## 不可变发布与激活（验收状态见任务清单）

`POST /api/v1/workflow/packages/{id}/releases` 需要独立的 `workflow:definition:publish` 权限和 `{expectedRevision}`，当前版本必须已有服务端场景证明。同一已发布版本重复请求返回相同的 200 发布记录，即使草稿后来更新；新的版本生成独立定义。包锁覆盖部署、发布记录和审计的同库事务，失败不留下半个发布。响应只提供不可变摘要、版本及定义标识，不返回可绕过草稿读取权限的源文件。

`GET /api/v1/workflow/packages/{id}/releases?page=1&pageSize=10` 和 `/api/v1/workflow/releases/{id}` 需要读取权限。`GET /api/v1/workflow/activations/leave` 读取当前选择；`PUT` 同路径需要 `workflow:definition:activate`，内容为 `{releaseId,expectedRevision}`。激活版本从字符串 `"0"` 开始，过期请求返回 409。发布权限不隐含激活权限，新的发布不会改变当前选择。

发布和激活检查静态用户及角色的存在、可用状态与实际候选账号；`${approver}` 目前返回 `WORKFLOW_BINDING_REQUIRED`，等待业务侧明确绑定。检查不保证未来身份一直有效，申请提交和任务操作还必须重新检查当前身份。业务提交、任务 UI、差异界面及 Agent 命令行仍待完成；不能把发布接口验收当作整个工作流已交付。
