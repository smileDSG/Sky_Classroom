# 模块 A 完整实现计划书

> **给执行者：** 请使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 按任务逐条实现。步骤使用 `- [ ]` 勾选语法追踪进度。

**目标：** 补全模块 A（解题 + 题库）的所有缺口，使 A-001 到 A-005 全部达到计划书验收标准。

**架构概述：** 模块 A 对外暴露 4 个 API 端点。拍照识图使用 GLM → Qwen → Anthropic 三层视觉模型降级。解题通过 LangGraph 状态图编排 5 个节点，三个 Agent（DeepSeek/GLM/Qwen）经 hybrid 置信度兜底策略路由。批改使用 DeepSeek LLM 分析 + 规则兜底。题库基于 IndexedDB，使用 Jaccard 二元组文本相似度匹配。

**技术栈：** Next.js 16 (App Router)、LangGraph、Vercel AI SDK、Vitest、Dexie/IndexedDB

**当前状态：** A-001~A-003 核心逻辑已存在但缺少几个计划要求的模块。A-004 的 GET/POST 是空壳。A-005 缺少 `tests/recognition/` 目录下的 4 个测试文件。

**三提供商 Key 已全部配置在 `.env.local`：** DeepSeek、GLM、Qwen。

---

## 文件变更总览

| 文件 | 操作 | 说明 |
|------|------|------|
| `lib/recognition/image-validator.ts` | **新建** | 图片格式/大小校验（A-001） |
| `lib/recognition/index.ts` | 修改 | 导出 image-validator |
| `app/api/sky/solve/recognize/route.ts` | 修改 | 集成图片校验 |
| `lib/solve/error-classifier.ts` | **新建** | 独立错误分类模块（从 grader.ts 抽离） |
| `lib/solve/index.ts` | 修改 | 导出 error-classifier |
| `lib/solve/grader.ts` | 修改 | 改为调用 error-classifier |
| `app/api/sky/solve/grade/route.ts` | 修改 | 批改结果写入错题本 |
| `app/api/sky/solve/explain/route.ts` | 修改 | 添加解题耗时统计 |
| `app/api/sky/question-bank/route.ts` | 修改 | GET（搜索/筛选/分页）+ POST（入库/去重） |
| `tests/recognition/formula-extractor.test.ts` | **新建** | LaTeX 提取测试 |
| `tests/recognition/image-validator.test.ts` | **新建** | 图片校验测试 |
| `tests/recognition/recognize-api.test.ts` | **新建** | 识别端点测试 |
| `tests/solve/error-classifier.test.ts` | **新建** | 错误分类测试 |

---

### 任务 1：A-004 — 题库查询 GET 端点

> 把空壳 GET 替换成完整的模糊搜索 + 知识点筛选 + 分页实现

**涉及文件：** `app/api/sky/question-bank/route.ts`

- [ ] **第1步：重写 GET 处理器**

首先替换文件顶部的 import：

```typescript
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';
import {
  findSimilarQuestions,
  saveToQuestionBank,
  listQuestionBankEntries,
  isProblemInBank,
} from '@/lib/solve/question-bank';
import type { QuestionBankEntry } from '@/lib/solve/types';

const log = createLogger('API:SkyQuestionBank');
```

然后用以下代码替换整个 GET 函数：

```typescript
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const query = url.searchParams.get('query') || '';
    const agentType = url.searchParams.get('agentType') || '';
    const verified = url.searchParams.get('verified');
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '10')));

    let entries: QuestionBankEntry[];
    let total: number;

    if (query) {
      const matches = await findSimilarQuestions(query, 0.3);
      entries = matches;
      if (agentType) {
        entries = entries.filter((e) => e.agentId === agentType);
      }
      if (verified !== null && verified !== undefined) {
        entries = entries.filter((e) => e.verified === (verified === 'true'));
      }
      total = entries.length;
      const start = (page - 1) * limit;
      entries = entries.slice(start, start + limit);
    } else {
      const allEntries = await listQuestionBankEntries(1000);
      let filtered = allEntries;
      if (agentType) {
        filtered = filtered.filter((e) => e.agentId === agentType);
      }
      if (verified !== null && verified !== undefined) {
        filtered = filtered.filter((e) => e.verified === (verified === 'true'));
      }
      total = filtered.length;
      const start = (page - 1) * limit;
      entries = filtered.slice(start, start + limit);
    }

    return apiSuccess({
      questions: entries,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    log.error('Question bank GET error:', err);
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      '题库查询失败',
      err instanceof Error ? err.message : undefined,
    );
  }
}
```

