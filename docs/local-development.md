# 本地服务管理（Windows / PowerShell 7）

从仓库根目录运行。管理器只启动/停止本项目 Java 与 Vite 进程，不创建数据库、不执行迁移、不清空 Redis，也不自动打包。现有数据库须已按 server/README.md 初始化；不要在已有业务数据上重复导入 upstream SQL。

## 配置一次

安装 Java 17、项目支持的 Node、PowerShell 7，准备 MySQL 8.4 / Redis 7.4；运行 `npm --prefix web ci` 安装依赖。后端没有构建时执行 `mvn -B -ntp -f server/pom.xml verify`，打包前先停止使用该 jar 的本地应用。

在项目根目录创建 `.env.local.ps1`（已被 Git 忽略）。它是会被执行的本地 PowerShell 配置，只加载自己信任的文件。示例值必须替换为实际本地配置；不要提交密码：

```powershell
$env:EFORGE_DB_URL='jdbc:mysql://127.0.0.1:3306/eforge_enterprise?useUnicode=true&characterEncoding=utf8&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC'
$env:EFORGE_DB_USERNAME='eforge'
$env:EFORGE_DB_PASSWORD='<本地数据库密码>'
$env:EFORGE_TOKEN_SECRET='<本地随机长密钥>'
$env:EFORGE_REDIS_HOST='127.0.0.1'
$env:EFORGE_REDIS_PORT='6379'
$env:EFORGE_SERVER_PORT='18080'
$env:EFORGE_PROFILE=Join-Path $PSScriptRoot 'server/eforge-boot/target/local-service/uploads'
# 仅在数据库已安装工作流 schema 后启用；后台执行器默认保持关闭。
$env:EFORGE_WORKFLOW_ENABLED='false'
$env:EFORGE_WORKFLOW_ASYNC_ENABLED='false'
```

## 日常命令

```powershell
pwsh -File scripts/local-service.ps1 Start
pwsh -File scripts/local-service.ps1 Status
pwsh -File scripts/local-service.ps1 Stop
```

默认前端 http://127.0.0.1:5174，后端地址从配置读取并自动配置同源代理。`Start -WebPort 5175` 可调整前端端口；`-ConfigPath` 可指定另一份可信配置。Start 检测到本脚本记录的两个进程都在运行时直接返回；部分进程退出时先 Stop 再 Start。端口被其他进程占用会报错，不自动结束占用者。

Stop 检查记录的 PID、创建时间与启动入口，避免停止 PID 复用后的其他应用。它是本地开发进程停止操作，使用前保存未完成操作。旧版手工启动的服务不会被本脚本接管，需先停止经确认的旧前后端。Status 显示进程存活状态，不等于业务健康检查；Start 额外检查经 Vite 代理的验证码接口返回成功。

日志与进程记录保存在 `server/eforge-boot/target/local-service/`。启动失败会清理本次已启动的应用进程，保留数据库、Redis 和日志。此管理器不是生产部署或数据库迁移工具。

## 手工验证

- `/showcase.html`：公共组件、表单与详情模板。
- `/frontend-template.html`：页面模板布局。
- `/`：真实登录、权限、管理功能。
- `/workflow/packages`：已启用工作流时验证设计与配置。

自动集成脚本 `server/scripts/verify-auth-integration.ps1` 使用独立临时数据库，运行结束自动清理；不能用它代替持久本地开发服务。

## 2026-10-21 验证记录

真实 Windows 开发环境复用原有 MySQL/Redis 与已验收 jar：占用端口时拒绝启动；启动成功后验证码代理返回200；跨 PowerShell 进程 Status 正常；再次 Start 保持原进程；篡改记录创建时间后 Stop 拒绝操作且两个进程仍存活；恢复记录后 Stop、Start 均成功。首次测试发现多 Node 安装导致可执行路径数组，以及 PowerShell JSON 自动转换时间导致身份误判，已修正并完成上述重测。最终保持服务运行。

本次只增加进程管理和文档，没有修改产品源码、依赖或 SQL，未重复业务全量回归。已有数据库迁移由使用者显式管理；不承诺并发执行多份管理命令、跨平台或生产进程编排。
