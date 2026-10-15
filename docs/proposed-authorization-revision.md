# 持久授权版本与会话一致性方案

状态：**设计待实现**。日期：2026-10-15。对应 `spec/framework-hardening.md` / `tasks/framework-hardening.md` 的 H01。本文依据当前源码只读核查，不代表实现、故障复现或验收已经完成；H01 应独立于诊断和组件切片交付。

本文保留全局 revision 的初始候选设计与完整测试矩阵，便于比较和追溯。独立审查后的下一验证方向是每次受保护请求读取短事务 MASTER 完整授权快照，详见末尾“独立审查与待决策”；全局 revision 仅作为成本证据支持后的备选，当前没有运行实现或真实故障证据。

## 问题与保证范围

当前 `RoleService`、`MenuService` 在默认 REQUIRED 的 `TransactionTemplate.execute` 返回后调用 `RoleSessionRefresher.refresh`。仅当它们自行拥有事务时，返回才意味着 SQL 已提交；加入调用方外层事务时，刷新可能发生在真实提交之前。用户控制器使用 afterCommit，导入服务逐行提交后统一刷新。刷新会枚举全部 Redis 登录 key，然后逐会话重建权限。

`RoleSessionRefresher.refresh` 的枚举和 `refreshSession` 的初次会话读取不在单条失败撤销保护内；单条失败也会中止后续枚举。SQL 已提交后发生 Redis 枚举、读取、CAS 或撤销失败，恢复 Redis 不能保证尚未处理的旧会话已经失效。现有字节 CAS、防止登出复活、TTL 保留解决的是会话写入竞争，不能替代持久授权失效边界。

目标是：**授权撤销或账号禁用提交后，随后进入认证的请求不能继续使用旧授权快照，即使提交后的 Redis 同步失败。** SQL 回滚不撤销仍然有效的权限。权限重新授予后，仍存活的会话可以获得新权限，保持当前功能语义。

这不是撤销已经完成认证、正在执行的请求的协议。提交前已经通过认证的并发请求需要明确记录线性化边界；若要求中止它们，需要额外的执行级协议，不能以版本检查冒充。

## 当前写入入口清单

下表是实现审查清单；若采用全局 revision，新增入口也须遵守同事务版本规则。采用每请求完整快照仍须覆盖这些规范/兼容入口的权限和事务故障验收，不能据此省略写入原子性审查。

| 入口 | 实际写入 | 当前边界与处理要求 |
|---|---|---|
| `/api/v1/system/users` 新增/编辑/删除、`/{id}/status`、`/{id}/roles` | `UserController` → `SysUserServiceImpl` | 控制器事务及 root lock；编辑/删除/状态/角色 afterCommit 刷新。版本递增必须在 SQL 提交前 |
| `/system/user` 对应旧写接口、`authRole` | `SysUserController` → 同一服务 | 编辑/删除/状态/角色已有事务、root lock 和 afterCommit；不得只覆盖规范端点 |
| 新旧用户导入 | `UserImportService.write` **直接** `SysUserMapper.insertUser/updateUser` | 每行 `REQUIRES_NEW`，提交后汇总 refresh；必须覆盖直接 mapper，保留部分成功和逐行提交 |
| `/api/v1/system/roles` 增改删、状态、`/{id}/data-scope`、`/{id}/users` 分配/取消 | `RoleService.mutate` → `SysRoleServiceImpl` | root lock + REQUIRED 事务；execute 返回后立即刷新，加入外层事务时尚未提交，须绑定真实 afterCommit |
| `/system/role` 新增/编辑、`changeStatus`、`dataScope`、删除 | `SysRoleController` → 同一服务 | 已有事务、root lock、afterCommit |
| `/system/role/authUser/cancel`、`cancelAll`、`selectAll` | 委托 `RoleService.users` | 已共享规范对象校验和事务，维持兼容响应 |
| `/api/v1/system/menus` 增改删、排序 | `MenuService.mutate` | create/update **直接** `MenuMutationMapper.insert/update`；delete/sort 经旧服务；REQUIRED execute 返回后刷新不保证外层已提交，须绑定真实 afterCommit；若采用版本，不能只覆盖旧服务 |
| `/system/menu` 增改删、`updateSort` | `SysMenuController` → `SysMenuServiceImpl` | 当前没有 root lock 或授权刷新；仅排序服务有事务。必须补齐同事务失效边界，并保持一致锁顺序 |
| `/api/v1/system/departments` 增改删、排序 | `DepartmentController` → `SysDeptServiceImpl` | 控制器事务、root lock；部门层级属于数据范围边界 |
| `/system/dept` 增改删、`updateSort` | `SysDeptController` → 同一服务 | 除排序外缺少事务/root lock；updateDept 会同时更新后代 ancestors、当前部门和部分父部门状态，不能分别提交 |
| 管理员重置密码、个人修改密码（新旧接口） | `SysUserServiceImpl.resetPwd/resetUserPwd` | 与并发登录凭据相关，应纳入同事务版本；保持既有会话持续有效的业务规则，不擅自改为全部退出 |
| 注册 | `SysUserServiceImpl.registerUser` | 创建账号，使用完整写事务边界 |
| 旧公开 `SysUserServiceImpl.importUser` | 直接 mapper，逐行处理 | 当前 HTTP 已不调用，`LegacyUserImportControllerTest` 明确断言不用此方法；若保留可调用兼容能力，仍需逐行事务，不能让外部调用绕过版本 |

