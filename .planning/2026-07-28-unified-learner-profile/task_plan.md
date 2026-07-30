# 统一学习者画像底座规划

## 目标

把仓库中分散的账号资料、个性化偏好、错题、知识状态、学习统计和 Agent 上下文统一为版本化、可解释、按用户隔离的学习者画像，使核心学习与生成模块通过同一份画像快照做决策，并把行为结果写回统一事件流。

## 范围

- 本轮只完成现状审计、目标架构和可执行实施计划。
- 不修改生产代码，不迁移现有数据，不启动 GitHub issue 或子代理。
- 计划必须符合严格 Schema、禁止静默 fallback、认证隔离、TDD 和两阶段审查要求。

## 阶段

### 阶段 1：审计现有画像与数据流
- 状态：complete
- 盘点账号资料、个性化设置、学情数据、运行时 prompt 注入和主要消费者。
- 识别重复模型、越权风险、静默降级和未接入画像的关键路径。

### 阶段 2：定义统一画像契约与边界
- 状态：complete
- 明确静态资料、显式偏好、动态学情、证据、派生策略和快照版本。
- 明确字段来源、所有权、更新触发器、置信度和隐私边界。

### 阶段 3：绘制生产者/消费者集成矩阵
- 状态：complete
- 为助手、课堂、解题、出题、课件、RAG、学习路径、首页推荐和复习模块定义读取与写回契约。

### 阶段 4：拆分实施计划
- 状态：complete
- 按 2-5 分钟原子任务列出文件、测试、验证、依赖和回滚步骤。
- 输出到 `docs/superpowers/plans/2026-07-28-unified-learner-profile-platform.md`。

### 阶段 5：交付评审结论
- 状态：complete

### 阶段 6：首个安全垂直切片实施
- 状态：complete
- 按 TDD 依次完成统一合同、严格存储与用户隔离、画像服务/API/UI、助手首个消费者。
- 每个行为保留 RED 与 GREEN 运行证据；本次修改聚焦测试 34 passed，画像相关生产文件聚焦 TypeScript 校验 0 errors。
- 汇总建议、风险、首个可实施切片和需要用户确认的产品决策见下方「阶段 6 结论」。

## 已确定决策

1. 不新增第三套画像模型；以 `lib/adaptive-learning/contracts/learner.ts` 为可信领域核心，扩展为通用基础画像 + 学科画像。
2. 画像不是一段 prompt 文本，而是版本化业务对象；prompt 只是多个投影之一。
3. 画像读取由服务端认证上下文决定，客户端不得提交可伪造的完整画像作为权威输入。
4. 画像缺失、过期或构建失败必须显式报错；只有明确标为可选的视觉展示层允许跳过。

## 错误记录

| 错误 | 尝试 | 处理 |
|---|---:|---|
| 并行搜索包含不存在路径，导致整组命令退出 1 | 1 | 改为限定存在目录并分开执行。 |
| 全仓搜索被 `tmp/eslint-report.json` 巨型单行污染 | 1 | 后续搜索限制到 `app/`、`components/`、`lib/`、`tests/` 并排除 JSON 报告。 |
| `app/api/sky/learning-path/route.ts` 不存在 | 1 | 记录为前端调用与后端实现脱节，不重复读取该路径。 |
| `spec` 技能要求不可用的 AskUserQuestion 工具 | 1 | 不执行 issue 工作流，改用仓库计划文件完成本轮架构规划。 |
| Windows 下把 `lib/storage/dao/*.ts` 作为 `rg` 路径参数导致路径语法错误 | 1 | 保留已返回的 MySQL 证据，后续使用目录参数配合 `--glob '*.ts'`，不重复该命令。 |
| 假定设置 store 位于 `lib/store/settings-store.ts`，实际文件不存在 | 1 | 已获得表单与字段使用证据；后续先用 `rg --files lib/store` 定位真实入口，再读取目标文件。 |
| 创建正式计划文档时自动审批服务返回 404，写入被拒绝 | 1 | 未绕过审批；保留已完成方案内容，等待用户明确允许重试写入。 |
| 用户允许重试后，新建正式计划文件仍被同一审批服务 404 拒绝 | 2 | 已停止继续尝试；生产代码保持未修改，等待用户决定是否临时以 `.planning` 计划作为实施基线。 |
| 正式计划文件无法创建 | 3 | 用户明确授权以 `.planning` 计划作为批准基线；不再重试该新文件写入，直接按现有计划执行。 |
| score scale 校验补丁首次命中错误的 `.strict()` 链 | 1 | 立即检查完整文件，将 refinement 从 preferences 移到 domain profile，并用同一聚焦测试验证 4 passed。 |
| Retrieval consent refinement 首次补丁命中 Teaching data 的相同 `.strict()` 片段 | 1 | 用字段上下文定位并立即迁移到 retrieval data；聚焦测试验证 14 passed。 |
| `npm run typecheck` 不存在 | 1 | 读取 `package.json` 确认无该脚本，改用仓库本地 `tsc.cmd --noEmit`，不重复无效命令。 |
| 仓库级 `tsc --noEmit` 返回约 3050 条既有错误，输出涉及 eval、software-cup-A3 与旧测试 | 1 | 不修改无关基线；改用临时 include-only tsconfig 聚焦校验本次生产文件。 |
| MySQL provider 测试在 `vi.resetModules()` 后使用静态导入的错误类，导致同名错误跨模块实例 `instanceof` 失败 | 1 | 将 provider 与错误类在同一次 reset 后动态导入；测试通过，不修改生产错误语义。 |
| 读取 API response 工具时误用不存在的 `lib/api/responses.ts` 路径 | 1 | 根据现有 route import 定位真实文件 `lib/server/api-response.ts`，不重复错误路径。 |
| `app/api/sky/assistant/route.ts` 导入不存在的 `createAdaptiveLearningApiErrorResponse` | 1 | 改为正确导出 `adaptiveLearningApiError` 并同步调用签名。 |
| `STATUS_BY_CODE` 缺少 `PROFILE_NOT_FOUND`，导致画像缺失返回 503 而非 404 | 1 | 补全画像相关错误码到状态码映射，聚焦测试验证返回 404。 |
| 画像测试 fixture 使用 `as const` 导致聚焦 TypeScript 校验失败 | 1 | 移除 `as const`，改为显式类型注解；聚焦校验通过。 |
| `tests/assistant/context-injector.test.ts` 的 `makeMistake` 缺少必填 `userId` | 1 | 补充 `userId: 'user-1'` 以匹配新的用户隔离 MistakeBookEntry 合同。 |