- [ ] **第2步：验证编译**

```bash
cd D:/github/OpenMAIC-firsted-team- && npx tsc --noEmit --pretty 2>&1 | grep -E "(question-bank|error)" | head -10
```

预期：无 question-bank 相关报错。

- [ ] **第3步：提交**

```bash
git add app/api/sky/question-bank/route.ts
git commit -m "feat(A-004): 题库 GET 端点 — 模糊搜索、知识点筛选、分页"
```

---

### 任务 2：A-004 — 题库入库 POST 端点

> 把空壳 POST 替换成完整去重入库实现

**涉及文件：** `app/api/sky/question-bank/route.ts`

- [ ] **第1步：重写 POST 处理器**

```typescript
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { problemText, problemImage, answer, steps, knowledgePoints, agentId } = body;

    if (!problemText || !answer) {
      return apiError(
        API_ERROR_CODES.MISSING_REQUIRED_FIELD,
        400,
        '缺少必填字段: problemText, answer',
      );
    }

    const exists = await isProblemInBank(problemText);
    if (exists) {
      return apiSuccess({
        id: '',
        saved: false,
        message: '题目已存在于题库中',
        duplicated: true,
      });
    }

    const entry = await saveToQuestionBank({
      problemText,
      problemImage: problemImage ?? undefined,
      answer,
      steps: steps ?? [],
      knowledgePoints: knowledgePoints ?? [],
      agentId: agentId ?? 'universal',
      solvedAt: new Date(),
      verified: false,
    });

    log.info(`题目已入库: ${entry.id}`);

    return apiSuccess({
      id: entry.id,
      saved: true,
      duplicated: false,
    });
  } catch (err) {
    log.error('Question bank POST error:', err);
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      '题库保存失败',
      err instanceof Error ? err.message : undefined,
    );
  }
}
```

- [ ] **第2步：提交**

```bash
git add app/api/sky/question-bank/route.ts
git commit -m "feat(A-004): 题库 POST 端点 — 去重检测 + 自动入库"
```

---

### 任务 3：A-001 — 新建图片校验模块

> 创建 `image-validator.ts`，校验文件格式（JPEG/PNG/WebP）和大小（≤10MB）

**涉及文件：** `lib/recognition/image-validator.ts`（新建）、`lib/recognition/index.ts`（修改）

- [ ] **第1步：创建校验模块**

```typescript
// lib/recognition/image-validator.ts

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/** 校验图片格式和大小 */
export function validateImage(file: File): ValidationResult {
  if (!file) {
    return { valid: false, error: '未上传图片' };
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return {
      valid: false,
      error: `不支持的图片格式: ${file.type || '未知'}。支持: JPEG, PNG, WebP`,
    };
  }

  if (file.size > MAX_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return { valid: false, error: `图片大小 ${sizeMB}MB 超过限制（最大 10MB）` };
  }

  if (file.size === 0) {
    return { valid: false, error: '图片文件为空' };
  }

  return { valid: true };
}
```

- [ ] **第2步：导出**

在 `lib/recognition/index.ts` 末尾追加：

```typescript
export { validateImage } from './image-validator';
export type { ValidationResult } from './image-validator';
```

- [ ] **第3步：提交**

```bash
git add lib/recognition/image-validator.ts lib/recognition/index.ts
git commit -m "feat(A-001): 新增图片格式与大小校验模块"
```

