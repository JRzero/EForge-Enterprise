# 字段、弹层和错误定位契约方案

状态：**设计待实现，红测试待创建**。日期：2026-10-15。对应 `spec/framework-hardening.md` / `tasks/framework-hardening.md` 的 H04、H05。第一薄片接口已通过本轮技术方案确认；当前仅落盘设计，等待 H02/H03/H12 精确提交与验证完成后再创建独立红测试。未修改运行时组件，不缩减 H04/H05 完整范围，不把设计、示例或公共类型当作业务验收。

## 当前证据

| 组件/模板 | 源码事实 | 影响 |
|---|---|---|
| `web/ui/FormField.tsx` | `useId` 内部生成标识，返回 id、required、invalid、describedby；label 只有 htmlFor | 没有可供错误摘要稳定定位的外部 ID；非原生 labelable 控件不能只靠 htmlFor 获得名称 |
| `web/ui/MultiSelect.tsx` | 自带标签；error 同时触发 invalid 和选项不可用；loading/error 移除 options，但 activeIndex 仍按过滤结果计算 | 无法区分字段错误与加载失败；可能引用不存在的 active descendant |
| `web/ui/TreeSelect.tsx` | 自带标签；无字段级帮助/错误；readonly 与 disabled 同样禁用触发器；没有外部点击/离开焦点关闭 | 标签/错误不能通用关联；弹层状态和焦点规则尚未收敛 |
| `web/ui/ReferenceSelect.tsx` | 通过公开 `Selector` 展示，error 禁用触发器；没有字段验证参数 | 将字段验证错误塞进 error 会阻止用户修正值 |
| `web/ui/RichTextEditor.tsx` | Quill root 名称固定“公告内容”，仅 disabled；上传错误独立本地状态 | 多个业务富文本无法区分或准确关联帮助与字段错误 |
| `web/ui/EditableDetailTable.tsx` | React key 来自 getRowKey；rowError 只显示在首格；新增/删除后 focusRow 是索引 | 无字段级错误；删除/重排/异步新增后不能可靠定位同一行 |
| `web/ui/EditorTemplate.tsx` | EditorForm 只接受一个表单级 error | 没有可点击、可导航的错误摘要 |
| `web/ui/TabbedDetailPage.tsx` | 隐藏页签仍挂载，值由调用方控制 | 可以保留草稿，但错误导航必须先揭示目标，再聚焦 |
| 生成器 `vm/react/Page.tsx.vm` | 主表包裹 label；所有 editor 字段复用公告名称；子表已有 childRowKeys；requiredMessage 只返回首条文字 | 多富文本、主子字段定位需要实际模板接入，不能仅改 showcase |

固定的 EForge UI 依赖来自 `a7b644b724f4264c1ca015ce4c686ca94476d62f`；本方案不升级基线、不复制源码、不让产品代码直接导入 Astryx。对依赖的核查仅用于确定公开 API 的真实行为。

## 第一薄片：兼容字段展示属性

只新增可选属性，原值/事件/权限/请求契约保持。暂不引入表单状态库、规则执行器、动态表单或远程查询。

### FormField

- 增加 `id?: string`；有值时作为控件 ID，没有时继续 `useId`。
- 给可见 label 稳定 ID，返回的 `FieldControlProps` 新增 `aria-labelledby` 指向它；保留原 htmlFor 和其他 ARIA 属性。两条关联指向同一个标签，测试必须断言精确可访问名称只有一份，不能靠重复隐藏标签拼接名称。
- `required` 仍是展示/可访问语义，不能擅自改变原生 checkbox 的选中规则。值校验和是否使用原生 required 仍由调用方决定。
- 保留 `hint?: ReactNode`、`error?: string`、span 和 render-prop；不收窄旧类型，不自动接管 disabled/readOnly。
- 显式 ID 应稳定且同页唯一；不把 label 或数组索引直接生成业务定位身份。

### MultiSelect / TreeSelect / ReferenceSelect

共同增量属性：`id?: string`、`required?: boolean`、`hint?: string`、`fieldError?: string`。

- id 落在主要可聚焦控件：MultiSelect 的 combobox 输入、TreeSelect 的主触发器、ReferenceSelect 的 Selector 触发器；不得只给外壳加 ID。
- 组件保留一个可见标签所有者。独立使用无需额外 FormField，不能产生两份标签/两套帮助或重复播报。
- required 形成正确的必填语义；fieldError 形成 invalid 与关联说明，同时仍允许修正选择。
- 原 `error` 继续代表选项加载/取得失败；保留重试、loading、未知旧值和所有精确字符串 ID。不得把旧 error 改成纯字段错误而偷偷放开失败状态的候选数据。
- hint 与 fieldError 有独立的稳定描述来源；错误清除不移除 hint，不重置值、查询、已展开树或草稿。
- 第一薄片不新增 imperative ref。稳定公开 id 先提供可验证的定位边界；后续摘要如需封装 focus，必须聚焦实际输入/触发器，而非不可交互外壳。

