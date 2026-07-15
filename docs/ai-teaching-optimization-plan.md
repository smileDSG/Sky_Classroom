# AI 智能授课模块优化方案

> 基于对模块 D（自适应授课系统）全链路代码审查，涵盖性能、体验、功能、稳定性四个维度。
> v2 — 修订版：修正原方案中的逻辑冲突、遗漏和技术细节问题。

---

## 一、性能优化

### 1.1 内容生成：串行改并行

**现状**：`content-generator.ts` 的 `generateLessonStream` 逐节串行调用 LLM，5 个 section 需 5 次串行等待，总耗时 = N × 单次调用时间（约 3-8s/节），整体 15-40s。

**方案**：

- 第 1 节单独生成，确保开篇质量和知识衔接
- 第 2 节起并行生成（`Promise.allSettled` 控制 2 路并发，避免 API 限流；注意是 `allSettled` 不是 `all`，单节失败不阻塞其他节）
- 每节完成即调用 `updateTeachingJobProgress` 持久化，不等全部完成
- 并行节需要在 prompt 中注入前序节的上下文摘要，避免内容重复或衔接断裂

**上下文传递方案**（原方案缺失，补充）：

- `buildContentPrompt` 增加 `precedingSections` 参数，格式为前序各节的 `{ title, knowledgePoints, depth, contentSummary }`
- `contentSummary` 取该节第一个 text chunk 的前 200 字，由 job runner 在前一节生成后提取
- 第 1 节无前序上下文，直接生成；第 2-N 节的 prompt 包含已完成的全部前序摘要
- 并行组内的节共享同一个前序快照（并行开始时已完成的节），因此内容摘要的截止点一致

**改动文件**：

- `lib/teaching/content-generator.ts` — 新增 `generateLessonConcurrent()` 函数
- `lib/teaching/content-prompts.ts` — `buildContentPrompt` 增加 `precedingSections` 参数
- `lib/server/teaching-job-runner.ts` — 调用并发版，管理前序摘要传递

**预期效果**：3 节课程从 ~18s 降至 ~8s，5 节从 ~30s 降至 ~12s。

### 1.2 轮询改 SSE 流式推送

**现状**：前端 1.5s 固定间隔轮询 `GET /api/sky/teaching/[jobId]`，每次返回完整 job 数据。无变化也发请求，浪费带宽。

**与 1.1 的关系说明**（原方案混淆，澄清）：

- 1.1 是**生成端**优化（服务端并行调用 LLM），1.2 是**推送端**优化（服务端→前端的数据通道）
- 两者独立，1.1 不依赖 1.2，即使仍用轮询也能从并行生成受益
- 但 1.2 完成后，前端可以更快感知每节完成事件，体验叠加

**方案**：

- 新增 `GET /api/sky/teaching/[jobId]/stream` SSE 端点
- job runner 每完成一节通过 `EventEmitter` 推送 `{ type: 'section_done', sectionIndex, section, chunks }`
- SSE 端点监听该 jobId 的事件并写入响应流
- 前端用 `EventSource` 替代 `pollTeachingJob`，收到事件即更新 UI
- 保留原轮询接口作为降级（SSE 连接失败时自动回退到轮询）
- 连接心跳：每 15s 发 `:{\n}\n\n` 防止代理超时
- SSE 断连重连：前端检测 `EventSource` 的 `error` 事件，自动降级轮询；轮询也失败则提示用户

**改动文件**：

- `app/api/sky/teaching/[jobId]/stream/route.ts` — 新建 SSE 端点
- `lib/server/teaching-job-runner.ts` — 增加 `EventEmitter` 实例，按 jobId 发射事件
- `lib/teaching/teaching-job-client.ts` — 新增 `streamTeachingJob()` 方法（EventSource + 自动降级轮询）
- `components/sky/solve/teaching-panel.tsx` — 用 `streamTeachingJob()` 替代 `pollTeachingJob`

**预期效果**：首节内容展示延迟从 ~3s 降至 <1s；轮询请求量减少 90%。

### 1.3 学生画像缓存优化

