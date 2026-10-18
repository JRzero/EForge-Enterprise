# H10 查询与共享锁规模基线方案

日期：2026-10-15。状态：**只读分析完成，优化待实施、规模基线待测量**。

范围来自 `spec/framework-hardening.md` 与 `tasks/framework-hardening.md` 的 H10。本文记录当前工作区源码的调用路径、已有实证、可验证的最小改动和后续测试矩阵，不代表 H10 已交付。当前阶段仍由主任务完成 H01 等变更的最终验收；本文不改变任何运行代码、锁、事务或缓存策略。

首批建议分两个独立切片：角色权限批量查询、请假列表批量投影。**不删除或绕过共享根锁，不新增跨请求权限缓存，不改变 DataScope 算法，不以扩大连接池替代定位问题。** 当前授权一致性决策继续遵守 [ADR 0020](adr/0020-primary-authorization-snapshots.md)。

## H11 辅助产物基线（只读测量）

H04 最终前端构建后，读取 `web/dist` 三个HTML里直接引用的script/modulepreload/CSS资源，按路径去重，使用Node `zlib.gzipSync` 分别压缩后累加，得到以下磁盘产物基线。此检查没有运行浏览器或修改源文件。

| 入口 | 原始字节 | 各资源gzip字节合计 |
|---|---:|---:|
| index.html | 848576 | 211267 |
| frontend-template.html | 873456 | 223337 |
| showcase.html | 1989484 | 596323 |

管理员入口包含 `application-Bpzwoqio.js`、`theme-sdSg1Vbo.js` 与 `theme-apCHfvaf.css`；展示入口还预加载富文本和图表等演示资源。这里不计后续动态模块、图片、字体、HTML本身、请求头或缓存命中，不能当作真实网络传输、首屏时延或内存测量，也没有据此声称已经优化。H11应据真实导航与依赖图评估展示页按分类懒加载，并建立可重复产物预算；管理入口不能为展示页测量而增加演示依赖。

## 证据口径

| 类别 | 当前证据 | 不能据此宣称 |
|---|---|---|
| 已测实证 | 仓库根 `authorization-snapshot-proof-native.log`，真实 MySQL/Spring/MyBatis，2角色每次4个 mapper 查询，5角色每次7个；各20次样本，中位数24.502/29.698ms，p95为35.377/33.004ms | 不是纯业务SQL计时、生产吞吐或整个HTTP请求耗时；不能拿这组数直接制定生产延迟预算 |
| 已测实证 | 同一探针的外层事务、maxActive=1场景约706ms安全503，连接释放后恢复；全部122项断言通过 | 不代表生产连接池容量已验证，也不证明提高连接数就是解决方案 |
| 源码推导 | 下文 `2+R`、`3+N`、`2+2N+G` 等是正常路径的逻辑查询次数，未为 H10 新跑规模测试 | 不能与实际JDBC执行数、Redis命令数或Flowable内部SQL数混用 |
| 待验证目标 | 批量角色权限后非空普通角色集的授权读取3次；mine/handled业务SQL3次；pending非空页业务SQL3次 | 属于拟议验收预算，不是已实现、已测出的提升 |

现 `server/scripts/probes/AuthorizationSnapshotMysqlProbe.java:68` 的 `ReadAudit` 在每次 `Executor.query` 前额外执行 `SELECT DATABASE(), CONNECTION_ID(), @@transaction_isolation`；`:168` 只断言 mapper 调用计数。因此上述计时包含逐查询安全校验SQL，而 `mapper_queries` 不包含它们。保留此探针做安全回归；H10另行记录实际JDBC执行与不含逐查询校验的计时，不能为了更好看的数字删除安全断言。

`server/eforge-boot/src/main/resources/mybatis/mybatis-config.xml:9` 未改写 `localCacheScope`。同一事务内重复相同查询可能命中MyBatis一级缓存，尤其会话刷新读取同用户多会话时，不能直接把“会话数×角色查询数”当作实际SQL执行数。