### ReferenceSelect 的公开依赖限制

固定版本 `Selector` 支持公开的 id、description、isRequired、status、isLabelHidden；其内部最终重写 aria-labelledby、aria-describedby、aria-invalid、aria-required。单纯把 FormField 的 ARIA spread 给它不能实现正确关联。

第一薄片使用 `hint → description`、`required → isRequired`、`fieldError → status.type=error / status.message`、`id → id`，让 Selector 自身 Field 管理唯一标签和说明。不要在它外面再套一个生成相同语义的 FormField。

ReferenceSelect 的新增 hint 先采用其公开接口支持的 string；这不改变 FormField 原有 ReactNode hint。任意外部描述 ID、富文本提示或额外 label owner 尚不属于已支持的契约，不能在类型里宣称支持却被依赖覆盖。若之后确需扩展，应走明确的公开适配/上游能力决策，不改 node_modules 或读取私有 context 来绕过。

## H04 剩余必做范围

第一薄片完成之后，以下仍须实施和验收。

### 状态和弹层

- 分别保留 listbox/tree/dialog 语义，只复用有限的关闭与焦点规则，不封装一个控制所有弹层的巨型组件。
- Escape 只由当前展开层消费；关闭后下一次 Escape 才交给父 dialog。
- 外部点击关闭后保留被点击目标的焦点。继续考虑现有 click 时机约束：在 pointerdown/blur 先折叠内联菜单会移动弹窗底部按钮，导致点击失效。
- TreeSelect 在焦点离开整个组件时关闭，而不是从搜索框移到树节点/重试按钮时关闭；MultiSelect 保持输入与 listbox 的交互模式。
- disabled/readOnly 转换需要关闭真实 open 状态、清理无效 active；重新可编辑时不能自动打开之前的菜单。
- aria-activedescendant 必须指向实际挂载、可用的选项；loading/error/过滤/候选变化时同步清除无效引用。
- ReferenceSelect 保留上游弹层管理，不能外包重复的 Escape/回焦点处理。
- 明确只读与禁用的行为：只读值可被理解、复制或聚焦，但不能修改；禁用不可执行操作。TreeSelect 当前 readonly=disabled 的差异要作为明确行为变更验证，不能单靠给普通 button 加 aria-readonly。
- 组件内部移除/清空/重试按钮不能提交父表单，不能改变业务只读/禁用数据。

### 富文本

- 增加可选 label/id/required/hint/fieldError/readOnly；兼容旧默认名称，同时实际业务迁移为明确标签。
- ARIA 和 ID 作用于 `quill.root`；使用独立属性同步 effect，不因标签、帮助或校验变化销毁 Quill。
- fieldError 与图片上传错误分开关联；校验错误不禁止纠正内容。
- readonly/disabled 控制编辑、工具栏、粘贴、图片选择和上传完成后的插入，不绕过现有 HTML 安全与图片 URL 清洗。
- 保持 Activity 隐藏/恢复、选区、上传期间 busy 计数、已卸载旧编辑器不能影响新编辑器的已验收行为；不要为字段重构顺便改变上传取消策略。
- 同页多个富文本的 ID、名称、上传状态必须隔离，普通字段、主表、子表分别验证。

### 其他字段与布局

CheckboxGroup、RadioGroup、DateRangeField 等同样需要与统一错误/帮助/定位契约接轨，保持 group/legend、日期字符串、原选项和 readOnly/disabled 差异；不能因第一薄片只处理三个选择器而从 H04 删除这些需求。桌面及 320 窄屏保留标签宽度、控件最小尺寸和错误文本换行。

## H05：错误摘要和稳定明细定位

### 错误输入与导航

- 业务提供结构化错误（稳定 key、可读 label、message、目标信息）；公共组件只负责展示和导航，不解析服务端英文错误消息或执行业务规则。
- EditorForm 保留全局 error，增量接受 errors 与 onNavigateError；摘要在表单前部可聚焦。只有明确失败提交或用户点击才导航，不在每次输入时抢焦点。
- 页签或 details 由实际调用方先揭示目标；在 React 提交后再聚焦，使用 pending target/layout effect 或已挂载的目标注册，不用固定 sleep 猜时序。
- hidden 面板保留挂载及草稿；对真正惰性未挂载的内容等待注册完成；不得跳转整个路由或重建表单来定位错误。
- 已删除、禁用或权限不可见目标要安全回退到摘要/所属可见区域，不能为定位错误扩大权限或打开隐藏数据。
- 当前 ApiError 大多只有 status/code，不能宣称已有通用服务端字段错误协议。先用明确本地验证或业务 code 映射；未知服务端错误保留全局安全提示。
- 使用原生 required 的隐藏页签有“invalid control cannot focus”风险。迁移时若使用 noValidate，必须先提供等价完整显式校验，不能仅关闭原生验证求通。

