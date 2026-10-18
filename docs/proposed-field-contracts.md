# 字段、弹层和错误定位契约方案

状态：**H04 组件实现、前端回归与两配置生成应用通过，完整真实环境/云端仍待验收；H05 尚未实施**。日期：2026-10-15。对应 `spec/framework-hardening.md` / `tasks/framework-hardening.md` 的 H04、H05。FormField、三种选择器、富文本、CheckboxGroup、RadioGroup、DateRangeField 已接入字段契约与真实消费者。最终 lint/typecheck、生成客户端复现、131单元、294模拟API浏览器、build及正式产物5项通过。下表记录设计时问题，不代表修复后仍全部存在；完整最终运行与云端证据以任务清单为准。

## 本地实现与证据

- `framework-fields-final-generated/unit/build/browser/dist.log`：顺序进程54797终态0，分别证明客户端复现、131单元、正式构建、294浏览器及5项dist。
- ReferenceSelect 默认ID跨可用状态保持、TreeSelect变只读时仅在内部焦点被移除后回焦、Quill两层Escape：`field-contract-review-red-native.log`四例修复前失败；最终 `field-contract-review-final-browser.log` 50/50通过。不会将覆盖层后不可直接点到的按钮用例冒充成功外点保存。
- 选项组/日期新增五例先红，最终 `group-field-contracts-accepted-browser.log` 37/37，`group-field-contracts-final-static.log` lint/typecheck通过。Checkbox required只描述整组必填，不强制每项选中；Radio使用实例独立name；公开focus定位实际选项或只读/空组；Date保留日期字符串、旧error并与fieldError去重。
- 日志和参数配置继续保留全局日期错误，并关联到实际日期字段；当前高级筛选收起时不会强行聚焦隐藏控件，自动揭示和提交后导航属于H05。用户编辑对已选停用岗位/角色补帮助说明，未知旧值和精确ID不变。
- 生成模板为主表/子表富文本提供业务字段名和独立ID，移除包裹其自身标签的外层label。`server/eforge-boot/target/hardening-generated-default.log` 与 `hardening-generated-enabled.log` 均终态通过：真实生成并编译CRUD/tree/sub及自动主键/String键应用，实际浏览器按richContent/childRichContent分别定位并验证ID唯一，保留上传、Activity、布局、精确长ID/金额、时区、权限和SQL内容断言。两份安装后OpenAPI一致；这是实际生成应用证据，不是普通mock套件。

## 设计时的问题基线

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

## H04 完整验收范围

以下范围已接入组件并通过前端回归；实际生成应用与两配置运行仍需最终验收，不以第一薄片替代完整范围。

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

状态：**以下是 2026-10-15 只读核查后的待实施方案和 RED 矩阵，不是已实现或已通过的证据**。H01/H04 最终验证期间只补此文档，生产组件、生成模板和测试源码继续冻结。

### 核查结果与第一闭环

- `GeneratorEditor.tsx` 的 basic/fields/output 面板已通过 `hidden` 保持挂载；`save` 当前只抛一段 `LocalValidationError`，没有字段目标。`columns` 使用精确字符串 `field.id` 作 React key，拖动及上移/下移会重排数组，适合验证错误身份不能绑定 index。字段排序还保留原生 `required/min=0/max=1000000`，不能在摘要接入时漏掉这些约束。
- `WorkflowPackageEditor.tsx` 的审批场景位于默认收起的高级 `details` 中；JSON 格式/最多 20 项的本地错误目前只出现在表单末尾。揭示该字段可以验证焦点导航，同时必须保留设计器未应用属性、BPMN 内容和页面草稿保护。
- `EditableDetailTable.tsx` 已有 `getRowKey`，但新增/删除后的 `focusRow` 存的是数组下标，并查询行内第一个原生输入。异步新增、重排或复合控件会使这个假设失效。当前 `rowError` 仅展示在首格，不提供具体字段定位。
- 生成模板 `vm/react/Page.tsx.vm` 的 `requiredMessage` 只返回首条文字。编辑已有主子记录时初始化了 `childRowKeys`，新增编辑状态没有显式初始化；`getRowKey` 仍有 `String(index)` 回退。空的新建子表目前可以正常逐行生成 UUID，但这个回退不是可依赖的稳定身份合同。H05 必须完整初始化所有新建/编辑入口、保持 keys 与业务行同一次状态变更、移除索引回退，不把客户端行键写入请求 DTO。
- `web/ui/data.tsx` 只是固定 EForge 依赖的展示表格包装。首轮不把编辑、业务校验或错误导航塞进 DataTable；编辑合同放在 EditableDetailTable，列表排序/分页/选择仍由原调用方控制。