## 阶段 6 结论

### 已完成的首个安全垂直切片

1. **统一合同（Stage A）**
   - `lib/adaptive-learning/contracts/learner.ts`：通用 `LearnerPreferences`、可多实例 `DomainLearnerProfile`、`KnowledgeState`、`LearningEvent` 及证据质量枚举。
   - `lib/adaptive-learning/contracts/profile-projection.ts`：快照 `LearnerProfileSnapshot`、五类投影（teaching/assessment/retrieval/planning/dashboard）、决策追踪 `ProfileDecisionTrace`。
   - `lib/adaptive-learning/errors.ts`：扩展画像专用错误码（`PROFILE_NOT_FOUND`、`PROFILE_INCOMPLETE`、`PROFILE_STALE`、`PROFILE_VERSION_CONFLICT`、`PROFILE_PROJECTION_FAILED`、`PROFILE_EVIDENCE_REJECTED`、`PERSISTENT_STORAGE_UNAVAILABLE`）。

2. **严格存储与用户隔离（Stage B）**
   - `lib/adaptive-learning/profile/repository.ts`：偏好/领域画像/学习事件按用户前缀隔离，版本化不可变写入，严格 Zod 解析。
   - `lib/adaptive-learning/profile/service.ts`：服务端赋予 `userId/version/schemaVersion/updatedAt/updatedBy`，通过 `expectedVersion` 实现乐观并发控制。

3. **画像服务、API 与 UI（Stage C）**
   - `app/api/user/learner-profile/route.ts`：认证 GET 返回权威画像（缺失显式 404），认证 PUT 创建/更新偏好（版本冲突显式 409）。
   - `components/account/personalization-form.tsx`：从服务端 GET/PUT，显式处理 loading、missing、success、conflict、error，保存期间锁定控件。
   - `lib/adaptive-learning/profile/client.ts`：客户端错误封装、成功响应 Schema 校验、不提交 owner/version 等权威字段。

4. **首个消费者接入（助手）**
   - `lib/adaptive-learning/profile/projection-builder.ts`：`buildTeachingProjection` 将 `LearnerPreferences` 转换为结构化教学投影。
   - `lib/assistant/context-injector.ts`：`injectTeachingProjection` 将投影渲染为中文系统提示，显式声明 `ready|no-evidence` 状态。
   - `app/api/sky/assistant/route.ts`：助手加载认证用户画像，缺失时返回 `PROFILE_NOT_FOUND` 404；成功时构建 teaching projection 注入 `buildSystemPrompt`。

### 验证结果

- 聚焦测试：`tests/adaptive-learning/*.test.ts` + `tests/assistant/*.test.ts` 共 34 tests passed。
- 聚焦 TypeScript：画像生产文件与相关测试临时 include-only 校验 0 errors（仓库级 `tsc --noEmit` 仍有约 3050 条既有错误，未修改无关基线）。
- 全量 `npm test`：画像相关测试通过；其余失败集中在 `tests/store/settings-server-sync.test.ts`、`tests/slides/agent/*` 等既有模块，与本切片无关。