**现状**：`profile-builder.ts` 每次全量加载 `pageSize: 9999` 错题 + 构建知识图谱，首次慢，5 分钟缓存过期后全量重来。

**原方案问题**：原方案提出"增量更新"，但存在以下问题：

1. `mistakeDAO.list()` 不支持时间范围过滤，无法只加载增量错题
2. 知识图谱 `buildKnowledgeGraph()` 是全量构建函数，增量合并节点/边的逻辑复杂且易出错
3. 多实例部署时 JSON 文件持久化不一致（当前项目单实例可接受，但设计上不理想）

**修正方案**：

- 画像结果持久化到 `data/student-profiles/{userId}.json`，延长缓存 TTL 至 30 分钟
- `invalidateProfileCache(userId)` 标记内存缓存失效，但不立即重建
- 下次访问时：检查磁盘缓存的 `updatedAt`，若 < 30 分钟则直接使用磁盘缓存（跳过 LLM 调用）
- 错题提交时异步触发画像重建（不阻塞提交流程），重建完成后更新磁盘缓存
- 知识图谱仍全量重建（改动最小、最可靠），但通过减少重建频率来降低开销

**改动文件**：

- `lib/student/profile-builder.ts` — 增加磁盘持久化 + 异步重建逻辑
- `lib/student/profile-types.ts` — 增加 `updatedAt` 字段

**预期效果**：画像接口平均响应从 ~2s 降至 ~50ms（命中缓存时）。

### 1.4 数学渲染批量优化（新增）

**现状**：`MathRenderer` 的 `wrapBareLatex()` 函数包含 15+ 个正则匹配，每次渲染新 chunk 都会执行。授课页面一次性渲染 5-10 个 section、数十个 chunk，全部触发 `wrapBareLatex`，可能导致页面卡顿。KaTeX 渲染结果有 LRU 缓存（2000 条），但预处理步骤没有缓存。

**方案**：

- 在 `MathRenderer` 组件内增加 `useMemo` 级别的预处理缓存：以 `content` 为 key，缓存 `parseMixedContent(wrapBareLatex(content))` 的结果
- 实际上当前已有 `useMemo`，但 `wrapBareLatex` 仍是纯函数同步调用。对于大段内容（> 2000 字符），考虑：
  - 方案 A：拆分 `wrapBareLatex` 到 Web Worker（改动大，收益不稳定）
  - 方案 B（推荐）：content-generator 输出时已要求 LLM 使用 `$...$` 和 `$$...$$` 定界符，`isWellFormedMath` 快速路径已可跳过裸 LaTeX 处理。优化 `buildContentPrompt`，明确要求 LLM 输出标准定界符，提高快路径命中率
- 对已完成渲染的 section，使用 `React.memo` 包裹 `SectionCard`，避免滚动时重新计算

**改动文件**：

- `lib/teaching/content-prompts.ts` — 在 CONTENT_SYSTEM_PROMPT 和 buildContentPrompt 中强调使用标准 `$...$` / `$$...$$` 定界符
- `components/sky/solve/teaching-panel.tsx` — `SectionCard` 包裹 `React.memo`

**预期效果**：LLM 规范输出时，渲染时间减少 ~70%（命中 `isWellFormedMath` 快路径）。

---

## 二、用户体验优化

### 2.1 测验交互化

**现状**：quiz 类型的 chunk 只是静态文本展示，用户无法作答。`quiz-injector.ts` 的 AI 生成题只写了占位符 `[AI生成] ...（待生成）`，且该模块在 job runner 中未被调用。

**与 4.1 的关系澄清**（原方案冲突，修正）：

- `content-generator.ts` 已经为 `contentType: 'quiz'` 的 section 生成测验内容
- `quiz-injector.ts` 的设计是在**非 quiz section**的知识点后注入额外测验（补充题），但从未被接入
- 4.1 应该**删除**独立的 `quiz-injector`，将测验生成统一到 `content-generator` 中
- 2.1 是前端交互化，让已生成的测验可作答

**方案**：

