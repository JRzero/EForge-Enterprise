# 公共 UI 与应用组合边界

H09 进行中。固定 EForge 依赖与原组件行为不变，不复制上游源码。

## 模块方向

- `web/ui`：受控展示、字段、列表、弹层和页面模板。通过 props 接收业务行为，不导入 app/features/templates。
- `web/app`：认证、权限快照、导航、固定业务路由及页面生命周期组合。认证外壳聚合入口为 `app/workspace.ts`。
- `web/features`：API 调用、业务策略、权限 UX 和具体页面。
- `web/templates`：公共组件组合及明确标识的模拟示例。

将 ListPage、ResourceDialog、ImagePreview、分页、列显示、密码字段、头像、品牌、图标、文件链接、字典标签及其纯辅助函数的产品自有实现移到 ui。app 原路径保留转发，以兼容已有消费者及生成模板；实现只有一份，依赖方向为 app→ui。ui 内部直接引用同层文件，不经过公共 barrel 自循环。

PasswordReminder 的密码状态和固定导航属于 app，不再由 ui/account 导出。原应用消费者本来就直接导入该组件，不改变提醒或导航行为。ui/workspace 仅保留纯页签控件；认证外壳导出迁至 app/workspace。迁移时未发现旧聚合入口的源码消费者。

## 可执行门槛

现有 `npm --prefix web run lint` 直接启用本地 architecture/ui-boundary 规则：检查 import、命名/通配 re-export、字面量动态 import 和 require。规范化相对路径后拒绝 ui→app/features/templates；拒绝 Astryx、node_modules 直达路径和 EForge 非公开子路径，仅允许公开包入口及 styles.css。不修改固定依赖、不禁用既有 lint。

`ui-boundary.test.ts` 通过真实 ESLint Linter 验证非法路径拒绝、相对路径折返、动态加载以及合法公开入口/样式和 app→ui 方向。初版测试虚构文件位于工作区之外，ESLint 忽略该文件；改为实际工作区内虚拟文件后规则正确执行，143项单元通过。lint/typecheck也已通过。

## 尚待验收

完整浏览器及 dist 回归正在执行。此切片不改变 Java 源、模板或 API；本地不重复 Maven/真实 MySQL，仍需精确提交 CI 的服务器/生成应用门槛。样式入口仍按历史顺序导入 app 中的兼容样式；token→组件→模板→外壳的 CSS 归属及底层 DOM 兼容集中仍待后续切片，不能把本次 TypeScript 依赖迁移标记为 H09 全部完成。

本地终态：69211 exit0，生成客户端可复现、build成功，h09-ui-browser.log 336 passed，h09-ui-dist.log 5 passed。143单元通过，lint/typecheck通过。尚待精确提交云端验收，CSS分层未完成。

样式切片：主题变量提取到 ui/theme-tokens.css，原输入容器/焦点/尺寸兼容规则提取到 ui/compat/input-theme.css，列表布局归属 ui/list-layout.css；app 原路径保留 CSS import 兼容入口，外壳与页面呈现保留 app/enterprise-presentation.css。顺序与选择器保持不变，没有引入会改变优先级的 @layer。构建后全部 CSS 文件 SHA-256 集合与拆分前完全相同（h09-css-before.json），h09-css-build.log 成功、h09-css-dist.log 5 passed。此低影响归属变更不重复运行 Maven或全量浏览器，直接以相同产物及正式产物回归验证。历史 app/styles.css 与若干模板文件内仍有混合兼容规则，进一步梳理及可执行 CSS 边界检查尚待，不将本切片当作 H09 全部完成。

底层选择器兼容已集中到 ui/compat/selector-theme.css；页签与布尔字段布局分别归属 tab-presentation.css/choice-layout.css，原 component-details.css 仅保留顺序导入。全部正式CSS哈希仍与h09-css-before.json相同。lint现在执行check-style-boundaries.mjs，拒绝兼容目录外的.astryx-*选择器与私有CSS包导入，覆盖引号及url()有/无引号形式；不是安全沙箱或任意混淆CSS解析器。2项规则单元验证拒绝及合法例外，总145单元、lint/typecheck/build和5项dist全部通过。H09仍待历史混合基础样式清理和精确云端验收。

公共层TS迁移c33d722精确云端：server39122293097四作业、web39122293140与skills39122293093全部success；h09-ui-cloud-final.log直接证实两配置各68真实浏览器/完整API/OpenAPI以及两实际生成应用通过。后续样式7b2ce63和74460ba仍待各自终态，不以本结果代替。

样式阶段精确云端终态：7b2ce63的server39122633415与web39122633471全部success；74460ba的server39123106414、web39123106411、skills39123106394全部success。直接日志h09-css-cloud-final.log与h09-style-boundary-cloud-final.log分别证明两配置各68真实浏览器/完整API/OpenAPI及两次实际生成应用通过。上述已交付边界与样式切片验收完成；H09仍保留历史基础样式分层未完成项，不扩张完成声明。

