# 示例应用

入口：`/showcase.html`，本地预览 `http://127.0.0.1:5174/showcase.html`。
原有 `/frontend-template.html` 保留，并提供展示中心链接。两个入口均包含在生产构建。

示例应用在当前仓库中独立运行，不需要登录，不请求业务 API，不保存真实业务数据。
刷新会重置本地演示状态。不要在账户演示中输入真实密码。

## 展示目录

| 栏目 | 实际复用的公共组件／模板 |
| --- | --- |
| 应用概览、前台模板 | FrontendLayout、BrandMark、Button |
| 列表模板 | ListPage、ListFilters、ListToolbar、DataTable、ColumnVisibilityMenu、ListPagination、ResourceDialog |
| 表单模板 | FormPage、PageForm、FormSection、FormActions、Input、TextArea、Switch、Feedback |
| 详情模板 | DetailPage、DetailSection、DetailField、Tag、处理记录 |
| 账户模板 | AccountLayout、PasswordField、登录／注册表单演示 |
| 基础组件 | Button、Input、TextArea、Select、NativeInput、Field、Selector、Checkbox、Switch、Tag、Badge、Avatar、AccountAvatar、DictionaryTag、Card、Heading、Text、Divider、Stack、HStack、VStack、FormLayout、Tooltip、UiIcon |
| 反馈与弹层 | Feedback、EmptyState、Spinner、Skeleton、ResourceDialog、Popover |
| 导航与页签 | TagNavigation、TagMenu，12个本地页签、首尾滚动与关闭 |
| 管理外壳模板 | AppShell、WorkbenchPage、PermissionProvider、PermissionGate |
| 更多交互组件 | DropdownMenu、Dialog、Toast、Pagination |
| 树与编辑器 | SelectionTree、IconPicker、RichTextEditor、RichTextContent |
| 图表看板 | DashboardPage、AnimatedNumber、ChartCard：柱状、折线、饼图、雷达图 |
| 文件与图片 | FileInput、ImagePreview、UploadEntries、ResourceFileLinks |

展示范围是产品公共组件与可独立运行的页面模板，不是底层依赖每个导出的 API 文档。
完整 EnterpriseShell / PageWorkspace、导航搜索、真实会话与权限、密码到期提醒、页面缓存和未保存保护
仍由管理入口 `/` 展示。示例提供管理入口链接，不伪造会话或绕过权限；简单 AppShell 演示不等于这些能力。
富文本图片演示返回固定本地标志，文件选择只保留在内存；没有模拟“真实上传成功”。
表单构建器保持暂缓，本次未开发。

## 开发与复用

表单与详情参照 spcore model-app 的横向表单（100px 标签）组织：共用白色面板、标题区、分组分隔线和底部操作区。
表单保留必填语义，开关与输入区对齐；详情使用相同字段栅格的只读值，状态归入字段，不放空白侧栏。
公共实现为 `web/ui/FormPage.tsx`、`web/ui/DetailPage.tsx` 和 `web/ui/page-templates.css`；600px 以下改为标签在上。

- 页面入口：`web/templates/showcase.tsx`；局部展示布局：`web/templates/showcase.css`。
- 所有展示控件从 `web/ui` 公共入口导入，不直接引用 Astryx，也不复制依赖实现。
- URL hash 支持栏目直达、刷新恢复与浏览器后退；左侧提供栏目搜索。
- 接入业务时，用授权 API 替换示例数据，保留公共模板结构。PermissionGate 只控制界面显隐。
- `web/tests/e2e/showcase.spec.ts` 验证所有13个栏目的桌面／手机布局、无业务 API 请求，以及本地表单、列表、弹窗、页签和图片交互。

## 验收记录（2026-10-09）

13栏目 × 桌面／手机的26张截图已生成；概览、控件、详情及图表截图复核。
3项展示应用浏览器测试通过，覆盖全部栏目、基础业务交互，以及树选择、富文本、权限、文件、弹窗、图例切换和历史导航。
原前台模板测试通过；前端 lint、typecheck、126项单元测试及生产构建通过。
截图检查曾发现 DashboardPage 的12列栅格使图表挤窄，修复为整行后新增宽度断言并重新通过。
日志：`web/showcase-interactions.log`、`web/showcase-final.log`、`web/showcase-build.log`。

### 表单/详情与公共控件同步验收

2026-10-09：100px 横向标签、开关对齐、必填语义、8个详情字段及无空侧栏已增加浏览器断言。
公共 Select/TextareaControl 的圆角、字号、焦点、禁用及错误边框通过真实计算样式验证；组件验收页统一加载产品主题。
固定最终源码后，205项模拟 API 浏览器测试、126项单元测试、lint/typecheck/生产构建全部通过；
表单桌面和详情手机、公共控件桌面截图已人工复核。日志为 `web/ui-sync-final-e2e.log`、
`web/ui-sync-final-unit.log`、`web/ui-sync-final-build.log`。
首轮必填装饰星号污染可访问名称已修复；中途热更新导致的两项会话失败在停止修改后的全量重跑通过。
本轮是公共样式与模板验收，不代表全部业务编辑器均迁移为 DetailPage，也不作为新的后端真实环境验收证据。