---

### 任务 4：A-001 — 识别端点集成图片校验

> 在 recognize 路由中调用 validator，拦截非法上传

**涉及文件：** `app/api/sky/solve/recognize/route.ts`

- [ ] **第1步：添加 import 和校验逻辑**

在现有多余 import 处添加：

```typescript
import { validateImage } from '@/lib/recognition/image-validator';
```

在 POST 函数中找到这段：

```typescript
    if (!image) {
      return apiError(
        API_ERROR_CODES.MISSING_REQUIRED_FIELD,
        400,
        'Missing required field: image',
      );
    }

    // Convert to base64 for vision model
```

在这两段之间插入校验逻辑：

```typescript
    if (!image) {
      return apiError(
        API_ERROR_CODES.MISSING_REQUIRED_FIELD,
        400,
        'Missing required field: image',
      );
    }

    // === 插入校验 ===
    const validation = validateImage(image);
    if (!validation.valid) {
      return apiError(
        API_ERROR_CODES.INVALID_REQUEST,
        400,
        validation.error ?? '图片校验失败',
      );
    }
    // === 校验结束 ===

    // Convert to base64 for vision model
```

- [ ] **第2步：提交**

```bash
git add app/api/sky/solve/recognize/route.ts
git commit -m "feat(A-001): 识别端点集成图片格式/大小校验"
```

---

### 任务 5：A-003 — 抽离错误分类模块

> 把 `grader.ts` 中的 `normalizeCause()` 函数独立为 `error-classifier.ts`

**涉及文件：** `lib/solve/error-classifier.ts`（新建）、`lib/solve/index.ts`（修改）

- [ ] **第1步：创建 error-classifier.ts**

```typescript
// lib/solve/error-classifier.ts

import type { MistakeCause } from './types';

const VALID_CAUSES: MistakeCause[] = [
  'concept-unclear', 'calculation-error', 'misreading',
  'method-wrong', 'careless', 'format-error',
];

const FULL_PHRASE_MAP: Record<string, MistakeCause> = {
  '概念不清': 'concept-unclear',
  '计算失误': 'calculation-error',
  '审题错误': 'misreading',
  '方法错误': 'method-wrong',
  '粗心': 'careless',
  '格式错误': 'format-error',
};

const KEYWORD_MAP: Record<string, MistakeCause> = {
  '概念': 'concept-unclear', '计算': 'calculation-error',
  '审题': 'misreading', '方法': 'method-wrong',
  '粗心': 'careless', '格式': 'format-error',
};

const CAUSE_LABELS: Record<MistakeCause, string> = {
  'concept-unclear': '概念不清',
  'calculation-error': '计算失误',
  'misreading': '审题错误',
  'method-wrong': '方法错误',
  'careless': '粗心',
  'format-error': '格式错误',
};

/** 将原始错误原因字符串（中文或英文）标准化为 MistakeCause 枚举值 */
export function classifyErrorCause(raw: string): MistakeCause {
  const normalized = raw.trim().toLowerCase();
  if (VALID_CAUSES.includes(normalized as MistakeCause)) return normalized as MistakeCause;
  for (const [k, v] of Object.entries(FULL_PHRASE_MAP)) {
    if (normalized.includes(k)) return v;
  }
  for (const [k, v] of Object.entries(KEYWORD_MAP)) {
    if (normalized.includes(k)) return v;
  }
  return 'concept-unclear';
}

/** 获取 MistakeCause 对应的中文标签 */
export function getCauseLabel(cause: MistakeCause): string {
  return CAUSE_LABELS[cause] || cause;
}

export { VALID_CAUSES };
```

- [ ] **第2步：导出**

在 `lib/solve/index.ts` 末尾追加：

```typescript
export { classifyErrorCause, getCauseLabel, VALID_CAUSES } from './error-classifier';
```

- [ ] **第3步：提交**

