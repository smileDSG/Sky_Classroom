# 云端智囊 · 拍照搜题 语义匹配提升方案

> 目标：把"拍照题 → 题库命中"从**文本相似**升级为**语义匹配**，同时保证现有流式速度不退化。
> 范围：仅搜题（solve）的题库召回层。不引入完整向量数据库，用轻量 embedding + 进程内向量检索。
> 状态：方案（未实施）。

---

## 一、现状与根因

### 1.1 当前查库链路（`lib/solve/question-bank.ts`）

`findSimilarQuestions(problemText, threshold=0.85)` 并行查两处：

| 数据源 | 匹配方式 | 阈值 |
|--------|----------|------|
| 知识库 `kb-manager` | TF-IDF 余弦 | 映射后 ≥ max(0.85-0.25, 0.3) |
| MySQL `question_bank` | FULLTEXT + bigram Jaccard | 0.85 |

命中后返回 `fromQuestionBank: true`（秒速响应），未命中则走 AI。

### 1.2 命中率低的根因（按优先级）

1. **OCR 噪声未归一化**：识别错字、换行错乱、全半角混用、LaTeX 分隔符不统一，直接掐断 0.85 阈值。
2. **纯文本相似无法理解"同一道题的多种表述"**：不同教材/来源措辞不同，bigram 即不相似。
3. **哈希去重只对完全一致文本有效**（`hashProblemText`），对拍照题无效。
4. **题库池冷**：虽有 `enrichment/` 冷启动层，但未与匹配层打通。

### 1.3 关键事实

- **已有开源冷启动层**：`lib/solve/enrichment/dataset-sources.ts` 收录 5 个开放授权数据集（TAL-SCQ5K / MM-Math / AGIEval Gaokao Math / QZDH 高考物理 / OlympiadBench，约 24k 题），配合 `dataset-importer.ts`、`sqlite-store.ts` / `local-store.ts` 已具备导入与持久化。
- **无 embedding 底座**：`.env.example` 无 EMBEDDING 配置，`kb-manager` 纯 TF-IDF。
- **DeepSeek 无公开 embedding API**：需依赖支持 embedding 的 provider（如 Google `text-embedding-*` / OpenAI 兼容），或复用现有 key。

---

## 二、方案：四级级联召回（不换库，加能力）

```
输入 OCR/文本
  │
  ├─ L1  规范化 + 哈希精确命中      → 命中(0ms)   秒速响应
  ├─ L2  规范化 + 词典/文本相似(放阈值~0.6) → 命中   秒速响应
  ├─ L3  规范化 + embedding 语义 top-k(θ_sem) → 命中  近秒速
  └─ L4  AI 兜底（现有链路不变）
```

每一层未命中才落到下一层，**只让"近命中"付出 embedding 代价**，L1/L2 仍是 0ms，保住流式优势。

### 2.1 L0 归一化层（先行，所有层复用的地基）

`normalizeProblemText(text)` 放 `lib/solve/question-bank-utils.ts`，作用于哈希前、相似度计算前、embedding 前：

- 去空白/换行归一；全半角统一；中文标点统一。
- LaTeX 分隔符统一（`$` `\(\)` `\[ \]` → 标准记号），去首尾冗余。
- 折叠常见 OCR 误识别（数字/字母/下标混淆映射表，可扩展）。
- 去除图片占位 token、页眉页脚噪声。

产出：一个纯函数，成熟后可反向用于保存前 `hashProblemText` 统一入口。

### 2.2 L3 embedding 通道

- **封装**：`lib/ai/embedding.ts`，风格对齐 `callLLM`（多 key、超时、结果缓存）。
- **模型选型**：优先支持 embedding 的现有 provider；明确 `EMBEDDING_MODEL` 配置，DeepSeek 不可用时切替代。
- **存储**：体量在几千~几万，**复用 `sqlite-store.ts`/`local-store.ts` 做向量持久化**，不引入 Milvus/Qdrant/pgvector。索引结构：本地文件 + 内存 Map（id→vector），启动惰性加载。
- **时效**：`saveToQuestionBank` 成功解析后联动写入向量；导入数据集时批量预计算向量。
- **门控**：embedding 不可用（未配置/失败）时自动降级回 L1/L2，不阻塞主链路。

### 2.3 冷启动数据（替换"爬版权站"）

