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
