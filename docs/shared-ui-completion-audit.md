# 公共组件与页面模板验收

范围依据：`spec/shared-ui-abstraction.md`。状态：done（2026-10-13），尚未合并 main。

| 要求 | 实际消费者 | 展示与交互证据 |
|---|---|---|
| FormField | 字典默认项 | showcase form/master-detail；shared-form-states 验证必填、说明/错误关联、只读/禁用 |
| CheckboxGroup / RadioGroup | 用户角色岗位、个人中心性别 | showcase form；未知旧值保留/改选移除、精确长ID、禁用/只读/空选项、键盘 |
| PageTabs | 个人中心、Cron、生成器 | showcase detail/approval；键盘方向/Home/End、页签关联、隐藏面板保留 |
| MultiSelect | 用户角色分配 | showcase form；shared-selectors 验证查询/移除/清空、缺失旧值、失败重试/加载/只读、真实请求体长ID |
| TreeSelect | 用户编辑部门 | showcase form；范围内孤立根、祖先搜索、键盘/折叠、失效旧值、状态保护和精确部门ID请求 |
| ReferenceSelect | 生成器字段字典关联 | showcase form；公共 EForge Selector 组合、旧记录/搜索/清空/加载/失败重试/只读 |
| DateRangeField | 参数设置、操作/登录日志 | showcase form；原日期字符串、双端清空、错误关联、只读/禁用；时区转换仍在业务端 |
| EditableDetailTable | 实际 React 生成子表 | showcase master-detail；增删/稳定行key/焦点、空明细校验、合计、行错误、busy锁定、只读；生成运行验证见下 |
| ConfirmActionDialog | 岗位删除 | showcase feedback；真实页面409/204重试、相同精确ids、等待期间禁用/Escape保护、关闭焦点 |
| AsyncContent | 任务/任务日志上下文 | showcase feedback；加载/空/失败/重试、业务失败不发送无筛选日志请求 |
| TreeListLayout | 用户管理部门/列表 | showcase tree-list；手机折叠保留选择、桌面恢复、布局无横向溢出 |
| EditorForm / Dialog / Page | 字典编辑、请假编辑；生成编辑之外保留原草稿策略 | showcase form/master-detail；失败保留草稿、取消明确确认、只读不提交；修复请假缺失discard.dialog |
| TabbedDetailPage / DetailTabs | workflow详情通过共享DetailTabs；模板组合保留标题/操作区 | showcase detail；全部字段、切换/键盘及挂载保留 |
| MasterDetailLayout | React 生成子表编辑 | showcase master-detail；一个form、主字段与可横滚明细、业务DTO不含UI UUID |
| ApprovalDetailLayout | workflow请假详情 | showcase approval；申请/任务/记录和操作区，实际权限/修订号/幂等仍由业务负责 |

所有公共组件经 `web/ui/index.ts` 导出；审批布局继续限定在 workflow 模块。没有直接从产品代码导入 Astryx、复制 EForge 源码、改变依赖基线或引入动态低代码表单。表单构建器仍暂缓。权限、请求、计算、持久化及草稿策略不放进公共展示组件。

## 验证证据与边界

- 完整 Maven：`shared-ui-detail-maven-verified.log`，BUILD SUCCESS。其后生产服务端代码/生成模板没有再修改。目标生成 Java 编译测试4项通过。
- 生成页面真实验证：`shared-ui-final-disabled-runtime.log` 中七类已安装页面及实际 MySQL/JWT/Redis/审计全部 PASS，包括 CRUD/tree/sub 创建编辑详情、筛选分页/导出删除，自动主键、字符串主键、根父子FK、精确十进制、无角色和撤权、上传/缓存/日期时区。父流程随后因生成测试菜单改变导航数量而终态1；不能称父流程整体成功。保留原导航断言，在全新框架环境单独回归。
- 全量模拟浏览器：`shared-ui-final-browser.log`，241项中240通过；唯一旧外观测试全局CSS误计入其他隐藏Selector选项。限定当前可访问listbox后两项外观复验通过，未改变原样式/键盘断言。
- 此后单选旧值修复：个人中心4项通过，新增 shared-form-states 通过；只读/禁用/空、说明错误关联、未知项移除和busy明细均实际验证。初版夹具的required标签隐藏星号、uncheck等待已卸载元素问题已按可访问名称和移除语义修正。
- 最终 typecheck/lint、131单元、build通过（session87673）；生成客户端复现通过（session43837）。构建保留既有大chunk提示。
- session26516 默认真实浏览器65/68通过，三个用户测试共用创建步骤仍调用原生selectOption('103')，与已迁移的TreeSelect不符。已改为点击归属部门树和精确data-value=103的研发部门节点；其余SQL/HTTP断言保留，启用配置未运行。
- 当前实现已推送 `46da40a8e6be964e484dd365c5c42aad3915680c`，分支 `codex/compact-list-layout`。默认配置68项真实浏览器及后续实际SQL/API全部通过，顺序命令已进入启用配置。默认实时OpenAPI与固定契约deepStrictEqual，统一CRLF/LF后字节也一致。
- 精确提交web-ci38387687845已success，直接日志 `shared-ui-cloud-web.log` 证明完整242浏览器、131单元、生成复现、lint/typecheck/build通过；agent-skills-ci38387687883已success。
- 精确提交 server-ci38387687803 四项均终态 success；直接日志 shared-ui-cloud-server.log 证明默认/启用各68真实浏览器、两套实际生成页面、完整SQL/API及OpenAPI通过。两份本地实时OpenAPI也已核对，统一CRLF/LF后与固定契约字节一致。本地session59753随后也已整体终态0。
- 最终本地验收：session59753终态0；shared-ui-framework-verified-disabled/enabled-runtime.log两套各68真实浏览器及完整后续API/SQL最终PASS，本次临时环境已清理。两实时OpenAPI统一换行后与契约字节一致。上述历史失败已修复或通过独立验证环境重新验收，不存在本次规格未完成项。

## 最终云端记录

实现提交：`46da40a8e6be964e484dd365c5c42aad3915680c`，分支 `codex/compact-list-layout`。

- [server-ci 38387687803](https://github.com/JRzero/EForge-Enterprise/actions/runs/38387687803)：四项成功，默认/启用各68真实浏览器、两套生成消费者及完整运行验证通过。
- [web-ci 38387687845](https://github.com/JRzero/EForge-Enterprise/actions/runs/38387687845)：242模拟浏览器、131单元、生成复现、lint/typecheck/build成功。
- [agent-skills-ci 38387687883](https://github.com/JRzero/EForge-Enterprise/actions/runs/38387687883)：成功。

完成范围限定本规格；未合并main、未发布生产。构建既有大chunk提示保留，表单构建器继续暂缓。
