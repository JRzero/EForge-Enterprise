# 公共组件与页面模板抽象

状态：done（2026-10-13）。规格：[shared-ui-abstraction](../spec/shared-ui-abstraction.md)。完整验收：[逐项审计](../docs/shared-ui-completion-audit.md)。实现已推送 codex/compact-list-layout，尚未合并 main。

| 切片 | 状态 | 迁移/证据 |
|---|---|---|
| FormField + CheckboxGroup/RadioGroup | done | 字典默认项、用户角色岗位、个人中心、示例；必填/错误关联、未知旧值和禁用/只读通过 |
| 页内 Tabs | done | 个人中心、Cron、生成器、详情/审批；键盘、面板关联和草稿保留通过 |
| 搜索多选 | done | 用户分配角色及示例；搜索/移除/清空、状态、精确ID请求通过 |
| TreeSelect / 关联选择 | done | 用户部门、生成器字典关联及示例；真实业务浏览器通过 |
| 日期范围 | done | 日志/配置/示例；原日期语义、清空、错误/只读/禁用通过 |
| 可编辑明细表 | done | 实际 React 子表生成与示例；稳定行、增删焦点、busy和真实生成数据通过 |
| 操作确认 / 异步状态 | done | 岗位删除、任务上下文及示例；409/204重试、等待保护与状态切换通过 |
| 树列表模板 | done | 用户管理与示例；手机折叠保留选择、桌面恢复通过 |
| 标准编辑页 / 弹窗 | done | 字典、请假及示例；草稿保留/放弃确认、只读、错误通过 |
| 多页签详情模板 | done | 详情示例及实际审批共享DetailTabs；键盘与挂载保留通过 |
| 主子表编辑模板 | done | 实际生成模板及采购示例；一个form、滚动明细、业务DTO隔离通过 |
| 审批详情模板 | done | workflow局部模板、请假详情和审批示例；操作/记录/状态通过 |
| 示例、全量验证、完成审计 | done | 精确46da40a云端全部成功；本地默认/启用完整回归exit0；见逐项审计 |

以下为历史实施记录，阶段待验收描述不覆盖上述最终状态。

首批证据：lint/typecheck、131 单元、build 通过（既有大 chunk 提示）；字典/showcase/workspace 18 项、Cron/生成器/个人中心 15 项，以及最终组件/showcase 6 项浏览器通过。覆盖字段描述关联、选项禁用、原生 radio 键盘、实际默认值提交、Tab 键盘切换和草稿保护。此处集合有重叠，不累计成全量数量。

审查：字段容器以 render props 传递 id/aria 描述，业务验证留在消费者；未知选项保留原标签和可移除行为，停用且已选项可取消规则由用户页适配；PageTabs 不接管面板卸载策略。未变更依赖基线、API 或后端。尚未全量浏览器/生成消费者验证，目标保持进行中。

多选切片：固定 EForge 无 MultiSelector 公共导出，使用项目公共原生控件组合实现 MultiSelect，没有导入 Astryx 或修改上游基线。受控精确 string ID、未知已选标签、搜索、移除/清空、键盘跳过禁用项、Escape/Tab、loading/error/retry/readonly/disabled 完成。实际用户分配角色采用组件；编辑表单的短选项组继续使用 CheckboxGroup。真实环境用户脚本调整为多选交互，尚未执行，不能声明真实 SQL 角色回归完成。

多选先验测试在实现前因组件缺失失败。实现验收发现并修复：统一标签列宽；短弹窗浮层挡住保存；失焦先收起导致按钮位移吞点击；重试按钮卸载被外部点击监听误判。最终多选 3/3 通过（含用户角色 HTTP 请求原样保留 9007199254740993），同轮 showcase/组件其他 6 项已通过；131 单元及 lint/typecheck/build 通过。最后重试事件修复以浏览器通过为证，不伪称该行修复后再次全量构建。手机截图 multi-select-mobile.png 已检查。总体目标未完成。