## 当前调用路径与精确位置

以下行号为本文读取时的工作区位置，后续实施应按方法名复核。

| 路径 | 源位置 | 实际行为 |
|---|---|---|
| 受保护请求认证 | `server/eforge-framework/src/main/java/io/eforge/enterprise/framework/security/filter/JwtAuthenticationTokenFilter.java:40`、`:54` | 定位Redis会话，刷新SQL授权后安装请求身份；控制台有独立入口 |
| 主库授权读取 | `server/eforge-framework/src/main/java/io/eforge/enterprise/framework/web/service/AuthorizationSnapshotService.java:65`、`:88` | MASTER、REQUIRES_NEW、只读RR；用户→有效角色→各角色权限；提交读取后才应用到会话 |
| 逐角色权限 | `server/eforge-framework/src/main/java/io/eforge/enterprise/framework/web/service/SysPermissionService.java:58`、`:76` | 遍历有效非admin角色，逐一查询并设置该角色自己的permissions，再合并请求总权限 |
| 权限转换/SQL | `server/eforge-system/src/main/java/io/eforge/enterprise/system/service/impl/SysMenuServiceImpl.java:118`；`server/eforge-system/src/main/resources/mapper/system/SysMenuMapper.xml:115` | 保留原 `perm.trim().split(",")`；SQL过滤有效菜单、有效且未删除角色 |
| 有效角色/导航 | `server/eforge-system/src/main/resources/mapper/system/NavigationMapper.xml:31`、`:15` | 有效角色单查；导航仅M/C且按用户当前有效角色授予 |
| bootstrap | `server/eforge-boot/src/main/java/io/eforge/enterprise/web/controller/api/v1/app/BootstrapService.java:35`、`:48` | 在新的独立授权快照内同时投影导航与权限；结束SQL读取后才写Redis |
| 提交后刷新 | `server/eforge-boot/src/main/java/io/eforge/enterprise/web/controller/api/v1/system/RoleSessionRefresher.java:50`、`:74`、`:100` | 真正afterCommit后另开事务并取共享根锁；扫描key、逐会话读SQL/CAS、最多3次竞争重试 |
| Redis网络操作 | `server/eforge-common/src/main/java/io/eforge/enterprise/common/core/redis/RedisCache.java:81`、`:117`、`:384` | Lua原bytes+TTL读取、Lua CAS保TTL，`keys`直接调用RedisTemplate.keys |
| 共享锁 | `server/eforge-system/src/main/java/io/eforge/enterprise/system/mapper/DepartmentMutationMapper.java:8` | 查询现有根部门并FOR UPDATE；IAM与部分配置/字典操作共享该锁 |
| 密码配置读取 | `server/eforge-boot/src/main/java/io/eforge/enterprise/web/controller/api/v1/app/PasswordStatusService.java:18`；`server/eforge-system/src/main/java/io/eforge/enterprise/system/service/ConfigurationValueReader.java:24` | bootstrap读取3个配置，每个均取根锁、读数据库、写Redis |
| 配置/字典缓存 | `server/eforge-boot/src/main/java/io/eforge/enterprise/web/controller/api/v1/system/ConfigurationService.java:46`、`:48`；`server/eforge-boot/src/main/java/io/eforge/enterprise/web/controller/api/v1/system/DictionaryService.java:58`、`:64` | 缓存清理、写入及字典读取/刷新均发生在现有根锁事务内 |
| 我的/已办列表 | `server/eforge-workflow/src/main/java/io/eforge/enterprise/workflow/WorkflowLeaveService.java:60` | 账号检查、count、当前页ID，再逐ID执行read |
| 待办列表 | 同文件`:68` | 账号及角色查询、Flowable count/listPage、逐task查业务ID和业务完整行、逐task资格核验 |
| 详情/资格/写操作 | 同文件`:51`、`:119`、`:84` | 详情重复计算eligible；资格仍核对BPMN绑定和有效角色；写操作先锁业务行后重新读取 |