首轮选择 **GeneratorEditor、WorkflowPackageEditor、MasterDetailDemo 和真实生成的主子表页面** 共同构成闭环：实际隐藏页签、实际高级配置、公共 EditorForm/明细模板及实际生成代码都必须接入。下面原有消费者清单仍保留；第一闭环不代表其余表单已经迁移。

### 错误输入与导航

- 业务提供结构化错误（稳定 key、可读 label、message、目标信息）；公共组件只负责展示和导航，不解析服务端英文错误消息或执行业务规则。
- EditorForm 保留全局 error，增量接受 errors 与 onNavigateError；摘要在表单前部可聚焦。只有明确失败提交或用户点击才导航，不在每次输入时抢焦点。
- 页签或 details 由实际调用方先揭示目标；在 React 提交后再聚焦，使用 pending target/layout effect 或已挂载的目标注册，不用固定 sleep 猜时序。
- hidden 面板保留挂载及草稿；对真正惰性未挂载的内容等待注册完成；不得跳转整个路由或重建表单来定位错误。
- 已删除、禁用或权限不可见目标要安全回退到摘要/所属可见区域，不能为定位错误扩大权限或打开隐藏数据。
- 当前 ApiError 大多只有 status/code，不能宣称已有通用服务端字段错误协议。先用明确本地验证或业务 code 映射；未知服务端错误保留全局安全提示。
- 使用原生 required 的隐藏页签有“invalid control cannot focus”风险。迁移时若使用 noValidate，必须先提供等价完整显式校验，不能仅关闭原生验证求通。

### 拟新增的最小公开 API

以下名字和字段是实现起点，正式落地须由类型检查与消费者验证，不以类型断言或未实现的 props 提前宣称支持。

```ts
type FormErrorTarget = {
  scope: string;   // 调用方拥有的区域，例如 basic、fields、output、children
  field: string;
  rowId?: string;
};
type FormErrorItem = {
  key: string;     // 稳定错误身份，不使用显示序号
  label: string;
  message: string;
  target: FormErrorTarget;
};
type ErrorSummaryHandle = {focus: () => void};

// ErrorSummary 可独立用于现有 PageForm；EditorForm 同样透传这些可选属性。
type ErrorSummaryProps = {
  errors: readonly FormErrorItem[];
  onNavigateError: (error: FormErrorItem) => void | Promise<void>;
  ref?: Ref<ErrorSummaryHandle>;
};
// EditorForm 增量：errors?、onNavigateError?、errorSummaryRef?。
// 原 error、onSubmit、noValidate、busy/readOnly、取消与草稿策略全部保留。
```

- 摘要在表单前部显示错误数量和可操作条目；条目使用 `type="button"`，不会再次提交。已有 PageForm 消费者可直接放 ErrorSummary，不为接入摘要全面重构弹窗或表单布局。
- scope 只供调用方映射到既有页签/details，公共摘要不认识路由、权限、字段配置或业务规则。错误身份按完整元组生成，例如序列化 `[scope,rowId ?? null,field,rule]`，不以未经分隔的字符串拼接区分身份。
- 明确失败提交后，调用方提交错误状态并在 React 提交后聚焦摘要；用户选择条目再揭示字段。允许调用方明确选择导航首错，但不能在错误文案、输入值或候选选项变化时自动抢焦点。没有提供导航回调的兼容调用方只显示文字，不显示失效的“链接”。
- 字段内错误继续由 FormField 或已有自带标签组件拥有。摘要是导航入口，不能再次制造控件的 label/description ID，不能复制私有依赖的 Field 实现。
- 首轮不新增统一业务校验引擎、远程字段错误协议或整个表单状态容器。未知 API 错误继续走现有安全全局提示，禁止解析 driver/server detail 推测字段。

### 异步揭示与焦点：表单内的有限状态

先在实际消费者使用小范围 pending-navigation 状态；重复代码确实出现后才提取局部 hook。这个状态只管理一次用户意图，不拥有字段值、校验、页签状态或请求。

