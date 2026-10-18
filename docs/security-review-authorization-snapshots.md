# 主库授权快照与提交后会话刷新安全审查

日期：2026-10-15。范围：framework-hardening H01。状态：最终源码完整构建、两配置授权故障恢复及真实生成应用通过；完整框架环境及精确云端验收尚未结束。决策见 [ADR 0020](adr/0020-primary-authorization-snapshots.md)。

## 问题与修复

原流程在 SQL 撤权提交后刷新 Redis 会话；实际禁止 Redis KEYS 后，刷新失败但 SQL 已提交。恢复 Redis 后，两份原 JWT 仍能访问岗位列表。原始复现记录为 `framework-authorization-recovery-red.log`，不是模拟缓存异常。

修复将 Redis 定位与授权判定分开：会话 key 必须存在，过滤器再从主库独立短只读 REPEATABLE_READ 事务取得当前用户、有效角色、权限和数据范围；成功提交读取后才安装请求身份。SQL 不可用时固定503，不信任旧缓存权限。不会创建已退出或过期的 key，原 bytes CAS 和 TTL-only 续期保持。无角色账号不进入上游可能包含已删除角色的回退查询。

bootstrap 的导航与授权从同一快照生成；快照完成后才发布到请求/缓存。旧 getInfo 使用已验证身份做兼容投影。控制台继续使用已有短期票据和每次授权，不延长登录 TTL。退出只定位和删除 Redis 会话，不依赖 SQL；删除失败不能宣称退出成功。

登录仍由真实 Spring 密码 provider 验证。创建 Redis key 前，主库再次核对已验证账号ID、账号名与密码 hash，拒绝在这次最终读取前已经提交的并发改密、改名或禁用。该读取是登录凭据核验点，不能阻止读取之后另一个事务提交；后续受保护请求仍重新核验账号与权限，已有会话的改密语义保持。固定资源码保留原错误密码、锁定、停用等提示；未知 provider/SQL 错误不使用原始异常消息。最终凭据失败不记录成功，登录信息写入或成功审计入队失败会尝试撤销刚创建的会话并返回安全错误。异步审计最终落库不由入队成功保证。

角色/菜单修改在 REQUIRED 加入外层事务时，execute 返回不等于真实提交。本次统一通过现有 refreshAfterCommit 注册回调；真实提交后才刷新，回滚不发布。现有共享锁和刷新协议保留，不能据此声称已经完成 H10 性能治理。

旧角色宽 DTO 另有跨操作写入缺口：普通编辑能够夹带数据范围，状态接口能够夹带角色名称、权限字与数据范围，数据权限接口能够夹带状态等列。修复仅在已有根锁事务内构造操作专用对象：创建采用规范入口的 scope=1、默认部门关联标志和服务端身份；普通编辑保留已存数据范围及部门关联标志；状态仅修改状态和可信更新人，并保留两个 primitive 关联标志；数据权限仅修改模式、部门集合、部门关联标志和可信更新人，保留菜单关联标志。规范与兼容入口共用模式、部门数量/正数/唯一性、逐部门范围与存在性、非自定义模式不得携带部门集合的完整预检。全部通过后才调用原写服务，普通备注 null/空串的原语义保持；合法 mode=1 仍按现有规范策略允许，不新增业务授权规则。

旧部门列表及根锁的存储错误原来落入通用 Runtime 处理，响应和日志会包含 SQL/driver 原文。新增处理只匹配 DataAccessException/TransactionException：保留 HTTP200/Ajax code500，固定提示 `The request could not be completed.`，响应携带服务端生成的 requestId、X-Request-ID 和 no-store；日志通过 ApiDiagnostics 记录有界异常类型与应用位置，不记录原消息或 Throwable 堆栈。规范高优先级处理器继续返回 HTTP500/ProblemDetail；普通 ServiceException、UserException 和其他旧 Runtime 规则未在此片扩展。

## 已有证据