日期/树列表切片：日期组件保留 date-only 字符串，无隐式时区、自动校验或请求；调用方仍执行原起止校验。新增双端清空且不提交表单，错误描述关联，readonly/disabled 接口。修复示例标签结构冲突后日志/配置/showcase/选择器17项通过。

TreeListLayout 从用户页提取左右槽位，原部门树算法/权限/请求保留，公共 CSS 不再使用 user-layout 命名。手机可折叠侧栏，组件内保留已挂载 sidebar 状态，桌面恢复显示；新增 showcase 树列表分类页。用户/workspace/showcase12项通过，覆盖五类草稿/权限回归及新折叠选择保留。lint/typecheck与131单元通过；最终构建/生成客户端复现均通过（既有 chunk 提示），桌面树列表截图已检查。后端及真实MySQL未重跑，最终全目标门槛仍未完成。

树选择切片：TreeSelect 受控精确 string ID，支持范围内孤立根、祖先搜索、折叠、方向/Home/End/Enter/Escape、选后回焦点、未知已选值、清空及加载/错误重试/禁用/只读。已迁移用户编辑部门，保留原授权选项来源及仅当前停用部门可保留规则，移除重复外置搜索。实际浏览器揭示搜索展开后右键沿用旧折叠状态误选父节点，修复后通过。用户 HTTP 夹具已证明 9007199254740993 原样提交与其他停用部门排除；夹具最初详情 envelope/非数字 ID 不符合真实契约已更正，没有改生产算法规避。

本地证据：11 项用户/示例/选择器通过，补充状态及用户提交后 7 项选择器通过（集合重叠不累计）；131 单元、lint/typecheck/build 通过，既有 chunk 提示；手机 tree-select-mobile.png 已目检。真实环境用户脚本已适配新控件，尚未执行；后端及 API 未变，本阶段不宣称全目标或真实 SQL 回归完成。

关联选择切片：ReferenceSelect 组合固定 EForge Selector 公共接口，受控 string/null，支持搜索、缺失已选记录回显、加载/失败重试/禁用/只读/清空；选项及授权、请求均由调用方提供。已迁移生成器字段字典关联并加入示例客户关联，真实环境生成器脚本适配后尚未执行。没有新增动态表单引擎或复制上游源码。

证据：生成器8项浏览器通过、示例5项通过、最终选择器9项通过（集合独立报告不作为全量验收）；131单元及构建通过，lint/typecheck通过。最初测试错把 EForge 可编辑 Selector 的 button 当 combobox、空结果同时匹配读屏公告，均按实际公开控件语义收紧定位；新增状态夹具后旧多选加载定位限定自身组件，未降低断言。其余模板及完整消费者审计继续 pending。

编辑/详情模板切片：EditorForm 统一提交阻止重复、busy/error及按钮，EditorDialog 组合原 ResourceDialog 焦点/几何/关闭行为，EditorPage 组合 FormPage。业务校验、请求、幂等标识和草稿 hook 留在调用方；字典与请假已迁移，示例表单采用标准编辑页且清空覆盖新增字段。迁移时发现原请假 cancel 调用 discard.confirm 却未渲染 discard.dialog：针对性测试真实失败后补齐挂载，继续编辑保持草稿、明确放弃与焦点返回通过。

DetailTabs 组合共享 PageTabs，稳定自动关联 id、键盘焦点和隐藏但保留挂载的面板；TabbedDetailPage 提供标题/内容/操作框架。详情示例覆盖两页签所有8字段标签。workflow-local ApprovalDetailLayout 通过 summary/tasks/history/actions 槽位接入实际审批，原命令修订号/重复请求/权限判断保持业务端。25 项字典/请假/示例/工作区浏览器通过，详情补充后11项示例/请假通过（有重叠不累计）；不代表真实 SQL 最终验收。
本轮最终 lint/typecheck、131单元及生产构建全部通过（既有 chunk 提示）；详情桌面截图已目检，页签下划线/信息标签/操作区统一。生成客户端、后端、真实环境最终回归尚未执行，完整目标保持进行中。

