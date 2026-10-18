# H08 高频业务字段与审计展示

状态：in_progress；完整范围含文件上传字段、精确数值字段、审计时间线/差异。当前仅实施审计展示切片，不代表H08完成。

AuditTimeline接受显式AuditEvent与AuditChange投影，不读取业务context、不请求接口、不自动序列化原始日志。调用方负责授权和字段白名单，不能传入未经筛选的含秘密审计载荷。账号/前后值均为string，保持超JS精度ID与小数尾零；null与空文本分别显示。保留服务端给定顺序，不按客户端时间重新排序。时间使用本地显示，time datetime/title保留原时间戳；非法值显示“时间不可用”。所有文本由React转义，无innerHTML或自动链接。

真实消费者：WorkflowLeaveDetail原处理记录；仅替换展示，原API、权限、指令ID/版本与失败重试流程保持。展示消费者：ApprovalDemo模拟批准后的状态/意见前后差异，明确本地模拟。

定向证据：2项单元通过（DOM解析证明恶意HTML无可执行节点、长ID/金额尾零、null/空/零、原顺序和时间）；17项审批/展示页浏览器通过，320窄屏恶意长意见不溢出。人工查看test-results/audit-timeline-mobile.png：长文本换行、精确编号和关闭控件可见。初次单元文件tsx未被既有配置收集、继而缺jsdom环境，修正测试文件约定后通过；首轮展示测试因新差异区同名状态导致全局locator歧义，限定所属tabpanel后通过。无放宽产品验收。

尚待：全量前端/真实审批回归与精确提交CI；文件字段及精确数值字段实际消费者/示例仍未实现。H07精确0587b90的server39117234444与web39117234460仍在运行，技能39117234439成功，不将旧阶段云端结果替代本阶段验收。

全量前端：135单元、build、332模拟浏览器、5 dist均终态通过（h08-audit-unit/build/browser/dist.log，进程79848 exit0），lint/typecheck通过。随后仅增加真实审批处理记录断言；进程10123正在运行启用配置完整API，实际Flowable浏览器1项已成功，验证独立审批人、领取/批准/拒绝/撤回及时间线三条动作/意见/time节点。完整API未终态，不提前验收。

后续文件/数值真实消费者已定位server/eforge-generator/src/main/resources/vm/react/Page.tsx.vm的FieldControl：当前上传逻辑局部实现、Long/BigDecimal保持原字符串。下一切片应复用现有UploadEntries/ImagePreview/ResourceFileLinks及兼容上传授权路径；精确数值不可转换为Number，需维持原生成CRUD/tree/sub真实编译/浏览器验收，不能只交付showcase。

启用配置真实终态：10123 exit0，h08-audit-enabled-runtime.log含1项实际Flowable审批浏览器和完整API/SQL/Redis/40诊断/验证码回归。实时OpenAPI与契约完整JSON结构一致。后端源未改，本切片本地不重复Maven；精确提交CI仍须完成服务器门槛及两配置全量浏览器。此切片仅完成审计展示本地验证，H08整体保持in_progress。