- 在内容生成阶段强化 quiz 输出：`content-prompts.ts` 要求 quiz chunk 输出结构化 JSON（`question` / `options` / `answer` / `explanation`）
- `ContentChunk` 扩展 quiz 专用字段（可选，向后兼容）
- 新增 `QuizInteraction` 组件：展示选项 → 用户选择 → 判对错 → 显示解析
- **答案安全**：quiz chunk 的 `answer` 和 `explanation` 字段不随题目一起下发，改为单独接口按需获取（前端答题后才请求）。这是安全要求的落地实现，不是仅在"风险"中提及
- 答题结果回传学生画像：答错自动标记该知识点需强化
- 保留纯文本 quiz 兼容（旧数据无结构化选项时降级为展示模式）

**改动文件**：

- `lib/teaching/content-types.ts` — 扩展 `ContentChunk`，quiz 类型增加 `options` / `answerHash` / `explanationHash` 可选字段（注意：存储 hash 或加密值，明文答案通过单独接口获取）
- `lib/teaching/content-prompts.ts` — 强化 quiz 输出格式要求
- `components/sky/solve/teaching-panel.tsx` — SectionCard 中 quiz chunk 使用 `QuizInteraction` 组件
- 新增 `components/sky/solve/quiz-interaction.tsx` — 测验交互组件
- 新增 `app/api/sky/teaching/quiz-answer/route.ts` — 按需获取测验答案接口

**预期效果**：用户从被动阅读变为主动练习，知识点掌握度可量化；答案不暴露在前端源码中。

### 2.2 智能主题推荐

**现状**：输入框只接受手动输入，没有推荐和补全。用户（尤其新手）不知道输入什么。

**冷启动问题**（原方案遗漏，补充）：

- 新用户没有画像数据，`weakPoints` 为空
- 需要区分两种场景：有画像 → 个性化推荐，无画像 → 热门推荐

**方案**：

- 有画像：从学生画像提取 `weakPoints` 和低掌握度知识点（mastery < 50）作为推荐主题，展示 3-5 个标签
- 无画像（冷启动）：展示学科热门主题预设（按学科分类，如数学"二次函数""不等式"、物理"牛顿定律""动量守恒"等），硬编码在配置中
- 输入框下方展示推荐标签，点击即填入
- 输入时做简单匹配补全（从知识图谱节点名 + 热门主题列表匹配）

**改动文件**：

- `components/sky/solve/teaching-panel.tsx` — 增加推荐标签区域 + 冷启动降级
- `app/sky/teaching/teaching-page.tsx` — 传入学生画像数据
- 新增 `configs/teaching-topics.ts` — 热门主题配置文件（按学科分类）
- 新增 `app/api/student/profile/route.ts` — 暴露当前用户画像的轻量接口（仅返回 weakPoints + 知识点列表 + 是否有数据标记）

**预期效果**：降低使用门槛，新/老用户均有可点击的推荐。

### 2.3 学习进度跟踪与反馈

**现状**：课程生成完即结束，没有后续跟踪。用户不知道自己学了多少、掌握如何。

**原方案问题**：原方案写"已掌握 +10，需复习 -5"，但知识图谱中的 mastery 计算逻辑是 `Math.max(0, 100 - mistakeCount * 20)`，直接加减会破坏数据一致性，导致画像数据与知识图谱脱节。

**修正方案**：

- 每节 SectionCard 增加底部操作栏：「已掌握」/「需复习」按钮
- **不直接修改掌握度数值**，而是：
  - 「已掌握」→ 在该知识点下标记一道虚拟"正确答题"记录（或记录到用户的学习反馈表）
  - 「需复习」→ 将该知识点添加到错题本的"待复习"列表
  - 两种操作都会触发 `invalidateProfileCache(userId)`，下次画像重建时自然反映变化
- 授课完成页增加学习小结：已完成 N 节、标记掌握 M 个、建议复习 K 个
- 支持收藏整个教案到「我的课程」

**改动文件**：