## 第一片：角色权限批量查询

正常有效普通用户的单次完整授权读取，目前逻辑计数为 `2+R`：用户1次、有效角色1次、有效非admin角色菜单权限R次。管理员和无有效角色分支为2次；非法/禁用账号的早退不适用该公式。用户查询本身已经JOIN旧角色列表，但随后被有效角色结果替换；这属于额外行处理，不能同时称为另一条SQL。

拟新增内部角色权限行投影和一次参数化批量mapper查询，返回 `(roleId, perms)`；在 `SysMenuServiceImpl` 中按roleId构造独立集合，由 `SysPermissionService` 设置每个角色的permissions并合并总权限。新增接口留在现有system模块及service/mapper边界内，不新增框架基础设施。保留旧单角色方法供兼容调用，具体命名待实施确定。

正常非空角色集合预计 `2+R → 3`，R=1时不宣称减少；admin/空集合保持2，不执行空IN查询。所有ID使用参数绑定及精确Long。若后续证明需要分块，应明示分块上限及 `2+ceil(R/chunk)` 预算，不能假称任意角色数量恒为3。

安全与兼容边界：

- **禁止把用户总权限复制给每个role。** `DataScopeAspect` 根据当前操作权限匹配各角色的数据范围，抹平对应关系会扩大权限。保持角色排序、角色自身scope、权限集合和有效状态语义。
- 保留菜单status、角色status/del_flag条件，普通用户不能因绑定保留的admin角色ID而获得特殊分支。未知roleId、无菜单角色与重复菜单关联不能产生额外权限。
- 保留现有逗号及空白转换语义，不把批量查询顺便变成权限字符串规范化迁移；no-active-role仍不得进入旧回退查询。
- 不改变MASTER、独立只读RR、外层事务挂起/恢复、最终登录证明、读取提交后才发布、SQL故障503及不续期行为。
- 同一方法也服务于登录创建、RoleSessionRefresher和菜单写前的当前权限检查。尤其菜单写入是在根锁后重新读取，不能替换为此前过滤器生成的principal。
- 不在本片移除 `SysUserMapper.selectUserById` 的旧角色JOIN，避免把结果结构迁移与查询次数优化混为一体。

bootstrap当前过滤器快照与导航快照分属两次事务。**不能直接复用前一份权限，再单独读当前导航**，否则失去导航/权限同快照。若未来统一为一个请求投影，必须另行验证身份安装、导航读取、失败发布与控制台边界；不是第一片的前提。

## 第二片：请假列表批量投影与调用内复用

`mine/handled`当前业务SQL为 `3+N`（账号检查、count、页ID、N个read）。建议把分页查询由 `select l.id` 改为完整列投影并复用现有Leave行映射器，固定为3次；不改原where、handled的EXISTS、`created_at desc,id desc`、offset/limit和total。EXISTS必须保留，避免同申请的多次审批audit使列表重复。

`pending`当前业务SQL为 `2+2N+G`：账号检查1、角色查询1、每任务两次业务行读取，以及G次资格判断角色查询（0≤G≤N）。此外存在Flowable的count和listPage两次API调用，不能未测就断言其内部只有两条SQL；模型冷加载也应分开记录。

建议保留原Flowable查询条件和分页，收集当前页distinct processIds，一次参数化查询对应Leave；映射后严格按原task顺序组装。页面上限现为100，空页跳过IN查询，非空页业务SQL目标为3次、空页为2次。单process存在多个task时可以复用业务行，但必须保留多个待办项与原total。任一task找不到业务行不得静默丢弃：旧queryForObject路径经database转换为安全503，新实现需保留明确失败并测试。

本次pending已读取的活跃角色集合可传入eligible，取消重复角色查询；复用范围只限当前 `database` 调用。详情的访问判定与Task投影也可复用本次计算的task→canHandle。BPMN模型最多按本次definitionId复用；Flowable已有部署缓存，减少getBpmnModel调用不等于减少同样次数SQL。