共享底层授权写方法：

- `SysUserServiceImpl`：`insertUser`、`updateUser`、`insertUserAuth`、`updateUserStatus`、`deleteUserById`、`deleteUserByIds`；内部 `insertUserRole` 由外层事务覆盖。
- `SysRoleServiceImpl`：`insertRole`、`updateRole`、`updateRoleStatus`、`authDataScope`、`deleteRoleById`、`deleteRoleByIds`、`deleteAuthUser`、`deleteAuthUsers`、`insertAuthUsers`；内部 `insertRoleMenu/insertRoleDept` 不独立提交。
- `SysMenuServiceImpl`：`insertMenu`、`updateMenu`、`deleteMenuById`、`updateMenuSort`，以及规范服务直接 mapper 路径。
- `SysDeptServiceImpl`：`insertDept`、`updateDept`、`deleteDeptById`、`updateDeptSort`，包括内部 `updateDeptChildren/updateParentDeptStatusNormal`。

普通个人资料、头像、登录时间不改变授权：`updateUserProfile` 已使用明确字段白名单，不更新部门、状态或角色。它们无需单独使所有用户授权过期，但其 Redis 写入仍必须拒绝过期授权版本。

岗位目前不是 `PermissionService` / `DataScopeAspect` 的授权来源，不能仅因有关联表就虚构新的岗位授权规则。用户编辑中的岗位变更继续保持原数据和权限检查。

## 初始候选：SQL 持久版本

本节保留初始设计，不代表最终选型或已实施；独立审查后的原型验证方向见文末。

### SQL 持久版本

新增 InnoDB 单行授权版本表，固定主键和 `BIGINT` 单调计数；拟定迁移文件 `sql/migrations/V030__authorization_revision.sql`，实际编号实施时重新检查。只允许首次插入，重跑迁移不能重置已有计数。行缺失、读取失败或计数溢出必须安全失败，不能静默使用默认值。

拟新增 `eforge-system/.../mapper/AuthorizationRevisionMapper.java` 与 `.../service/AuthorizationRevisionService.java`。`advance` 必须在真实授权写事务中调用，不能用 afterCommit 补写版本，也不能开一个独立提交的版本事务。事务顺序保持现有 root lock → 原 SQL 校验/写入 → 版本递增 → commit；所有入口采用一致顺序，避免新增相反锁序。

尽量在共用系统服务写边界处理版本，并补齐 `MenuService`、`UserImportService` 的直接 mapper 路径。不得同时在外层和内层随意重复递增；“每次完整成功变更至少一次，失败变更零次”是安全条件，具体去重方案应由测试证明。现有 root mutex 不直接删除。

### 同版本授权快照

拟新增 `eforge-framework/.../web/service/AuthorizationSnapshotLoader.java`，不依赖 boot 控制器。使用短 `REQUIRES_NEW`、readOnly、`REPEATABLE_READ` 事务，同一 read-view 读取：