明细表切片进行中：EditableDetailTable 受控 rows、显式行 key、列渲染、busy/readonly、增删/空态/逐行错误/合计槽位，增删后焦点迁移。MasterDetailLayout 在已有 PageForm 中组合主字段和明细，不嵌套 form。实际 React 子表模板已替换手写 Table，UI UUID 放 editor.childRowKeys，不混入提交 form；主子读取仍保留旧 PK/FK 和字段权限判断。采购示例验证增删后稳定 identity、内容/焦点、合计及只读；补 EditorForm 只读禁止提交和 FormField 必填重复星号样式。

当前7项 showcase实际浏览器通过，首次测试只误匹配组件内部空status已收紧为表单反馈。目标 GeneratorEforgeApiTemplateTest 4项通过真实Java生成编译。完整 Maven 首次运行被沙箱 ByteBuddy attacher 阻塞，已核验并仅终止本次3个Java验证进程；新的完整验证 session76147、shared-ui-detail-maven-verified.log 尚在运行，未验收。现有本地服务使用 target-flowable 包，默认 target 构建独立；另一个项目占用18081，真实环境须选空闲端口，勿停止他项目服务。前端131单元/build曾通过，最后只读/星号修复后需补最终静态及构建。不以示例或4项Java测试冒充生成TS/真实SQL浏览器完成。

后续实证：session76147 完整 Maven verify 已终态0（shared-ui-detail-maven-verified.log BUILD SUCCESS）；最终只读/星号后的静态、131单元和构建已通过。session59931 真实生成部署已证明生成TS/lint/生产build，以及CRUD/tree多项实际读写，但在sub失败：旧脚本限定 section[aria-label]，新组件用 aria-labelledby 提供同名区域。已改为按 region 可访问名称定位，保留原字段/SQL断言；session20232 正在独立18091/13426/16426顺序重验，日志 shared-ui-detail-generated-retry-runtime.log，未终态不得声明通过。

确认/异步切片：ConfirmActionDialog 复用 ResourceDialog 和 Feedback，busy禁用操作/取消及原生Escape，失败保留并由业务重试；岗位删除保留原身份/权限/请求。AsyncContent 显式互斥状态，不接管缓存或请求，任务上下文原本卸载的条件内容已迁移；后台列表刷新仍保留原DataTable行为。showcase展示加载/空/失败重试和确认失败重试/回焦点。岗位4项+任务11项通过，最终showcase8项通过（首轮仅status定位匹配EForge按钮内部读屏节点，限定反馈容器后通过）；lint/typecheck、131单元和生产build成功，既有chunk提示。全目标验收仍未完成。

生成重验更新：session20232 终态1，已通过sub实际各字段及主/子上传历史回填，后续外观检查仍限定 form > label，无法定位 MasterDetailLayout 下主字段。已将字段范围按sub定位到 .master-detail-fields，保留原桌面/手机无溢出与富文本不得遮挡下一字段的几何断言，没有修改生产实现。session20256 正在顺序重跑同独立端口，日志 shared-ui-detail-generated-layout-runtime.log；源码保持固定，不重复启动。旧59931/20232均已终态且清理完成。确认/异步真实删除失败/重试请求测试与全量消费者最终审计仍需完成，不能仅凭岗位只读测试宣布删除交互全验收。

2026-10-13 后续验收：session20256 已终态1，在sub明细滚动断言发现旧检查针对外层section；新模板内部 .detail-table-scroll 才拥有滚动。已改为按“子表明细表格”区域验证 scrollWidth > clientWidth，保留无溢出与主字段宽度断言。生成数据/API仍未最终验收，不能宣称通过。

补齐实际岗位 DELETE 请求体夹具：精确9007199254740993、等待期间按钮/Escape锁定、409保留、重试仍同ids、204关闭，5项岗位测试全通过。初版测试误假定URL带ids已按生成契约修正，产品请求不变。审批局部模板新增展示中心 approval 分类，操作区/记录/状态跨页签联动，采购空明细失败校验加入浏览器，最终showcase+selectors18项通过。

