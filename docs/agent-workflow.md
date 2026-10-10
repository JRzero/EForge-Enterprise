# EForge 的 Agent Skills 开发流程

状态：已采用。范围：本仓库的开发流程；不改变运行时架构，不启动 Flowable 开发。

## 安装与版本

- 项目级安装：`.agents/skills/`，共 25 个上游 Skill。
- 来源：`addyosmani/agent-skills`，版本 `0.6.12`，提交 `1401c8b8030e023baeebb31781a6653fe8e93026`。
- `.agents/references/` 保留共享参考资料；`.agents/LICENSE` 保留 MIT 许可。
- `.agents/agent-skills.lock.json` 记录全部上游文件 SHA-256。校验：`node scripts/verify-agent-skills.mjs`。
- 上游 Skill 原文保持不变，项目差异只写在本文和根 AGENTS.md。不要复制上游 AGENTS.md、Claude 命令或全局钩子。
- Codex 按需发现 Skill；不要将 using-agent-skills 全文预加载。下一轮对话应可用；若客户端尚未发现，重新打开本项目会话。
- 安装位置依据：[官方技能文档](https://learn.chatgpt.com/docs/build-skills)。这是项目级 Skill 安装，不是全局插件安装。

## 约束与授权

系统、平台和用户指令继续有效。根 AGENTS.md 的架构和验收要求是本项目约束；本文是用户已同意的上游通用流程适配。

1. 用户已授权的日常实现、修复、测试和提交推送持续执行，不因上游每阶段确认或每任务停止的默认规则而重复询问。已有明确计划授权可直接沿用。
2. 新的实质范围决策、生产发布、不可逆业务数据操作按实际授权处理；Skill 不产生这类授权，也不能绕过平台拒绝。
3. 验证失败先定位修复；只有确实缺少用户决策或外部条件时才暂停依赖工作，其他独立工作继续。
4. 保留无关未提交改动，精确暂存本任务文件。只有影响任务安全执行时才询问处理方式，不自动 stash、reset 或吸收他人修改。
5. 普通迭代无需为每个任务新建会话。只有用户或适用指令明确要求并行代理时才委派；Skill 安装本身不启动代理或后台任务。
6. 文档、纯样式等低影响修改采用适当检查；不要为形式上的 RED/GREEN 写镜像测试。权限、事务、并发、重试和行为修复要有能揭示错误的测试证据。
7. 当前表单构建器暂缓，不开展开发、不计入当前验收、不标记完成。Skill 安装本身不授权产品功能；Flowable 后续已由用户明确授权，范围与实际交付状态见 `spec/flowable-integration.md` 和 `tasks/flowable-integration.md`。

## 工作流与记录

先读当前分支、工作区、`tasks/README.md`、关联规格和实际代码。历史会话只作为线索，实际仓库和验证证据决定状态。

| 场景 | 按需加载的 Skill | 输出 |
|---|---|---|
| 新的非平凡功能 | spec-driven-development、constraint-driven-development | `spec/<initiative>.md`，范围、非目标、验收和约束 |
| 拆分已明确的功能 | planning-and-task-breakdown | `tasks/<initiative>.md`，依赖及完整功能切片 |
| 框架/API 接入 | source-driven-development、api-and-interface-design | 锁定版本依据、规范 API 和生成客户端 |
| 开发 | incremental-implementation、test-driven-development | 实现、证据、原子提交 |
| 故障 | debugging-and-error-recovery | 复现、根因、修复和针对性回归 |
| UI | frontend-ui-engineering、browser-testing-with-devtools | 公共组件、实际浏览器、桌面/手机证据 |
| 交付 | code-review-and-quality、security-and-hardening、git-workflow-and-versioning | 审查问题及处理、验证、提交/推送/合并状态 |
| 架构变化 | documentation-and-adrs | 沿用 `docs/adr/` 的现有格式 |

小修改不必走完整链路。实际使用 Skill 前读取它；需要共享参考资料时按原相对路径读取。浏览器技能的工具名适配当前可用工具，不能把缺少特定 DevTools MCP 等同于无法使用项目已有 Playwright。

本项目用 `spec/<initiative>.md` 与 `tasks/<initiative>.md` 成对记录，一个任务文件同时包含计划和状态，不再生成互相矛盾的 `tasks/plan.md`、`tasks/todo.md`。多模块规格通过索引明确关联，不能靠文件名猜当前任务。根 roadmap 记录里程碑，若依清单记录原能力库存。

每个切片应交付能运行的用户能力，列出依赖、验收、权限/一致性、验证命令和证据。基础研究允许独立任务，但不能将 helper、API 或组件完成当作整个页面/能力完成。

状态：`pending`、`in_progress`、`blocked`、`done`、`deferred`。done 必须满足本任务验收和适用项目门槛。blocked 写清原因及可继续工作；deferred 不算完成。

## 验证与运行纪律

以下命令从仓库根目录运行，执行前检查环境、现有进程和端口：

| 检查 | 命令/入口 |
|---|---|
| Skill 安装 | `node scripts/verify-agent-skills.mjs` |
| 后端编译/测试 | `mvn -B -ntp -f server/pom.xml verify` |
| 前端静态检查 | `npm --prefix web run lint`、`npm --prefix web run typecheck` |
| 前端测试/构建 | `npm --prefix web test`、`npm --prefix web run build` |
| 生成客户端 | `npm --prefix web run check:generated` |
| 浏览器 | 在 `web` 目录执行 `npx playwright test`，定向验证可指定相关 spec |
| 真实环境 | `pwsh -File server/scripts/verify-auth-integration.ps1 -VerifyWeb`；启用配置追加 `-EnableConsoles` 等适用开关 |

变更期间用定向检查快速反馈，交付阶段完成根 AGENTS.md 中适用的完整验证。文档/技能安装不触发业务 Maven、MySQL/Redis 或浏览器全量回归；检查安装、链接、元数据和差异即可。涉及实现时必须记录检查范围及未执行项原因，不能默默降低验收标准。

- 真实环境脚本需要已构建 jar、Docker 和可用端口；不得在本地应用使用同一 jar 时重新打包。
- 不并行抢占测试端口；已有验证进程继续等待，不重复启动。
- 浏览器验证期间固定源码，不运行会改写生成文件的检查，避免热更新污染结果。
- API/权限变更保持真实 MySQL/Redis、登录、数据范围和 OpenAPI 一致性证据；声明通过必须对应实际提交和配置。
- CI 以精确提交、运行编号和最终状态记录；排队、观察进程 EOF、运行器故障均不等于产品通过或失败。
- 未授权运行时部署不能由 shipping Skill 自动触发。提交、推送、合并、部署是不同状态，分别报告。

## 升级和回退

升级在独立分支进行：审查上游差异 → 固定新提交 → 用 skill-installer 安装到临时目标 → 同版本补齐 references 和 LICENSE → 核对本文的适配仍有效 → 更新锁文件 → 运行校验 → 选一个真实任务试用。升级不能自动推进 RuoYi/EForge 或业务依赖基线。

上游文件变动必须来自明确版本升级；不要将本地改写重新计算成合法上游哈希。回退安装使用 Git 中前一套完整 skills/references/lock，同步回退相关配置。只取消使用时移除项目的发现目录及入口，业务运行代码不受影响。

验收边界：静态校验证明安装完整，不证明模型每次都正确选用 Skill；首次真实迭代需检查任务是否加载正确 Skill、遵守授权、形成可复核证据并能从中断处恢复。