1. 当前授权版本；
2. 当前用户、status、del_flag、deptId 和凭据；
3. `NavigationMapper.selectActiveRoles` 的有效角色；
4. `SysPermissionService.getMenuPermission`，包括每个角色的 permissions/dataScope。

无角色且非超级管理员应明确得到空权限，不回落到旧缓存角色。数据范围算法保持原实现及 10 项 parity。快照结束后再进行 Redis CAS，不在读取事务里等待网络重试。

`LoginUser` 新增可持久化 nullable `authorizationRevision`。兼容旧 Redis JSON 缺字段：null/缺失视为需要权威重建，不能视为可信的版本 0。JWT 仍只标识既有 Redis 会话，不需要把权限写进 JWT，也不允许重建已经退出或过期的 key。

### 请求认证与缓存写入

请求读取有效 Redis session 后，必须从权威 SQL 主库验证版本；不能通过有延迟的副本或带 TTL 的版本缓存制造撤权窗口。版本相同才使用原快照；失配时加载完整授权快照，用现有精确字节 CAS、原剩余 TTL 写入，再用于认证。

CAS 失败要重新读现存 session 并重新计算权威状态；有界重试后安全拒绝，不回落到旧权限。SQL/Redis 不可用时拒绝受保护请求，响应保留规范 ProblemDetail / 兼容边界，不泄漏驱动详情。不要把认证失败和存储暂不可用混为一个未记录的空缓存命中。

`TokenService.updateLoginUser` 仍可被 profile/getInfo/bootstrap 调用，因此也必须防止过期版本写入。版本验证不能加入调用方旧 RR read-view，应使用明确独立的 current-version 检查。保留当前 compare-and-set、精确 bytes、TTL 和不插入丢失 key 的语义。

`RoleSessionRefresher` 在绑定真实提交边界后，可以暂时保留为加速路径；在版本方案正确实施的前提下，它失败不影响持久版本已经生效。当前 Role/Menu 的 REQUIRED 返回即刷新不能直接视为已经满足该前提。将来拆分锁或替换全库 key 枚举属于有测量支持的后续改进，不能作为本轮安全补丁的捷径。

## 必须处理的竞态

| 场景 | 正确规则 |
|---|---|
| 登录读取 UserDetails 后并发撤权 | 不能在 createToken 给旧对象盖“当前”版本；版本必须对应构造它的完整 SQL 快照 |
| 登录验证旧密码后管理员修改密码 | 创建 token 前发现版本改变，应重新核验当前身份/凭据或安全拒绝重试；只装载新权限不足以证明旧密码仍有效 |
| Redis 写入前又发生授权提交 | 检查当前版本、必要时重试；认证线性化边界明确。不能宣称存在跨 SQL/Redis 的原子事务 |
| bootstrap 先开始、撤权后结束 | bootstrap 自身版本来自同一快照，过期版本写被拒；不能给旧 user/roles 使用新版本 |
| profile/getInfo 与授权刷新竞争 | 保留原 Redis bytes CAS；普通更新不能恢复旧角色/部门/dataScope/permissions |
| 当前 `getInfo` 使用缓存 user.roles 重算权限 | 应复用权威快照或只读已验证授权，避免独立写入一套没有版本来源的权限 |
| 旧回调晚于新变更执行 | 回调重新读取当前 SQL 权限，不能发布保存于回调闭包的旧实体 |
| 事务回滚 | 数据与版本共同回滚；不发布会话变化 |
| 失配后用户已经禁用/删除 | 拒绝认证；Redis 删除失败也不能恢复旧授权 |
| 登出或过期与刷新竞争 | CAS 不创建 key；后续任何 stale write / TTL renewal 不复活 |
| 缺版本的旧会话 | 必须重新取得完整 SQL 快照；不可仅补字段后信任缓存 |

`BootstrapService` 当前 RR 事务默认 REQUIRED，可能加入调用方较早的事务；应统一使用独立短快照。`ConsoleTicketService.resolve` 直接读取 Redis，不经 TokenService，但 `ConsoleAccessService.authorize` 已每请求调用 Bootstrap 重新读取 SQL。保留这条权威边界以及不延长登录 TTL 的规则，不能让新 ticket 路径变成只看缓存。

## 迁移、回退与外部 SQL

