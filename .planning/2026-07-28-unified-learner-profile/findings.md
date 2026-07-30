# 统一学习者画像底座：现状发现

## 已验证事实

- `lib/store/user-profile.ts` 只保存头像、昵称和简介；客户端可本地持久化，并后台同步服务器。
- `lib/store/settings/personalization.ts` 保存教育阶段、年级、兴趣学科、学习风格、回答详细度、AI 性格和功能开关；它与账号资料是另一套 store。
- `app/api/user/profile/route.ts` 与 `app/api/user/personalization/route.ts` 把上述字段平铺在 `users` 记录中。
- `lib/adaptive-learning/contracts/learner.ts` 已定义严格的 `LearnerProfile`、`KnowledgeState` 和 `LearningEvent`，但目前仅面向高三数学，尚无持久化和运行时集成。
- 多智能体课堂的 `StatelessChatRequest.userProfile` 只有 `nickname` 与 `bio`；`lib/orchestration/prompt-builder.ts` 只能据此生成简单 Student Profile 文本。
- `lib/agents/personalization-utils.ts` 能把部分偏好转换为 prompt，但当前只被课件分析和解题 prompt 少量使用，且客户端读取 helper 返回空对象。
- `/api/sky/assistant` 自行聚合错题、知识图谱和解题历史；加载失败时记录 warning 后继续，违反项目“禁止降级 fallback”原则。
- `MistakeBookEntry` 没有 `userId`，DAO 的 list/get/update/delete 均未做用户隔离；助手与复习 API 可能读取共享表中的全部错题。
- `/api/sky/cloud-mind/slides` 是少数会读取服务端个性化字段的模块；流式路径未传入 personalization，与非流式行为不一致。
- `components/account/personalization-form.tsx` 的所有修改只写入 `useSettingsStore`；仓库中没有客户端调用 `/api/user/personalization`，因此服务端个性化字段通常不会随 UI 更新。
- 出题、记忆卡片、知识库、解题流和多数课堂生成路径没有统一画像输入。
- `app/api/sky` 下扫描到的业务路由中，只有课件分析路由调用 `requireAuth()`；错题、复习、助手等路径没有统一认证门禁。
- `lib/storage/mysql-provider.ts` 的 `mistakes` 专表没有 `user_id` 列；这不仅是 DAO 漏筛选，而是底层表结构本身无法表达所有权。
- `lib/server/server-storage.ts` 在持久化存储不可用时自动切换到进程内存，核心画像、错题和学习事件会在重启后丢失，违反项目的禁止 fallback 规则。
- MySQL 对核心实体使用专表，其他实体写入通用 `storage_entries`；Supabase 当前主要依赖同一通用 JSON 表。统一画像初期可以通过严格 DAO 使用通用表兼容两种后端，但高频 `KnowledgeState` 和事件查询最终需要专表与索引。
- 课程生成把 `requirements.userNickname/userBio` 拼成自由文本并通过 sessionStorage 传递。这是“课程目标受众”而非必然等于登录用户，需和个人画像区分为 `AudienceProfile`。
- 量化审计：`app/api/sky` 当前有 35 个路由文件，只有 6 个包含任一认证检查；与画像/个性化关键词直接相关的前后端文件有 47 个。
- 现有错题 DAO 和 API 测试默认所有调用匿名、所有记录全局可见；引入用户隔离会是明确的契约变更，需要先写跨用户不可见/不可改/不可删的失败测试，再改实现。
- 现有助手 API 测试同样不提供认证上下文，只验证消息与 SSE；画像接入需补 `PROFILE_NOT_FOUND`、画像投影构建失败和成功注入的集成测试。
- 当前自适应学习合同测试已经严格验证未知字段、日期一致性和非 fallback 错误，可作为统一画像新 Schema 的风格基线。
- `app/api/sky/solve/grade` 会在错答后直接写错题；`lib/solve/grader.ts` 在 LLM 失败或 JSON 解析失败时用模糊字符串相似度继续评分。若该结果进入画像，会把未经验证的判断当成掌握度证据，必须在画像接入前移除或限定为可证明正确的确定性题型。
- `app/api/sky/check-in` 把正确率、当天场景完成数和连续打卡共同折算成 `masteryScore`。连续打卡属于参与度，不是知识掌握度；统一画像必须拆分 `engagement`、`progress` 与 `knowledge mastery`，停止复用一个总分。
- `user_stats.recordProblem()` 和 `recordSceneCompletion()` 目前没有找到稳定调用方，现有首页“掌握度”可能长期为 0 或仅在打卡时重算，不能作为权威知识状态。
- 旧文档 `docs/OPTIMIZATION-PLAN.md` 规划过 `StudentProfile` 聚合器；新设计规格已转向 `LearnerProfile + KnowledgeState + LearningEvent`，不能并存为两套权威模型。
- 工作树已有大量用户未跟踪文件；本轮必须只新增明确的规划文件，不能清理或覆盖。

