# 框架与公共组件深入审查

审查日期：2026-10-15。源码基线：`108e9a267ed632fb6dc9b3a796d0e822fd1377ae`，分支 `codex/compact-list-layout`。

本轮是审查与改进建议，没有修改产品实现、合并分支、升级依赖或操作真实业务数据。此前全量测试通过是已有证据，本轮没有重复执行全量 Maven、浏览器或真实数据库故障测试。

## 判断

模块化单体、固定 EForge 依赖、规范 API 与生成客户端、后端权威权限、可选 Flowable 的方向合理。实际路由已有懒加载，BPMN、富文本和图表形成独立产物块；没有依据要求重写框架或更换组件库。

下一阶段最值得投入的是：封闭权限故障边界、修复已复现的组件组合问题、统一控件契约、补生产产物验收。此前“封装清单完成”不等于所有组合状态、故障情形和规模场景均无缺陷。

## 1. 应优先处理的问题

### P1：授权变更后的缓存同步故障缺少闭环

**证据等级：静态高置信，尚未做隔离 Redis 故障复现。**

- `server/eforge-boot/src/main/java/io/eforge/enterprise/web/controller/api/v1/system/RoleService.java:195`：SQL 事务完成后才调用 `sessions.refresh(affected)`。
- 同目录 `RoleSessionRefresher.java:86`：先枚举会话，再逐条刷新。枚举及会话初读异常不进入单条失败保护；单条异常只尝试撤销当前会话，然后抛出，中止后续会话刷新。
- `server/eforge-framework/src/main/java/io/eforge/enterprise/framework/security/filter/JwtAuthenticationTokenFilter.java:52`：普通请求使用 Redis 会话快照；`PermissionService.java:33` 从该快照读取权限。

管理员撤权或禁用账号时，若 SQL 已提交、Redis 短暂故障后恢复，未处理的旧会话可能继续保留旧权限。现有 CAS、TTL 保留、竞争重试和当前会话失败撤销能处理部分场景，不能代替持久授权版本或故障恢复闭环。

建议先补两会话、枚举失败、首条失败后第二条未处理、Redis 恢复后旧 JWT 访问的隔离测试。再评估 SQL 同事务授权版本/失效记录与认证端过期检查，明确失败时拒绝访问的语义。提交后刷新可作为快速传播路径，不能只增加后台重试就宣称窗口消失。不在本次审查中直接改变授权或锁语义。

### P2：树选择器混合鼠标/键盘操作会意外改值

**证据等级：实际 Chromium 复现。**

位置：`web/ui/TreeSelect.tsx:46`，尤其51、53行。

步骤：展示页表单 → 打开“负责部门” → 点击“折叠总部” → 焦点留在“展开总部”按钮 → 按 Enter。本意为展开，实际选中“总部”并关闭面板。原选择值也随之改变。嵌套按钮的键盘事件冒泡到了 treeitem 的选中逻辑。

建议区分 treeitem 自身与嵌套按钮的事件所有权，补鼠标点击后键盘激活、禁用父节点、搜索态和弹窗内组合测试。

### P2：多选器关闭候选后仍吞掉 Escape

**证据等级：实际页面 + 模拟 API 的 Chromium 复现，不使用真实账号。**

位置：`web/ui/MultiSelect.tsx:50`。

用户管理“分配角色”弹窗内，第一次 Escape 将候选关闭，第二次 Escape 仍被输入框 preventDefault/stopPropagation，外层 dialog 无法收到取消事件。实测两次后弹窗数量仍为1，点击取消才能关闭。

建议仅在候选展开时消费 Escape，并明确嵌套弹层逐层退出和焦点恢复规则。现有测试只覆盖第一次 Escape，需补第二次退出。

### P2：状态标签对比度不足

**证据等级：实际 computed style + WCAG 相对亮度计算。**

位置：`web/ui/spcore-theme.css:60`。

标签均为12px、400字重、白色文本：

| 标签 | 背景 | 对比度 |
|---|---|---|
| 成功 | `#30bf13` | 2.45:1 |
| 警告 | `#ff9326` | 2.22:1 |
| 危险 | `#f23d3d` | 3.81:1 |
| 信息 | `#b8babf` | 1.94:1 |
| 主要 | `#2468f2` | 4.84:1 |

