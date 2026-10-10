# 工作流版本内容对比审查

范围：同包不可变发布与当前草稿或另一发布的只读对比。它不是流程语义等价分析，也不代替真实场景证明。

## 边界

- `GET /api/v1/workflow/packages/{id}/comparison` 使用原 `workflow:definition:list`；发布或激活权限不能替代读取权限。默认禁用时安全 503。
- 一条参数化 JOIN 查询取得包、基准发布和目标发布/草稿；两侧同属明确的包，跨包和不存在的版本均 404。读取不加变更锁，不修改证明、审计、发布时间或激活选择。
- 返回双方版本和摘要，以及名称、业务绑定、BPMN 和场景的前后保存内容。版本以十进制字符串跨 HTTP；场景先反序列化为固定契约后以一致 JSON 形式展示，XML 保留原文。
- 数据库不可用返回安全 503，坏存储 JSON 返回安全 500；不传播 SQL、驱动或坏 JSON 的原始错误。
- 页面使用纯文本和 React 转义展示，支持跨发布分页保留基准、读取失败重试、重新读取当前草稿与手机单列布局；每次新目标/重读清除旧结果并取消旧请求。
- Agent `diff` 只调用该规范 GET，无写入或隐式校验/激活。省略目标表示当前草稿。

## 证据

- `flowable-comparison-red.log`：未实现时 2 个行为测试失败；`flowable-comparison-green.log` 通过，验证长版本、差异字段、旧发布不变、无写入、跨包、坏 JSON 与 SQL 故障。
- `flowable-comparison-verify.log`：完整隔离 Maven verify 成功。MVC 验证精确版本、原读取权限及输入拒绝；原预览 jar 未重打包。
- `flowable-comparison-enabled-runtime.log`：新对比、Agent diff 与完整真实 API 终态 PASS，实际 MySQL 比较、证明不变、SQL 故障和恢复通过。
- 前端 lint/typecheck/128 单元/build/客户端复现通过；`flowable-comparison-browser-accepted.log` 5 项管理页面与对比测试通过。初次生成函数的参数位置已按真实生成接口修正；随后开发 StrictMode 的重复只读请求使固定次数断言失败，改为核验最后一次目标和 GET 行为后通过。
- 最终两配置真实浏览器、全量交互和精确提交云端仍待终态。独立审查未运行测试，指出的生成契约缺失已由实际应用导出并生成补齐。