- `components/sky/solve/teaching-panel.tsx` — SectionCard 增加底部操作栏 + 完成页小结
- 新增 `app/api/student/feedback/route.ts` — 学习反馈接口（记录掌握/需复习标记）
- `lib/mistakes/knowledge-graph.ts` — `buildKnowledgeGraph` 考虑纳入正面反馈数据（可选，后续迭代）

**预期效果**：形成"授课→练习→反馈→再授课"闭环，且数据与知识图谱一致。

### 2.4 内容语音朗读

**现状**：纯文本展示，无法听读。

**风险补充**（原方案遗漏）：

- `SpeechSynthesis API` 在中文环境下质量参差不齐，Chrome 的中文 TTS 延迟明显（~2s）
- Safari/Edge 中文质量较好但浏览器差异大
- 需要做浏览器兼容性检测，不支持时隐藏朗读按钮

**方案**：

- 利用浏览器原生 `SpeechSynthesis API`，每节 SectionCard 增加朗读按钮
- 自动跳过 formula/diagram 类型 chunk，只朗读 text/explanation 内容
- 朗读时高亮当前段落
- 不支持 `SpeechSynthesis` 或无中文语音时，隐藏按钮不展示

**改动文件**：

- 新增 `components/sky/solve/speech-reader.tsx` — 语音朗读 hook + 兼容性检测 + UI 控制
- `components/sky/solve/teaching-panel.tsx` — SectionCard 条件性集成朗读按钮

**预期效果**：多模态学习，适合听觉偏好用户和碎片化场景。

---

## 三、稳定性优化

### 3.1 单节失败自动重试

**现状**：`generateSectionContent` 只设 `retries: 1`（即失败后重试 1 次，共 2 次尝试），失败后返回 `fallbackContent`（"内容正在生成中..."），用户分不清是加载还是出错。整个 job 不会因单节失败而终止（`teaching-job-runner.ts:88` 已有 try/catch 包裹），但降级内容不够清晰。

**修正方案**（原方案说"共 3 次尝试"但实际 retries:1 已经是 2 次，明确为 2 次重试共 3 次尝试）：

- `callLLM` 的 `retries` 从 1 改为 2（共 3 次尝试），每次间隔 1s 退避
- 仍失败则返回带 `failed: true` 标记的降级内容，文案改为"该章节生成失败，可点击重试"
- 前端 SectionCard 对 `failed` section 显示错误状态 + 「重新生成」按钮
- 「重新生成」调用 `POST /api/sky/teaching/[jobId]/retry-section`，参数为 `{ sectionId }`
- 服务端从 job 的 plan 中找到对应 section 定义，重新调用 `generateSectionContent`
- 生成成功后替换 job store 中该 section 的 chunks，前端刷新展示

**改动文件**：

- `lib/teaching/content-generator.ts` — `retries` 从 1 改为 2，fallback 内容标记 `failed: true`
- `lib/teaching/content-types.ts` — `ContentChunk` 增加 `failed?: boolean` 字段
- 新增 `app/api/sky/teaching/[jobId]/retry-section/route.ts` — 单节重试接口

**预期效果**：单节偶发失败不再影响整体，用户可局部修复。

### 3.2 认证过期友好处理

**现状**：`teaching-panel.tsx:374` 认证过期直接 `window.location.href = '/auth/login'` 强制跳转，可能打断用户阅读。

**方案**：

- 认证过期时弹出 toast 提示"登录已过期"，5s 后跳转
- 提供"稍后登录"选项，保留当前内容不丢失
- 正在生成的 job 不因跳转丢失（已有 sessionStorage 恢复机制，确认覆盖此场景）

**改动文件**：

- `components/sky/solve/teaching-panel.tsx` — 替换强制跳转为 toast + 延迟跳转

**预期效果**：用户不被突然打断，内容不丢失。

### 3.3 轮询动态间隔

**现状**：固定 1.5s 轮询，无论是否有更新。

**方案**（SSE 方案的降级补充）：

- 前 10s：1s 间隔（快速感知首节内容）
- 10s-30s：2s 间隔
- 30s+：3s 间隔
- 有更新时回退到 1s 间隔

**改动文件**：

