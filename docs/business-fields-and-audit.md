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