前四项低于普通正文4.5:1要求。这些状态文本不是禁用控件，不适用禁用态豁免。保留 spcore 色相，改深字浅底或加深实底，并将对比度纳入主题验收。[W3C 对比度说明](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)

### P2：规范 API 未预期异常缺少统一诊断线索

**证据等级：静态确认；未注入生产故障。**

`server/eforge-framework/src/main/java/io/eforge/enterprise/framework/web/exception/ApiExceptionHandler.java:55` 的全局 Exception handler 不接收异常对象，也没有日志，直接返回安全500。无操作审计注解的 GET 路径可能没有可关联的根因记录；ProblemDetail 也没有统一关联ID。

保留响应脱敏，在服务端增加关联ID、受控异常记录与错误指标。不能直接把原始 SQL、请求体、密码或驱动秘密写入日志。操作审计和故障诊断用途不同。

### P2：正式构建产物尚未经过浏览器验收

**证据等级：CI/测试配置静态确认。**

`.github/workflows/web-ci.yml:29` 构建后运行浏览器，但 `web/playwright.config.ts:5`、`web/playwright.live.config.ts:6` 启动的仍是 Vite dev。现有测试证明源码交互，不直接证明 dist 的分块加载、静态资源路径和发布行为。

保留现有全量套件，新增 dist 的小型冒烟套件：登录、深链刷新、懒页面、弹窗、资源加载失败恢复。静态部署服务器的 API 反代和 SPA fallback 也应进入验收。

### P3：窄屏展示仍有局部整页溢出

**证据等级：实际 Chromium 复现。**

表单、主子表、详情、列表、基础组件在1440/390/320宽度下未出现整页横向溢出；列表内部表格滚动是预期行为。“更多交互组件”在320宽度下 document.scrollWidth 为372。

位置：`web/templates/showcase.tsx:111` 的基础分页示例。建议窄屏减少页码按钮或收敛为紧凑分页，不隐藏整个页面的溢出掩盖问题。现有390宽度测试不会覆盖此边界。

## 2. 框架规模与维护风险

以下有代码证据，但没有压测，不能表述为当前已发生的性能事故。

| 风险 | 证据 | 建议 |
|---|---|---|
| 跨模块共享根部门排他行锁，锁内有 Redis I/O | `DepartmentMutationMapper.java:8`；`ConfigurationValueReader.java:26`；`RoleSessionRefresher.java:81` | 先记录竞争/延迟，保留现有一致性测试，再按资源拆锁、采用短快照和版本化失效；不能直接删锁 |
| 会话刷新扫描全部登录 key | `RoleSessionRefresher.java:86`；`RedisCache.java:384` 使用 KEYS | 建用户到会话索引，减少全库扫描；分页扫描替换仍需证明并发遗漏边界 |
| 审批列表存在 N+1 | `WorkflowLeaveService.java:64`、74、124：分页ID后逐行读取、重复查询当前角色 | 批量读取业务行，请求内复用有效角色上下文；保留每项权限检查，增加查询计数预算 |
| 公共样式反向依赖应用外壳 | `web/ui/theme.css:6` 引入4份app样式；`component-details.css:22` 使用底层内部DOM选择器 | 收敛为token→组件→模板→外壳；将底层兼容样式集中并加外观契约 |
| 公共导出混入业务上下文 | `web/ui/index.ts:34` 重导出app组件；`ui/account.ts` 导出依赖context和固定路由的PasswordReminder | 纯展示移至ui；账号/路由组合保留在feature/app；添加依赖方向与私有导入约束 |
| 页签缓存无容量策略 | `PageWorkspace.tsx:188` 保留所有cached页面，使用隐藏Activity | 先测20–30页签内存，再区分干净列表、未保存草稿、重编辑器；不得自动回收未保存草稿 |