安全与一致性边界：

- 已领取不等于仍可处理。现测试要求角色撤销后pending仍展示已领取task但canHandle=false，详情同样false，decide必须403。保留BPMN原始assignee/candidateUsers/candidateGroups与当前活跃角色核验。
- 保留Flowable当前 `active/businessType/taskCandidateOrAssigned/taskCandidateGroupIn` 组合、无角色占位组和排序/分页；不直接查询ACT_*表替代公开引擎API。
- claim/decide/withdraw仍在业务行FOR UPDATE后重新读取身份、角色、任务与revision；不得使用先前列表或详情的资格结果，不增加跨请求缓存。
- `WorkflowTransactionBoundary`当前使用MASTER和默认TransactionTemplate，没有显式固定RR。须记录实际数据库隔离级别后测试并发完成/撤回/撤权；若发现混合业务行与task视图，作为独立一致性问题处理，不以优化掩盖或暗改全局隔离。
- 继续保护command幂等、业务状态/引擎/audit同事务回滚、旧实例绑定旧definition、长ID与安全错误。

## 共享根锁与Redis：先测量，后决定独立切片

RoleSessionRefresher当前在根锁内执行KEYS和后续缓存读写。正常无冲突且未中途失败时，Redis客户端往返约为 `1+S+A`：KEYS一次、S个匹配会话的Lua读取、A个相关会话的Lua CAS；重试、停用删除和失败补偿另计。这里是客户端调用数，Lua内部GET/PTTL/SET不是独立网络往返。KEYS的服务器扫描成本还与Redis数据库总key数有关，不能只看受影响用户数。

应分开记录根锁等待时间、持有时间、SQL连接占用、Redis各阶段耗时和命令数，以及无关用户/配置请求的等待。即使根锁只在回调新事务里取得，SQL写入已经提交，回调失败也不能被记录成原写入未发生。

首批只通过权限批量查询缩短SQL部分，不移动Redis发布、不删锁。不要先加按user的刷新memo：MyBatis一级缓存可能已经减少实际SQL，且现测试要求CAS竞争后重读会话并重新计算，不允许直接重放旧快照。会话对象也不能跨请求共享。

KEYS→SCAN应单独测量和验收：全量遍历成本、返回重复key、扫描中创建/过期/登出、ACL中途失败、cursor关闭和内存上限。SCAN不能被描述为取消全库遍历或必然减少总持锁时间。用户→会话索引另涉及旧会话迁移、创建/删除原子性、TTL和失败恢复，不作为第一薄片。

保留afterCommit与回滚不发布、原bytes CAS、TTL-only续期、不重建缺失key、最多3次竞争后的撤销、Redis初读/部分CAS故障、恢复后旧JWT按当前SQL拒绝等边界。H01真实故障探针继续作为性能改动的安全门槛。

可选下一片是批量读取3个密码策略配置：在 `ConfigurationValueReader` 原锁边界内一次查询三个key，理论上把该部分SQL由6次变为2次。仍写原缓存namespace并保留缺失默认值、数据库权威来源、缓存失败503。Redis写入暂不改，需测量一次较长持锁与原三次短持锁的实际差异；不与首批两片捆绑交付。

## 实际SQL计数与一致性测试矩阵