- 现有真实集成脚本按文件名依次执行 `sql/migrations/*.sql`，新增迁移会进入新建数据库验证；仓库没有证据表明现存部署会自动应用它，实施时必须提供明确升级步骤。
- 先部署表结构、验证固定行存在，再启用新应用。缺表或缺行时 fail closed，不自动建表、不把故障降级成信任旧 session。
- 混跑旧应用和新应用时，旧写节点不会递增 revision，旧认证节点不会检查 revision；不能声称滚动混版期间有完整新保证。升级需排空旧实例，或提前给全部旧节点提供同样版本写协议。
- 新增 nullable session 字段兼容旧 JSON；旧序列化器是否忽略新字段需实际验证。应用回退会撤回本安全保证，不能把保留一张版本表当作仍有保护。
- 数据库恢复到旧备份而 Redis 保留较新快照时，版本不相等会重建；如果计数恰好重复则仅计数无法识别恢复。恢复操作应使旧会话失效或另设不可重用的数据库世代值，须写入运行手册并验证，不能重置计数后沿用旧 Redis。
- Java 版本协议只能保证遵循协议的应用写入口。手工改 IAM SQL、外部迁移/安装脚本必须在同事务中递增版本。若产品要求任意外部 SQL 自动撤权，需数据库触发器或每请求完整权威查询，不能宣称 Java epoch 已覆盖任意直接 SQL。
- 不自动清理业务数据，不调整原账号/角色/菜单/dataScope 语义；迁移、回退和故障注入只在自有测试环境执行。

## 查询与锁成本

全局版本的优点是不用枚举角色/菜单/部门变更影响的全部用户，避免删除前关系或并发分配漏项。代价是所有受保护请求增加 SQL 版本读取，任意授权变化会使无关用户下次访问也重建。

目前 `SysPermissionService` 按有效角色分别查询菜单权限，失配成本与角色数有关；重建还包含用户、有效角色、版本等查询。实现后应记录稳定版本请求的查询数、失配请求查询数、p50/p95、连接池等待、批量角色变更后突发重建及 root lock 持有时间，不能先编造性能提升或固定成本。

per-user 版本可以减少无关重建，但需要完整覆盖角色成员、菜单关联、删除前关系、部门层级和并发分配。现有多个直接 mapper 与兼容写入口使首轮漏项风险较高，因此初始版本候选在两种版本粒度之间优先考虑全局版本；这不代表当前决定引入版本协议。下一步先验证文末的每请求完整快照，只有成本证据支持时再评估全局、per-user 或双层版本，并保持完全相同的故障验收，不先引入索引或缓存来缩短测试范围。

## 可复用的真实故障夹具

复用 `server/scripts/verify-auth-integration.ps1` 的独立 MySQL 8.4 / Redis 7.4 容器、随机凭据、自有端口、`Request`、`Assert-Problem`、`Assert-Check`、管理员和普通用户登录夹具。新片段建议 `verify-authorization-consistency-integration.ps1`，由父脚本 dot-source；所有变量使用独有前缀，避免现有片段的 PowerShell 变量互相覆盖。不要额外启动同端口应用或在 jar 正被使用时打包。

### 枚举故障（可直接复用现有 ACL 方法）

1. 建专用角色和用户，通过真实 API 赋予一个可观察权限，登录同一普通用户两次。
2. 保存两次 JWT、Redis key、剩余 TTL、SQL 角色/关联与版本；先证明两个 JWT 都能访问目标 API。
3. 在父脚本持有的 Redis 容器执行 `ACL SETUSER default -keys`。`verify-cache-monitor-integration.ps1` 和 `verify-online-sessions-integration.ps1` 已使用相同故障模式。登录 session 的 Lua GET/PTTL 仍可工作，不会在 mutation 的前置认证阶段就失败。
4. 通过真实规范或兼容接口撤销权限。必须分别查询 SQL 确认授权变更确实提交、版本确实递增，再把响应记录为提交后同步失败或相应明确语义；不能仅以 HTTP 错误证明缺陷。
5. finally 恢复 `+keys`。不调用 bootstrap，不重新登录，直接用原两个 JWT 请求被撤销的后端能力；修复前应能复现旧授权继续使用，修复后两个都拒绝。然后验证仍允许的能力、TTL、恢复后的重新授权。