### 阶段 7：扩展消费者与数据所有权收尾

- 状态：complete
- 按用户「都需要」的决策，同步推进：显式废弃旧 personalization API 并迁移旧数据、接入更多消费者、巩固错题/知识状态用户隔离。7.1–7.8 全部完成。

### 7.1 旧 personalization API 废弃与迁移（完成）

- `lib/adaptive-learning/profile/migrate-legacy-personalization.ts`：定义旧 `users` 表个性化字段到新 `LearnerPreferences` 的映射逻辑。
- `app/api/user/personalization/route.ts`：GET/PATCH 均代理到新的 `LearnerProfileService`；响应返回 `Deprecation` / `Sunset` / `Link` 头，标记 successor 为 `/api/user/learner-profile`。
- `lib/server/api-response.ts`：`apiSuccess` / `apiError` 支持自定义 headers。
- `tests/adaptive-learning/personalization-deprecation.test.ts`：验证无画像时迁移旧数据、已有画像时直接返回、PATCH 代理更新。

### 7.2 课堂 `/api/chat` 接入教学投影（完成）

- `lib/types/chat.ts`：`StatelessChatRequest` 新增 `teachingProjection?: string`，显式声明客户端不得提交权威值。
- `lib/orchestration/state-manager.ts`：`OrchestratorState` 新增 `teachingProjection`，`buildInitialState` 从请求透传。
- `lib/orchestration/prompt-builder.ts` / `lib/prompts/templates/agent-system/system.md`：`buildStructuredPrompt` 接收并注入 `teachingProjectionSection`。
- `lib/orchestration/agent-node.ts`：将 `state.teachingProjection` 传入 `buildStructuredPrompt`。
- `app/api/chat/route.ts`：认证 + 配额通过后，加载用户最新偏好，构建 teaching projection 并渲染为提示文本；缺失画像时返回 `PROFILE_NOT_FOUND` 404，不接受客户端覆盖。
- `tests/integration/chat-learner-profile.test.ts`：验证缺失画像 404、成功时传递权威投影、忽略客户端提供的 `teachingProjection`。
- `tests/orchestration/prompt-builder.test.ts`：新增教学投影注入断言。

### 7.3 错题 DAO/API 跨用户隔离回归（完成）

- 审查结论：`MistakeBookEntry` 已包含 `userId`，DAO 所有读写与聚合方法均按 `userId` 过滤；API 路由均通过 `requireAuth()` 取用户 ID 传入 DAO。
- `lib/storage/dao/mistakes.ts`：`update` 增加运行时防御，显式剔除 patch 中的 `id` / `userId`，防止绕过 TypeScript 类型后篡改所有权。
- `tests/storage/dao-mistakes-isolation.test.ts`：新增 13 条 DAO 层跨用户隔离回归测试，覆盖 `add` / `get` / `update` / `recordReview` / `delete` / `list` / `getDueForReview` / `findByKnowledgePoint` / `count` / `getErrorTypeDistribution` 的不可见、不可改、不可删。
- `tests/mistakes/mistakes-api.test.ts`：新增 API 层断言，验证 `POST /api/sky/mistakes` 忽略客户端提供的 `userId` 并绑定到认证用户。

### 7.4 解题模块接入画像投影（完成）

- `app/api/sky/solve/grade/route.ts`：认证后加载 `LearnerPreferences`；缺失画像时返回 `PROFILE_NOT_FOUND` 404；成功时构建 teaching projection 并注入 `gradeAnswer`，使批改反馈按学习者偏好调整。
- `tests/mistakes/mistakes-api.test.ts`：在「批改生成错题」断言前为认证用户 seed 偏好，验证绑定到认证用户并忽略客户端传入的 `mistakeId`。

### 7.5 记忆卡片接入画像投影（完成）

- `app/api/sky/cloud-mind/memory-cards/route.ts`：认证后加载 `LearnerPreferences`；缺失画像时返回 `PROFILE_NOT_FOUND` 404；成功时构建 teaching projection 文本并传给 `generateMemoryCards`，使卡片难度、语气与展示节奏按学习者偏好调整。

### 7.6 学习路径接入画像投影（完成）