| 场景 | 规模/排列 | 应记录和守住的门槛 |
|---|---|---|
| 授权普通角色 | R=0/1/2/5/20，互斥与重叠权限 | 同时记录mapper调用及真实JDBC执行；批量方案R>0目标3、空角色2；逐role集合和总集合精确一致 |
| 授权异常角色 | 停用/删除/无菜单/admin-role-ID、admin账号、精确Long、逗号/空白 | 不新增权限，no-role不回退；各角色scope与DataScope10项保持 |
| 授权快照 | 根读取后并发提交用户/角色/菜单；外层旧RR和SLAVE上下文；SQL缺表/提交失败 | 当前完整旧快照、下次完整新快照；MASTER/readOnly/REQUIRES_NEW、上下文恢复及固定503；失败不发布/续期 |
| mine/handled | N=0/1/20/100；相同created_at、多个审批audit、跨用户 | 业务SQL均3，稳定id次序与total正确；无重复或越权行 |
| pending | N=0/1/20/100；相同/不同process及definition；显式用户/角色候选混合 | 业务SQL空页2、非空3；角色查询一次，业务行批量一次；引擎SQL冷/热分别计；多task不丢失 |
| pending异常 | 空角色、被别人领取、业务行缺失、已领取后撤权、两个版本BPMN | 安全失败/资格不扩大；旧实例保持其definition；不静默缩减items或修改total |
| 并发列表与后续处理 | task页读取后暂停，另一事务完成/撤回/撤角色 | 记录实际隔离及列表视图；下次读取新鲜，claim/decide仍按当前revision409或撤权403；不复用列表权限 |
| 会话规模 | 相同用户1/3/20会话；总会话10/100/1000；多用户多角色；相同与不同查询 | 实际SQL不可按mapper调用估算；记录Redis往返、根锁等待/持有、连接等待、内存和p50/p95 |
| 会话并发/故障 | 登出/过期、profile/bootstrap赢CAS、连续3次冲突、初读ACL失败、A成功后B写/删失败C未处理 | 不复活、不延TTL、不覆盖新内容；实际SQL已提交；恢复后所有原JWT仍经当前权限核验；原110项覆盖不缩减 |
| 可选策略批量 | 三key均有、部分缺失、并发更新、SQL/Redis失败 | SQL目标6→2需实测，默认值与安全错误兼容；无跨请求复用；根锁仍保护原顺序 |

计数应使用测试范围内的StatementHandler/JDBC执行观测，分别标记业务SELECT、Flowable内部查询和事务/探针诊断语句。不是仅数mapper方法调用，也不是数prepareStatement而忽略实际执行。日志不得输出JWT、密码、完整Redis用户内容或敏感SQL参数。

已有回归复用位置：

- `server/eforge-framework/src/test/java/io/eforge/enterprise/framework/web/service/AuthorizationSnapshotServiceTest.java`、`TokenServiceSessionTest.java`、`TokenServiceRedisIntegrationTest.java`。
- `server/eforge-framework/src/test/java/io/eforge/enterprise/framework/aspectj/DataScopeAspectParityTest.java`。
- `server/eforge-boot/src/test/java/io/eforge/enterprise/web/controller/api/v1/app/BootstrapServiceTest.java`，以及同级system目录的`RoleSessionRefresherTest.java`、`AuthorizationMutationCommitTest.java`和角色/菜单边界测试。
- `server/scripts/probes/AuthorizationSnapshotMysqlProbe.java`、`AuthorizationRefreshRedisProbe.java`、`AuthorizationMutationMysqlProbe.java`；已有122/110/54项是安全与事务证据，不是新规模性能结果。
- `server/eforge-workflow/src/test/java/io/eforge/enterprise/workflow/WorkflowLeaveServiceTest.java`、`WorkflowLeaveMysqlTest.java`、`WorkflowTransactionBoundaryTest.java`；实际MySQL测试已有双提交/双claim、撤权、audit故障回滚与重试，尚无列表规模查询预算。

后续执行顺序：固定源码和环境→记录原实现计数与延迟分布→单片针对性RED→实施→相同样本/冷暖状态测量→安全与真实环境回归。计数预算是确定性门槛；延迟改善必须超过同环境测量噪声，不先捏造百分比。两片分别记录结果，完整框架、两配置运行及精确提交云端仍按项目门槛验收。

## 2026-10-18 H10扩展实测

实现优化前，在原授权快照探针中新增 StatementHandler.query 计数，区分 Executor mapper调用与真正到达MyBatis语句执行层的业务SELECT。计数不含ReadAudit通过原始JDBC发出的连接检查SQL；这些检查仍完整运行并计入耗时，没有删除安全断言。只扩展隔离数据库夹具，无运行时代码变化。