### 初读、更新、部分会话失败

单纯在整个请求前禁用 GET/EVAL 会挡住管理员认证，无法证明“SQL 已提交后刷新失败”。应使用隔离集成测试的可控 barrier：

- 管理请求通过 JWT 校验后在已知 SQL 锁/测试拦截点等待，测试再设置 Redis 读取故障，释放后确认 SQL 提交，随后刷新初读失败。现有 generator 同步测试已有自有 SQL 行锁与并发 HTTP 的结构可复用；必须观察请求实际等待，不能只按 sleep 猜时序。
- 部分成功需要确定顺序和逐会话断点。建议实际 Spring/MyBatis/MySQL/Redis probe，在测试配置中仅给真实 RedisCache 包装一个可控顺序/故障 barrier：会话 A 实际 CAS 成功后，令 B 的真实 Redis 读取或写入因 ACL 失败，C 尚未处理。测试配置不进入生产，不能用生产后门或用 Mockito 假 Redis 代替实际缓存。
- Redis ACL 的按 key 读/写规则可帮助构造 CAS 失败且删除失败；具体规则必须先用测试连接证明实际 GET/SET/DEL 权限，不能假定 ACL 命令类别会在 Lua 内产生预期时序。
- 每种故障都保留实际 SQL 提交、A/B/C 缓存状态、恢复后原 JWT 的后端响应证据。多个会话都不能借首条失败逃逸。

### SQL 故障与回滚

- 复用已有 `RENAME TABLE ...` / finally 恢复模式，在自有环境让版本表读取失败，已登录会话必须安全拒绝，恢复后正常，不泄露表名/SQL/凭据。
- 用专用触发器或可控 SQL 失败放在授权写之后、版本或事务结束之前，实际核对授权行、关系行、revision、审计、会话都符合回滚结果。触发器仅用本运行唯一标识创建并清理。
- 对导入保留每行提交：已提交行各自推进版本，失败行不推进；不能以最终 refresh 异常把已提交行改标 FAILED。

## 具体测试清单

| 新增或扩展测试 | 应证明的行为 |
|---|---|
| `AuthorizationRevisionTransactionTest`（新） | 新旧写入口实际服务/事务内递增；回滚零发布；直接 mapper 例外已覆盖；缺行和溢出安全失败 |
| `AuthorizationSnapshotLoaderTest`（新） | 独立 RR/readOnly、有效角色、无角色、admin、disabled/deleted、完整角色 dataScope/permissions、版本来自同一 read-view |
| `AuthorizationConsistencyMysqlRedisIntegrationTest` 或 native probe（新） | 同用户多会话、枚举/初读/CAS/撤销故障、真实恢复后旧 JWT、事务回滚、SQL 不可用 |
| `TokenServiceSessionTest` / `TokenServiceRedisIntegrationTest` | bytes CAS、并发 profile、TTL、不复活登出、旧 JSON 缺 revision、过期版本写拒绝 |
| `UserDetailsServiceImpl` 登录相关测试（新/扩展） | 旧 UserDetails 后撤权、改密码、禁用；createToken 不给旧快照盖新版本；并发登录不获得陈旧权限 |
| `RoleSessionRefresherTest` | 故障不破坏持久失效边界；旧回调重读权威 SQL；部分失败有界、安全 |
| `BootstrapServiceTest` + 实际并发 probe | 调用方旧事务被挂起/恢复；旧 bootstrap 无法覆盖新授权；新角色/部门/dataScope 不是混合版本 |
| `LegacyRoleMenuSecurityTest` / `LegacyIdentitySecurityTest` | 新旧 API 均覆盖；原对象范围、超级管理员保护及响应边界保持 |
| `UserImportSessionTest` / `UserImportServiceTest` | 独立逐行 commit、失败行回滚、refresh 失败不隐瞒已提交结果 |
| `DataScopeAspectParityTest` + `verify-roles-integration.ps1` | 原 10 项算法、五种真实 dataScope 与权限关联保持 |
| `verify-consoles-integration.ps1` | ticket 路径撤权、退出、SQL/Redis 故障拒绝及 TTL 不延长 |