Redis 官方明确提醒普通应用路径谨慎使用 KEYS；本仓库建议来自实际调用链，而不是仅凭命令名称认定故障。[Redis KEYS 文档](https://redis.io/docs/latest/commands/keys/)

现有2026-10-13产物的入口 application JS、HTML预加载theme JS和公共CSS合计约848 KB原始/211 KB gzip，尚未计入登录懒块。BPMN、图表和富文本已拆块。以上为磁盘产物统计，不是实际网络传输、LCP或内存测量；先建立性能预算，再据测量优化。

## 3. 组件优化与补充顺序

### 先统一契约

1. **字段契约**：FormField 提供 id/required/invalid/describedby，但 MultiSelect、TreeSelect、ReferenceSelect 不接收这些字段，又自行创建标签。统一 label、help、fieldError、loadingError、readOnly、disabled、focus 的组合契约，避免每个业务页面自己拼。不要引入动态表单引擎。
2. **弹层交互**：共享有限的展开、Escape、外部点击、回焦点和状态切换规则。根据 listbox/tree/dialog 类型保持不同语义，不造一个包办所有弹层的巨型组件。[WAI Combobox 交互模式](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)
3. **富文本字段**：`web/ui/RichTextEditor.tsx:53` 将名称硬编码为“公告内容”；生成页面可能有多个富文本字段。补 label/id/describedby，保留原 HTML 安全边界和上传能力。
4. **明细表字段级错误**：EditableDetailTable 目前只有行级字符串错误，放在第一格。增加稳定rowId+field路径的错误关联和定位，让业务提供校验结果，不把规则塞进表格。

### 再补企业页面高频能力

| 能力 | 基于已有实现补充 | 有价值的验收场景 |
|---|---|---|
| FormErrorSummary / 错误定位 | 组合FormField、Editor、DetailTabs | 保存失败后定位首个错误；跨页签和主子表定位；草稿保留 |
| 远程记录选择器 | 扩展ReferenceSelect的查询适配层 | 搜索防抖、请求取消、分页、精确ID、选中回显、未知旧值；大列表按需虚拟化 |
| 表格工具区与批量操作条 | 复用DataTable/ListToolbar/ColumnVisibility | 已选数量、清除选择、权限变化、删除后页码回退、跨页选择语义明确 |
| 筛选条件摘要/保存视图 | 复用ListFilters与现有路由/查询状态 | 收起后仍能看见已生效条件；重置一致；用户级列配置和筛选版本化 |
| 业务文件字段 | 组合现有上传、预览、排序与文件链接 | 上传进度/取消/失败重试、原文件保留、数量/类型限制；请求与权限由业务注入 |
| 精确数值/金额/百分比字段 | 复用已有精确字符串数据规则 | 空值与0分离、精度/范围、粘贴格式化；不得经浮点数破坏十进制或长ID |
| 审计时间线/差异展示 | 复用日志、审批、流程包比较 | 变更前后值、操作者和时区、长文本/安全HTML、无查看权限状态 |

这些能力应由至少两个真实消费者证明边界，再成为公共组件。表单构建器仍暂缓；不增加低代码引擎、微服务或多租户。

## 4. 建议迭代安排与验收

1. **故障与交互补洞**：隔离复现授权传播故障；修复树/多选交互、标签对比度和窄屏；补安全诊断。
2. **公共契约收敛**：字段关联、错误定位、富文本参数、弹层行为、样式层次和架构lint。优先迁移用户编辑、字典编辑、流程表单和生成主子表。
3. **高频业务体验**：记录选择、批量操作条、筛选摘要、文件字段；让示例应用展示加载/空/失败/只读/禁用，而不只有正常状态。
4. **规模与发布**：dist smoke、入口体积预算、列表/选择器规模测试、页签内存、SQL查询数和锁等待。达到预算后再考虑虚拟化或缓存回收。

新增验收重点：控件放入form/dialog、鼠标键盘混用、两层Escape、展开时切换loading/error/readonly、同页多个相同控件、未知旧值、320窄屏、200%缩放、状态对比度。现有功能测试保留，不通过删断言或放宽权限来获得全绿。

## 本轮核验记录

- Git/架构/测试配置/关键组件与后端调用链只读检查，交叉审查后排除了Tag隐式submit的误报：当前按钮已有明确type=button。
- 实际Chromium：六类展示页×三种宽度；树选择误选；模拟用户角色弹窗两次Escape；状态标签计算样式。展示页面未发现pageerror。
- 多选弹窗首次临时夹具漏拦截公告等辅助API，未形成有效复现；补齐项目已有fixture的模拟接口并对未定义API返回404后复现成功。这次检查没有提交真实业务变更。
- 浏览器截图：本地 `verification/component-audit-controls.png`，用于核对当前视觉；不作为修复后证据。
- 未运行：Redis故障复现、负载/内存分析、完整可访问性自动扫描、供应链漏洞全审计、完整构建/集成回归。相关结论按证据强度标注，不宣称全框架无漏洞。
