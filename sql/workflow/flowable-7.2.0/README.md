# Flowable 7.2.0 MySQL 初始 schema

这三个文件原样提取自官方 Maven Central 7.2.0 构件，遵循 Apache-2.0，版权归 Flowable 项目贡献者；不是框架自行设计的引擎表。

| 文件 | 官方构件和资源 | SHA-256 |
| --- | --- | --- |
| 01-common.sql | flowable-engine-common / org/flowable/common/db/create/flowable.mysql.create.common.sql | 9FC740C79257E104657B5CEAC038817637ADC2CF7683A246986416CD10B3BD93 |
| 02-engine.sql | flowable-engine / org/flowable/db/create/flowable.mysql.create.engine.sql | 582514FAB9C520680FDF68862AF8232D5D0A1B5A3FA6E6C6497E79EDCD85DA2E |
| 03-history.sql | flowable-engine / org/flowable/db/create/flowable.mysql.create.history.sql | 3BD341906F3E6BEA1BD18D077B75665797A75C7E38A251B0BC69A1CF33596EE4 |

仅在经过批准的空引擎 schema 上按编号执行一次；与业务表使用同一主数据库。它们不是幂等升级脚本，不能反复执行到已有 Flowable 表。不要删除已有表来处理冲突。现有引擎升级必须另行固定官方升级链、备份并演练。

应用保持 `flowable.database-schema-update=false`；测试脚本 `server/scripts/verify-workflow-engine.ps1` 只在自己创建的一次性容器中执行这些文件，并以自动建表关闭的实际引擎验证。

来源：https://github.com/flowable/flowable-engine/tree/flowable-7.2.0
