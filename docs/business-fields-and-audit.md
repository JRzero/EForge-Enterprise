# H08 高频业务字段与审计展示

状态：in_progress；完整范围含文件上传字段、精确数值字段、审计时间线/差异。当前仅实施审计展示切片，不代表H08完成。

AuditTimeline接受显式AuditEvent与AuditChange投影，不读取业务context、不请求接口、不自动序列化原始日志。调用方负责授权和字段白名单，不能传入未经筛选的含秘密审计载荷。账号/前后值均为string，保持超JS精度ID与小数尾零；null与空文本分别显示。保留服务端给定顺序，不按客户端时间重新排序。时间使用本地显示，time datetime/title保留原时间戳；非法值显示“时间不可用”。所有文本由React转义，无innerHTML或自动链接。

真实消费者：WorkflowLeaveDetail原处理记录；仅替换展示，原API、权限、指令ID/版本与失败重试流程保持。展示消费者：ApprovalDemo模拟批准后的状态/意见前后差异，明确本地模拟。

定向证据：2项单元通过（DOM解析证明恶意HTML无可执行节点、长ID/金额尾零、null/空/零、原顺序和时间）；17项审批/展示页浏览器通过，320窄屏恶意长意见不溢出。人工查看test-results/audit-timeline-mobile.png：长文本换行、精确编号和关闭控件可见。初次单元文件tsx未被既有配置收集、继而缺jsdom环境，修正测试文件约定后通过；首轮展示测试因新差异区同名状态导致全局locator歧义，限定所属tabpanel后通过。无放宽产品验收。

尚待：全量前端/真实审批回归与精确提交CI；文件字段及精确数值字段实际消费者/示例仍未实现。H07精确0587b90的server39117234444与web39117234460仍在运行，技能39117234439成功，不将旧阶段云端结果替代本阶段验收。

全量前端：135单元、build、332模拟浏览器、5 dist均终态通过（h08-audit-unit/build/browser/dist.log，进程79848 exit0），lint/typecheck通过。随后仅增加真实审批处理记录断言；进程10123正在运行启用配置完整API，实际Flowable浏览器1项已成功，验证独立审批人、领取/批准/拒绝/撤回及时间线三条动作/意见/time节点。完整API未终态，不提前验收。

后续文件/数值真实消费者已定位server/eforge-generator/src/main/resources/vm/react/Page.tsx.vm的FieldControl：当前上传逻辑局部实现、Long/BigDecimal保持原字符串。下一切片应复用现有UploadEntries/ImagePreview/ResourceFileLinks及兼容上传授权路径；精确数值不可转换为Number，需维持原生成CRUD/tree/sub真实编译/浏览器验收，不能只交付showcase。

启用配置真实终态：10123 exit0，h08-audit-enabled-runtime.log含1项实际Flowable审批浏览器和完整API/SQL/Redis/40诊断/验证码回归。实时OpenAPI与契约完整JSON结构一致。后端源未改，本切片本地不重复Maven；精确提交CI仍须完成服务器门槛及两配置全量浏览器。此切片仅完成审计展示本地验证，H08整体保持in_progress。

精确数值切片进行中：ExactNumberInput/规则模型已接入生成器Page.tsx.vm的Long/BigDecimal，及独立ExactNumberDemo。全程受控string，不Number转换或舍入；精确范围比较使用数字串与指数，不按指数大小分配数组；允许BigDecimal指数表示，Long只接受整数字面量。可选scale按有效小数位校验，保留输入尾零；金额/百分比仅单位提示，不隐式乘除。空串仍表示未填写；required由表单负责；非法中间草稿保留、customValidity阻止提交。只规范化明确逗号三位分组粘贴，歧义1,23保留并提示。

已验证3项规则单元，最终138前端单元/lint/typecheck/build通过；13定向数值/展示浏览器通过。第一次独立示例误置于EditorPage内形成嵌套form，真实测试保存失败；移到独立兄弟表单后13项全绿。完整Maven verify终态成功，h08-number-maven.log，进程62259 exit0；无本地运行app期间打包。

当前权威进程58886顺序运行默认/启用VerifyGeneratedReactOnly，两份日志h08-number-generated-default.log与h08-number-generated-enabled.log；新jar已包含模板接入，实际生成浏览器脚本新增非法小数validity拒绝/原草稿保留/恢复有效验证。尚未终态，不重复启动或同时运行会改写生成路由的构建/浏览器。实际生成CRUD/tree/sub编译运行、全量框架浏览器/dist及精确提交CI仍待；数值源尚未提交。文件字段仍待开发。审计4e69ac0的web39118541161已成功，server39118541304仍在运行。

