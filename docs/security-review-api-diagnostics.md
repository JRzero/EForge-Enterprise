# 规范 API 故障诊断审查

状态：实现、完整Maven及两配置真实运行验收通过，精确提交云端待核验。2026-10-15，框架加固 H03。

## 运维问题与边界

本切片回答：用户报告的错误对应哪一次请求？错误来自哪种异常、哪个应用位置？同类服务器故障是否重复发生？

规范 ProblemDetail 增加 `requestId` 扩展，同时返回 `X-Request-ID`；同一请求的错误处理共享一个服务端随机 UUID。请求头、查询和正文无法选择该编号。成功响应、JWT、操作审计、兼容 AjaxResult 语义不变。该编号只用于诊断，不用于身份、授权或幂等。

控制器 advice、Spring 框架异常、路由错误、认证过滤器拒绝和生成器部分成功的专用 ProblemDetail 均使用同一关联规则。生成器保留原 `creation` / `output` 全部结果；错误编号不能代替部分 DDL/文件结果的人工核验。

5xx 产生固定 `api_server_error` JSON 事件；503 使用 WARN（包括主动关闭的功能），其余5xx使用ERROR。4xx保留关联编号而不产生服务器故障事件。没有改动所有历史日志，更没有宣称已经完成全框架日志隐私审计。

## 私密数据与资源限制

- 白名单字段：固定事件/入口、实际HTTP状态、安全大写错误码、服务端请求编号、异常类型、有限的应用代码位置。
- 不序列化 Throwable、不传 Throwable 给日志后端；不输出异常消息、请求URI/查询/正文、SQL、文件名、用户身份或认证令牌。
- cause按对象身份检测环，最多4层；每层检查前64帧，只输出最多8个应用位置，符号受长度与字符限制。
- 输出为JSON，使用现有Jackson编码；内部序列化失败只保留固定失败事件与编号。
- 这是错误路径的日志诊断，不是跨服务追踪系统。可按固定event/status/code聚合错误次数；请求编号不得作为指标标签。不添加新的监控服务或依赖。

## 已有针对证据

- `framework-diagnostics-red.log`：原实现2项均失败，无关联编号/诊断。
- `framework-diagnostics-framework-red.log`：补查发现框架5xx没有诊断；另一项是测试的独立ObjectMapper未安装Spring ProblemDetail mixin，已修正夹具，不是产品序列化缺陷。
- `framework-diagnostics-final-target.log`：6项通过。覆盖无审计GET、伪造请求头、私密异常/查询、4xx、框架序列化/路由503、认证错误、循环/长cause与恶意栈帧。
- `framework-diagnostics-partial-red.log`：生成器31项MVC中新增2项失败，确认局部handler缺关联；修复后完整Maven中31项全部通过。
- 独立审查发现的静默业务500、框架5xx和固定日志status问题已修复；503警告策略已明确。

真实集成脚本对每个规范错误检查body/header编号一致，并在完整运行结束后将实际5xx逐一关联到应用JSON诊断与状态。不会仅凭mock证明真实SQL/Redis故障日志可用。运行手册见 [API故障排查](runbooks/api-server-errors.md)。

## 完整本地证据

- `framework-hardening-full-verify.log`：Maven verify成功，908项中897通过、11按原设置跳过（独立数据库/Redis等环境型测试）。不是“908全部执行通过”。包含10项数据范围parity。
- `framework-hardening-disabled-runtime.log` / `framework-hardening-enabled-runtime.log`：同一顺序进程24394终态0。默认与工作流/控制台/自定义输出启用两配置，各68真实浏览器与完整MySQL/Redis/Quartz/OSHI/ACL/故障回滚/验证码/原接口回归通过。
- 两配置分别37、40次实际5xx响应编号与应用日志逐一对应，包含SQL、Redis ACL及部分生成结果。日志副本在`server/eforge-boot/target/hardening-{disabled,enabled}-application.log`。
- 两实时OpenAPI与已提交契约逐字符一致（统一Git文本行尾）；规范化UTF-8 SHA256为`3D7FC784F8576A602E8965C07A0CD0C1B6215C0E93750FE07B5E29238AE15F0C`。工作区契约采用CRLF，磁盘原始字节hash不同不表示内容漂移。
- 前端生成复现、lint、typecheck、131单元、build、248完整模拟浏览器通过；本切片没有改变生成客户端签名。
- 独立原生MySQL probes及实际生成CRUD/tree/sub完整安装浏览器留在精确CI验证；本地两配置运行没有冒称执行这些独立probe。最终云端终态另行补证。
