# 采购审批示例任务

规格：[采购审批](../spec/purchase-approval-sample.md)。分支：feat/purchase-approval-sample；基线：main 3f87e45。

| 阶段 | 内容 | 状态 |
|---|---|---|
| P01 | 当前绑定审查、业务规格与数据/金额规则 | done |
| P02 | 草稿主子数据、规范API、权限与附件所有权 | done |
| P03 | purchase包绑定、单级流程、幂等与事务一致性 | done |
| P04 | 生成客户端、列表/编辑/详情/审批页面及导航 | done |
| P05 | 真实MySQL/Redis/Flowable、浏览器及全量回归 | in_progress |
| P06 | 精确云端、使用说明、最终验收 | pending |

已确认：用户选择单级指定审批人。现有业务类型在控制器/包存储/发布激活与编辑器中限定leave；`${approver}`已在BPMN安全白名单及场景验证支持。扩展必须保留leave测试，不将放宽业务类型当作采购业务已接入。

## 2026-10-21 接续证据

- 已实现采购业务表、BigDecimal规则、草稿/参与者列表/审批/撤回/私有附件规范API、生成客户端、采购页面和V030导航；采购模板与独立激活已接入现有设计器。
- 金额27项测试先红后绿；业务/H2实际Flowable、MVC权限测试通过。真实MySQL模式0/1发现并修复并发创建前一致读过早建立快照的问题；修复后两模式通过，日志purchase-mysql-fixed-0/1.log。
- 最终后端全量Maven verify通过：purchase-final-verify.log。测试jar使用target-flowable-purchase，未覆盖用户运行中的target jar。
- 前端149单元、生成复现、lint/typecheck/build通过；采购3模拟浏览器与原请假6项通过。后续状态筛选和长度对齐已加入，最终全量浏览器仍在验收。
- 真实HTTP已证明采购包校验/发布/激活与leave隔离、权限/金额/重复提交、实际SQL故障回滚及撤权拒绝；采购真实浏览器专测1项通过，覆盖实际设计器创建采购包、私有附件、指定人批准/拒绝/撤回。
- 首次带V030的完整API运行因测试jar内嵌旧路由契约失败，不记为全绿；重新构建后运行purchase-browser-runtime.log，完整API仍以终态为准。
- 全局目标尚未验收完成；不宣称已合并、已推送、已更新用户本地服务或云端通过。

## 本地验收收口

`purchase-browser-runtime.log`与`purchase-disabled-runtime.log`均终态exit0：启用/默认禁用完整API、MySQL/Redis/Flowable、导航/权限及采购实际浏览器通过，两实时OpenAPI与契约deepEqual。采购实际浏览器覆盖创建模板、明细、私有附件、另一账号批准/拒绝/申请人撤回。

346项全量模拟浏览器通过；随后仅采购表单的普通十进制pattern、400后允许更正、权限按钮与状态筛选修正，最终3项采购定向浏览器重新通过。最终typecheck/lint/build通过（purchase-web-final.log）；149单元与客户端可复现此前已通过且相关集成代码未再改动。状态变量遮蔽导致的类型失败已修复并加入HTTP查询参数断言。

等待精确提交云端与最终验收记录；未合并main，未升级用户本地数据库/常驻服务。PDF仅格式检查的边界见安全审查，不宣称病毒扫描。