1. 摘要点击时，调用方依据当前草稿和可用区域重新确认目标存在。记录递增导航序号和稳定 target，并设置相应 `setTab`/`details.open`；被删行、禁止访问的区域直接回退摘要。
2. 同步 mounted 面板在调用方 `useLayoutEffect` 中、React 已提交后解析真实目标。解析使用已知 ID 的 `getElementById` 后校验属于当前表单，或实例 ref；不使用任意业务键拼 CSS selector，不在 setState 后立刻 focus。
3. 真正异步/惰性内容由该消费者的已有 ready 回调或可取消 Promise 表明“内容已准备”，再推进这次 pending-navigation；不能把 `await setState(...)` 当成提交完成，也不能用固定 sleep、无限轮询或全局 MutationObserver 等待未知控件。
4. ready 后只处理仍有效的最新序号。较早的 Promise、已关闭编辑器、已删除行或更晚的用户导航不能抢回焦点；揭示失败应终结本次请求并回退摘要。卸载/关闭要取消 pending 意图，不让稍后注册的同名字段接走旧请求。
5. 定位前确认控件仍连接、可见且不处于 hidden/inert/disabled 的祖先下。优先使用 H04 的公开焦点合同：普通输入/三种选择器的公开 ID，RichTextEditor、ChoiceGroup、DateRangeField 的公开 focus（日期可指定 from/to）。不依赖内部 DOM 类名，不把外壳误作实际输入，也不为定位擅自启用禁用控件。
6. 导航结束校验焦点确实位于该目标或其公开组件内部；失败回退当前摘要/可见所属区域，保留全部草稿和错误。点击错误只改变揭示/焦点，不保存、重排或重新请求业务数据。

本轮实际消费者不必为了测试异步而增加业务延时。异步 ready、旧响应和卸载竞态在独立组件 fixture 用受控 Promise 复现，实际生成页另外证明富文本就绪后定位真实编辑根。

### 明细表

- 保留 getRowKey 和 rowError；新增 cellError（按 rowId + columnKey）及对应 control props/error 描述 ID，作为 DetailColumn.render 第三参数的增量字段。
- 行键和字段键全程保留字符串，不转 Number。视觉行号只用于文案，不能用作错误身份。
- 每格的 ID 必须稳定且避免键拼接碰撞；不能用未转义业务键拼 CSS selector。使用公开 ID 定位或 ref，不依赖控件内部 DOM 类名。
- 新增/删除后的焦点改为稳定行键和字段键；捕获实际下一行/前一行身份，异步新增需依据新出现的键而非当时数组长度。
- 生成页面已有 childRowKeys，应复用并保证完整初始化。新增、删除、重排后错误归属不能移动到另一行；未知/被删除目标回退安全。
- 多控件单元格保留调用方决定具体 field 的能力，避免把第一格第一个 input 当作通用错误定位。
- 聚焦错误不提交数据、不改变明细顺序、不丢焦点所在行草稿。

明细 API 的具体落点：

```ts
// EditableDetailTable 增量，原 getRowKey / rowError / render 参数保持。
id?: string;
cellError?: (rowId: string, field: string) => string | undefined;

// DetailColumn.render 的第三参数追加：
field: {id: string; error?: string};
rowId: string;
// field.id 对应当前列；同格多控件由调用方各自建立稳定 field 子键。
```

- 表格实例 ID + 精确 rowId + 字段 key 形成稳定控件 ID；长度分隔/编码后的完整元组必须无碰撞，不能将 `a:b + c` 和 `a + b:c` 合并，也不能丢掉大于 JS 安全整数的 ID 精度。
- **每个字段只保留一个错误展示所有者**：原生输入使用 `FormField id={state.field.id} error={state.field.error}`，由其 render-prop 提供实际 control props/label/error 描述 ID；自带标签的 ReferenceSelect/MultiSelect/TreeSelect/RichTextEditor 等直接用 `id` 和 `fieldError`。表格不再额外渲染第二份 cellError。旧 rowError 保留为独立行级错误，不拿它代替 cellError。
- 新增行为拟向后兼容扩展为 `onAdd: () => void | string | Promise<void | string>`，返回字符串表示本次真正创建的 rowId；状态提交后再以该键定位。旧 void 调用仅在前后键集合恰好新增一个键时安全推导；多个候选或失败不得猜“最后一行”。异步回调必须处理拒绝并清理 pending，不能成为未处理 Promise。
- 不再默认寻找“第一格第一个 input”。新增/删除焦点可增加可选 `onFocusCell({rowId,field})` 和明确首选列键，复用消费者上面的定位回调；未接入的旧消费者安全回到行/表格区域。实际 MasterDetailDemo 与生成消费者须接入字段焦点，不能只修改公共签名。
- 删除前记录相邻行的稳定键，确认删除已在 rows 提交后选择仍存在的下一行/前一行；没有行回到新增按钮或表格区域。排序不改变这些身份。若异步操作期间用户已离开该操作区域，不在完成时夺回焦点。
- 生成页面所有 childRowKeys 生命周期需与行数组一致：新建空数组、详情载入完整 UUID、增删同一次更新，若将来支持移动则两个数组同次移动。编辑过程中不得因校验、页签切换或重新 render 重新生成键。直接验证 keys 不足/重复的内部错误，而不是静默退回 index。