### 明细表

- 保留 getRowKey 和 rowError；新增 cellError（按 rowId + columnKey）及对应 control props/error 描述 ID，作为 DetailColumn.render 第三参数的增量字段。
- 行键和字段键全程保留字符串，不转 Number。视觉行号只用于文案，不能用作错误身份。
- 每格的 ID 必须稳定且避免键拼接碰撞；不能用未转义业务键拼 CSS selector。使用公开 ID 定位或 ref，不依赖控件内部 DOM 类名。
- 新增/删除后的焦点改为稳定行键和字段键；捕获实际下一行/前一行身份，异步新增需依据新出现的键而非当时数组长度。
- 生成页面已有 childRowKeys，应复用并保证完整初始化。新增、删除、重排后错误归属不能移动到另一行；未知/被删除目标回退安全。
- 多控件单元格保留调用方决定具体 field 的能力，避免把第一格第一个 input 当作通用错误定位。
- 聚焦错误不提交数据、不改变明细顺序、不丢焦点所在行草稿。

## 真实消费者与迁移顺序

1. 用户编辑/角色分配：`web/features/users/UsersPage.tsx`；部门范围、停用/未知角色和精确长 ID 保持。
2. 字典编辑：`web/features/dictionaries/DictionaryEditor.tsx`；默认项、名称/code/键值/排序/样式/备注的业务规则保持。
3. 请假与流程包：`WorkflowLeaveEditor.tsx`、`WorkflowPackageEditor.tsx`；日期/事由、提交标识和草稿保护保持，高级 details 错误可揭示。
4. 公告：`NoticesPage.tsx`；内容字段、上传、安全预览、busy/重试保持。
5. 生成器配置：`GeneratorEditor.tsx` 的 basic/fields/output 三个面板，排序使用字段 id，字典关联加载错误与字段错误隔离。
6. 生成业务：`server/eforge-generator/src/main/resources/vm/react/Page.tsx.vm`；root/child FieldControl、多个 editor、稳定 childRowKeys 和 requiredMessage 数据结构实际接入。
7. 展示页：Form/MasterDetailDemo 等同时展示正常、帮助、错误、加载失败、重试、只读、禁用及跨页签定位，不只展示静态 API。

## 测试准备与验收

第一薄片拟创建的独立测试文件（目前尚未创建）：

- `web/tests/fixtures/field-contracts.html`
- `web/tests/fixtures/field-contracts.tsx`
- `web/tests/e2e/field-contracts.spec.ts`

源码冻结与当前切片提交期间不创建这些红测试、不启动浏览器，避免 CI 或全量测试发现未实现的新断言。解冻后先创建针对性红测试，再实施通过技术确认的显式可选接口；最终 fixture 必须使用正式 props 类型接受检查，不以额外 props spread、any 或错误抑制绕过类型契约。行为断言应在原组件上真正失败，并保留首次运行证据。首次执行前需协调完整验证进程，不让独立红测试意外混入其他切片的已冻结全量测试。

完整矩阵：

| 验收 | 必须证明 |
|---|---|
| 字段关联 | 多实例唯一 ID、label/required/invalid/hint/error 对应实际控件；更新错误保留值/查询/草稿 |
| 错误分类 | fieldError 可被修正；loading error 保留不可用/重试边界；清除一个错误不掩盖另一个 |
| 旧值兼容 | 未知/停用选项、长 ID、null/空值、只读/禁用均不被隐式改写 |
| 弹层 | 嵌套两次 Escape、外部点击保存、Tab/焦点离开、状态切换、不引用卸载 option |
| 富文本 | 多字段名称隔离、帮助/错误更新不重建、HTML 安全、图片上传、Activity、选区、busy 与卸载隔离 |
| 错误摘要 | 隐藏页签/details 揭示后焦点正确，未提交草稿保留；不存在/无权限目标不越权 |
| 明细 | 删除第一行/重排/异步新增后仍定位原 rowId+field；特殊字符键不触发错误选择器 |
| 真实消费者 | 用户、字典、请假、公告、生成器配置回归；真实生成 CRUD/tree/sub 编译、HTTP 与浏览器通过 |
| 视觉与正式产物 | 桌面/320 窄屏、焦点/错误可见；开发态及 dist 产物回归，保持原外观方向 |

保留并扩充 `shared-selectors.spec.ts`、`shared-form-states.spec.ts`、`notice-rich-text.spec.ts`、`showcase.spec.ts` 和真实业务测试。第一薄片测试通过不替代 H04/H05 完成；最终执行项目适用 lint/typecheck/test/build、生成客户端可复现及相关/完整真实环境和云端门槛。
