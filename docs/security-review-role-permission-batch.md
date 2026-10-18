# 角色权限批量读取安全审查

H10第一实现切片，未验收。优化前实测见 proposed-scale-baseline.md：20角色每请求22次业务SELECT；优化目标为非空有效普通角色集固定3次。

## 边界

只修改内部菜单mapper/service及SysPermissionService的查询组织。SQL参数化IN列表返回(role_id,perms)，仍过滤菜单status、角色status和del_flag；空列表SQL明确and 1=0，服务空列表不访问mapper。旧单角色与按用户方法保留兼容。

服务按请求角色ID建立各自独立HashSet，忽略不属于请求集合的返回行。原trim后按逗号split行为保持，不顺便规范化权限内空白。SysPermissionService仅批量请求原循环认可的正常、非保留admin角色，仍逐角色设置权限并合并用户总集合；不把总集合复制给每个role。真实admin用户仍直接拥有通配权限；旧空角色兼容分支保持，AuthorizationSnapshotService无有效角色时仍绕开该旧回退。

MASTER、REQUIRES_NEW、readonly REPEATABLE_READ、登录最终证明、提交后发布、Redis CAS/TTL、共享写锁与DataScopeAspect算法均未改变。没有跨请求缓存、会话索引或锁迁移。查询异常继续由现有快照边界脱敏成503；全部查询完成后才组装role权限，不在失败时发布部分授权。

## 验证进度

原实现先触发RolePermissionBatchTest的NeverWantedButInvoked失败（h10-role-red.log），证明确有逐角色调用；首个命令因PowerShell未引用含点号-D参数失败，仅是命令错误，修正后取得上述真正红测。实现后3项批量测试与10项DataScopeAspectParityTest通过，完整Maven仍在运行。

真实探针保留原190项安全/事务/故障检查，新增每个规模样本逐角色权限集合精确断言，并把查询预算改为无角色2次、非空3次。尚待实际运行；原基线不会被当作优化结果。随后必须执行原Redis故障恢复、两配置完整API/真实浏览器和精确OpenAPI/云端门槛。H10其它审批N+1、锁与扫描规模治理未完成。

本地实际SQL验证：18536 exit0，h10-role-batch-native.log，750项断言全绿。0/1/2/5/20角色的mapper及实际执行业务SELECT分别2/3/3/3/3；每个样本的每个角色均核对精确独立权限集合。原MASTER/独立RR/并发登录证明/故障恢复/单连接安全503通过。该轮与Maven并行，耗时不用于改善结论；查询次数从20角色22次降至3次为实证。

完整Maven首轮3失败来自LegacyMenuAuthorizationTest仍只stub旧单角色mapper。更新批量返回后，第二轮剩余旧方法顺序断言失败；现已将禁止无谓查询和取锁后读取的断言一起改为批量方法，保留原顺序与权限内容。最终58113正在运行h10-role-batch-verified-maven.log，未终态不得声称完整后端通过。无前端生产源变化；尚未启动最终jar的真实HTTP/Redis两配置验证，代码未提交。

最终58113 exit0，h10-role-batch-verified-maven.log 全模块BUILD SUCCESS，含3批量/10数据范围和旧菜单全部断言。接续唯一顺序真实运行：原授权恢复h10-role-recovery.log → 默认完整API/浏览器h10-role-default-runtime.log → 启用控制台/自定义输出/Flowable完整API/浏览器h10-role-enabled-runtime.log。最终jar已构建，运行期间不重新package，未终态不验收，不重复启动。

默认配置阶段已终态成功：h10-role-default-runtime.log含68 passed及最终完整API/SQL/Redis/验证码/37诊断/导航PASS，实时h10-role-default-openapi.json与contracts/openapi/api-v1.json完整JSON精确一致。先前h10-role-recovery.log也已最终PASS。原顺序进程4628仍运行，现已进入h10-role-enabled-runtime.log启用配置，不能据默认配置宣称两配置验收，保持未提交。

最终本地验收：顺序进程4628终态exit0，原授权恢复及默认/启用完整API均PASS，两配置各68真实浏览器通过；启用配置39项实际故障诊断关联通过。两份h10-role-default/enabled-openapi.json与contracts/openapi/api-v1.json经JSON deepStrictEqual精确一致。全部Maven/750真实SQL断言/HTTP回归完成，无前端生产改动。待提交后的精确云端四作业及生成应用验证；H10锁/扫描及审批查询其它切片仍未完成。

精确云端验收：e916f975e29028dc44805eaf246f4415b06886f1的server39126089551全四作业及skills39126089578终态success。h10-role-cloud-final.log直接记录750真实快照断言、默认/启用各68真实浏览器、完整API/OpenAPI及两实际生成CRUD/tree/sub应用通过。角色批量读取切片验收完成，H10其余项继续；本次没有前端源变化，不伪造web触发。