- `lib/teaching/teaching-job-client.ts` — `pollTeachingJob` 增加动态间隔逻辑

**预期效果**：减少无效请求 40%，首节感知更快。

---

## 四、功能补全

### 4.1 统一测验生成（原"测验注入器接入"，重构）

**现状**：存在两套测验生成机制但都不完善：

1. `content-generator.ts` — 为 `contentType: 'quiz'` 的 section 生成测验，但输出格式不够结构化
2. `quiz-injector.ts` — 设计为在非 quiz section 后补充测验，但 AI 生成部分是占位符，且从未被 job runner 调用

**原方案问题**：原方案直接说"在 job runner 中调用 injectQuizzes"，但这会和 content-generator 的 quiz section 功能重复。

**修正方案**：

- **删除 `quiz-injector.ts`**，不再维护两套测验机制
- 测验生成统一在 `content-generator` 中处理：
  - `contentType: 'quiz'` 的 section → 生成结构化测验题（与 2.1 配合）
  - 非 quiz section 中 `hasQuiz: true` 的 → 在该 section chunks 末尾追加 1-2 个 quiz 类型的 chunk（由 LLM 生成，不单独调用 injectQuizzes）
- `buildContentPrompt` 增加 `hasQuiz` 参数，当为 true 时在 prompt 中要求额外生成 1-2 道随堂测验
- 题库匹配作为后续优化（当前先走 LLM 生成，题库接入可作为 P2 独立任务）

**改动文件**：

- 删除 `lib/teaching/quiz-injector.ts`
- `lib/teaching/content-generator.ts` — `generateSectionContent` 传入 `hasQuiz` 参数
- `lib/teaching/content-prompts.ts` — `buildContentPrompt` 增加 `hasQuiz` 参数，有测验时要求额外生成 quiz chunk

**预期效果**：测验生成逻辑统一，消除占位符问题，与 2.1 交互化无缝衔接。

### 4.2 教案收藏与分享

**现状**：课程只能通过历史记录查看，无法收藏或分享。

**安全与隐私补充**（原方案遗漏）：

- 教案包含个性化内容（基于学生薄弱点），分享时需提示"此教案为个性化内容，仅供参考"
- 分享链接需权限控制：公开 / 仅链接可见 / 私密（默认仅链接可见）

**方案**：

- 授课完成页增加「收藏」按钮，收藏的教案在独立列表展示
- 生成可分享链接（默认仅链接可见），其他用户可查看教案内容（只读）
- 导出为 PDF（前端 `window.print()` + 打印专用样式表 `@media print`）

**改动文件**：

- `components/sky/solve/teaching-panel.tsx` — 增加收藏按钮
- `app/api/sky/teaching/history/route.ts` — 增加收藏/取消收藏逻辑
- 新增 `app/api/sky/teaching/share/[id]/route.ts` — 分享链接端点
- 新增 `app/sky/teaching/share/[id]/page.tsx` — 分享查看页
- `app/globals.css` — 增加 `@media print` 打印样式

**预期效果**：知识沉淀和社交传播。

### 4.3 多轮对话式授课

**现状**：一次性生成全部内容，用户无法追问或要求换一种讲法。

**原方案问题**：原方案写"每个 SectionCard 底部增加对话输入框"，会让页面非常长且杂乱，干扰阅读体验。

**修正方案**：

- 每个 SectionCard 底部增加「提问」按钮（非输入框），点击后展开对话区域
- 对话区域包含输入框 + 历史追问记录
- 追问时调用 LLM 基于当前 section 上下文 + 前序摘要 + 追问历史生成补充内容
- 补充内容追加到该 section 的 chunks 中，带 `isFollowUp: true` 标记，UI 上用缩进/左边框区分
- 再次点击「提问」可收起对话区域，保持页面整洁

**改动文件**：

- `components/sky/solve/teaching-panel.tsx` — SectionCard 增加折叠式提问区域
- 新增 `app/api/sky/teaching/followup/route.ts` — 追问接口
- `lib/teaching/content-generator.ts` — 新增 `generateFollowUp()` 函数
- `lib/teaching/content-types.ts` — `ContentChunk` 增加 `isFollowUp?: boolean` 字段