| 层级 | 实际证据 | 边界 |
|---|---|---|
| 网络故障原始红绿 | 原 jar 的两 JWT 在 KEYS 故障恢复后仍200；首个修复 jar 两 JWT 的规范/兼容路由拒绝，重新授权后恢复。真实缺表503且不续期、SQL不可用时退出单会话、禁用/重新启用不复活已删除 key 均通过 | 首轮修复 jar 日志 `framework-authorization-recovery-green.log`；最终源码两配置重跑见后面的网络故障证据 |
| 主库一致性 | `authorization-snapshot-proof-native.log`：122项真实 MySQL/Spring/MyBatis 断言，主从上下文、真实事务属性、外层挂起恢复、并发全快照、最终密码证明、缺表恢复、精确长ID；2026-10-15 17:56终态通过 | 对应当时快照/登录读取实现；不覆盖此后角色、部门、菜单写边界补丁，不等同于网络全链路或压力测试 |
| 外层提交/回滚 | `authorization-mutation-native.log`：6场景54项断言，真实角色/菜单写入，独立连接观察已提交值与释放的根锁，回滚不刷新；18:04终态通过 | callback观察，不代表 Redis 实写；早于后续 RoleService/MenuService 字段及层级补丁，不能替代最新源码整体运行验收 |
| Redis初读及部分刷新 | `server/eforge-boot/target/hardening-authorization-refresh-native-final.log`：110项断言。真实GET被ACL禁止后A/B/C缓存原样；A成功CAS后禁止SET/DEL，B的真实CAS和撤销均失败，C未处理。SQL角色停用已提交，恢复Redis后三份原JWT逐一403，TTL不延长；18:19终态通过 | 真实Spring/MyBatis/Redis及生产JWT过滤器/PermissionService servlet链；不是网络HTTP，不覆盖此后兼容角色字段投影 |
| 旧部门原子写入 | `framework-legacy-department-red.log`：15例14红；GREEN新增15+原规范14+数据范围10共39通过。原 `server/eforge-boot/target/hardening-department-mutation-native-schema.log` 的85项真实MySQL证据证明本节点/父状态UPDATE触发器故障完整回滚、重试、旧add/edit实际根锁等待及DataScope1–5 | 原85项是事务片证据；下述178项在新部门边界源码上重跑并扩展同一探针，不能将85和178相加当独立覆盖 |
| 旧菜单授权与删除竞态 | 新增30例中20红，新旧菜单及外层事务57/57通过。`server/eforge-boot/target/hardening-menu-mutation-native-compiled.log`：52项真实Spring/MyBatis/MySQL/Redis断言，授权先提交时删除等待后保留原已分配警告，删除先提交时授权等待后404且无孤儿关联；通配权限、不可见对象及停用角色的旧会话请求拒绝，SQL/缓存/TTL保持；null/不变/非空清空/合法赋值保持；18:40终态通过 | 真实服务/控制器与存储调用，不是网络HTTP；早于18:54菜单cycle补丁，不能当作新增环检查的原生证据。单条请求角色有效性仍以当前事务快照为界 |
| 旧写字段与层级授权 | `framework-legacy-department-authorization-red/green.log`：新增30例27红→部门/事务/规范/DataScope合计69通过。`server/eforge-boot/target/hardening-department-authorization-native.log`：18:56终态178项真实MySQL断言全部通过，包含原故障/根锁/数据范围回归，新增范围外或不存在父级、子孙环、伪ancestors、根删除及混合排序整批无写入；原/null父级保留、根编辑不采纳伪层级、创建忽略提交ID/派生/audit字段、合法范围内兄弟迁移均验证完整行与账号/角色/关系保持。菜单cycle另有 `framework-legacy-menu-cycle-red/green.log`：36例中2红→新旧菜单/提交合计63通过 | 178项使用当时已冻结的新部门生产类，测试仅独占MySQL，不是网络HTTP；部门整数排序保持旧语义，不擅自新增Min0规则。菜单新环规则由MVC验证，52项旧原生记录未重跑 |
| 兼容存储错误隐私 | `server/eforge-boot/target/hardening-legacy-storage-red/green.log`：新 LegacyStorageFailureBoundaryTest 19例8红→19绿；连同认证5、规范部门14、旧部门事务15、诊断6，共59通过。真实旧部门list/PUT根锁和规范list/POST控制器分别注入4种存储异常；捕获日志确认只有有界诊断、无原SQL/secret/Throwable，关联ID由服务端生成，规范处理器仍优先使用ProblemDetail | MVC控制器与advice实路由，存储依赖受控；不是实际数据库故障或网络HTTP。仅收敛DataAccessException/TransactionException；3控制例保留ServiceException/UserException/其他Runtime契约。发生在后续部门授权补丁之前 |
| 旧角色操作字段与数据范围 | `server/eforge-boot/target/hardening-role-operation-red/green.log`：新 LegacyRoleOperationBoundaryTest 33例17红→33绿；与旧角色菜单47、旧identity22、规范角色19、外层提交6及DataScope10，共137通过，18:59终态。四操作专用写集、双入口scope整批预检、所有合法mode1–5、目标缺失、无权限与非法status均覆盖；成功后真实Spring提交回调顺序保持 | 真实控制器/security/RoleService与Spring同步钩子，持久依赖受控；实际SQL证据见下一行，不与共享回归简单相加 |
| 旧角色实际SQL与回滚 | 仓库根目录 `role-operation-native.log`：19:03终态通过，16场景244项真实Spring/MyBatis/MySQL断言。add/edit/status/scope四入口逐列写集及角色/菜单/用户/部门关联保持、服务端身份与可信actor、超过2^53的精确long、mode1–5、跨范围/不存在/重复/非法部门集合整批零写入、无权限及角色对象范围拒绝均通过。scope的sys_role_dept INSERT、edit/add的sys_role_menu INSERT分别由真实SQL触发器失败，先前角色与关联写入、审计完整回滚，移除自有故障后相同请求重试成功 | 真实控制器、方法安全、DataScope、事务与mapper；不是网络HTTP。独立连接的afterCommit观察器继承生产refreshAfterCommit，仅核对提交后根锁释放、完整角色行和精确受影响用户；失败不回调，不代表Redis实写。普通身份缺失部门先403、admin明确404均有实际SQL证据 |
| 独立只读复核 | 独立代理对上述角色最终两文件与SysRoleMapper.updateRole逐列复核，未发现新增阻塞：fresh patch按操作隔离、primitive flags正确保留、scope整批校验先于原服务写入、数组复制、备注null/空串原语义、可信actor及根锁/afterCommit位置保持 | 复核结论不替代真实SQL、整体验证或精确云端验收 |
| 登录与异常边界 | 登录 provider/队列边界37例、规范/兼容错误5例通过；登录原22例9红→全绿、增加队列故障后的37例10红→全绿；角色/菜单外层事务6例4红→全绿 | 真实 provider 配合可控依赖与队列边界；不声称异步审计最终交付 |
| 后端历史完整构建 | `framework-authorization-final-verify.log`：18:10 Maven verify 成功。framework88、workflow47、boot847，共982个报告计数，0失败/0错误，含11项环境测试跳过，即实际执行971项 | 早于后续getInfo兼容投影、部门事务/授权、菜单授权/cycle、旧存储隐私及角色字段补丁；即使日志名含final，也不是本轮最终源码完整构建。环境测试须独立验证，跳过不算通过 |
| 最终源码完整构建 | `server/eforge-boot/target/framework-hardening-final-verify.log`：19:06 Maven verify 终态成功。framework88、workflow47、boot989，共1124个报告计数，0失败/0错误；11项环境测试跳过，实际执行1113项 | 包含上述全部生产修复并重新打包；环境专用用例与真实部署链路仍由独立验证补充，不把跳过计为通过 |
| 最终源码两配置网络故障 | `server/eforge-boot/target/hardening-recovery-default.log` 与 `hardening-recovery-enabled.log` 均终态通过：真实KEYS拒绝后SQL撤权已提交、两原JWT拒绝、重新授予恢复；真实缺表503/无续期、SQL故障时精确退出、恢复后正常续期、禁用删除旧会话/重新启用后旧JWT无效，以及安全诊断关联均通过 | 使用最终jar，独占MySQL/Redis和真实HTTP；启用配置包含控制台、自定义输出、Flowable及异步开关。生成应用和完整浏览器/API仍单独验收 |