- 目标：路径规划按学习者目标分数、可用时间、偏好格式生成个性化学习路径。
- `lib/adaptive-learning/planning/learning-plan-service.ts`：新增 `generateLearningPlan`，消费 `PlanningProfileProjection` 与可选 `goalTopic`，注入 `retrieveChunks` / `generatePlan` 依赖，输出结构化 `{ goal, strategy, weeklyPlans, materials }`；对无效 JSON 与无资料场景显式报错。
- `lib/adaptive-learning/planning/retrieve-chunks.ts`：基于规划投影的活动学科、目标节点与 `goalTopic` 召回 `data/crawled` 下的 Markdown 资料。
- `lib/adaptive-learning/planning/generate-plan.ts`：封装统一 LLM 调用层，支持 `LEARNING_PLAN_MODEL` 环境变量与 key pool，返回原始 JSON 字符串。
- `app/api/sky/learning-path/route.ts`：认证后加载权威 `LearnerPreferences` 与指定 `DomainLearnerProfile`；缺失画像返回 `PROFILE_NOT_FOUND` 404，缺失领域画像返回 `PROFILE_INCOMPLETE` 422；构建 planning projection 并调用服务生成计划；忽略客户端提供的投影。
- `scripts/generate-learning-plan.ts`：重写为使用新 planning service，将 CLI 参数映射为 `DomainLearnerProfile`/`LearnerPreferences`，输出 Markdown 格式计划。
- `lib/adaptive-learning/contracts/learner.ts`：为 `DomainLearnerProfile` 补充 `targetNodeIds` 与 `horizonDays` 可选字段，支持掌握型规划模式。
- 测试：`tests/adaptive-learning/learning-plan-service.test.ts`（3 tests）验证结构化计划生成、JSON 解析失败、无资料报错；`tests/adaptive-learning/learning-path-api.test.ts`（4 tests）验证认证绑定、画像缺失、领域画像缺失、权威投影注入。

### 7.7 首页仪表盘接入画像投影（完成）

- `app/api/sky/learning-stats/route.ts`：在返回学习统计时，通过 `LearnerProfileRepository` 加载权威 `LearnerPreferences` 并以 `learnerProfile` 字段返回，替代客户端构造数据。

### 7.8 实现 `KnowledgeState` DAO/API 并补齐用户隔离（完成）

- `lib/storage/dao/knowledge-state.ts`：实现基于 `knowledgeStateSchema` 的 DAO，所有方法按 `userId` 过滤；`set` 显式用认证 userId 覆盖数据中的 userId，`delete` 先校验所有权再删除。
- `app/api/user/knowledge-state/route.ts`：新增知识状态 API 路由，支持 GET/POST；POST 用认证 userId 覆盖客户端提供的 userId，Zod 校验失败返回 `INVALID_REQUEST` 400。
- `tests/storage/dao-knowledge-state-isolation.test.ts`：新增 6 条 DAO 层跨用户隔离回归测试，覆盖 `set`/`get`/`list`/`delete`/`count` 的不可见、不可改、不可删。
- `tests/adaptive-learning/knowledge-state-api.test.ts`：新增 4 条 API 层测试，验证 GET 空列表、POST 创建、覆盖客户端 userId、拒绝非法格式。

### 验证结果（阶段 7 最终）

- 聚焦测试：阶段 7 相关聚焦测试分三个批次全部通过，合计 21 files / 176 tests passed。
  - 批次 1（画像/迁移/合同/存储）：`tests/adaptive-learning/{knowledge-state-api,personalization-deprecation,migrate-legacy-personalization,projection-builder,profile-api,profile-service,profile-repository,learner-profile-contracts}.test.ts` + `tests/storage/dao-knowledge-state-isolation.test.ts` + `tests/storage/dao-mistakes*.test.ts` = 11 files / 81 tests passed。
  - 批次 2（助手/课堂/错题 API）：`tests/assistant/*.test.ts` + `tests/integration/chat-*.test.ts` + `tests/mistakes/mistakes-api.test.ts` = 8 files / 88 tests passed。
  - 批次 3（学习路径）：`tests/adaptive-learning/learning-plan-service.test.ts` + `tests/adaptive-learning/learning-path-api.test.ts` = 2 files / 7 tests passed。
- 聚焦 TypeScript：使用临时 include-only tsconfig 对本次生产文件与相关测试进行校验，0 errors；校验后已删除临时配置。仓库级 `tsc --noEmit` 仍有既有错误，未修改无关基线。

### 遗留风险与下一步建议

1. **旧 personalization API**：已显式废弃并支持迁移；待确认 `Sunset` 日期后是否需要前端强制跳转或数据清理任务。
2. **持久化后端原子能力**：当前通过 service 层版本校验弥补通用存储无事务；后续高频 `KnowledgeState` 和事件查询建议专表 + 索引。
3. **决策追踪写入**：当前投影构建未持久化 `ProfileDecisionTrace`，后续应在关键消费者处补审计日志。
4. **知识状态事件写回**：当前 `KnowledgeState` 仅提供 DAO/API 入口，后续应在解题/批改/复习等消费者处将证据写回 `LearningEvent` 并更新知识状态。
