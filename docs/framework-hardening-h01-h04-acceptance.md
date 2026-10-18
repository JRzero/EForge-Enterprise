# H01–H04 精确提交验收

日期：2026-10-18。实现提交：`7331671a0b8ea9cd9905dd90f48a3307405d0226`，分支 `codex/compact-list-layout`。本记录仅验收 H01–H04；H05–H11 与最终 H13 尚未完成，没有合并 main 或部署。

## 云端最终证据

- [server-ci 39084790316](https://github.com/JRzero/EForge-Enterprise/actions/runs/39084790316)：verify、runtime-integration、auth-runtime-integration/default、auth-runtime-integration/enabled 四项全部 success。
- [web-ci 39084790318](https://github.com/JRzero/EForge-Enterprise/actions/runs/39084790318)：success；生成客户端复现、lint、typecheck、131 单元、build、294 模拟 API 浏览器、5 项正式产物浏览器全部通过。
- [agent-skills 39084790402](https://github.com/JRzero/EForge-Enterprise/actions/runs/39084790402)：success。
- 三份权威结果的 headSha 均为上述完整 SHA；观察进程 51406 终态 0。直接日志保存在 `server/eforge-boot/target/hardening-7331671-cloud-server-final.log` 和 `hardening-7331671-cloud-web-final.log`。

后端 Maven 报告 1124 项（88 framework、47 workflow、989 boot），其中 1113 执行通过、11 环境项跳过，零失败/错误。真实存储探针另行执行：授权快照122、事务回调54、Redis故障110、部门178、菜单52、角色16场景244断言；这些不是互不重叠的用例总数，事务回调探针本身不证明 Redis 持久化。

默认、启用两配置各68真实浏览器及完整 API 全部通过，两实时 OpenAPI 与提交契约一致。默认配置核验37条、启用配置核验40条实际服务器故障诊断与响应 requestId。原 JWT 撤权、Redis KEYS 故障恢复、SQL 不可用、不续期、精确退出、禁用账号均有真实 HTTP/SQL/Redis 证据。生成应用包含七类实际编译、安装与浏览器运行的 CRUD/tree/sub、自动主键和 String-key 家族，保留精确 ID/金额、字段关联、上传、草稿、权限和审计验证。

## 修复过程与不变边界

本地回归曾揭示日期全局/字段双错误的旧浏览器定位、锁屏认证前置后的错误码及两处任务审计文本旧断言。修正均保留原保护断言：锁屏 SQL 故障不改变会话字节/TTL；任务 SQL 回滚与重试保留；兼容任务审计严格固定安全文本和 UUID，规范任务审计还要求编号等于同次 HTTP 响应。未改为任意文本匹配，未以删断言获取通过。

H01 保证请求认证时刻的主库权限快照，不撤销已认证的在途操作，也不是跨 SQL/Redis 原子事务；禁用后存储故障期间再启用的持久账号代际协议未实现。共享锁内 Redis I/O、KEYS 枚举、按角色查询仍归 H10。详见授权安全审查及 ADR 0020。

H04 验收字段标签、帮助、错误、只读/禁用、弹层和富文本契约；隐藏区域错误导航与稳定明细行定位属于 H05，不在本次完成声明中。表单构建器继续暂缓。

## 本地最终收口

顺序进程32875终态0：hardening-oct18-final-default.log完整API通过；hardening-oct18-final-enabled.log的68真实浏览器及完整API通过。默认68真实浏览器来自同一未改产品源码的前轮75064，前轮随后失败的旧审计断言不冒充通过，最终API已在本轮重验。两份实时OpenAPI仅统一CRLF/LF后与契约文本精确一致。