Redis探针首轮失败是断言未识别 Redis 7.4 的真实ACL错误文案；保留ACL LOG与实际命令失败的双重判断后通过，未修改产品绕过故障。getInfo兼容投影另有9例7红→9绿，恢复原 trim/逗号拆分且不增加SQL。178项部门扩展探针首次运行即通过，并已确认本探针所有权标签下无残留容器。上表各组存在共享回归，不应简单相加宣称唯一测试总数。

本次文档更新时，角色实际SQL探针、最终源码完整Maven、两配置网络授权故障恢复均已终态通过。`server/eforge-boot/target/hardening-generated-default.log` 和 `hardening-generated-enabled.log` 也均终态通过，覆盖七类实际生成模块的编译、客户端、构建、浏览器、SQL授权与审计，不等同于框架68项浏览器套件。两配置完整框架HTTP/浏览器、实时OpenAPI一致性及精确提交云端仍待终态验收。上表阶段性证据不替代这些最终检查。

## 明确边界与剩余风险

- 写入口深审确认旧部门多SQL缺事务、派生层级字段透传与新父数据范围缺口，以及旧菜单删除/授予竞态、任意权限标识提升和环检查缺口，已完成上述最小修复与分层回归。旧角色add/edit/status/scope的操作字段投影及共享scope预检已实现，针对性137项、16场景244项实际SQL断言通过并经独立只读复核；最终整体仍待验收。事务原子性不能代替写入授权；H01仍进行中，不能以缓存故障通过代替所有写边界验收。
- 原非admin部门范围检查会先拒绝不可见或不存在部门，因此真实缺失部门可先得到403；admin跳过范围过滤后才走明确404存在检查。保持规范入口现有顺序，不能用可控MVC依赖中的404场景推断所有实际身份的响应。
- 核验保证请求读取时刻的完整快照，不中断已经通过认证的在途操作；没有跨 SQL/Redis 的原子事务。
- Redis 缓存投影可能仍旧，下一次认证重新核验主库。SQL 提交后缓存刷新失败可能返回错误，客户端需重新查询已提交状态。
- 禁用时 Redis DEL 失败返回503。未实现持久账号代际协议，不能宣称覆盖“存储故障期间禁用又启用”的全部强退语义。
- 不新增改密后所有既有会话强退的业务规则；最终凭据证明只约束正在创建的新会话。
- REQUIRES_NEW 可能需要额外连接；原生 maxActive=1 外层事务场景约706ms安全503，释放后恢复。生产连接预算与授权查询数仍归 H10 测量。
- 共享锁内 Redis I/O、全库 key 枚举和每角色查询仍存在。本修复优先使其失败不能放行旧权限，未把它们冒充已优化的性能路径。
- 真实测试只使用本次创建的独占数据库/Redis/随机凭据与端口，不修改用户预览数据库或业务会话；日志不输出 JWT、缓存用户或密码。

## 2026-10-18 阶段验收

H01精确提交7331671已通过云端四作业、两配置各68浏览器、完整API和实际存储探针；前述最终待验收状态由此收口。请求时刻/在途操作/SQL与Redis非原子/账号代际及H10规模边界仍有效。 统一证据见 [H01–H04验收](framework-hardening-h01-h04-acceptance.md)。