完整交付还需：所有相关规范/兼容写接口覆盖矩阵、默认/启用配置实际 API/浏览器、实时 OpenAPI 与生成客户端、完整 Maven、精确提交云端终态、安全审查和按现有编号正式 ADR。本文本身不满足任何运行时完成条件。

## 独立审查与待决策

日期：2026-10-15。本节是对设计及当前源码的独立只读审查。以下反例由调用链和事务边界推导，尚未以运行时夹具复现；不能将审查结论记作测试通过。上方测试矩阵完整保留，版本专属条目仅在选用版本方案时实施，其余故障、权限、事务、CAS、TTL 和兼容性要求仍适用于下一验证方向。

### 下一实际验证方向：每请求 MASTER 完整授权快照

首轮拟先在每次受保护请求中读取权威完整授权快照，以实测判断是否需要版本快路径。保留现有 Redis 会话定位、精确 bytes CAS、剩余 TTL 和不复活缺失 key 的行为；缓存中的授权字段不能作为通过请求授权的依据。该方向尚待红测试复现、实现原型及成本验证，不代表最终验收。

- 规范 `/api/v1/**` 与兼容 HTTP 认证过滤链均须覆盖；不能仅改 bootstrap、规范控制器或某几个权限检查点。有效 Redis 会话只证明会话存在，当前账号状态、有效角色、权限及数据范围来自主库。
- 在获取连接前明确 MASTER 路由，在短 REQUIRES_NEW、readOnly、REPEATABLE_READ 事务内读取当前用户、有效角色及每角色权限；完成后恢复原数据源上下文和调用方事务。Redis 写入及重试在读取事务结束后处理，不回落到缓存权限。
- `createToken` 前须重新核验当前账号身份、状态和密码 hash 与此前通过验证的凭据证明对应。旧凭据不能因加载了新权限而升级为有效登录；hash/身份发生变化时须重新验证当前凭据或安全拒绝重试。不得把原始密码放入 Redis、JWT 或日志，也不能在重试时绕过密码错误计数与验证码语义。
- console 的 ticket 路径继续使用短权威快照，禁止续期 ticket 或登录会话 TTL；JWT 与 ticket 两种入口都须真实验证撤权、退出和故障恢复。
- profile/getInfo/bootstrap 与原刷新回调仍需防止覆盖较新的会话。不得通过去掉 CAS、重新插入失效 key、延长 TTL 或修改原 DataScope 算法来减少实现工作。

这一方案不依赖全部 IAM 写入口正确推进一个新计数，第一刀可以集中在认证读边界；直接 SQL 变更也会被随后读取的权威快照观察到。它不自动修复旧部门多语句更新的原子性、外层事务刷新时机或其他既存写入边界，这些仍按清单验证并修复。

按当前查询形态，完整读取约需要用户查询、有效角色查询及逐角色菜单权限查询，即约 `2 + 有效角色数` 次 SQL（实际分支、角色过滤、bootstrap 导航和配置查询以测量为准）。先记录实际查询数、p50/p95、连接池等待、并发容量和 root lock 持有时间，再确定预算。只有数据证明该成本需要优化时，才重新评估上方全局 revision 快路径；不得预先宣称性能可接受，也不得通过有延迟的副本或版本 TTL 缓存牺牲撤权保证。

### 必须落实的边界与反例