```bash
git add lib/solve/error-classifier.ts lib/solve/index.ts
git commit -m "feat(A-003): 错误分类逻辑抽离为独立模块 error-classifier"
```

---

### 任务 6：A-003 — grader.ts 引用新模块

> 删除 grader.ts 中的 `VALID_CAUSES` 和 `normalizeCause`，改为 import

**涉及文件：** `lib/solve/grader.ts`

- [ ] **第1步：替换**

在 grader.ts 顶部添加 import：

```typescript
import { classifyErrorCause } from './error-classifier';
```

删除 grader.ts 第 138-179 行的 `VALID_CAUSES` 常量和 `normalizeCause` 函数。

将 `gradeAnswer` 函数中调用 `normalizeCause(parsed.cause)` 的地方（约第 243 行）改为：

```typescript
cause: classifyErrorCause(parsed.cause),
```

- [ ] **第2步：验证已有测试仍然通过**

```bash
cd D:/github/OpenMAIC-firsted-team- && npx vitest run tests/solve/grader.test.ts
```

预期：12 个测试全部通过。

- [ ] **第3步：提交**

```bash
git add lib/solve/grader.ts
git commit -m "refactor(A-003): grader 改为引用 error-classifier 模块"
```

---

### 任务 7：A-003 — 批改结果写入错题本

> 在 grade 端点中，当答案错误时自动写入 mistakes DAO

**涉及文件：** `app/api/sky/solve/grade/route.ts`

- [ ] **第1步：重写 grade 路由**

```typescript
import { gradeAnswer } from '@/lib/solve/grader';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';
import { getStorageProvider } from '@/lib/storage/storage-factory';
import { createMistakeBookDAO } from '@/lib/storage/dao/mistakes';
import type { MistakeCause } from '@/lib/solve/types';
import type { ErrorType } from '@/lib/storage/dao/mistakes';

const log = createLogger('API:SkySolveGrade');

function mapCauseToErrorType(cause: MistakeCause): ErrorType {
  const map: Record<MistakeCause, ErrorType> = {
    'concept-unclear': 'concept',
    'calculation-error': 'calculation',
    'misreading': 'reading',
    'method-wrong': 'reasoning',
    'careless': 'careless',
    'format-error': 'careless',
  };
  return map[cause];
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { problem, correctAnswer, userAnswer, stepByStep, mistakeId } = body;

    if (!problem || !correctAnswer || !userAnswer) {
      return apiError(
        API_ERROR_CODES.MISSING_REQUIRED_FIELD,
        400,
        '缺少必填字段: problem, correctAnswer, userAnswer',
      );
    }

    const steps: string[] | undefined = Array.isArray(stepByStep)
      ? stepByStep.map((s: { content?: string; text?: string }) => s?.content ?? s?.text ?? '')
      : undefined;

    const result = await gradeAnswer(problem, correctAnswer, userAnswer, steps);

    // 错误答案写入错题本
    if (!result.isCorrect) {
      try {
        const storage = await getStorageProvider();
        const dao = createMistakeBookDAO(storage);
        await dao.add({
          id: mistakeId || `mistake_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          problemText: problem,
          userAnswer,
          correctAnswer,
          errorType: mapCauseToErrorType(result.cause),
          errorExplanation: result.errorAnalysis,
          knowledgePoints: [],
          sourceSessionId: undefined,
        });
        log.info('批改结果已存入错题本');
      } catch (e) {
        log.error('错题本存储失败:', e);
      }
    }

    return apiSuccess({ ...result });
  } catch (err) {
    log.error('Grade API error:', err);
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      '批改失败',
      err instanceof Error ? err.message : undefined,
    );
  }
}
```

- [ ] **第2步：提交**

```bash
git add app/api/sky/solve/grade/route.ts
git commit -m "feat(A-003): 批改错误结果自动写入错题本"
```

---

### 任务 8：A-002 — 解题耗时统计

> 在 explain 端点中对 solve graph 执行过程计时

**涉及文件：** `app/api/sky/solve/explain/route.ts`

- [ ] **第1步：添加计时**

找到 POST 函数中的这几行：

```typescript
    const graph = createSolveGraph();
    const initialState = buildSolveInitialState(problem, problemImage ?? null, userAnswer ?? null);

    const finalState = await graph.invoke(initialState);
