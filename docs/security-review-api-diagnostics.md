# 规范 API 故障诊断审查

状态：原实现完整本地通过；精确7e411bb云端发现实际生成接口的遗漏，修复及审计异常隐私补充已通过针对验证，最终全量与新精确云端待验收。2026-10-15，框架加固 H03。

## 运维问题与边界

本切片回答：用户报告的错误对应哪一次请求？错误来自哪种异常、哪个应用位置？同类服务器故障是否重复发生？

规范 ProblemDetail 增加 `requestId` 扩展，同时返回 `X-Request-ID`；同一请求的错误处理共享一个服务端随机 UUID。请求头、查询和正文无法选择该编号。该编号只用于诊断，不用于身份、授权或幂等。补充修复将失败操作审计的任意异常文本替换为安全说明和同一编号；正常审计字段、参数排除与业务结果保持。

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

## 精确云端发现与补充修复

`7e411bbd16fe9af18dba34f864bd110aa57388c6` 的 web-ci `38710412483`、agent-skills-ci `38710412512` 成功。server-ci `38710412542` 的两配置 auth-runtime-integration 与 runtime-integration 成功，但 verify 在真实生成模块/React安装验证中失败：生成控制器自己的 ProblemDetail handler 未带 requestId。观察命令的 TLS 超时不作为工作流结果；上述来自GitHub最终任务状态。

- `framework-generated-diagnostics-red-2.log`：动态生成并编译CRUD/tree/sub的7测试中6失败；`framework-generated-diagnostics-green-final.log`：7全通过。模板全部SQL错误使用安全ApiFailure保留cause供受控诊断，补unexpected500，框架502/415及响应头保持。
- 补查 `LogAspect` 发现AfterThrowing先于HTTP handler，原始异常message会先写入操作审计，参数序列化/调度失败还会打印原始参数和堆栈。`framework-audit-privacy-red.log` 7测试6失败；`framework-audit-privacy-green.log` 7全通过，使用真实AOP/MVC证明审计与HTTP编号一致。
- 普通失败审计只存固定摘要+编号；显式ApiFailure保留其公开safe code/detail，仍按2000字符限制并保留完整编号。内部捕获失败记录独立 `audit_recording_failed`，只含固定stage、编号和受限异常类型，不把业务成功误记为HTTP500。
- 异步持久化机制未改变；提交到队列成功不等于最终SQL审计必达。本切片没有宣称可靠投递或全框架旧日志已完成隐私审计。

最终源码 `server/eforge-boot/target/framework-hardening-final-verify.log` 已终态成功：1124报告计数、实际1113项执行通过、11项环境专用测试跳过。

两配置实际生成应用的最终日志已直接核验：

- `server/eforge-boot/target/hardening-generated-default.log`：2026-10-15 19:12终态通过。
- `server/eforge-boot/target/hardening-generated-enabled.log`：2026-10-15 19:15终态通过。

两份日志均包含实际生成Java/mapper编译、生成OpenAPI客户端复现与严格类型、安装后的宿主生产构建、CRUD/tree/sub及自动主键/字符串主键页面的真实浏览器操作，以及原Boot/JWT/Redis/MyBatis/LogAspect、撤权/退出和持久审计回归；末尾均为 `PASS: focused generated React and original Boot module verification completed.`。主子富文本字段名称与独立ID的浏览器定位调整也已在这些实际生成页面中执行。原云端暴露的生成错误缺requestId已在真实部署链路验证；这组证据属于生成应用专用验证，不计作完整框架的68项真实浏览器。

当前完整框架两配置HTTP/浏览器仍运行，新的精确提交云端仍待终态。不能用旧提交成功任务替代新源码验收。

### 2026-10-18 任务审计集成断言接续

默认配置的68项框架浏览器在 `hardening-runtime-final-default.log` 已通过；后续API先因锁屏的旧认证错误码断言中断，修正后已证明实际授权故障不续期/不改会话、恢复同JWT可解锁。随后的 `hardening-runtime-accepted-default.log` 暴露旧任务审计断言仍要求原ServiceException文案；`hardening-oct18-default.log` 已证明修正后的旧路由固定摘要/UUID、完整SQL回滚和重试通过，随后规范任务审计仍要求不含code/requestId的旧文本而中断。

两处断言现按已实现的H03合同精确验证：旧路由只能持久化完整固定摘要与合法UUID；规范路由只能持久化公开错误码、固定安全detail及与同次HTTP响应完全相同的requestId。兼容HTTP中文错误、规范503、任务完整行回滚、真实调度和恢复重试保持；不接受任意非空文本，也不仅用“未匹配SQL关键词”代替内容合同。此处未修改产品源码或删除已有隐私检查。

当前验证日志为 `server/eforge-boot/target/hardening-oct18-final-default.log` 和 `hardening-oct18-final-enabled.log`，尚待终态。默认本轮只重跑完整API，沿用同一未变生产源码已通过的68浏览器；启用配置执行完整68浏览器和API。不将上述被断言中断的运行记为全量通过。
