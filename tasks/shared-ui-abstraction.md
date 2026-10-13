# 公共组件与页面模板抽象

状态：in_progress。规格：[shared-ui-abstraction](../spec/shared-ui-abstraction.md)。

| 切片 | 状态 | 迁移/证据 |
|---|---|---|
| FormField + CheckboxGroup/RadioGroup | in_progress | 字典默认项、用户角色岗位、个人中心性别、showcase 已迁移；完整字段状态审计待补 |
| 页内 Tabs | in_progress | 个人中心、Cron、生成器和组件夹具已迁移；showcase 综合模板待接 |
| 搜索多选 | pending | 公共依赖边界核实、真实消费者 |
| TreeSelect / 关联选择 | pending | 部门及人员场景 |
| 日期范围 | pending | 日志及配置列表 |
| 可编辑明细表 | pending | 生成主子表与展示 |
| 操作确认 / 异步状态 | pending | 复用 ResourceDialog/Feedback |
| 树列表模板 | pending | 用户管理 |
| 标准编辑页 / 弹窗 | pending | 共享字段、操作、草稿接口 |
| 多页签详情模板 | pending | DetailPage 扩展 |
| 主子表编辑模板 | pending | 生成器输出适配 |
| 审批详情模板 | pending | 保持 workflow 局部 |
| 示例、全量验证、完成审计 | pending | 不以局部检查声称全部完成 |

首批证据：lint/typecheck、131 单元、build 通过（既有大 chunk 提示）；字典/showcase/workspace 18 项、Cron/生成器/个人中心 15 项，以及最终组件/showcase 6 项浏览器通过。覆盖字段描述关联、选项禁用、原生 radio 键盘、实际默认值提交、Tab 键盘切换和草稿保护。此处集合有重叠，不累计成全量数量。

审查：字段容器以 render props 传递 id/aria 描述，业务验证留在消费者；未知选项保留原标签和可移除行为，停用且已选项可取消规则由用户页适配；PageTabs 不接管面板卸载策略。未变更依赖基线、API 或后端。尚未全量浏览器/生成消费者验证，目标保持进行中。