**预期效果**：从"AI 单向输出"变为"师生双向互动"，UI 不干扰阅读。

---

## 五、优先级排序

| 优先级 | 优化项 | 维度 | 预期收益 | 实现复杂度 | 依赖关系 |
|--------|--------|------|----------|------------|----------|
| P0 | 1.1 并行内容生成 | 性能 | 生成速度提升 60%+ | 中 | 无 |
| P0 | 3.1 单节失败重试 | 稳定性 | 消除整体失败 | 低 | 无 |
| P0 | 4.1 统一测验生成 | 功能 | 测验从占位变真实 | 低 | 无 |
| P1 | 2.1 测验交互化 | 体验 | 被动→主动学习 | 中 | 依赖 4.1 |
| P1 | 1.2 SSE 流式推送 | 性能 | 首节展示 <1s | 高 | 无（与1.1独立） |
| P1 | 2.2 智能主题推荐 | 体验 | 降低使用门槛 | 低 | 无 |
| P1 | 1.4 数学渲染优化 | 性能 | 渲染卡顿减少 70% | 低 | 无 |
| P2 | 2.3 学习进度跟踪 | 体验 | 形成学习闭环 | 中 | 依赖 2.1 |
| P2 | 1.3 画像缓存优化 | 性能 | 画像接口快 40x | 中 | 无 |
| P2 | 3.2 认证过期处理 | 稳定性 | 避免内容丢失 | 低 | 无 |
| P2 | 3.3 轮询动态间隔 | 性能 | 减少 40% 无效请求 | 低 | 无 |
| P3 | 4.3 多轮对话式授课 | 功能 | 双向互动 | 高 | 依赖 1.1 |
| P3 | 2.4 语音朗读 | 体验 | 多模态学习 | 中 | 无 |
| P3 | 4.2 收藏与分享 | 功能 | 知识沉淀 | 中 | 无 |

**依赖链说明**：

- 4.1（统一测验生成）→ 2.1（测验交互化）：先生成结构化测验，再做前端交互
- 2.1（测验交互化）→ 2.3（学习进度跟踪）：交互化后才有答题结果可反馈
- 1.1（并行生成）→ 4.3（多轮对话）：并行生成稳定后再加对话功能

---

## 六、技术风险与注意事项

1. **并行生成的一致性**：并行生成可能导致前后节内容重复或衔接不自然。缓解：第 1 节单独生成，后续节在 prompt 中注入前序节摘要（title + knowledgePoints + contentSummary 前 200 字）。并行组内共享同一快照，避免竞争条件。
2. **SSE 连接管理**：需处理断连重连、连接数限制（浏览器同域 6 个）、代理超时。缓解：心跳机制 + 自动降级轮询。
3. **测验答案安全**：quiz 的 answer/explanation 不随题目一起下发，前端答题后才通过单独接口获取。服务端存储明文答案，按需返回。
4. **LLM 输出格式不稳定**：JSON 解析可能失败。缓解：`parseJsonResponse` 已有修复能力，quiz 结构化输出增加 schema 校验 + 降级到纯文本展示。
5. **并发 LLM 调用的 API 限流**：2 路并发可能触发 key 限流。缓解：key pool 轮转 + 退避重试，并发数可配置（环境变量 `TEACHING_CONCURRENCY`）。
6. **数学渲染性能**（新增）：大量 chunk 同时渲染时 `wrapBareLatex` 的 15+ 正则匹配可能卡顿。缓解：优化 prompt 要求 LLM 输出标准定界符提高快路径命中率 + `React.memo` 防重渲染。
7. **画像数据一致性**（新增）：学习进度反馈不应直接修改掌握度数值（会与知识图谱计算脱节），应通过错题本/反馈表间接影响。画像重建时自然反映变化。
8. **SpeechSynthesis 兼容性**（新增）：中文 TTS 质量浏览器差异大，Chrome 延迟 ~2s。需做兼容性检测，不支持时隐藏按钮。