```

改为：

```typescript
    const graph = createSolveGraph();
    const initialState = buildSolveInitialState(problem, problemImage ?? null, userAnswer ?? null);

    const startTime = performance.now();
    const finalState = await graph.invoke(initialState);
    const solvingTime = Math.round(performance.now() - startTime);
```

然后把输出的 `solvingTime: 0` 改为 `solvingTime`，把日志也加上耗时：

```typescript
    log.info(`[Explain] 耗时 ${solvingTime}ms. 缓存命中=${finalState.fromQuestionBank}`);

    return apiSuccess({
      ...output,
      fromQuestionBank: finalState.fromQuestionBank ?? false,
      solvingTime,
      agentsUsed: [finalState.agentRoute ?? 'universal'],
    });
```

- [ ] **第2步：提交**

```bash
git add app/api/sky/solve/explain/route.ts
git commit -m "feat(A-002): 解题端点加入实际耗时统计"
```

---

### 任务 9：A-005 — 编写 formula-extractor 单元测试

**涉及文件：** `tests/recognition/formula-extractor.test.ts`（新建）

- [ ] **第1步：编写测试**

```typescript
import { describe, test, expect } from 'vitest';
import { extractFormulas } from '@/lib/recognition/formula-extractor';

describe('extractFormulas — LaTeX公式提取', () => {
  test('提取行内公式 $...$', () => {
    const r = extractFormulas('解方程 $x^2 + 2x + 1 = 0$ 求值');
    expect(r.latex).toContain('x^2 + 2x + 1 = 0');
    expect(r.text).not.toContain('$');
  });

  test('提取块级公式 $$...$$', () => {
    const r = extractFormulas('$$\\int_0^1 x dx = \\frac{1}{2}$$');
    expect(r.latex).toContain('\\int_0^1 x dx = \\frac{1}{2}');
  });

  test('提取 \\(...\\) 行内公式', () => {
    const r = extractFormulas('\\(a^2 + b^2 = c^2\\)');
    expect(r.latex).toContain('a^2 + b^2 = c^2');
  });

  test('Unicode数学符号转为LaTeX', () => {
    const r = extractFormulas('2 × 3，π ≈ 3.14，√4 = 2，≤ 5，≠ 6');
    expect(r.text).toContain('\\times');
    expect(r.text).toContain('\\pi');
    expect(r.text).toContain('\\sqrt');
  });

  test('角度和上下标符号转换', () => {
    const r = extractFormulas('90°，体积 1m³，2²');
    expect(r.text).toContain('^\\circ');
    expect(r.text).toContain('^3');
    expect(r.text).toContain('^2');
  });

  test('希腊字母转换', () => {
    const r = extractFormulas('α + β = γ，θ = 30°，λ = 500');
    expect(r.text).toContain('\\alpha');
    expect(r.text).toContain('\\beta');
    expect(r.text).toContain('\\theta');
  });

  test('无公式时 latex 为空', () => {
    const r = extractFormulas('什么是光合作用？');
    expect(r.latex).toBe('');
    expect(r.text).toBe('什么是光合作用？');
  });

  test('清理多余空白', () => {
    const r = extractFormulas('  解方程   $x = 1$   ');
    expect(r.text).toBe('解方程');
  });

  test('空字符串不报错', () => {
    const r = extractFormulas('');
    expect(r.text).toBe('');
    expect(r.latex).toBe('');
  });

  test('多公式提取', () => {
    const r = extractFormulas('$a=1$ + $b=2$ = $c=3$');
    expect(r.latex.split('\n')).toHaveLength(3);
  });
});
```

- [ ] **第2步：运行测试**

```bash
npx vitest run tests/recognition/formula-extractor.test.ts
```

预期：10 个测试全部通过。

- [ ] **第3步：提交**

```bash
git add tests/recognition/formula-extractor.test.ts
git commit -m "test(A-005): 添加 LaTeX 公式提取单元测试（10项）"
```

---

### 任务 10：A-005 — 编写 image-validator 单元测试

**涉及文件：** `tests/recognition/image-validator.test.ts`（新建）

- [ ] **第1步：编写测试**

```typescript
import { describe, test, expect } from 'vitest';
import { validateImage } from '@/lib/recognition/image-validator';