公共主题组合接续：原ui/theme.css反向导入app/styles、enterprise-theme和workspace-layout。产品三个入口现使用app/theme.css保持原组合顺序，公共ui/theme只依赖公共层和固定依赖CSS。检查器新增相对CSS导入不得逃出ui目录，覆盖POSIX及Windows盘符；首轮错误使用posix.resolve处理D:/路径产生误报，改为join/normalize并增加实际Windows用例。

仅入口重定位时全部产品CSS哈希与h09-composition-css-before.json相同，但完整独立组件回归出现1项真实失败：attached错误提示定位规则原藏在workspace-layout，独立主题不再加载它。基础盒模型/排版移入ui/base.css后仍能复现该失败，随后将attached提示规则移入ui/compat/input-theme.css，并将图片预览和列菜单各自样式移入ui/image-preview.css、ui/column-visibility.css由组件自身导入。没有恢复ui到app的反向依赖，也没有放宽原提示位置/窄屏/图片预览断言。h09-owned-components-target.log两项通过。

组件样式归属调整后不再声称最终CSS哈希相同；完整h09-owned-theme-final.log包含静态/生成/单元/build/dist/规模/336模拟浏览器，当前运行中。未改后端运行源，本地不重复Maven/真实SQL；精确提交CI仍须执行完整服务器和生成应用门槛。历史app混合样式及UI中外壳选择器进一步归属仍待清理，不把本切片当作H09全部完成。

本轮最终本地结果：h09-owned-theme-final.log 的生成复现/lint/typecheck/build、146单元、5 dist及2规模测试通过；第一次完整模拟浏览器335通过、文件重试1失败。未改上传实现或放宽断言，h09-file-reproduce.log单worker重复五轮10/10通过，随后同源码h09-owned-theme-browser-repeat.log完整336/336通过。首次瞬态失败原因尚未确定，不能宣称已修复，后续CI继续观察。代码审查确认组件CSS单向依赖、原业务权限/数据接口未变；本切片待精确提交云端验收。

上传与外壳归属接续：UploadEntries自带upload-entries.css，原app中的文件列表网格/换行/触摸拖拽/手柄状态全部迁入，独立gallery实际验证grid与touch-action:none，保留排序、上传重试/取消及窄屏。spcore-theme中的应用导航/面包屑/顶部操作/保留页签规则迁至app/shell-controls.css，产品组合在公共主题后导入；公共组件主题不再携带该应用外壳规则。原选择器/声明保持，未改业务交互。进程85865定向4/4；最终76825 exit0：生成复现/lint/types/build、146单元、5dist、2规模及336模拟浏览器全部通过，本轮文件重试通过。h09-upload-shell-budget.json三入口预算通过。后端未变，不重复本地SQL；精确新提交CI待验收，H09历史混合样式仍有后续项。

云端失败核验：019a8b0的web39130632918成功，但server39130632914失败；d62e742的web39131208761成功，但server39131208758失败。两者均为实际生成应用Rich editor must not overlap the following generated field断言失败，不是执行器故障，前述本地前端通过不能代表完整验收。生成验证挂载Application却仍导入ui/theme，现改为与真实产品一致的app/theme；公共RichTextEditor高度/工具栏/边框规则仍藏workspace-layout，现移入其自身rich-text-editor.css，公共主题独立消费者也拥有它们。没有改原生成重叠/手机/CRUD/权限断言。新增独立桌面/手机长正文边界验证；最初精确180px断言错误，原组件内联本就是192px，已改为最低180px且检验真实内容/字段/后续按钮几何边界，不把该测试夹具误判当产品修复前证据。h09-rich-contract-final.log共13项通过；真实产品修复前证据是两次云端同断言失败，后续原真实生成脚本验证中。

H09富文本修复本地真实生成验证：10788 exit0，h09-rich-generated-runtime.log实际原Boot/JWT/Redis/MyBatis、生成CRUD/tree/sub及自动PK/String键、图片/文件/富文本、原不重叠/手机边界、XLSX、权限撤回与持久审计全部通过。146单元/5dist/2规模及静态检查也通过。第一轮全量337项中缓存页末尾导航30秒超时、336通过；原trace已保存h09-cache-timeout-trace.zip，图表/溢出断言已完成，最后菜单导航耗尽总时长。未改产品或超时，定向3次全部通过；固定源以6workers复验全部337项中，不称本轮全绿。H11页签/分页/选择器与入口预算的精确证据已补全并在任务表验收done，H10扫描及H13仍在。