### 解冻后先执行的 RED 矩阵

下表是待编写、待运行的用例，不宣称当前已取得 RED 或 GREEN；也不修改现有成功断言来适配新结果。

| 消费者/层次 | 先构造的反例 | 必须证明的修复结果 |
|---|---|---|
| GeneratorEditor 真实页面 | 清空生成信息的必填包名，切回基本信息提交；同时保留备注、菜单选择和字段草稿 | 摘要列出正确字段；点击后切到 output 并聚焦包名；所有草稿/长 ID 不变，未调用保存 API |
| GeneratorEditor 字段页签 | 让一个字段排序为空/越界或保留不支持的旧选项，切走后提交；再上移/拖动该字段 | 不出现浏览器隐藏 invalid-control 焦点错误；错误仍归属同一 field.id，修正后提交原精确 ID/顺序 |
| 原生验证兼容 | required、排序 min/max、日期或其他已存在约束分别无效 | 不能用 noValidate 消除失败而漏掉等价约束；普通输入与复合控件均可纠正；校验规则仍由调用方拥有 |
| WorkflowPackageEditor | 修改场景为坏 JSON，收起高级 details 后保存；保留未应用节点属性和流程名称 | 摘要揭示 details 并聚焦场景；不重建/切换设计器、不丢 XML/未应用草稿、无网络写入；改好后原保存/版本冲突逻辑不变 |
| MasterDetailDemo/公共明细 | 建立 A/B/C，给 B 数量错误，删 A、插入 D、再重排行；点击原错误 | 始终定位 B 的数量；A/C/D 的值和标识不变；修正 B 仅消除 B 的相应错误；金额/数量业务规则不变 |
| 公共明细异步 | 新增 Promise 未完成前插入/删除其他行，或完成前用户转移焦点；删除失败/最后一行删除 | 返回 rowId 决定目标；多新增候选不猜；旧异步操作不抢焦点；失败不跳错行；空表回退可见区域 |
| 真实生成主子表 | 两子行分别含必填/富文本/选项组错误；删除第一行再增行，跨错误点击 | requiredMessage 替换为完整结构化结果；每行同名字段 ID 唯一，导航到剩余原行的正确控件，childRowKeys 无 index 回退，DTO 没有 UI 行键 |
| 真实生成兼容 | CRUD/tree/sub/autosub，insert-only/edit-only/自动 PK/非自动 PK/外键及只读详情 | 只校验当前真正可写字段；保持原字段值转换、长 ID/BigDecimal、上传 busy、安全显示、201/204 和实际数据库内容 |
| 受控异步 fixture | A 揭示慢、B 揭示快；A ready 前关闭表单/删除行/改变权限；目标已禁用或不存在 | 仅最新有效导航能聚焦；失败/不可用回摘要；无旧响应焦点劫持、无隐式解禁、无读取隐藏业务数据 |
| 稳定身份/可访问性 | 特殊字符/Unicode/分隔符组合、长 ID、多表实例、同格两个控件 | 无 ID 碰撞/选择器异常；摘要条目键稳定；label/hint/error 只关联正确控件，没有双 label/双错误说明 |
| 真浏览器/正式产物 | 键盘 Enter/Space 点击摘要、Tab/Escape、桌面与 320 宽度、长错误文本 | 条目不提交表单，焦点可见且无页面横向溢出；隐藏面板草稿仍保留；打包产物同样成立 |

优先扩充 `web/tests/e2e/generator.spec.ts`、`workflow.spec.ts`、`showcase.spec.ts`，新增独立 H05 导航/明细 fixture 处理受控异步与特殊键；生成消费者扩充 `web/scripts/verify-generator-react-browser.mjs` 的真实生成应用路径，保留原编译、HTTP、SQL、上传、Activity 与布局断言。第一轮不以 fixture 通过替代真实业务/真实生成页面验证。

## 真实消费者与迁移顺序

1. 用户编辑/角色分配：`web/features/users/UsersPage.tsx`；部门范围、停用/未知角色和精确长 ID 保持。
2. 字典编辑：`web/features/dictionaries/DictionaryEditor.tsx`；默认项、名称/code/键值/排序/样式/备注的业务规则保持。
3. 请假与流程包：`WorkflowLeaveEditor.tsx`、`WorkflowPackageEditor.tsx`；日期/事由、提交标识和草稿保护保持，高级 details 错误可揭示。
4. 公告：`NoticesPage.tsx`；内容字段、上传、安全预览、busy/重试保持。
5. 生成器配置：`GeneratorEditor.tsx` 的 basic/fields/output 三个面板，排序使用字段 id，字典关联加载错误与字段错误隔离。
6. 生成业务：`server/eforge-generator/src/main/resources/vm/react/Page.tsx.vm`；root/child FieldControl、多个 editor、稳定 childRowKeys 和 requiredMessage 数据结构实际接入。
7. 展示页：Form/MasterDetailDemo 等同时展示正常、帮助、错误、加载失败、重试、只读、禁用及跨页签定位，不只展示静态 API。