function makeFile(type: string, size: number): File {
  const content = new Uint8Array(size).fill(65);
  return new File([content], 'test.' + (type.split('/')[1] || 'png'), { type });
}

describe('validateImage — 图片校验', () => {
  test('接受 JPEG', () => {
    expect(validateImage(makeFile('image/jpeg', 1024)).valid).toBe(true);
  });

  test('接受 PNG', () => {
    expect(validateImage(makeFile('image/png', 2048)).valid).toBe(true);
  });

  test('接受 WebP', () => {
    expect(validateImage(makeFile('image/webp', 512)).valid).toBe(true);
  });

  test('拒绝 GIF', () => {
    const r = validateImage(makeFile('image/gif', 1024));
    expect(r.valid).toBe(false);
    expect(r.error).toContain('不支持的图片格式');
  });

  test('拒绝 BMP', () => {
    expect(validateImage(makeFile('image/bmp', 1024)).valid).toBe(false);
  });

  test('拒绝超过 10MB 的文件', () => {
    const r = validateImage(makeFile('image/png', 11 * 1024 * 1024));
    expect(r.valid).toBe(false);
    expect(r.error).toContain('超过限制');
  });

  test('接受恰好 10MB 的文件', () => {
    expect(validateImage(makeFile('image/png', 10 * 1024 * 1024)).valid).toBe(true);
  });

  test('拒绝 0 字节空文件', () => {
    const r = validateImage(makeFile('image/png', 0));
    expect(r.valid).toBe(false);
    expect(r.error).toContain('空');
  });

  test('拒绝空 MIME 类型', () => {
    expect(validateImage(makeFile('', 1024)).valid).toBe(false);
  });

  test('拒绝 SVG', () => {
    expect(validateImage(makeFile('image/svg+xml', 1024)).valid).toBe(false);
  });
});
```

- [ ] **第2步：运行测试**

```bash
npx vitest run tests/recognition/image-validator.test.ts
```

预期：10 个测试全部通过。

- [ ] **第3步：提交**

```bash
git add tests/recognition/image-validator.test.ts
git commit -m "test(A-005): 添加图片校验单元测试（10项）"
```

---

### 任务 11：A-005 — 编写 recognize API 端点测试

**涉及文件：** `tests/recognition/recognize-api.test.ts`（新建）

- [ ] **第1步：编写测试**

```typescript
import { describe, test, expect, vi, beforeEach } from 'vitest';

const llmState = vi.hoisted(() => ({ shouldFail: false, responseText: '' }));

vi.mock('@/lib/ai/llm', () => ({
  callLLM: vi.fn().mockImplementation(async () => {
    if (llmState.shouldFail) throw new Error('LLM挂了');
    return { text: llmState.responseText || '解方程 $x^2+2x+1=0$' };
  }),
}));

vi.mock('@/lib/ai/providers', () => ({
  getModel: vi.fn().mockReturnValue({ model: {}, modelId: 'test', provider: 'glm' }),
}));

import { POST } from '@/app/api/sky/solve/recognize/route';

function makeFile(type: string, size: number): File {
  const content = new Uint8Array(size).fill(65);
  return new File([content], 'test.' + (type.split('/')[1] || 'png'), { type });
}