审计切片云端终态：4e69ac01f7c52453ab7bc3665ff53b0045e9484b的server39118541304四作业、web39118541161、skills39118541430全部success；h08-audit-cloud-final.log直接确认两配置各68真实浏览器/完整API/OpenAPI及两实际生成React应用回归。仅审计展示切片验收，不代表H08全部完成。

数值切片本地终态：58886 exit0，默认/启用h08-number-generated-default/enabled.log均PASS，真实生成CRUD/tree/sub及自动主键/String键页面编译、构建、浏览器、精确ID/金额SQL往返、权限/审计与原上传/时区回归通过。随后7196 exit0，完整334模拟浏览器、5 dist通过；138单元及Maven全模块成功。新native有效性断言证明歧义1,23保持草稿且拒绝提交，合法超精度金额恢复有效。

OpenAPI检查边界：生成应用专用运行安装了业务端点，因此直接与无业务契约deepEqual会失败；差异已逐项核实，两配置的所有原框架paths/schema/security/info/server字段完全一致，额外仅21个/api/v1/business/fixture路径与30个fixture模型。不是放宽原框架一致性，动态生成契约仍经实际客户端严格类型与HTTP验证。数值切片精确提交云端待验收；文件字段尚未实现，其他H09-H11/H13保留。

文件字段切片实现中：FileField受控路径列表/有界本地File队列，注入上传、校验、错误消息、渲染与busy回调。复用UploadEntries排序（实现移入ui，原app路径仅兼容导出），生成Page.tsx.vm接入并保留五文件/原格式/5MB/逗号限制、预览、链接、原权限上传路径。使用原fetch认证传输时显示不定进度与完成文件数；适配器提供实际loaded/total才显示字节进度，不伪造真实网络百分比。展示FileFieldDemo明确本地模拟。

取消中止队列，已确认成功的文件保留；迟到响应不写回；重试失败/取消项重新校验剩余容量；没有远程DELETE。真实卸载通过清理后的DOM连接状态中止请求，Activity隐藏时节点仍连接因而保留上传。busy回调按操作一次开始/一次释放，取消回焦点到字段。只读与disabled阻止选择/移除/重排/重试，完成响应后若已只读不再写值。

当前13项文件/展示浏览器通过，3项迟到响应单元通过（忽略signal的适配器在取消/真实卸载/只读后完成，onChange仍零次，busy精确true/false）；初次展示旧全局file input选择器因新增字段匹配两个元素失败，已限定原“文件选择”区域，保留原测试能力。首轮完整Maven及前端单元/build通过；随后仅补生成器原“五个文件”文案与实际HTTP失败重试断言，最终Maven进程41817、前端26166仍待终态。尚未开始本切片真实生成应用，不将前一数值验证充当文件验证。

文件切片最终静态/框架验证：41817 Maven全模块verify成功、26166 lint/typecheck/141单元/build成功，79868完整336模拟浏览器/5 dist成功。最终源已固定。实际生成回归唯一顺序进程73546正在默认后启用VerifyGeneratedReactOnly，日志h08-file-generated-default/enabled.log，勿重复启动或同时修改生成路由/打包；最终jar已包含FileField模板。真实脚本新增原服务失败文件重试成功、移除重试结果后继续原混合批次/顺序/SQL验证，写请求数相应精确更新；原文案“五个文件”通过业务limitMessage保留。未终态前不宣称实际生成回归通过，未提交此文件切片。

数值切片精确云端验收：469fc28d6f5cdfd88c7ea02e2db713e8b6f80139 的 server39119838559 四作业及 web39119838587 均终态 success；h08-number-cloud-final.log 直接确认两配置各68真实浏览器、完整API/OpenAPI及两配置实际生成React应用通过。

文件真实回归首轮73546终态失败：容量超限提示与前次单文件校验错误同时展示，旧 getByRole(alert) 产生两个匹配；产品提示内容正确。断言已限定“最多上传五个文件。”，保留原失败队列及零上传请求断言。新顺序进程14135运行默认/启用真实生成回归，默认日志 h08-file-generated-default-retry.log，未终态不得验收。

文件切片真实本地终态：14135 exit0，h08-file-generated-default-retry.log 与 h08-file-generated-enabled.log 均以 focused generated React verification PASS 结束。两配置实际CRUD/tree/sub/自动主键/String键应用编译运行、文件失败重试及混合批次成功保留、拖动/键盘排序、预览、Activity隐藏上传锁、SQL精确保存、权限/撤权/审计全部通过。原框架OpenAPI所有paths/schemas及其余合同字段逐项精确一致，额外仅21个生成fixture路径和30个fixture模型。仅修改数量提示测试定位后重跑，没有产品代码变化；141单元/336模拟浏览器/5 dist/Maven证据仍对应最终产品源。精确提交CI待验收，H08保持in_progress。