用已有 `dataset-importer` 导入 5 个开放数据集并批量 embedding，作为 L3 的底池；合规、可解释、随体积增长命中率自然上升。

### 2.4 自沉淀增强

确认每个已解决且校验过的题目都会 `saveToQuestionBank`（当前链路已有 `solve-chain` 调用，需核验覆盖），让库"越用越厚"，且沉淀数据与拍照场景同分布、质量最高。

---

## 三、建设与验收顺序

1. **P0 归一化层**：`normalizeProblemText` + 单元测试（最小、纯函数、无外部依赖）。
2. **P1 embedding 封装**：`lib/ai/embedding.ts` + provider 门控 + 降级。
3. **P2 级联接入**：改 `findSimilarQuestions` 走 L1→L4；开向量索引读写。
4. **P3 冷启动打通**：`dataset-importer` 灌数 + 批量 embedding。
5. **P4 评测与回归**：召回率评测脚本 + 既有 solve 测试回归。

---

## 四、测试策略（重点）

> 按仓库约定：单元测试走 `tests/**/*.test.ts`（vitest）；召回率用独立脚本 + 真机清单。

### 4.1 单元测试

| 模块 | 用例 |
|------|------|
| `normalizeProblemText` | 全半角/换行/LaTeX 分隔符统一；OCR 字符折叠；输入空串/纯图片占位 |
| `hashProblemText`（复用） | 归一化前后 hash 稳定性；同一题多种噪声写法 hash 一致 |
| L2 相似度（复用 `textSimilarity`） | 阈值放宽后正例命中、反例不误伤 |
| `lib/ai/embedding.ts` | 同文本缓存命中（二次调用不打模型）；失败抛错可降级；超时兜底 |

### 4.2 召回率评测（数据驱动，最重要的验收）

`scripts/eval-semantic-match.ts` + 静态黄金对：

- 构造 ≥30 组 `{ ocrNoiseProblem, canonicalProblem }`（3 门学科、覆盖选择题/填空/解答），OCR 噪声由构造脚本生成（插入错字/换行/全半角）。
- 指标：**Top-1 命中率、Top-5 命中率**。
- 对比三档：
  1. 基线（现状 TF-IDF + 0.85）
  2. 基线 + 归一化
  3. 归一化 + embedding（θ_sem 调参会话式给出）
- 验收线：**(2) 较 (1) 命中率明显上升；嵌入一档在 (2) 基础上再提升，且混入无关题 ≤3 个误命中/30 组**。
- 用 `vitest` 跑成断言（阈值断言）+ 输出对比表，便于回归。

### 4.3 集成测试

- 预置库里某题，走 `findSimilarQuestions`：同一题原文 → L1 命中；OCR 噪声版 → L2 或 L3 命中；无关新题 → L4 兜底返回空，且不误返回相似题。
- embedding 未配置时全链路可降级，不报错、不阻塞。

### 4.4 性能约束（不可退化）

- L1/L2 命中路径 0 LLM 调用，延迟与现状持平（≤百 ms 级）。
- embedding 单次查询预算 ≤ 800ms，且只发生在 L2 未命中的子集。
- 向量索引写入/加载有超时与懒加载，不阻塞首屏。

### 4.5 真机测试清单（用户验收导向）

1. 用手机拍一张真实错题（含公式/乱序），观察：命中"秒速"标注 or AI 兜底，记录耗时。
2. 同一题换两种噪声写法（错字/换行）再搜，是否仍命中。
3. 连续搜 3 个学科各 2 题，统计秒速命中占比。
4. 断网/未配置 embedding 时，搜题仍可用（降级无感）。

---

## 五、风险与取舍

| 风险 | 对策 |
|------|------|
| embedding 增加每次近命中查询延迟 | 只对 L2 未命中子集开向量；向量结果缓存 |
| 数据集版权/合规 | 仅用开放授权开源数据（TAL/MM-Math/AGIEval/OlympiadBench），不爬版权站 |
| DeepSeek 无 embedding | 门控 + 可配置 provider；不可用时纯文本降级，功能不阻塞 |
| 召回率难量化 | 用黄金对 + 命中率带阈值断言，纳入 vitest 回归 |
| 引入新存储 | 复用已有 `sqlite-store`/`local-store`，不加外部服务 |