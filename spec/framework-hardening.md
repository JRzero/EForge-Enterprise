# 框架可靠性与组件契约迭代

状态：已获用户“按照建议方案执行”授权，2026-10-15。依据：`docs/framework-review-2026-10-15.md`。这是完整交付范围，阶段完成不替代总体验收。

## 能力图与实施顺序

| 模块 | 责任 | 依赖 |
|---|---|---|
| authorization-consistency | 撤权/禁用后的SQL与会话故障一致性 | 现有IAM/Redis |
| interaction-correctness | TreeSelect、MultiSelect、标签、320窄屏 | 固定公共EForge |
| diagnostics | 安全异常诊断与请求关联 | 现有规范API |
| field-contract | 字段/弹层/富文本/明细错误契约 | interaction-correctness |
| reusable-business-ui | 记录选择、批量操作、筛选视图、文件、精确数值、审计展示 | field-contract |
| architecture-maintenance | 样式分层、公共层边界、可执行lint | 上述真实消费者 |
| scale-and-release | dist验收、包体积、列表/页签/SQL/锁性能 | 已稳定实现 |

先故障与交互，再公共契约与高频业务，最终规模/正式产物门槛。独立模块可并行，测试端口、构建产物及文件所有权必须协调。

## 具体验收

1. 授权：隔离真实MySQL/Redis中复现SQL已提交后枚举/读取/更新失败、多会话部分刷新、恢复后旧JWT。修复必须封闭旧权限窗口，事务回滚不撤销未生效授权；覆盖规范/兼容写入及撤销用户、角色、菜单、数据范围。更新安全审查/必要ADR，不直接移除保护锁。
2. 交互：树展开按钮鼠标焦点后Enter/Space不选值；多选两层Escape逐层退出；正常状态标签达到4.5:1，320窄屏无整页溢出，保留原视觉方向与完整分页功能。
3. 诊断：未预期API异常有可关联、受控的服务端诊断，响应不泄漏SQL/秘密，请求ID不能被任意输入伪造污染日志；维护原HTTP/ProblemDetail语义和审计。
4. 字段：原生输入及树/多选/关联/富文本统一id、label、required、hint、field error、readonly/disabled和focus关联。明细按稳定rowId+field定位错误；错误摘要可定位隐藏页签内字段并保留草稿。业务校验仍属调用方。
5. 弹层：展开状态、Escape、外部点击、回焦点、状态切换一致；保持listbox/tree/dialog各自语义。
6. 高频能力：远程记录查询（防抖、取消、分页、精确ID、旧值回显）；表格已选/批量操作条；生效筛选摘要与用户级版本化保存视图；组合文件上传/进度/取消/重试/预览/排序；精确数值/金额/百分比；安全审计时间线/差异展示。复用既有能力，以实际业务消费者和showcase证明边界，不只交付空壳。
7. 维护：token→公共组件→模板→外壳分层；底层DOM兼容样式集中；移除纯公共层对业务context/固定路由的反向依赖，增加可执行禁止Astryx/私有路径/非法依赖方向检查。
8. 规模：测量共享锁/Redis网络持锁、审批N+1、20–30页签、列表/选择器大数据和入口产物；按证据处理串行瓶颈、批量查询与缓存策略，保证草稿/权限/一致性。记录基线、环境、预算及回归机制；不将无测量的推测写成性能改善。
9. 发布：针对实际dist测试登录、深链刷新、懒页面、弹窗、资源失败恢复；保留原开发态回归，增加入口JS/CSS产物预算。CI真实执行并核对精确提交终态。

## 不变约束

模块化单体、固定EForge与RuoYi基线、后端权威授权、OpenAPI生成客户端、原ID/十进制/时区语义及DataScopeAspectParityTest不变。无直接Astryx产品导入、无复制上游、无新增低代码/微服务/多租户；表单构建器继续暂缓。未经请求不部署生产、不自动清空业务数据。本次正常提交推送已授权，合并main与发布分别记录。

## 实现与验证

后端位于server各现有模块，前端ui/features/app/templates按责任分层；规格/任务记录在spec/tasks，安全/架构决策在docs。保持现有类型化接口和受控组件风格，避免重写已验证行为。

- 小步：针对问题的先失败/后通过行为测试、对应静态检查与审查。
- 前端：`npm --prefix web run lint`、`npm --prefix web run typecheck`、`npm --prefix web test`、`npm --prefix web run build`、`npm --prefix web run check:generated`，web目录下相关及最终完整Playwright。
- 后端：`mvn -B -ntp -f server/pom.xml verify`，权限、事务、隐私、数据范围针对测试与真实MySQL/Redis回归。
- 运行：已有本地服务使用target-flowable jar；不得在其运行时覆盖该包。临时测试使用独立端口和自有容器，不能抢占他项目服务。
- 最终：默认/启用配置真实浏览器与API、实际生成CRUD/tree/sub消费者、契约一致、准确云端终态与逐项完成审计。新增门槛先有基线和可运行命令，不放宽现有门槛或删断言求绿。