describe('Recognize API 端点', () => {
  beforeEach(() => {
    llmState.shouldFail = false;
    llmState.responseText = '';
  });

  test('无图片时返回 400', async () => {
    const fd = new FormData();
    const req = new Request('http://localhost/api/sky/solve/recognize', { method: 'POST', body: fd });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain('Missing required field');
  });

  test('不支持格式返回 400', async () => {
    const fd = new FormData();
    fd.append('image', makeFile('image/gif', 1024), 'test.gif');
    const req = new Request('http://localhost/api/sky/solve/recognize', { method: 'POST', body: fd });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  test('超大文件返回 400', async () => {
    const fd = new FormData();
    fd.append('image', makeFile('image/png', 11 * 1024 * 1024), 'big.png');
    const req = new Request('http://localhost/api/sky/solve/recognize', { method: 'POST', body: fd });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  test('正常识别返回 200', async () => {
    llmState.responseText = '解方程 $x^2 + 2x + 1 = 0$';
    const fd = new FormData();
    fd.append('image', makeFile('image/png', 1024), 'problem.png');
    const req = new Request('http://localhost/api/sky/solve/recognize', { method: 'POST', body: fd });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.text).toBeDefined();
    expect(body.data.problemCount).toBeGreaterThanOrEqual(1);
  });

  test('识别结果包含 LaTeX', async () => {
    llmState.responseText = '$\\frac{1}{2} + \\frac{1}{3}$';
    const fd = new FormData();
    fd.append('image', makeFile('image/png', 2048), 'problem.png');
    const req = new Request('http://localhost/api/sky/solve/recognize', { method: 'POST', body: fd });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.latex).toBeDefined();
  });

  test('无视觉提供商时返回 500', async () => {
    const saveGlm = process.env.GLM_API_KEY;
    const saveQwen = process.env.QWEN_API_KEY;
    const saveAnthro = process.env.ANTHROPIC_API_KEY;
    delete (process.env as any).GLM_API_KEY;
    delete (process.env as any).QWEN_API_KEY;
    delete (process.env as any).ANTHROPIC_API_KEY;

    const fd = new FormData();
    fd.append('image', makeFile('image/png', 1024), 'p.png');
    const req = new Request('http://localhost/api/sky/solve/recognize', { method: 'POST', body: fd });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toContain('没有配置');

    if (saveGlm) process.env.GLM_API_KEY = saveGlm;
    if (saveQwen) process.env.QWEN_API_KEY = saveQwen;
    if (saveAnthro) process.env.ANTHROPIC_API_KEY = saveAnthro;
  });
});
```

- [ ] **第2步：运行测试**

```bash
npx vitest run tests/recognition/recognize-api.test.ts
```

预期：6 个测试全部通过。

- [ ] **第3步：提交**

```bash
git add tests/recognition/recognize-api.test.ts
git commit -m "test(A-005): 添加识别 API 端点测试（6项）"
```

---

### 任务 12：A-005 — 编写 error-classifier 单元测试

**涉及文件：** `tests/solve/error-classifier.test.ts`（新建）

- [ ] **第1步：编写测试**

```typescript
import { describe, test, expect } from 'vitest';
import { classifyErrorCause, getCauseLabel, isValidCause } from '@/lib/solve/error-classifier';

describe('classifyErrorCause — 错误分类', () => {
  test('英文直接匹配: calculation-error', () => {
    expect(classifyErrorCause('calculation-error')).toBe('calculation-error');
  });

  test('英文直接匹配: misreading', () => {
    expect(classifyErrorCause('misreading')).toBe('misreading');
  });

  test('中文全称: 概念不清 → concept-unclear', () => {
    expect(classifyErrorCause('概念不清')).toBe('concept-unclear');
  });

  test('中文全称: 计算失误 → calculation-error', () => {
    expect(classifyErrorCause('计算失误')).toBe('calculation-error');
  });

  test('中文全称: 审题错误 → misreading', () => {
    expect(classifyErrorCause('审题错误')).toBe('misreading');
  });

  test('中文全称: 方法错误 → method-wrong', () => {
    expect(classifyErrorCause('方法错误')).toBe('method-wrong');
  });

  test('中文全称: 粗心 → careless', () => {
    expect(classifyErrorCause('粗心')).toBe('careless');
  });

  test('中文全称: 格式错误 → format-error', () => {
    expect(classifyErrorCause('格式错误')).toBe('format-error');
  });

  test('关键词匹配: 含"概念" → concept-unclear', () => {
    expect(classifyErrorCause('学生对基本概念不理解')).toBe('concept-unclear');
  });

  test('关键词匹配: 含"计算" → calculation-error', () => {
    expect(classifyErrorCause('计算过程中出了错误')).toBe('calculation-error');
  });

  test('大小写不敏感', () => {
    expect(classifyErrorCause('CARELESS')).toBe('careless');
  });

  test('去首尾空白', () => {
    expect(classifyErrorCause('  misreading  ')).toBe('misreading');
  });

  test('无法识别默认为 concept-unclear', () => {
    expect(classifyErrorCause('xyz-unknown')).toBe('concept-unclear');
  });

  test('空字符串默认 concept-unclear', () => {
    expect(classifyErrorCause('')).toBe('concept-unclear');
  });
});

describe('getCauseLabel — 中文标签', () => {
  test('concept-unclear → 概念不清', () => {
    expect(getCauseLabel('concept-unclear')).toBe('概念不清');
  });

  test('calculation-error → 计算失误', () => {
    expect(getCauseLabel('calculation-error')).toBe('计算失误');
  });

  test('无法识别返回原值', () => {
    expect(getCauseLabel('unknown' as any)).toBe('unknown');
  });
});

describe('isValidCause — 合法性检查', () => {
  test('合法值返回 true', () => {
    expect(isValidCause('concept-unclear')).toBe(true);
    expect(isValidCause('calculation-error')).toBe(true);
  });

  test('非法值返回 false', () => {
    expect(isValidCause('invalid')).toBe(false);
    expect(isValidCause('')).toBe(false);
  });
});
```

- [ ] **第2步：运行测试**

```bash
npx vitest run tests/solve/error-classifier.test.ts
```

预期：19 个测试全部通过。

- [ ] **第3步：提交**

```bash
git add tests/solve/error-classifier.test.ts
git commit -m "test(A-005): 添加错误分类器单元测试（19项）"
```

---

### 任务 13：A-005 — 全量回归验证

- [ ] **第1步：运行模块 A 全部测试**

```bash
cd D:/github/OpenMAIC-firsted-team- && npx vitest run tests/recognition/ tests/solve/
```

预期：12 个测试文件（8 已有 + 4 新增）全部通过。

- [ ] **第2步：运行项目全量测试检查回归**

```bash
cd D:/github/OpenMAIC-firsted-team- && npx vitest run
```

预期：任务 6 的 grader 重构没有破坏现有测试。

- [ ] **第3步：提交**

```bash
git add -A
git commit -m "test(A-005): 模块 A 全量回归验证通过"
```

---

## 验收对照表

全部 13 个任务完成后，模块 A 与计划书对齐情况：

| 计划编号 | 任务名 | 补全内容 | 对应任务 |
|----------|--------|----------|----------|
| A-001 | 图片识别 API | image-validator 新建 + 集成 | 任务 3-4 |
| A-002 | 解题讲解 API | 解题耗时统计 | 任务 8 |
| A-003 | 批改 API | error-classifier 独立模块 + 错题本写入 | 任务 5-7 |
| A-004 | 题库管理 API | GET 搜索分页 + POST 去重入库 | 任务 1-2 |
| A-005 | 单元测试 | 4 个缺失测试文件 | 任务 9-13 |

**三提供商（DeepSeek / GLM / Qwen）Key 均已在之前的配置中配好，本计划不涉及 Key 变更。**