全量模拟浏览器 session98634/shared-ui-final-browser.log：241项中240通过，唯一旧外观测试全局CSS统计计入新增ReferenceSelect隐藏选项；改为当前可访问listbox的option计数后 session53351 两项外观通过（包括原失败项）。未改产品语义或移除断言，手机390截图已目检。session43837 最终生成客户端可复现、typecheck/lint、131单元/build均通过，只有既有chunk提示。

当前唯一权威进程session60392正在默认完整API+VerifyWeb+VerifyGeneratedReact（shared-ui-final-disabled-runtime.log）成功后顺序启用consoles/custom-output/workflow/async的完整API+VerifyWeb（shared-ui-final-enabled-runtime.log），端口18091/13426/16426，仅拥有的临时容器。两实时契约输出shared-ui-final-disabled/enabled-openapi.json。勿重复启动，运行期间不修改源码/重新打包；终态与OpenAPI精确核对后继续最终逐项状态/消费者审计、必要边界测试、提交推送。整体目标尚未完成。

接续更新：60392已终态1；生成七类真实页面及全部生成SQL/HTTP/浏览器检查全部PASS，随后原框架导航数量断言因已安装测试生成菜单失败。保留导航断言，改为独立不安装生成模块的框架环境；不能称60392整体成功。单选组审计发现未知旧值未回显，RadioGroup补unknownLabel与旧值条目，不改变值或自动提交；profile4项及新增shared-form-states通过（必填/错误描述、只读/禁用/空、未知值保留和移除、日期保护、busy明细），手机状态截图已查看。session87673最终typecheck/lint、131单元和build均成功。新增逐项审计 docs/shared-ui-completion-audit.md。

框架默认session26516终态1：65/68真实浏览器通过，三个用户测试共用创建步骤遗留 selectOption('103')。已与其他部门编辑步骤统一为点击树及精确103研发部门；没有改产品或业务断言。未启动其顺序启用段。当前唯一进程session59753正在同独立端口顺序运行默认及启用完整API/VerifyWeb，日志 shared-ui-framework-verified-disabled/enabled-runtime.log，契约同名前缀-openapi.json。源码保持固定，不重启、不并行抢端口、不运行app时打包。终态后核对OpenAPI/审计、精确提交推送；目标保持进行中。

最新交付/验证：实现27文件已精确提交推送46da40a8e6be964e484dd365c5c42aad3915680c到codex/compact-list-layout。普通无关root JSON保留；web/generated/api.ts确认diff为空后仅刷新索引，未包含内容噪音。session59753默认阶段已经68真实浏览器与全部SQL/API终态成功，并已开始启用consoles/custom-output/workflow/async阶段。默认OpenAPI与contracts/openapi/api-v1.json结构严格相等、换行规范化后字节一致；原hash差异仅CRLF。

精确46da40a云端web38387687845终态success，shared-ui-cloud-web.log直接确认242浏览器、131单元、生成复现、lint/typecheck/build全部成功；agent-skills38387687883成功；server38387687803尚in_progress。不要重复启动session59753，当前启用日志shared-ui-framework-verified-enabled-runtime.log正在工作流API验证；完成后核对其68浏览器/全部API/契约，以及server精确终态，再更新全表状态和最终验收文档提交推送。当前仅两份验收文档有后续未提交更新，全部实现已推送，整体goal仍active。

最终验收（2026-10-13）：session59753顺序默认及启用完整真实API/浏览器均终态0，两套各68浏览器成功，最后导航/登录/Redis/验证码/OpenAPI总PASS；本次临时环境已清理。两实时OpenAPI统一换行后与契约字节一致。精确实现46da40a的server38387687803四项、web38387687845、agent-skills38387687883全部success；直接云端日志包括两套实际生成页面验证、完整Maven、131单元和242模拟浏览器。所有规格条目已完成，表单构建器仍暂缓；未合并main或部署生产。