## 初步根因

1. 画像按页面和功能逐步生长，没有统一领域边界。
2. “用户填写的偏好”和“系统从证据推断的学情”混在一起，缺少来源、置信度和更新时间。
3. 每个 Agent 自行拼上下文，导致字段覆盖不一致、token 浪费和行为不可测试。
4. 学习行为没有统一事件入口，画像无法确定性重放或解释。
5. 多个 API 缺少认证用户隔离，画像强化前必须先修正数据所有权。
6. 当前课程和 Agent 生成把画像作为自由字符串传递，无法做 Schema 校验、最小披露、版本追踪或决策审计。
7. 现有测试固化了匿名全局数据行为；安全迁移必须同步重写测试契约，不能只在路由里临时加过滤。
8. 权威画像不能吸收降级评分或混合指标，否则个性化会变成“精确地根据错误数据做错误决策”。

## 待确认

- 统一画像是否以全学科为核心、以高考数学为首个 domain extension；当前建议是“通用核心 + 学科扩展”。
- 第一批必须接入的消费者优先级；当前建议先做助手、学习计划、解题/出题、课堂，再扩展写作/翻译等低相关模块。
- 用户是否允许关闭行为画像；当前建议允许关闭 LLM 记忆，但掌握度等学习记录仍作为核心学习数据保留并提供清除入口。

## 统一合同设计补充