最终6workers完整复验89347 exit0：h09-rich-final-browser.log 337/337通过；h09-rich-entry-budget.json三入口预算通过。没有提高超时、删除断言或改缓存产品代码。富文本修复的真实生成应用与完整前端本地验收通过，接续精确云端；019a8b0/d62e742服务器失败仍作为失败历史保留，不能将后续修复结果回填到旧提交。

精确修复提交61b1a87的web39137600447、server39137600455及skills39137600431全部终态success。h09-rich-cloud-final.log直接确认默认/启用各68真实浏览器、完整API/OpenAPI及两次实际生成应用全部通过，原富文本不重叠断言保留并成功。019a8b0/d62e742失败历史不改写；当前修复切片接受。H09仍有ResourceDialog/TreeListLayout/PaginationNavigation基础样式留在app/styles与workspace-layout，需接续归属及独立主题验证，不据此宣称H09全部完成。

H09分页/树列表归属：PaginationNavigation和TreeListLayout现在分别导入自身CSS，app/styles、workspace-layout、enterprise-presentation和公共兼容文件中的对应重复规则已移除；保留产品200px侧栏/1100px折叠及分页当前态。独立公共主题消费者修复前真实侧栏1408px（预期200），h09-list-primitives-red.log；迁移后h09-list-primitives-green.log通过1440/1050/390/320px布局、折叠、跳页和无水平溢出。最终session29392 exit0：lint/typecheck/生成复现、146单元、build、338模拟浏览器及5正式dist全部通过。仅前端样式归属改变，后端源码不变，不重复本地Maven/SQL；精确云端仍待。ResourceDialog及其他历史混合样式尚待，H09不标完成。

H09公共弹窗基础样式迁移：ResourceDialog独立导入resource-dialog.css，原app的通用尺寸/标题/表单基础/背景/拖拽缩放手柄/焦点及动作区规则按原级联顺序集中，页面专用用户/生成器/权限布局保留原处。独立公共主题夹具修复前宽度失败(h09-dialog-red.log)，修复后520px/20px内边距、真实手柄absolute/touch-action、键盘移动/Home、390/320边界、草稿及Escape焦点恢复通过(h09-dialog-green.log)。session70204终态0：lint/typecheck、146单元、构建、339模拟浏览器及5正式dist全部通过。后端/契约未改，不重复本地Maven/SQL；精确新CI待验收。公共表单与页面混合选择器仍需归属审计，H09暂不标全部完成。

## H09剩余归属核对（2026-10-18）

对ui中静态className与app三份CSS交叉检索后逐组件读取确认：AccountLayout的login面板/卡片/页脚、ChartCard/AnimatedNumber图表容器及辅助文本、IconPicker图标弹层、SelectionTree权限树、DictionaryTag容器、Pagination完整页脚，以及TagNavigation/TagMenu公共页签基础规则仍需接续归属和独立主题验证。AccountAvatar的screen-lock专用尺寸、BrandMark的auth/frontend容器尺寸、PasswordField的post-dialog表单列属于组合覆盖，应保留在相应模板或应用层；不能机械删除所有包含组件class的app规则。ResourceDialog仍有通用表单列与页面专用选择器混合，须拆开检查。当前只有明确迁移并验证的条目已完成，H09整体保持in_progress。

本轮密码/头像/品牌基础样式已组件自带；用户编辑角色岗位规则移出ui/choice-layout到app/user-choice-layout，产品入口在公共布局之后组合。独立夹具初次typecheck发现误用不支持defaultValue；后续改为受控value/onChange，仅夹具修正，不宣称产品bug。全站回归运行时保持源固定，结束后修夹具并补类型与定向验证。

账户基础样式本地终态：h09-account-final.log/session58111 exit0，生成复现、146单元、build、339模拟及5dist通过。夹具受控值修正后38243 exit0，typecheck与独立浏览器补验通过；产品源码在全量期间未变。lint通过，原字段交互/头像故障回退/图标来源未改。新精确CI待验收。分页b802747的server39141072169/web39141072171已终态success，弹窗c0ac32a web39141683332成功/server39141683368仍运行，尚不把弹窗服务器标为完成。

账号模板/复杂公共控件切片：AccountLayout、SelectionTree、IconPicker、DictionaryTag及完整Pagination各自导入CSS。使用CSS AST拆分混合选择器，保留原媒体条件与styles→presentation→workspace顺序，导航图标/密度/页面专属选择器保留应用。独立公共主题实际验证账号面板1440/390/320居中和无溢出，权限树父子联动、图标搜索选择、未知字典值布局、分页大小/换页与手机边界。79092两定向及typecheck通过；15462终态0，h09-templates-final.log含lint/生成复现、146单元、构建、341模拟、5dist全通过。后端未改，本地不重复SQL/Maven，待精确CI。c0ac32a弹窗server39141683368及web39141683332终态success。H09仍需图表卡片/动画数字、公共页签与剩余模板覆盖审计。