## 测试准备与验收

H04 已创建并进入完整回归的独立测试包括：

- `web/tests/fixtures/field-contracts.html`
- `web/tests/fixtures/field-contracts.tsx`
- `web/tests/e2e/field-contracts.spec.ts`
- `web/tests/e2e/rich-text-field-contracts.spec.ts`
- `web/tests/e2e/group-field-contracts.spec.ts`

这些 fixture 使用正式 props 类型接受检查，行为修复保留先失败后通过的证据。当前 H04 最终运行期间冻结源码；H05 的新实现及红测试在该切片解冻后再进入工作区，避免污染正在进行的验收。后续行为测试同样不得以 any、额外 props spread 或错误抑制绕过类型契约。

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

## 2026-10-18 阶段验收

H04精确提交7331671已通过完整云端验收：131单元、294模拟浏览器、5正式产物、两配置各68真实浏览器与完整API、实际生成富文本字段关联。H05设计尚未实施，不能以H04验收替代隐藏错误导航和明细定位。 统一证据见 [H01–H04验收](framework-hardening-h01-h04-acceptance.md)。

## H05 首片：流程包高级场景

2026-10-18：FormErrorSummary只负责可聚焦摘要和结构化目标事件，业务校验/揭示/聚焦由调用方拥有。流程包沿用原JSON数组/最多20项校验，错误时聚焦摘要；用户点击后通过本组件details与textarea引用展开聚焦，不全局查询、不重建设计器、不改原XML约束和服务端校验。新增真实页面测试先因摘要缺失失败，接入后通过，并断言名称/未应用节点草稿保留、无错误写入、修正后只保存一次。跨页签异步导航、明细稳定rowId及生成模板尚未实现。

首片验证：h05-workflow-red.log复现失败，green/keyboard日志通过（键盘Enter、320宽度摘要边界、草稿及实际保存事件）；h05-workflow-lint/types/unit/build/browser/generated/dist分别通过，131单元、295完整模拟API浏览器、5正式产物。此片仅前端，不重新打包未修改的后端；后端基线7331671完整云端已通过，当前首片的真实API两配置及精确CI尚待核验，不沿用旧提交冒充新结果。五轴审查：无新依赖/网络请求/后端契约，摘要内容由React转义，局部ref导航无全局选择器/异步抢焦点，原XML约束及场景验证不变。

## H05 第二片：生成器隐藏字段

2026-10-18：GeneratorEditor 接入结构化错误摘要，覆盖原8个必填文本、前端/Java/查询/控件选择和字段排序。摘要定位使用组件实例+scope+精确field.id+字段名的元组，不使用数组索引；页签提交到DOM后再聚焦，重排不改变目标，缺失/禁用目标回摘要。草稿和所有面板继续挂载。

原数字框清空时Number('')会写成0，现保留空串直到校验；采用noValidate避免隐藏原生invalid-control阻断提交，但明确保留原required/min0/max1000000/默认step1的等价校验，空/负数/超限/小数均拒绝请求。DTO仍发number且不包含UI目标信息；旧无效选项保留展示而不静默替换。

首轮公开Input的id未落到真实input，实际浏览器定位失败（h05-generator-green.log）；改用固定EForge公开ref定位，不改依赖、不引入私有API，最终ref-green及生成器整组10项通过。原label/错误关联由Input自身拥有；原生Select和排序框使用稳定id及精确错误描述。h05-generator-red.log保留最初摘要缺失失败，新增用例证明包名隐藏错误、备注/菜单长ID保持、全部排序边界及旧类型在重排后定位同一字段。

完整前端回归正在执行，精确提交云端尚待验收。此片不代替EditableDetailTable异步新增/删除、生成主子字段和通用EditorForm的H05工作，也不宣称H05完成。

第二片本地验收：final-lint/types/generated/unit/build/browser/dist全部通过，131单元、297模拟API浏览器、5正式产物；追加visual用例通过并人工查看320截图，摘要无横向裁切。仅追加截图测试发生在完整回归之后，产品源码未再修改。第一片f8a0a60的web39086338220、技能39086338216已成功，server39086338236仍运行；第二片云端尚未验收。
