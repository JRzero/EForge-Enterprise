# 采购审批示例

当前开发分支：`feat/purchase-approval-sample`。本页描述使用流程；最终验收与合并状态以 `tasks/purchase-approval-sample.md` 为准，当前不能据此认为main或本地常驻服务已更新。

## 启用与授权

沿用框架现有Flowable启用配置和数据库迁移机制。新环境依次安装现有workflow脚本及 `sql/workflow/08-eforge-purchase.sql`；导航使用 `sql/migrations/V030__purchase_sample_navigation.sql`。已有数据库应先备份并核对已应用迁移，这两个脚本不是可重复执行的重置脚本，不能清空或重建业务库。

普通申请人需要采购列表与发起权限（`sample:purchase:list`、`sample:purchase:write`），审批人需要采购列表与审批权限（`sample:purchase:list`、`sample:purchase:approve`）。菜单位于工作流下的“采购审批示例”，地址 `/samples/purchases`。审批人必须为有效账号，不能选择自己。原请假权限不自动转成采购权限。

## 配置一次采购流程

1. 进入流程管理，新增流程包，先选择“采购审批 · 单级指定审批人”。
2. 模板包含一个人工审批任务，审批对象为 `${approver}`；这是服务端绑定的申请指定审批人。
3. 保存、校验批准/拒绝场景、发布，然后激活采购版本。保存或发布都不会自动激活。
4. 采购与请假分别激活；已提交申请继续使用其提交时版本。

本轮只支持一个同步人工审批任务。无需为采购启用异步执行；多级审批、会签和其他业务节点尚不在此示例范围。

## 业务闭环

- 申请人新增标题、事由、审批人和1–100条明细，先保存草稿。
- 数量最多3位小数、单价最多2位小数。服务端逐行四舍五入到分后合计，显示的总额来自服务器。
- 草稿详情中可编辑明细、逐个确认上传PDF/PNG/JPEG附件，再提交审批。单个附件不超过5MiB、最多5个。
- 审批人在“待我审批”中查看明细/附件，填写意见并确认批准或拒绝。申请人可在待审批时撤回。
- 已提交后不再修改明细或附件。所有操作形成事件记录；重试使用原命令编号，避免重复创建或重复完成任务。

附件只有业务参与者能下载，不提供公开URL。PDF格式检查不替代病毒扫描；不应把示例附件存储直接当作面向不可信公众的大文件服务。

## 验证入口

- `mvn -B -ntp -f server/pom.xml verify`
- `pwsh -File server/scripts/verify-workflow-engine.ps1 -Purchases -LowerCaseTableNames 0`，再以1运行。
- `pwsh -File server/scripts/verify-auth-integration.ps1 -EnableWorkflow -VerifyWeb -WebTestPattern purchases.spec.ts`（需要先构建jar；只使用该脚本创建的临时环境）。
- 默认禁用配置去掉 `-EnableWorkflow`，核验禁用页面与503边界。
- `npm --prefix web run check:generated`、`typecheck`、`lint`、`test`、`build`。

用户常驻本地服务使用独立jar；开发期间采用 `target-flowable-purchase` 替代输出，禁止覆盖正在运行的jar。测试环境与用户预览环境的端口和容器独立。