- 现有 `learnerProfileSchema` 把 `stage/grade/subject` 固定为高三数学，且把考试目标、日程约束与通用身份混在同一对象；改造时应保留严格校验风格，但拆成通用 `LearnerPreferences`、可多实例的 `DomainLearnerProfile` 与派生 `LearnerProfileSnapshot`。
- 现有客户端资料 store 在请求失败时返回 `null`、后台同步失败不暴露错误；画像中心迁移后必须提供明确的 loading/saving/error/version 状态，失败不得伪装成已保存。
- `/api/user/personalization` 的 GET 当前用大量默认值填补服务器缺失字段；统一画像上线后，默认值只允许用于“首次创建画像”的显式初始化命令，常规读取缺字段应返回可识别的画像不完整错误。
- 个人资料 `nickname/bio/avatar` 属于账户展示资料，可与学习画像关联但不应混入掌握度计算；消费者投影仅在确有展示或称呼需求时读取这些字段。
- 当前错题 DAO 的每个查询都从全表读取后筛选，接口也没有 `userId` 参数；首个垂直切片必须先把所有者写入实体并让 DAO 方法以认证用户作为必填第一参数，否则任何画像聚合都会继承跨用户污染。
- 助手当前允许客户端传入 system prompt、难度、风格与 memoryContext，并在画像数据加载失败时继续生成；统一画像接入时应由服务端构建权威 teaching/retrieval 投影，客户端只能提交会话意图与可审计的临时偏好覆盖。
- `buildPersonalizationPrompt()` 把偏好直接拼接为自由文本且没有投影版本或来源标记；应替换为 `LearnerContextProjection` → 专用 renderer，决策追踪记录 profileVersion、projectionKind、字段与 reasonCode。
- `getServerStorage()` 的 MySQL→Supabase→Memory 链路会让同一用户请求在不同存储间看到不一致状态；画像、事件、错题等权威数据必须使用 strict storage accessor，在无持久化后端时返回 `PERSISTENT_STORAGE_UNAVAILABLE`。
- 通用 `StorageProvider` 只表达表名与主键，不提供事务、条件写或 owner-aware 查询；首期可通过严格 DAO 和复合主键完成一致性边界，但画像版本递增、事件水位和去重写入必须在 service 层显式校验，后续持久化适配器需补事务能力。
- 现有自适应学习错误体系可直接扩展画像错误，而无需另建异常基类；建议新增 `PROFILE_NOT_FOUND`、`PROFILE_INCOMPLETE`、`PROFILE_VERSION_CONFLICT`、`PROFILE_PROJECTION_FAILED`、`PROFILE_EVIDENCE_REJECTED` 与 `PERSISTENT_STORAGE_UNAVAILABLE`。
- 当前 `UserEntry` 把所有个性化字段平铺进账号记录；迁移期间应保留兼容读取但停止把它作为画像权威源，新写入由 profile service 负责，并通过显式迁移/双读校验完成切换，不能无期限双写。
- 现有合同测试已经建立 strict Zod 与非 fallback 错误风格，统一画像测试应在同一测试域扩展，并新增 service、DAO、API 与消费者集成测试，而不是只测试 prompt 字符串。
- MySQL 表由 provider 启动时内联 `CREATE TABLE IF NOT EXISTS` 与自迁移逻辑维护，没有独立 migration runner；首个用户隔离改动必须在 provider 中加入可幂等的列/索引升级并测试旧表升级，不能只修改新建表 SQL。
- `requireAuth()` 可直接提供权威 `user.id`，因此错题、批改、复习、助手、统计等所有画像消费者应在路由入口先认证，再把 userId 作为显式 service/DAO 参数；不得从 body/query 接收 ownerId。
- 批改路由目前“评分成功但错题写入失败”会整体报错，符合不静默丢证据的方向；但在评分可能来自模糊 fallback 的情况下，必须先标记 evidenceQuality，只有 `verified` 证据才能更新 KnowledgeState。
- 复习计划当前直接把错题表的 `masteryLevel` 当掌握进度；迁移后 UI 可以继续显示错题复习阶段，但知识掌握度必须来自 `KnowledgeState` 投影，二者在 API 中分别命名。
- 个性化 slice 被嵌入庞大的通用 settings store 并整体持久化到 localStorage；画像中心不应继续把服务端画像状态塞进该 store，可保留非业务设备设置，新增独立 query/mutation 层管理画像版本、保存冲突与错误。
- `enableMemory` 需要拆成至少两种语义：是否把对话长期记忆用于生成，以及是否允许系统采集可选行为信号；核心学习记录的保存与清除属于学习数据治理，不应被一个开关隐式关闭。
- `enableRAG` 应表达“是否使用个人上传/私有知识库”，而不是禁止平台课程知识检索；retrieval 投影必须携带允许的数据域与来源范围，避免把隐私开关误当算法开关。
- Cloud Mind 课件分析的非流式路径读取个性化，流式路径完全忽略；同时认证/画像/RAG 加载失败都静默继续。消费者矩阵必须把流式与非流式视为同一个合同，避免同一功能因传输模式不同而个性化行为不一致。
- “学习风格”当前以视觉型/听觉型等固定标签直接驱动 prompt；新合同建议改名为 `contentFormatPreferences`，以可多选、可随时修改的呈现偏好表达，不把用户永久归类为认知类型。
- 多智能体课堂的 `/api/chat` 整体状态由客户端提交，且 `userProfile` 是可伪造 nickname/bio；接入后路由应在 quota/auth 已解析出的用户身份上加载 teaching 投影，把客户端 `userProfile` 从合同中移除，必要的课程目标受众另用 `AudienceProfile`。
- 出题、记忆卡片等 Cloud Mind 路由完全没有画像输入；它们应分别消费 assessment/retrieval 投影，并在生成成功后写 `content-generated` 事件，但生成内容本身不能直接提高掌握度。
- 记忆卡片路由把知识库写入做成 fire-and-forget 且失败忽略；若该写入被纳入画像/RAG 证据链，必须改为明确的可选增强或同步失败，不可保持当前模糊状态。
- 学习统计未登录时返回全 0，这会把“无权访问/无画像”伪装为“零学习数据”；画像仪表盘应明确区分 unauthenticated、profile-incomplete、no-evidence 与真实零值。
- 当前自适应学习计划只有离线脚本入口，平台集成应新增认证 API/service，而不是让各消费者直接运行脚本或自行拼装 profile。
- 离线学习计划脚本定义了另一套宽松 `LearnerProfile` 并直接输出 Markdown；平台化时应让 CLI 变成统一 planning service 的适配器，输入严格 planning 投影，输出 `LearningPlan` JSON，再由独立 renderer 生成 Markdown。
- `LearningPlan.profileSnapshot` 当前直接嵌入旧的高三数学 profile；改造后应保存 `snapshotId/profileVersion/eventWatermark` 和规划所需的不可变投影，避免未来画像 Schema 变化导致旧计划不可解析。
- 题库是平台共享内容库，不能简单加 userId 变成私有表；需要区分 `QuestionBankItem`（共享、经验证内容）与 `UserQuestionInteraction`（收藏、作答、熟悉度、来源会话），画像只从后者的已验证答题证据更新。
- 当前题库路由允许任意调用者新增、修改、删除并默认 `verified: true`，这会污染画像证据源；画像接入前必须补认证/角色权限，并把普通用户生成题标记为未验证或私有草稿。
- 课程生成的 `userNickname/userBio` 明确属于生成需求中的目标受众描述，需重命名为 `audienceProfile` 并保持客户端可提交；若选择“为我生成”，服务端可从 learner projection 派生 audience，但两者不能复用同一字段或权威语义。
- RAG 检索器在缺少 rerank API key 或重排失败时静默使用原排序；若 rerank 被定义为可选增强，可以跳过，但必须返回/记录 `retrievalMode` 与降级原因，画像决策追踪不能误称使用了完整个性化重排。
- 首页当前只展示固定问候与混合总分，并吞掉统计请求错误；应改为 dashboard 投影驱动的称呼、今日任务、待复习、薄弱点与数据完整度，同时显式显示加载/错误/无证据状态。
- 学习数据页混合服务端错题、客户端 Zustand 与 localStorage 记忆卡片进度；画像平台化后这些行为必须通过 `LearningEvent` 写入服务端，UI 只读取 dashboard projection，不能继续本地拼接权威统计。
- 正式计划的文件映射已定位到现有合同、错误、存储、错题、个性化、助手、课堂、批改、复习、Cloud Mind、题库与仪表盘的具体定义位置；实施时可按这些边界逐项写 RED 测试，避免大范围盲改。
- 现有 API 测试直接调用 route handler，且普遍未 mock 认证或隔离存储；首批 RED 测试需要先建立统一的认证用户 fixture 与可注入 MemoryStorageProvider，避免测试继续依赖进程级单例数据。
- 错题 API 测试当前明确接受空 body 并依赖默认字段创建记录；新合同必须把这些测试改成预期 400，证明画像证据不会从空白/宽松输入产生。
- 合同依赖审计确认旧 `learnerProfileSchema` 只有 learning plan 直接生产依赖；当前采用 additive exports 保持旧 plan fixture 有效，后续用独立 snapshot/planning projection 单独迁移，避免负向测试因嵌套画像提前失败而假绿。
- 错题隔离首个 route-level tracer 应使用专属 MemoryStorage + 可切换 auth fixture；现有 mistakes API 测试未 mock storage，可能读取真实 `.env.local` 并污染开发 MySQL，实施隔离前必须先修测试边界。
- MySQL `rowToMistakeEntry()` 还遗漏业务 `id`；增加 userId 时应一并修复，但必须由独立 RED 测试驱动。旧表只改 CREATE TABLE 无效，需要幂等列/索引升级。
- `tests/setup-env.ts` 会在 Vitest 启动时加载真实 `.env.local`；严格存储测试必须在模块导入前显式清除相关环境变量并 mock MySQL/Supabase 边界，再动态导入 accessor，不能让测试探测开发数据库。
- 五类投影的共同信封固定为 `projectionId/kind/userId/snapshotId/profileVersion/eventWatermark/schemaVersion/generatedAt`；服务构建前必须检查对应 `snapshot.completeness.byProjection[kind].complete`，不完整时返回 `PROFILE_INCOMPLETE`，禁止产出缺字段投影。
- Assessment 投影只允许影响选题、讲解与反馈，不得改变评分正确性；Retrieval 投影必须显式列出公共课程/私有用户知识源权限；Planning 投影使用结构化目标、时间约束与知识证据；Dashboard 用 `ready|no-evidence` 区分状态，未有证据时 `overallMastery=null`，不得返回伪造的 0 或 demo 数据。
- 五类投影均不得包含账户资料、原始错题/答案、历史题干、bio、客户端 system prompt 或 memoryContext；账户称呼由独立 AccountDisplayProfile 组合，课程 `AudienceProfile` 不写回 LearningEvent。
- LocalStorage 没有原生 create-only 写入；为避免无保护的 `get()+set()` 竞争，`insert()` 必须在同源 Web Locks 临界区内执行，锁能力缺失时显式抛出 `STORAGE_ATOMIC_INSERT_UNAVAILABLE`，不能静默退回非原子写入。
- MySQL 与 Supabase 都有原生 create-only 语义：MySQL 使用不含 `ON DUPLICATE KEY UPDATE` 的 `INSERT` 并归一化 1062/`ER_DUP_ENTRY`，Supabase 使用 `.insert()` 并归一化 PostgreSQL `23505`。