| 边界 | 当前源码与具体反例 | 原型和验收要求 |
|---|---|---|
| 退出不依赖 SQL 授权 | `LogoutSuccessHandlerImpl.onLogoutSuccess` 先调用 `TokenService.getLoginUser` 再 DEL。若公共读取方法无差别加入 SQL 校验，SQL 不可读而 Redis 正常时，旧 broad catch 会将其吞为 null，退出响应可能成功但 key 未删除；SQL 恢复后旧 JWT 仍可用。改为直接抛异常则使退出新增 SQL 依赖 | 拆分已验证 JWT 的会话定位/删除与受保护请求授权；logout 不授予权限，不要求账号仍启用或 SQL 可用。验证 SQL 故障、账号禁用、缺失/过期 key、无效 JWT 和真实 Redis 删除失败；不能在未完成删除时宣称成功 |
| 故障 503 与安全诊断 | `TokenService.getLoginUser` 捕获全部异常、记录原 message 并返回 null；`JwtAuthenticationTokenFilter` 当前只在 console 分支捕获 ApiFailure。登录路径还会由 `SysLoginService` 将异常包装成 ServiceException，再由规范 AuthController 改成凭据错误 | 限定凭据解析异常的处理边界；存储不可用安全拒绝并保留 503，规范响应及兼容响应各自符合原契约。过滤器异常须进入受控诊断链，不泄漏原 SQL/message/驱动秘密。验证 SQL 和 Redis 故障不误报普通 401，不落入无关联的容器错误页 |
| 外层 REQUIRED 与 afterCommit | RoleService/MenuService 的默认 REQUIRED 加入外层事务后，execute 返回尚未提交；紧接着 refresh 开 REQUIRES_NEW 并获取 root lock，会等待被挂起的外层事务仍持有的同一锁 | 绑定真实事务 afterCommit，保留业务写入加入外层事务的语义；不能把整个 mutation 改成 REQUIRES_NEW 以绕过等待。分别证明无外层调用、外层成功提交、外层回滚，回滚不发布会话变化 |
| MASTER 与旧 RR | 当前 DynamicDataSource 依据线程上下文选库；单加 REQUIRES_NEW 并不自动离开 SLAVE。副本上的旧 revision 与旧权限仍可能相互匹配；加入旧 RR 也会读到撤权前状态 | 在获取连接前切到 MASTER，finally 恢复原上下文；实际验证外层旧 RR 和 SLAVE 上下文均不污染权威快照，调用方事务被挂起后准确恢复。版本备选若启用，current-version 读取同样遵守此规则 |
| 小连接池饥饿 | RoleSessionRefresher 持有连接和 root lock 遍历 Redis；内部若再开独立快照/current-version 事务，会增加连接需求。持锁者等空闲连接、其他占用连接的请求等 root lock，可导致超时。当前默认 maxActive=20、maxWait=60000 | 使用小连接池和可控 barrier 实测并发修改/刷新/认证的进展、连接数与锁等待；不得以扩大池或缩短测试范围冒充修复，也不得无证据直接移除保护锁 |
| 登录成功审计与最终复核 | SysLoginService 在 createToken 前记录成功并更新登录信息，AuthenticationContextHolder 此时已清理。新增最终身份/hash 复核若拒绝并发改密码后的登录，现时序会留下未创建会话却记录成功的结果 | 明确最终凭据证明的生命周期和成功记录时机；验证改密码、禁用、撤权与 token 创建失败的并发分支，未成功创建会话不能记录为已登录成功，不用原异常 message 填充审计 |
| 跨角色 DataScope | DataScopeAspect 按每个角色自身 permissions 决定其 dataScope 是否适用于目标权限。只刷新 LoginUser.permissions 并集、复用旧角色或混合旧 deptId，会造成接口权限看似更新而数据范围仍过大 | 同一快照替换有效角色、各角色 permissions/dataScope 与用户 deptId。补两个角色分别授予不同权限和不同范围的组合、撤销其中一个角色、空角色及自定义范围关系变化；保留 10 项算法 parity 和五种真实范围验证 |

### 原型顺序与新增证据要求

1. 先在隔离真实 MySQL/Redis 中运行故障复现，证明至少一次 SQL 确已提交、Redis 枚举/读取/更新或部分会话刷新失败、恢复后原 JWT 仍被旧实现错误放行；保留对应红证据，再修改运行源码。
2. 实现受保护请求短 MASTER 完整快照的最小切片，规范/兼容入口使用同一权威边界；保留上方枚举、初读、CAS/撤销、部分成功、回滚、导入逐行提交和恢复后的全部验收，不用单会话 mock 代替。
3. 补充本节 logout/503/外层事务/MASTER/小池/登录审计/跨角色范围矩阵。按两种 console 配置验证原 JWT、ticket、TTL、退出与重授予，明确请求认证的线性化边界，不声称中止已完成认证的请求。
4. 实测完整快照成本，与原稳定请求基线比较后确定预算和最终选择；如改选 revision，重新执行全部共同故障矩阵及版本专属写入/迁移/回退测试。最终以 ADR、安全审查、真实运行和精确提交云端终态记录决定，不把本文或原型通过当作 H01 完成。