| 有效角色数 | 样本 | mapper/次 | 执行业务SELECT/次 | 中位数ms | p95 ms |
|---|---:|---:|---:|---:|---:|
| 0 | 20 | 2 | 2 | 18.281 | 25.000 |
| 1 | 20 | 3 | 3 | 13.998 | 18.783 |
| 2 | 20 | 4 | 4 | 18.228 | 20.924 |
| 5 | 20 | 7 | 7 | 25.014 | 28.124 |
| 20 | 20 | 22 | 22 | 66.679 | 70.545 |

证据：h10-role-baseline-final.log，进程19062 exit0，190项真实授权断言全部通过；单连接外层事务仍约712ms安全503。每请求单独读事务，业务查询计数与mapper一致；不代表其他会话刷新场景没有一级缓存命中。上述计时包含每个mapper一次检查SQL，仅用于本地受控前后比较，不作为生产SLA或已优化证据。首轮扩展fixture后仍断言7角色行而失败，已用统一ROLE_FIXTURE_COUNT=22精确校验角色及关联行数后全绿。原验证逻辑与故障保护保持。

下一步为非空普通角色集增加一次按roleId分组的参数化查询，将业务SELECT目标改为3；必须保留原分割语义、逐role权限/数据范围、无角色与超级管理员分支，并继续真实并发/故障和HTTP回归。H10未完成。

## 真实会话刷新规模基线（2026-10-18）

AuthorizationRefreshRedisProbe在原ACL故障恢复后增加3/30/100实际登录会话，保持原根锁与SQL/Redis实现。每轮真实枚举一次、snapshot Lua各S次、CAS Lua各S次，100会话为201次客户端Redis调用；全部为同一受影响用户，用于覆盖相关会话比例100%的场景。每会话精确权限与原TTL不延长均验证，清理仅本轮创建的session key。

h10-refresh-scale-baseline.log实测3/30/100刷新总耗时25.787/198.617/283.546ms，651项断言通过。时间包括SQL、事务与共享锁，不是Redis纯耗时或生产SLA，且与独立HTTP回归同机运行，不能用单轮时延宣称改善。当前仍使用KEYS，尚未优化；无关会话比例、真实根锁等待及网络延迟分解待补测。禁止将本基线当作锁/会话扫描治理完成。

补充基线h10-refresh-mixed-lock-baseline.log（91537 exit0）：100会话仅3相关时仍执行1次枚举+100次snapshot Lua+3次CAS，97个无关会话字节完全不变、TTL不延长。3/30/100全相关本轮总时间32.153/117.688/239.358ms，混合比例105.127ms；不跨轮宣称改善。探针在枚举后、读取前启动第二个真实SQL事务，通过performance_schema.data_lock_waits观察其阻塞，刷新事务完成后该竞争者取得根锁；35.851ms包含诊断协调，不是生产锁延迟。原故障恢复及新增规模断言共1162项通过。

结论：无关会话也被逐条读取，枚举/Redis循环期间实际占用共享根锁。下一运行时切片应针对有界枚举和查询组织，保留新会话/撤权/失败恢复语义。不能直接删根锁；也不能凭本数据加入跨请求权限缓存。现有CAS冲突测试明确要求重读数据库权限，任何调用内复用也必须保留该边界，不能用性能目标放宽它。KEYS的全库阻塞与实际网络等待尚未分解，本地一轮总耗时不足以宣称已解决扫描问题。

精确云端c40dc739979aa7dfb65998ff0a17364825b048d5的server39128955443全部成功；h10-session-scale-cloud-final.log直接确认1162真实断言及两配置各68浏览器。0621313的server39127749541亦全部成功，两配置各68见h11-scale-cloud-final.log；cb81269的server39128421588/web39128421567均成功。会话计数与根锁等待仍为基线测量，不代表KEYS扫描或锁已优化。
