import { nanoid } from 'nanoid';
import { callLLM } from '@/lib/ai/llm';
import { keyRotator } from '@/lib/ai/key-rotator';
import { createStageAPI } from '@/lib/api/stage-api';
import type { StageStore } from '@/lib/api/stage-api-types';
import {
  applyOutlineFallbacks,
  generateSceneOutlinesFromRequirements,
} from '@/lib/generation/outline-generator';
import pMap from 'p-map';
import { resolveConcurrency } from '@/lib/constants/generation';
import {
  createSceneWithActions,
  generateSceneActions,
  generateSceneContent,
  type SceneContentOptions,
} from '@/lib/generation/openmaic-main-scene-generator';
import type { AICallFn } from '@/lib/generation/pipeline-types';
import type { AgentInfo } from '@/lib/generation/pipeline-types';
import { getDefaultAgents } from '@/lib/orchestration/registry/store';
import { createLogger } from '@/lib/logger';
import { isProviderKeyRequired } from '@/lib/ai/providers';
import { resolveClassroomWebSearchConfig } from '@/lib/server/web-search-config';
import { resolveModel } from '@/lib/server/resolve-model';
import { buildSearchQuery } from '@/lib/server/search-query-builder';
import { formatSearchResultsAsContext, searchWeb } from '@/lib/web-search';
import type { BaiduSubSources, WebSearchProviderId } from '@/lib/web-search/types';
import { persistClassroom } from '@/lib/server/classroom-storage';
import {
  generateMediaForClassroom,
  replaceMediaPlaceholders,
  generateTTSForClassroom,
} from '@/lib/server/classroom-media-generation';
import { buildVideoManifestFromOutlines } from '@/lib/media/video-manifest';
import type { GeneratedSlideContent, SceneOutline, UserRequirements } from '@/lib/types/generation';
import type { Scene, Stage } from '@/lib/types/stage';
import { AGENT_COLOR_PALETTE, AGENT_DEFAULT_AVATARS } from '@/lib/constants/agent-defaults';
import { selectThemeForCourse } from '@/lib/generation/classroom-design-dna';
import {
  auditClassroomSlideContents,
  auditGeneratedSlideContent,
  formatClassroomSlideQAError,
  type ClassroomSlideQAIssue,
  type ClassroomSlideQAReport,
} from '@/lib/generation/scene-content/classroom-slide-qa';

const log = createLogger('Classroom');
const CLASSROOM_QA_SAFE_FONT =
  'Noto Sans SC, Microsoft YaHei, PingFang SC, Source Han Sans SC, Arial, sans-serif';
const CLASSROOM_QA_SAFE_BLOCK_FONT_SIZE = 22;
const CLASSROOM_QA_SAFE_MIN_BLOCK_HEIGHT = 84;
const CLASSROOM_QA_SAFE_TABLE_ROW_HEIGHT = 44;

type ClassroomSlideElement = GeneratedSlideContent['elements'][number];
type ClassroomSlideTextElement = Extract<ClassroomSlideElement, { type: 'text' }>;

function isQASafeTextBlockElement(
  element: ClassroomSlideElement,
): element is ClassroomSlideTextElement {
  return element.type === 'text' && element.id.includes('_block_');
}

export interface GenerateClassroomInput {
  requirement: string;
  pdfContent?: { text: string; images: string[] };
  enableWebSearch?: boolean;
  webSearchProviderId?: WebSearchProviderId;
  webSearchApiKey?: string;
  baiduSubSources?: BaiduSubSources;
  enableImageGeneration?: boolean;
  enableVideoGeneration?: boolean;
  enableTTS?: boolean;
  agentMode?: 'default' | 'generate';
}

export type ClassroomGenerationStep =
  | 'initializing'
  | 'researching'
  | 'generating_outlines'
  | 'generating_scenes'
  | 'qa_reviewing'
  | 'generating_media'
  | 'generating_tts'
  | 'persisting'
  | 'completed'
  | 'awaiting_review';

export interface OutlineOnlyResult {
  outlines: SceneOutline[];
  languageDirective: string;
  topicSummary?: string;
  agents: AgentInfo[];
  stage: Stage;
  requirement: string;
  pdfText?: string;
  researchContext?: string;
  enableImageGeneration: boolean;
  enableVideoGeneration: boolean;
  enableTTS: boolean;
}

export interface ClassroomGenerationProgress {
  step: ClassroomGenerationStep;
  progress: number;
  message: string;
  scenesGenerated: number;
  totalScenes?: number;
}

export interface GenerateClassroomResult {
  id: string;
  url: string;
  stage: Stage;
  scenes: Scene[];
  scenesCount: number;
  createdAt: string;
  slideQaReport?: ClassroomSlideQAReport;
}

const SCENE_PROGRESS_INITIAL = 31;
const SCENE_PROGRESS_CONTENT_DONE = 55;
const SCENE_PROGRESS_ACTIONS_DONE = 75;
const SCENE_PROGRESS_CREATED_DONE = 90;

type ProgressReporter = (progress: ClassroomGenerationProgress) => Promise<void> | void;
type GeneratedSceneContent = NonNullable<Awaited<ReturnType<typeof generateSceneContent>>>;
type GeneratedSceneContentResult = {
  outline: SceneOutline;
  content: GeneratedSceneContent;
  index: number;
};

function createSlideFallbackOutline(outline: SceneOutline): SceneOutline {
  return {
    ...outline,
    type: 'slide',
    description: `${outline.description || outline.title}\n\nPresent the original ${outline.type} activity as a regular 天空课堂 classroom slide. Keep the key idea visual, concrete, and lesson-ready.`,
    quizConfig: undefined,
    interactiveConfig: undefined,
    pblConfig: undefined,
    widgetType: undefined,
    widgetOutline: undefined,
  };
}

async function generateSceneContentWithSlideFallback(
  outline: SceneOutline,
  aiCall: AICallFn,
  options: SceneContentOptions,
): Promise<{ outline: SceneOutline; content: GeneratedSceneContent } | null> {
  try {
    const content = await generateSceneContent(outline, aiCall, options);
    if (content) return { outline, content };
  } catch (err) {
    log.error(`Scene "${outline.title}" content generation error:`, err);
  }

  if (outline.type === 'slide') {
    return null;
  }

  const fallbackOutline = createSlideFallbackOutline(outline);
  log.warn(
    `Scene "${outline.title}" (${outline.type}) content generation failed; retrying as 天空课堂 slide.`,
  );

  try {
    const fallbackContent = await generateSceneContent(fallbackOutline, aiCall, options);
    if (fallbackContent) {
      return { outline: fallbackOutline, content: fallbackContent };
    }
  } catch (err) {
    log.error(`Scene "${outline.title}" slide fallback generation error:`, err);
  }

  return null;
}

function isGeneratedSlideContent(content: unknown): content is GeneratedSlideContent {
  return (
    typeof content === 'object' &&
    content !== null &&
    Array.isArray((content as GeneratedSlideContent).elements)
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function compactText(text: string | undefined, fallback: string, maxLength = 64): string {
  const cleaned = (text || fallback).replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, Math.max(0, maxLength - 1))}…`;
}

function buildSlideQARepairDirective(
  outline: SceneOutline,
  issues: ClassroomSlideQAIssue[],
): string {
  const issueDetails = issues
    .map((issue, index) => {
      const element = issue.elementId ? ` element=${issue.elementId}` : '';
      return `${index + 1}. ${issue.type}${element}: ${issue.detail}`;
    })
    .join('\n');
  const deckDiversityDirective = issues.some((issue) => issue.type === 'repeated_layout_signature')
    ? `

Deck diversity repair rules:
- Do not reuse the same main composition, card grid, table position, or title/body coordinate rhythm from the failed slide.
- Change the main element coordinates: move the visual anchor to a different side/row, change the card/table structure, and alter the background rhythm.
- Prefer a different visual anchor for this page: flow, command diagram, comparison band, formula stage, or structure diagram.
- This is a deck-level failure, so a page that only changes wording but keeps the same layout still fails.`
    : '';

  return `这页幻灯片没有通过天空课堂课堂级 QA，请基于当前页完整重做，而不是只改动少数地方。主题：${outline.title}

失败项：
${issueDetails}
${deckDiversityDirective}

必须满足：
- 所有可见文字以简体中文为主，Redis、String、List、Hash 等技术词只能放在中文句子里。
- 不要使用“要点一 / Step 1 / 核心功能”等占位标题，标题必须和本页知识点直接相关。
- 至少给出 4 个具体教学单元：使用场景、关键命令或步骤、易错点、课堂总结。
- 使用蓝白清爽风格；不要使用橙色横条、橙色竖条、角标条纹或无关装饰。
- 不要让任何文字互相重叠，也不要超出安全区 left>=48, top>=48, right<=952, bottom<=514.5。
- 字号保持可读：标题约 30-34px，正文不低于 20px。
- 如果内容较少，合并信息块，不要留下大面积空白。`;
}

type ClassroomQASafeIntent =
  | 'string'
  | 'list'
  | 'hash'
  | 'set'
  | 'zset'
  | 'choice'
  | 'practice'
  | 'summary'
  | 'generic';

type ClassroomQASafeBlock = {
  label: string;
  body: string;
};

type ClassroomQASafeProfile = {
  intent: ClassroomQASafeIntent;
  accent: string;
  variant:
    | 'anchor-left'
    | 'top-table'
    | 'anchor-right'
    | 'split-bands'
    | 'bottom-table'
    | 'stack-left'
    | 'stack-right'
    | 'wide-bands'
    | 'center-table'
    | 'bottom-cards'
    | 'table-right-low'
    | 'table-left-low'
    | 'full-ladder';
  variantSeed?: number;
  blocks: ClassroomQASafeBlock[];
  tableRows: string[][];
};

const CLASSROOM_QA_SAFE_VARIANTS: ClassroomQASafeProfile['variant'][] = [
  'anchor-left',
  'top-table',
  'anchor-right',
  'split-bands',
  'bottom-table',
  'stack-left',
  'stack-right',
  'wide-bands',
  'center-table',
  'bottom-cards',
  'table-right-low',
  'table-left-low',
  'full-ladder',
];

function deriveGenericQASafeBlocks(
  outline: SceneOutline,
  title: string,
  description: string,
  keyPoints: string[],
): ClassroomQASafeBlock[] {
  const signal = [outline.title, outline.description, ...keyPoints].join(' ').toLowerCase();
  const primary = compactText(keyPoints[0], description, 24);
  const point = (index: number, fallback: string, maxLength = 52) =>
    compactText(keyPoints[index], fallback, maxLength);

  if (/\bredis\b|缓存|键值|数据结构|队列|排行榜|去重|过期/i.test(signal)) {
    return [
      { label: '结构选择', body: `场景：围绕“${primary}”先判断值、列表、字段还是排行。` },
      { label: '示例操作', body: '示例：SET cache:user:1 Tom，GET 返回 Tom，EXPIRE 设置过期。' },
      { label: '结果解释', body: '结果：说清 key、value、field、TTL 或 score 对应的业务含义。' },
      { label: '检查提醒', body: '注意不要只背名称，检查顺序、去重、过期和更新成本。' },
    ];
  }

  if (/\bsql\b|select|from|where|order\s+by|数据库|数据表|查询|字段|索引/i.test(signal)) {
    return [
      { label: '查询目标', body: `场景：从“${primary}”里找出要看的列、行和排序规则。` },
      {
        label: '语法示例',
        body: '示例：SELECT name, score FROM students WHERE score >= 60 ORDER BY score DESC。',
      },
      { label: '执行结果', body: '结果：FROM 找表，WHERE 过滤行，SELECT 取列，ORDER BY 排序。' },
      { label: '检查提醒', body: '注意字段名、表名和排序方向，避免只堆 SELECT 等关键词。' },
    ];
  }

  if (
    /并发|concurrent|thread|线程|process|进程|multiprocessing|async|asyncio|异步|gil/i.test(signal)
  ) {
    return [
      { label: '并发模型', body: description },
      { label: '适用场景', body: `场景：${point(0, '区分 I/O 密集、CPU 密集和事件循环任务。')}` },
      { label: '示例代码', body: '示例：for task in tasks 提交 I/O 任务，等待返回结果。' },
      { label: '检查提醒', body: '结果可重叠；注意 GIL、共享状态和异常回收。' },
    ];
  }

  if (
    /\bpython\b|javascript|typescript|java|变量|函数|循环|条件语句|代码|脚本|语法|print\s*\(|input\s*\(/i.test(
      signal,
    )
  ) {
    return [
      { label: '语法目标', body: `场景：围绕“${primary}”说明输入、判断和输出。` },
      { label: '代码示例', body: '示例：if score >= 60: print("通过")，条件成立才输出结果。' },
      { label: '结果解释', body: '结果：变量保存数据，条件决定路径，函数封装可复用步骤。' },
      { label: '检查提醒', body: '注意缩进、变量名和边界条件，避免只列关键词。' },
    ];
  }

  if (/\bapi\b|http|接口|请求|响应|json|状态码/i.test(signal)) {
    return [
      { label: '接口场景', body: `场景：围绕“${primary}”说明谁请求、传什么、返回什么。` },
      { label: '请求示例', body: '示例：GET /api/users?role=student 返回学生列表 JSON。' },
      { label: '结果解释', body: '结果：状态码说明成功或失败，响应体承载业务数据。' },
      { label: '检查提醒', body: '注意鉴权、参数校验和错误码，避免只画接口框。' },
    ];
  }

  if (/项目|实践|实战|练习|下载|download|project|pbl|动手|实现/i.test(signal)) {
    return [
      { label: '项目目标', body: description },
      { label: '实现步骤', body: point(0, '把任务拆成输入、处理、输出三步完成。') },
      { label: '关键风险', body: point(1, '检查边界条件、失败重试和资源释放。') },
      { label: '验收标准', body: point(2, `完成后能运行并解释“${title}”的结果。`) },
    ];
  }

  if (/总结|回顾|扩展|复盘|summary|review|next/i.test(signal)) {
    return [
      { label: '知识回顾', body: point(0, description) },
      { label: '对比结论', body: point(1, '把本课多个概念放在同一张判断表里比较。') },
      { label: '迁移建议', body: point(2, '换一个真实任务检查这些方法是否仍然成立。') },
      { label: '下一步', body: point(3, `围绕“${title}”继续做练习或阅读扩展资料。`) },
    ];
  }

  if (/安装|环境|配置|setup|install|运行环境|开发环境/i.test(signal)) {
    return [
      { label: '准备目标', body: description },
      { label: '安装步骤', body: point(0, '下载工具并按课程要求完成安装配置。') },
      { label: '验证命令', body: point(1, '用版本检查或最小示例确认环境可用。') },
      { label: '常见问题', body: point(2, '记录路径、权限和依赖版本带来的错误。') },
    ];
  }

  const fallbackLabels = ['学习目标', '关键方法', '课堂例题', '检查任务'];
  const labels = keyPoints.slice(0, 4).map((value, index) => {
    const cleaned = value
      .replace(/<[^>]+>/g, '')
      .replace(/[：:，,。；;].*$/g, '')
      .replace(/[（(].*?[）)]/g, '')
      .trim();
    const fallback = fallbackLabels[index];
    if (/[a-zA-Z]{3,}/.test(cleaned)) return fallback;
    return compactText(cleaned, fallback, 8);
  });

  return [
    { label: labels[0] ?? '学习目标', body: point(0, description) },
    { label: labels[1] ?? '关键方法', body: point(1, '说明本页概念如何运行或如何判断。') },
    { label: labels[2] ?? '课堂例题', body: point(2, `用一个小例子验证“${title}”。`) },
    { label: labels[3] ?? '检查任务', body: point(3, `学完后能解释“${title}”的用途和边界。`) },
  ];
}

function withDeckDiversitySafeVariant(
  profile: ClassroomQASafeProfile,
  outline: SceneOutline,
  issues: ClassroomSlideQAIssue[],
): ClassroomQASafeProfile {
  if (!issues.some((issue) => issue.type === 'repeated_layout_signature')) return profile;

  const index = Math.max(0, Math.floor(outline.order || 1) - 1) % CLASSROOM_QA_SAFE_VARIANTS.length;
  return {
    ...profile,
    variant: CLASSROOM_QA_SAFE_VARIANTS[index],
    variantSeed: index,
  };
}

function classifyClassroomQASafeIntent(outline: SceneOutline): ClassroomQASafeIntent {
  const signal = [outline.title, outline.description, ...(outline.keyPoints ?? [])]
    .join(' ')
    .toLowerCase();

  if (/sorted\s*set|zset|有序集合|排行榜|排行|权重|分数/.test(signal)) return 'zset';
  if (/string|字符串|键值|计数器|验证码/.test(signal)) return 'string';
  if (/list|列表|队列|时间线|两端/.test(signal)) return 'list';
  if (/hash|哈希|散列|对象|字段/.test(signal)) return 'hash';
  if (/(^|[^a-z])set([^a-z]|$)|集合|去重|标签|交集|并集/.test(signal)) return 'set';
  if (/选择|怎么选|如何选|选型|指南|对比/.test(signal)) return 'choice';
  if (/最佳实践|实践|规范|注意|避坑|进阶|优化/.test(signal)) return 'practice';
  if (/总结|关键要点|回顾|复盘|收束/.test(signal)) return 'summary';
  return 'generic';
}

function createClassroomQASafeProfile(outline: SceneOutline): ClassroomQASafeProfile {
  const outlineSignal = [outline.title, outline.description, ...(outline.keyPoints ?? [])].join(
    ' ',
  );
  const intent = /\bredis\b/i.test(outlineSignal)
    ? classifyClassroomQASafeIntent(outline)
    : 'generic';
  const title = compactText(outline.title, '课堂重点', 36);
  const description = compactText(outline.description, title, 42);
  const keyPoints = outline.keyPoints?.filter((point) => point.trim().length > 0) ?? [];
  const primary = compactText(keyPoints[0], description, 24);
  const secondary = compactText(keyPoints[1], title, 24);

  const commonRows = [
    ['判断项', '课堂落点'],
    ['先看对象', primary],
    ['再看操作', secondary],
    ['最后验证', '用一个例子说清输入、处理和结果'],
  ];

  const profiles: Record<ClassroomQASafeIntent, ClassroomQASafeProfile> = {
    string: {
      intent,
      accent: '#2563eb',
      variant: 'anchor-left',
      blocks: [
        { label: '键值模型', body: '一个 key 对应一个值，适合缓存配置、验证码和状态标记。' },
        { label: '典型命令', body: 'SET 写入、GET 读取、INCR 计数，EXPIRE 控制有效期。' },
        { label: '适合场景', body: `本页关注“${primary}”，先确认值是否足够简单。` },
        { label: '避坑提醒', body: '字段很多的对象不要硬塞进 String，可改用 Hash 做局部更新。' },
      ],
      tableRows: [
        ['判断项', 'String 讲解线索'],
        ['数据形态', '单值、计数或短文本'],
        ['操作重点', '读写、递增、过期时间'],
        ['课堂产出', '说清 key、value 和 TTL'],
      ],
    },
    list: {
      intent,
      accent: '#0ea5e9',
      variant: 'top-table',
      blocks: [
        { label: '顺序结构', body: 'List 保留插入顺序，适合队列、时间线和最近记录。' },
        { label: '两端操作', body: 'LPUSH、RPUSH、LPOP、RPOP 对应入队和出队过程。' },
        { label: '场景判断', body: `当重点是“${primary}”时，要说明顺序为什么重要。` },
        { label: '长度控制', body: '配合裁剪或分页，避免列表无限增长影响读取效率。' },
      ],
      tableRows: [
        ['判断项', 'List 讲解线索'],
        ['数据形态', '按顺序排列的一串元素'],
        ['操作重点', '左进右出、右进左出'],
        ['课堂产出', '能画出队列流向'],
      ],
    },
    hash: {
      intent,
      accent: '#1d4ed8',
      variant: 'split-bands',
      blocks: [
        { label: '对象字段', body: 'Hash 把一个对象拆成多个字段，适合资料、配置和状态集合。' },
        { label: '局部更新', body: 'HSET、HGET、HDEL 可以只改某个字段，避免整对象重写。' },
        { label: '资料场景', body: `围绕“${primary}”说明字段名、字段值和对象 key 的关系。` },
        { label: '命名提醒', body: '字段命名保持稳定，避免同一对象里混入多套含义。' },
      ],
      tableRows: [
        ['判断项', 'Hash 讲解线索'],
        ['数据形态', '对象和字段集合'],
        ['操作重点', '字段读写和局部删除'],
        ['课堂产出', '能拆出对象 key 与字段'],
      ],
    },
    set: {
      intent,
      accent: '#0284c7',
      variant: 'anchor-left',
      blocks: [
        { label: '自动去重', body: 'Set 天然不保存重复成员，适合标签、黑名单和唯一集合。' },
        { label: '集合运算', body: '交集、并集、差集能表达共同好友、共同标签等关系。' },
        { label: '无序提醒', body: `讲“${primary}”时要提醒学生不要依赖成员顺序。` },
        { label: '结果验证', body: '用是否存在、是否重复、集合关系三步检查选择是否正确。' },
      ],
      tableRows: [
        ['判断项', 'Set 讲解线索'],
        ['数据形态', '无序且不重复的成员'],
        ['操作重点', '去重、存在判断、集合运算'],
        ['课堂产出', '能解释为什么不需要顺序'],
      ],
    },
    zset: {
      intent,
      accent: '#4f46e5',
      variant: 'anchor-right',
      blocks: [
        { label: '分数排序', body: '每个成员带一个 score，Redis 按分数维护有序结果。' },
        { label: '范围查询', body: 'ZADD 写入分数，ZRANGE 或 ZREVRANGE 取排名区间。' },
        { label: '排行场景', body: `本页的“${primary}”要落到榜单、热度或优先级例子。` },
        { label: '更新提醒', body: '分数变化要同步更新，否则排名结果会和业务状态不一致。' },
      ],
      tableRows: [
        ['判断项', 'Sorted Set 讲解线索'],
        ['数据形态', '成员加分数'],
        ['操作重点', '写分数、取区间、查排名'],
        ['课堂产出', '能解释排行榜为什么要 score'],
      ],
    },
    choice: {
      intent,
      accent: '#0369a1',
      variant: 'top-table',
      blocks: [
        { label: '读写模式', body: '先判断读多写少、频繁更新还是需要范围查询。' },
        { label: '排序需求', body: '需要排名或时间顺序时，优先比较 List 与 Sorted Set。' },
        { label: '去重需求', body: '需要唯一成员或集合关系时，Set 比列表更合适。' },
        { label: '对象字段', body: '需要局部更新对象属性时，Hash 通常比 String 更清楚。' },
      ],
      tableRows: commonRows,
    },
    practice: {
      intent,
      accent: '#1e40af',
      variant: 'split-bands',
      blocks: [
        { label: '命名规范', body: 'key 要体现业务、对象和粒度，方便排查和迁移。' },
        { label: '过期策略', body: '缓存类数据要说明 TTL，长期数据要说明清理办法。' },
        { label: '数据规模', body: '估算成员数量和读写频率，避免小例子放大后失控。' },
        { label: '监控排查', body: '把慢查询、内存增长和命中率作为课堂延伸检查点。' },
      ],
      tableRows: commonRows,
    },
    summary: {
      intent,
      accent: '#075985',
      variant: 'anchor-right',
      blocks: [
        { label: '选择原则', body: '从数据形态、访问方式和结果需求三步回顾结构选择。' },
        { label: '命令线索', body: '每种结构至少对应一组高频命令，帮助学生形成操作记忆。' },
        { label: '常见误区', body: '不要只背名称，要说清它解决了哪类业务问题。' },
        { label: '迁移项目', body: '把课堂例子替换成真实需求，检查结构选择是否仍然成立。' },
      ],
      tableRows: commonRows,
    },
    generic: {
      intent,
      accent: '#2563eb',
      variant: 'split-bands',
      blocks: deriveGenericQASafeBlocks(outline, title, description, keyPoints),
      tableRows: commonRows,
    },
  };

  return profiles[intent];
}

function createQASafeTextElement(
  id: string,
  text: string,
  left: number,
  top: number,
  width: number,
  height: number,
  fontSize: number,
  color: string,
): GeneratedSlideContent['elements'][number] {
  return {
    id,
    type: 'text',
    left,
    top,
    width,
    height,
    rotate: 0,
    defaultFontName: CLASSROOM_QA_SAFE_FONT,
    defaultColor: color,
    content: `<p style="font-size:${fontSize}px;line-height:1.25;font-family:${CLASSROOM_QA_SAFE_FONT};">${escapeHtml(text)}</p>`,
  } as GeneratedSlideContent['elements'][number];
}

function createQASafeTableElement(
  id: string,
  left: number,
  top: number,
  width: number,
  height: number,
  rows: string[][],
  accent: string,
): GeneratedSlideContent['elements'][number] {
  const safeHeight = Math.max(height, rows.length * CLASSROOM_QA_SAFE_TABLE_ROW_HEIGHT);
  return {
    id,
    type: 'table',
    left,
    top,
    width,
    height: safeHeight,
    rotate: 0,
    outline: { color: '#cfe0f5', width: 1, style: 'solid' },
    theme: { color: accent, rowHeader: true, rowFooter: false, colHeader: false, colFooter: false },
    colWidths: [0.34, 0.66],
    cellMinHeight: Math.floor(safeHeight / Math.max(1, rows.length)),
    data: rows.map((row, rowIndex) =>
      row.map((text, cellIndex) => ({
        id: `${id}_r${rowIndex}_c${cellIndex}`,
        colspan: 1,
        rowspan: 1,
        text,
        style: {
          bold: rowIndex === 0 || cellIndex === 0,
          color: rowIndex === 0 || cellIndex === 0 ? '#0f172a' : '#1e293b',
          backcolor: rowIndex === 0 ? '#eaf4ff' : '#ffffff',
          fontsize: rowIndex === 0 ? '18' : '17',
          fontname: CLASSROOM_QA_SAFE_FONT,
          align: 'left',
        },
      })),
    ),
  } as GeneratedSlideContent['elements'][number];
}

function createQASafeShapeElement(
  id: string,
  left: number,
  top: number,
  width: number,
  height: number,
  fill: string,
  opacity = 1,
  outlineColor = '#d8e8f8',
): GeneratedSlideContent['elements'][number] {
  return {
    id,
    type: 'shape',
    left,
    top,
    width,
    height,
    rotate: 0,
    path: 'M 0 0 L 1 0 L 1 1 L 0 1 Z',
    viewBox: '0 0 1 1',
    fixedRatio: false,
    fill,
    opacity,
    outline: { color: outlineColor, width: 1, style: 'solid' },
  } as GeneratedSlideContent['elements'][number];
}

function createQASafeBlockElement(
  outlineId: string,
  block: ClassroomQASafeBlock,
  index: number,
  left: number,
  top: number,
  width: number,
  height: number,
): GeneratedSlideContent['elements'][number] {
  return createQASafeTextElement(
    `classroom_qa_safe_block_${outlineId}_${index}`,
    `${block.label}：${block.body}`,
    left,
    top,
    width,
    Math.max(height, CLASSROOM_QA_SAFE_MIN_BLOCK_HEIGHT),
    CLASSROOM_QA_SAFE_BLOCK_FONT_SIZE,
    '#1e293b',
  );
}

function addQASafeVisualPolish(
  outline: SceneOutline,
  elements: GeneratedSlideContent['elements'],
  profile: ClassroomQASafeProfile,
): GeneratedSlideContent['elements'] {
  const blockElements = elements.filter(isQASafeTextBlockElement);
  const blockCards = blockElements.map((element, index) =>
    createQASafeShapeElement(
      `classroom_qa_safe_card_${outline.id}_${index}`,
      Math.max(58, element.left - 14),
      Math.max(128, element.top - 8),
      element.width + 28,
      element.height + 16,
      index % 2 === 0 ? '#ffffff' : '#f3f9ff',
      0.96,
      '#dbeafe',
    ),
  );
  const blockAccents = blockElements.map((element, index) =>
    createQASafeShapeElement(
      `classroom_qa_safe_accent_${outline.id}_${index}`,
      Math.max(60, element.left - 14),
      element.top + 12,
      4,
      Math.max(42, element.height - 24),
      index % 2 === 0 ? profile.accent : '#0ea5e9',
      0.8,
      index % 2 === 0 ? profile.accent : '#0ea5e9',
    ),
  );

  return [
    createQASafeShapeElement(
      `classroom_qa_safe_title_rule_${outline.id}`,
      72,
      126,
      230,
      4,
      profile.accent,
      0.9,
      profile.accent,
    ),
    createQASafeShapeElement(
      `classroom_qa_safe_title_rule_soft_${outline.id}`,
      318,
      126,
      420,
      2,
      '#dbeafe',
      0.7,
      '#dbeafe',
    ),
    ...blockCards,
    ...blockAccents,
    ...elements,
  ];
}

function createQASafeLayoutElements(
  outline: SceneOutline,
  title: string,
  profile: ClassroomQASafeProfile,
): GeneratedSlideContent['elements'] {
  const elements: GeneratedSlideContent['elements'] = [
    createQASafeTextElement(
      `classroom_qa_safe_title_${outline.id}`,
      `本页主题：${title}`,
      72,
      58,
      856,
      56,
      32,
      '#0f172a',
    ),
  ];

  if (profile.variant === 'anchor-left') {
    elements.push(
      createQASafeTableElement(
        `classroom_qa_safe_table_${outline.id}`,
        82,
        142,
        348,
        250,
        profile.tableRows,
        profile.accent,
      ),
    );
    profile.blocks.forEach((block, index) => {
      elements.push(
        createQASafeBlockElement(outline.id, block, index, 470, 142 + index * 90, 448, 84),
      );
    });
    return addQASafeVisualPolish(outline, elements, profile);
  }

  if (profile.variant === 'top-table') {
    elements.push(
      createQASafeTableElement(
        `classroom_qa_safe_table_${outline.id}`,
        82,
        136,
        836,
        176,
        profile.tableRows,
        profile.accent,
      ),
    );
    profile.blocks.forEach((block, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      elements.push(
        createQASafeBlockElement(
          outline.id,
          block,
          index,
          col === 0 ? 82 : 520,
          row === 0 ? 330 : 422,
          398,
          84,
        ),
      );
    });
    return addQASafeVisualPolish(outline, elements, profile);
  }

  if (profile.variant === 'anchor-right') {
    profile.blocks.forEach((block, index) => {
      elements.push(
        createQASafeBlockElement(outline.id, block, index, 82, 142 + index * 90, 420, 84),
      );
    });
    elements.push(
      createQASafeTableElement(
        `classroom_qa_safe_table_${outline.id}`,
        548,
        150,
        370,
        250,
        profile.tableRows,
        profile.accent,
      ),
    );
    return addQASafeVisualPolish(outline, elements, profile);
  }

  if (profile.variant === 'bottom-table') {
    profile.blocks.forEach((block, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      elements.push(
        createQASafeBlockElement(
          outline.id,
          block,
          index,
          col === 0 ? 82 : 520,
          row === 0 ? 142 : 236,
          398,
          84,
        ),
      );
    });
    elements.push(
      createQASafeTableElement(
        `classroom_qa_safe_table_${outline.id}`,
        82,
        334,
        836,
        176,
        profile.tableRows,
        profile.accent,
      ),
    );
    return addQASafeVisualPolish(outline, elements, profile);
  }

  if (profile.variant === 'stack-left') {
    elements.push(
      createQASafeTableElement(
        `classroom_qa_safe_table_${outline.id}`,
        82,
        148,
        286,
        286,
        profile.tableRows,
        profile.accent,
      ),
    );
    profile.blocks.forEach((block, index) => {
      elements.push(
        createQASafeBlockElement(outline.id, block, index, 410, 142 + index * 90, 508, 84),
      );
    });
    return addQASafeVisualPolish(outline, elements, profile);
  }

  if (profile.variant === 'stack-right') {
    profile.blocks.forEach((block, index) => {
      elements.push(
        createQASafeBlockElement(outline.id, block, index, 82, 142 + index * 90, 500, 84),
      );
    });
    elements.push(
      createQASafeTableElement(
        `classroom_qa_safe_table_${outline.id}`,
        628,
        152,
        290,
        286,
        profile.tableRows,
        profile.accent,
      ),
    );
    return addQASafeVisualPolish(outline, elements, profile);
  }

  if (profile.variant === 'wide-bands') {
    profile.blocks.forEach((block, index) => {
      elements.push(
        createQASafeBlockElement(outline.id, block, index, 82, 136 + index * 90, 836, 84),
      );
    });
    return addQASafeVisualPolish(outline, elements, profile);
  }

  if (profile.variant === 'center-table') {
    profile.blocks.slice(0, 2).forEach((block, index) => {
      elements.push(
        createQASafeBlockElement(outline.id, block, index, index === 0 ? 82 : 528, 136, 390, 84),
      );
    });
    elements.push(
      createQASafeTableElement(
        `classroom_qa_safe_table_${outline.id}`,
        194,
        230,
        612,
        168,
        profile.tableRows,
        profile.accent,
      ),
    );
    profile.blocks.slice(2).forEach((block, index) => {
      elements.push(
        createQASafeBlockElement(
          outline.id,
          block,
          index + 2,
          index === 0 ? 82 : 528,
          414,
          390,
          84,
        ),
      );
    });
    return addQASafeVisualPolish(outline, elements, profile);
  }

  if (profile.variant === 'bottom-cards') {
    elements.push(
      createQASafeTableElement(
        `classroom_qa_safe_table_${outline.id}`,
        82,
        142,
        376,
        246,
        profile.tableRows,
        profile.accent,
      ),
    );
    profile.blocks.slice(0, 3).forEach((block, index) => {
      elements.push(
        createQASafeBlockElement(outline.id, block, index, 500, 142 + index * 90, 418, 84),
      );
    });
    elements.push(createQASafeBlockElement(outline.id, profile.blocks[3], 3, 82, 414, 836, 84));
    return addQASafeVisualPolish(outline, elements, profile);
  }

  if (profile.variant === 'table-right-low') {
    profile.blocks.forEach((block, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      elements.push(
        createQASafeBlockElement(
          outline.id,
          block,
          index,
          col === 0 ? 82 : 520,
          row === 0 ? 142 : 236,
          398,
          84,
        ),
      );
    });
    elements.push(
      createQASafeTableElement(
        `classroom_qa_safe_table_${outline.id}`,
        330,
        326,
        588,
        176,
        profile.tableRows,
        profile.accent,
      ),
    );
    return addQASafeVisualPolish(outline, elements, profile);
  }

  if (profile.variant === 'table-left-low') {
    profile.blocks.forEach((block, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      elements.push(
        createQASafeBlockElement(
          outline.id,
          block,
          index,
          col === 0 ? 82 : 520,
          row === 0 ? 142 : 236,
          398,
          84,
        ),
      );
    });
    elements.push(
      createQASafeTableElement(
        `classroom_qa_safe_table_${outline.id}`,
        82,
        326,
        560,
        176,
        profile.tableRows,
        profile.accent,
      ),
    );
    return addQASafeVisualPolish(outline, elements, profile);
  }

  if (profile.variant === 'full-ladder') {
    profile.blocks.forEach((block, index) => {
      elements.push(
        createQASafeBlockElement(outline.id, block, index, 82, 136 + index * 90, 836, 84),
      );
    });
    return addQASafeVisualPolish(outline, elements, profile);
  }

  elements.push(
    createQASafeTableElement(
      `classroom_qa_safe_table_${outline.id}`,
      82,
      148,
      376,
      286,
      profile.tableRows,
      profile.accent,
    ),
  );
  profile.blocks.forEach((block, index) => {
    elements.push(
      createQASafeBlockElement(outline.id, block, index, 500, 142 + index * 90, 418, 84),
    );
  });
  return addQASafeVisualPolish(outline, elements, profile);
}

function createClassroomQASafeSlideContent(
  outline: SceneOutline,
  issues: ClassroomSlideQAIssue[],
  options?: {
    variantOverride?: ClassroomQASafeProfile['variant'];
  },
): GeneratedSlideContent {
  const title = compactText(outline.title, '课堂重点', 42);
  const issueTypes = [...new Set(issues.map((issue) => issue.type))].join('、') || '版面问题';
  const baseProfile = withDeckDiversitySafeVariant(
    createClassroomQASafeProfile(outline),
    outline,
    issues,
  );
  const profile = options?.variantOverride
    ? { ...baseProfile, variant: options.variantOverride }
    : baseProfile;

  return {
    background: { type: 'solid', color: '#f7fbff' },
    remark: `QA safe fallback for ${outline.title}. Previous blocking issues: ${issueTypes}.`,
    elements: createQASafeLayoutElements(outline, title, profile),
  };
}

function groupBlockingSlideQAIssuesByScene(
  report: ClassroomSlideQAReport,
): Map<string, ClassroomSlideQAIssue[]> {
  const grouped = new Map<string, ClassroomSlideQAIssue[]>();
  for (const issue of report.issues) {
    if (issue.severity !== 'blocking') continue;
    grouped.set(issue.sceneId, [...(grouped.get(issue.sceneId) ?? []), issue]);
  }
  return grouped;
}

function doesIssueTargetResult(
  issue: ClassroomSlideQAIssue,
  result: GeneratedSceneContentResult,
): boolean {
  return (
    issue.sceneId === result.outline.id ||
    issue.sceneTitle === result.outline.title ||
    issue.order === result.outline.order
  );
}

function getBlockingIssuesForResult(
  result: GeneratedSceneContentResult,
  issuesByScene: Map<string, ClassroomSlideQAIssue[]>,
  blockingIssues: ClassroomSlideQAIssue[],
): ClassroomSlideQAIssue[] {
  const byId = issuesByScene.get(result.outline.id);
  if (byId && byId.length > 0) return byId;
  return blockingIssues.filter((issue) => doesIssueTargetResult(issue, result));
}

function getQASafeFallbackVariantOrder(
  outline: SceneOutline,
  issues: ClassroomSlideQAIssue[],
): ClassroomQASafeProfile['variant'][] {
  const baseIndex =
    Math.max(0, Math.floor(outline.order || 1) - 1) % CLASSROOM_QA_SAFE_VARIANTS.length;
  const rotated = [
    ...CLASSROOM_QA_SAFE_VARIANTS.slice(baseIndex),
    ...CLASSROOM_QA_SAFE_VARIANTS.slice(0, baseIndex),
  ];

  if (!issues.some((issue) => issue.type === 'repeated_layout_signature')) {
    return rotated;
  }

  // For repeated deck layouts, try the most structurally different safe
  // variants early instead of only relying on scene order.
  const diversityFirst: ClassroomQASafeProfile['variant'][] = [
    'full-ladder',
    'center-table',
    'stack-left',
    'stack-right',
    'bottom-cards',
    'table-right-low',
    'table-left-low',
  ];
  return [...new Set([...diversityFirst, ...rotated])];
}

function replaceBlockingSlidesWithQASafeFallback(
  contentResults: Array<GeneratedSceneContentResult | null>,
  report: ClassroomSlideQAReport,
): {
  contentResults: Array<GeneratedSceneContentResult | null>;
  replacementCount: number;
} {
  const issuesByScene = groupBlockingSlideQAIssuesByScene(report);
  const blockingIssues = report.issues.filter((issue) => issue.severity === 'blocking');
  if (blockingIssues.length === 0) return { contentResults, replacementCount: 0 };

  const nextResults = [...contentResults];
  let replacementCount = 0;
  for (let index = 0; index < nextResults.length; index += 1) {
    const result = nextResults[index];
    if (!result || result.outline.type !== 'slide' || !isGeneratedSlideContent(result.content)) {
      continue;
    }

    const issues = getBlockingIssuesForResult(result, issuesByScene, blockingIssues);
    if (!issues || issues.length === 0) continue;

    let bestCandidate = nextResults;
    let bestBlockingCount = Number.POSITIVE_INFINITY;
    let replaced = false;

    for (const variant of getQASafeFallbackVariantOrder(result.outline, issues)) {
      const safeContent = createClassroomQASafeSlideContent(result.outline, issues, {
        variantOverride: variant,
      });
      const safeQa = auditGeneratedSlideContent(safeContent);
      const candidateResults = [...nextResults];
      candidateResults[index] = {
        ...result,
        content: { ...safeContent, qa: safeQa },
      };
      const candidateReport = auditClassroomSlideContents(candidateResults);
      const candidateSceneStillBlocked = candidateReport.issues.some(
        (issue) => issue.severity === 'blocking' && doesIssueTargetResult(issue, result),
      );

      if (candidateReport.blockingIssueCount < bestBlockingCount) {
        bestCandidate = candidateResults;
        bestBlockingCount = candidateReport.blockingIssueCount;
      }

      if (!candidateSceneStillBlocked) {
        nextResults.splice(0, nextResults.length, ...candidateResults);
        replacementCount += 1;
        replaced = true;
        break;
      }
    }

    if (!replaced && bestCandidate !== nextResults) {
      nextResults.splice(0, nextResults.length, ...bestCandidate);
      replacementCount += 1;
    }
  }

  return { contentResults: nextResults, replacementCount };
}

async function reviewAndRepairClassroomSlideQA(
  contentResults: Array<GeneratedSceneContentResult | null>,
  aiCall: AICallFn,
  options: {
    sceneContentOptions: SceneContentOptions;
    onProgress?: ProgressReporter;
    totalScenes: number;
    concurrency: number;
  },
): Promise<{
  contentResults: Array<GeneratedSceneContentResult | null>;
  slideQaReport: ClassroomSlideQAReport;
}> {
  let slideQaReport = auditClassroomSlideContents(contentResults);
  if (slideQaReport.pass) {
    return { contentResults, slideQaReport };
  }

  const initialMessage = formatClassroomSlideQAError(slideQaReport);
  log.warn(`${initialMessage}; attempting classroom-level slide repair.`);

  const blockingIssues = slideQaReport.issues.filter((issue) => issue.severity === 'blocking');
  const blockingSceneIds = new Set(blockingIssues.map((issue) => issue.sceneId));
  const repairTargets = contentResults
    .map((result, resultIndex) => ({ result, resultIndex }))
    .filter(
      (entry): entry is { result: GeneratedSceneContentResult; resultIndex: number } =>
        !!entry.result &&
        entry.result.outline.type === 'slide' &&
        blockingSceneIds.has(entry.result.outline.id) &&
        isGeneratedSlideContent(entry.result.content),
    );

  if (repairTargets.length === 0) {
    return { contentResults, slideQaReport };
  }

  await options.onProgress?.({
    step: 'qa_reviewing',
    progress: SCENE_PROGRESS_CONTENT_DONE + 1,
    message: `Repairing ${repairTargets.length} slide layout/content issue(s)`,
    scenesGenerated: 0,
    totalScenes: options.totalScenes,
  });

  const repairedEntries = await pMap(
    repairTargets,
    async ({ result, resultIndex }) => {
      const issues = blockingIssues.filter((issue) => issue.sceneId === result.outline.id);
      const baselineContent = result.content as GeneratedSlideContent;
      const editDirective = buildSlideQARepairDirective(result.outline, issues);
      const requiresDeckDiversityReview = issues.some(
        (issue) => issue.type === 'repeated_layout_signature',
      );

      try {
        const regenerated = await generateSceneContentWithSlideFallback(result.outline, aiCall, {
          ...options.sceneContentOptions,
          editDirective,
          baselineContent,
        });

        if (regenerated && isGeneratedSlideContent(regenerated.content)) {
          const regeneratedQa = auditGeneratedSlideContent(regenerated.content);
          if (regeneratedQa.pass) {
            const candidateContent = { ...regenerated.content, qa: regeneratedQa };
            const candidateResults = [...contentResults];
            candidateResults[resultIndex] = {
              ...result,
              outline: regenerated.outline,
              content: candidateContent,
            };
            const candidateDeckQa = requiresDeckDiversityReview
              ? auditClassroomSlideContents(candidateResults)
              : null;
            const candidateSceneStillBlocked =
              candidateDeckQa?.issues.some(
                (issue) => issue.severity === 'blocking' && issue.sceneId === result.outline.id,
              ) ?? false;

            if (candidateSceneStillBlocked) {
              log.warn(
                `Classroom slide QA repair for "${result.outline.title}" still repeats a deck layout; using safe fallback layout.`,
              );
            } else {
              log.info(`Classroom slide QA repair succeeded for "${result.outline.title}"`);
              return {
                resultIndex,
                result: {
                  ...result,
                  outline: regenerated.outline,
                  content: candidateContent,
                },
              };
            }
          }

          if (!regeneratedQa.pass) {
            log.warn(
              `Classroom slide QA repair for "${result.outline.title}" still has ${regeneratedQa.blockingIssueCount} blocking issue(s); using safe fallback layout.`,
            );
          }
        }
      } catch (err) {
        log.warn(`Classroom slide QA repair generation failed for "${result.outline.title}":`, err);
      }

      const safeContent = createClassroomQASafeSlideContent(result.outline, issues);
      const safeQa = auditGeneratedSlideContent(safeContent);
      return {
        resultIndex,
        result: {
          ...result,
          content: { ...safeContent, qa: safeQa },
        },
      };
    },
    { concurrency: options.concurrency },
  );

  let repairedResults = [...contentResults];
  for (const entry of repairedEntries) {
    repairedResults[entry.resultIndex] = entry.result;
  }

  slideQaReport = auditClassroomSlideContents(repairedResults);
  if (!slideQaReport.pass) {
    const finalFallback = replaceBlockingSlidesWithQASafeFallback(repairedResults, slideQaReport);
    if (finalFallback.replacementCount > 0) {
      log.warn(
        `${formatClassroomSlideQAError(
          slideQaReport,
        )}; forcing ${finalFallback.replacementCount} remaining slide(s) into QA safe fallback layouts.`,
      );
      repairedResults = finalFallback.contentResults;
      slideQaReport = auditClassroomSlideContents(repairedResults);
    }
  }

  if (!slideQaReport.pass) {
    log.warn(formatClassroomSlideQAError(slideQaReport));
  }

  return { contentResults: repairedResults, slideQaReport };
}

function progressInRange(start: number, end: number, completed: number, total: number): number {
  const safeTotal = Math.max(total, 1);
  const next = start + Math.floor((Math.min(completed, safeTotal) / safeTotal) * (end - start));
  return Math.min(Math.max(next, start), end);
}

async function reportSceneProgress(
  onProgress: ProgressReporter | undefined,
  progress: number,
  message: string,
  scenesGenerated: number,
  totalScenes: number,
): Promise<void> {
  await onProgress?.({
    step: 'generating_scenes',
    progress,
    message,
    scenesGenerated,
    totalScenes,
  });
}

function createInMemoryStore(stage: Stage): StageStore {
  let state = {
    stage: stage as Stage | null,
    scenes: [] as Scene[],
    currentSceneId: null as string | null,
    mode: 'playback' as const,
  };

  const listeners: Array<(s: typeof state, prev: typeof state) => void> = [];

  return {
    getState: () => state,
    setState: (partial: Partial<typeof state>) => {
      const prev = state;
      state = { ...state, ...partial };
      listeners.forEach((fn) => fn(state, prev));
    },
    subscribe: (listener: (s: typeof state, prev: typeof state) => void) => {
      listeners.push(listener);
      return () => {
        const idx = listeners.indexOf(listener);
        if (idx >= 0) listeners.splice(idx, 1);
      };
    },
  };
}

export function generateTopicSummary(
  requirement: string,
  outlines: import('@/lib/types/generation').SceneOutline[],
): string {
  const outlineTitle = outlines.find((outline) => outline.title.trim().length > 0)?.title;
  const source = outlineTitle || requirement;
  return source.replace(/\s+/g, ' ').trim().slice(0, 40);
}

function stripCodeFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return cleaned.trim();
}

async function generateAgentProfiles(
  requirement: string,
  languageDirective: string,
  aiCall: AICallFn,
): Promise<AgentInfo[]> {
  const systemPrompt =
    'You are an expert instructional designer. Generate agent profiles for a multi-agent classroom simulation. Return ONLY valid JSON, no markdown or explanation.';

  const userPrompt = `Generate agent profiles for a course with this requirement:
${requirement}

Requirements:
- Decide the appropriate number of agents based on the course content (typically 3-5)
- Exactly 1 agent must have role "teacher", the rest can be "assistant" or "student"
- Each agent needs: name, role, persona (2-3 sentences describing personality and teaching/learning style)
- Language directive for this course: ${languageDirective}
  Agent names and personas must follow this language directive.

Return a JSON object with this exact structure:
{
  "agents": [
    {
      "name": "string",
      "role": "teacher" | "assistant" | "student",
      "persona": "string (2-3 sentences)"
    }
  ]
}`;

  const response = await aiCall(systemPrompt, userPrompt);
  const rawText = stripCodeFences(response);
  const parsed = JSON.parse(rawText) as {
    agents: Array<{ name: string; role: string; persona: string }>;
  };

  if (!parsed.agents || !Array.isArray(parsed.agents) || parsed.agents.length < 2) {
    throw new Error(`Expected at least 2 agents, got ${parsed.agents?.length ?? 0}`);
  }

  const teacherCount = parsed.agents.filter((a) => a.role === 'teacher').length;
  if (teacherCount !== 1) {
    throw new Error(`Expected exactly 1 teacher, got ${teacherCount}`);
  }

  return parsed.agents.map((a, i) => ({
    id: `gen-server-${i}`,
    name: a.name,
    role: a.role,
    persona: a.persona,
  }));
}

export async function generateClassroom(
  input: GenerateClassroomInput,
  options: {
    baseUrl: string;
    phase?: 'full' | 'outline_only';
    modelConfig?: {
      modelString?: string;
      apiKey?: string;
      baseUrl?: string;
    };
    onProgress?: (progress: ClassroomGenerationProgress) => Promise<void> | void;
  },
): Promise<GenerateClassroomResult | OutlineOnlyResult> {
  const phase = options.phase ?? 'full';
  const { requirement, pdfContent } = input;

  await options.onProgress?.({
    step: 'initializing',
    progress: 5,
    message: 'Initializing classroom generation',
    scenesGenerated: 0,
  });

  const {
    model: languageModel,
    modelInfo,
    modelString,
    providerId,
    apiKey,
    keyPool,
  } = await resolveModel(options.modelConfig ?? {});
  log.info(`Using server-configured model: ${modelString}`);

  // Register key pool for rotation (if multiple keys available)
  if (keyPool.length > 1) {
    keyRotator.register(providerId, keyPool);
    log.info(`Key rotation enabled for "${providerId}": ${keyPool.length} keys`);
  }

  const concurrency = resolveConcurrency(keyPool.length);
  log.info(`Generation concurrency: ${concurrency} (keys: ${keyPool.length})`);

  // Fail fast if the resolved provider has no API key configured
  if (isProviderKeyRequired(providerId) && !apiKey) {
    throw new Error(
      `No API key configured for provider "${providerId}". ` +
        `Set the appropriate key in .env.local or server-providers.yml (e.g. ${providerId.toUpperCase()}_API_KEY).`,
    );
  }

  const aiCall: AICallFn = async (systemPrompt, userPrompt, _images) => {
    const result = await callLLM(
      {
        model: languageModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        maxOutputTokens: modelInfo?.outputWindow,
      },
      'generate-classroom',
    );
    return result.text;
  };

  const searchQueryAiCall: AICallFn = async (systemPrompt, userPrompt, _images) => {
    const result = await callLLM(
      {
        model: languageModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        maxOutputTokens: 256,
      },
      'web-search-query-rewrite',
    );
    return result.text;
  };

  const requirements: UserRequirements = {
    requirement,
  };
  const pdfText = pdfContent?.text || undefined;

  await options.onProgress?.({
    step: 'researching',
    progress: 10,
    message: 'Researching topic',
    scenesGenerated: 0,
  });

  // Web search (optional, graceful degradation)
  let researchContext: string | undefined;
  if (input.enableWebSearch) {
    const webSearchConfig = resolveClassroomWebSearchConfig(input);
    if (webSearchConfig) {
      try {
        const searchQuery = await buildSearchQuery(requirement, pdfText, searchQueryAiCall);

        log.info('Running web search for classroom generation', {
          hasPdfContext: searchQuery.hasPdfContext,
          rawRequirementLength: searchQuery.rawRequirementLength,
          rewriteAttempted: searchQuery.rewriteAttempted,
          finalQueryLength: searchQuery.finalQueryLength,
        });

        const searchResult = await searchWeb({
          providerId: webSearchConfig.providerId,
          query: searchQuery.query,
          apiKey: webSearchConfig.apiKey,
          baseUrl: webSearchConfig.baseUrl,
          baiduSubSources: webSearchConfig.baiduSubSources,
        });
        researchContext = formatSearchResultsAsContext(searchResult);
        if (researchContext) {
          log.info(`Web search returned ${searchResult.sources.length} sources`);
        }
      } catch (e) {
        log.warn('Web search failed, continuing without search context:', e);
      }
    } else {
      log.warn('enableWebSearch is true but no web search API key configured, skipping web search');
    }
  }

  await options.onProgress?.({
    step: 'generating_outlines',
    progress: 15,
    message: 'Generating scene outlines',
    scenesGenerated: 0,
  });

  // Heartbeat: increment progress while LLM runs (can take 30-60s with no updates)
  let outlineProgress = 15;
  const heartbeat = options.onProgress
    ? setInterval(() => {
        outlineProgress = Math.min(outlineProgress + 2, 28);
        Promise.resolve(
          options.onProgress!({
            step: 'generating_outlines',
            progress: outlineProgress,
            message: 'AI is thinking...',
            scenesGenerated: 0,
          }),
        ).catch(() => {});
      }, 2000)
    : null;

  let outlinesResult;
  try {
    outlinesResult = await generateSceneOutlinesFromRequirements(
      requirements,
      pdfText,
      undefined,
      aiCall,
      undefined,
      {
        imageGenerationEnabled: input.enableImageGeneration,
        videoGenerationEnabled: input.enableVideoGeneration,
        researchContext,
        // NO teacherContext — agents haven't been generated yet
      },
    );
  } finally {
    if (heartbeat) clearInterval(heartbeat);
  }

  if (!outlinesResult.success || !outlinesResult.data) {
    log.error('Failed to generate outlines:', outlinesResult.error);
    throw new Error(outlinesResult.error || 'Failed to generate scene outlines');
  }

  const { languageDirective, outlines } = outlinesResult.data;
  log.info(`Generated ${outlines.length} scene outlines (languageDirective: ${languageDirective})`);
  const courseTheme = selectThemeForCourse(outlines);

  // Generate a short AI topic summary for display on progress cards
  const topicSummary = generateTopicSummary(requirement, outlines);
  log.info(`Topic summary: "${topicSummary}"`);

  await options.onProgress?.({
    step: 'generating_outlines',
    progress: 30,
    message: `Generated ${outlines.length} scene outlines`,
    scenesGenerated: 0,
    totalScenes: outlines.length,
  });

  // Resolve agents based on agentMode — now AFTER outlines so we can use languageDirective
  let agents: AgentInfo[];
  const agentMode = input.agentMode || 'default';
  if (agentMode === 'generate') {
    log.info('Generating custom agent profiles via LLM...');
    try {
      agents = await generateAgentProfiles(requirement, languageDirective, aiCall);
      log.info(`Generated ${agents.length} agent profiles`);
    } catch (e) {
      log.warn('Agent profile generation failed, falling back to defaults:', e);
      agents = getDefaultAgents();
    }
  } else {
    agents = getDefaultAgents();
  }

  const stageId = nanoid(10);
  const stage: Stage = {
    id: stageId,
    name: outlines[0]?.title || requirement.slice(0, 50),
    description: undefined,
    languageDirective,
    videoManifest: buildVideoManifestFromOutlines(outlines),
    style: 'interactive',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    // For LLM-generated agents, embed full configs so the client can
    // hydrate the agent registry without prior IndexedDB data.
    // For default agents, just record IDs — the client already has them.
    ...(agentMode === 'generate'
      ? {
          generatedAgentConfigs: agents.map((a, i) => ({
            id: a.id,
            name: a.name,
            role: a.role,
            persona: a.persona || '',
            avatar: AGENT_DEFAULT_AVATARS[i % AGENT_DEFAULT_AVATARS.length],
            color: AGENT_COLOR_PALETTE[i % AGENT_COLOR_PALETTE.length],
            priority: a.role === 'teacher' ? 10 : a.role === 'assistant' ? 7 : 5,
          })),
        }
      : {
          agentIds: agents.map((a) => a.id),
        }),
  };

  const store = createInMemoryStore(stage);
  const api = createStageAPI(store);

  // Phase 1 only: return outlines for review
  if (phase === 'outline_only') {
    log.info('Outline phase complete, returning outlines for review');
    return {
      outlines,
      languageDirective,
      topicSummary,
      agents,
      stage,
      requirement,
      pdfText,
      researchContext,
      enableImageGeneration: input.enableImageGeneration ?? false,
      enableVideoGeneration: input.enableVideoGeneration ?? false,
      enableTTS: input.enableTTS ?? false,
    };
  }

  log.info(
    `Stage 2: Generating ${outlines.length} scene(s) in parallel (concurrency=${concurrency})...`,
  );

  await reportSceneProgress(
    options.onProgress,
    SCENE_PROGRESS_INITIAL,
    `Generating ${outlines.length} scenes in parallel...`,
    0,
    outlines.length,
  );

  // Phase A: Generate all scene content in parallel
  let contentProcessed = 0;
  let contentResults = await pMap(
    outlines,
    async (outline, index) => {
      const safeOutline = applyOutlineFallbacks(outline, true);
      try {
        const result = await generateSceneContentWithSlideFallback(safeOutline, aiCall, {
          agents,
          languageDirective,
          themeSelection: courseTheme,
        });
        if (!result) {
          log.warn(`Skipping scene "${safeOutline.title}" — content generation failed`);
          return null;
        }
        return { ...result, index };
      } catch (err) {
        log.error(`Scene "${safeOutline.title}" content generation error:`, err);
        return null;
      } finally {
        contentProcessed += 1;
        await reportSceneProgress(
          options.onProgress,
          progressInRange(
            SCENE_PROGRESS_INITIAL,
            SCENE_PROGRESS_CONTENT_DONE,
            contentProcessed,
            outlines.length,
          ),
          `Generated scene content ${contentProcessed}/${outlines.length}`,
          0,
          outlines.length,
        );
      }
    },
    { concurrency },
  );

  const failedContentOutlines = contentResults
    .map((result, index) => (result ? null : outlines[index]))
    .filter((outline): outline is SceneOutline => outline !== null);
  if (failedContentOutlines.length > 0) {
    throw new Error(
      `天空课堂 classroom content generation failed for ${failedContentOutlines.length} scene(s): ${failedContentOutlines
        .map((outline) => outline.title)
        .join(', ')}`,
    );
  }

  await options.onProgress?.({
    step: 'qa_reviewing',
    progress: SCENE_PROGRESS_CONTENT_DONE,
    message: 'Checking generated slide layouts',
    scenesGenerated: 0,
    totalScenes: outlines.length,
  });
  const qaResult = await reviewAndRepairClassroomSlideQA(contentResults, aiCall, {
    sceneContentOptions: {
      agents,
      languageDirective,
      themeSelection: courseTheme,
    },
    onProgress: options.onProgress,
    totalScenes: outlines.length,
    concurrency,
  });
  contentResults = qaResult.contentResults;
  const slideQaReport = qaResult.slideQaReport;
  if (!slideQaReport.pass) {
    const message = formatClassroomSlideQAError(slideQaReport);
    throw new Error(message);
  }

  // Phase B: Generate all scene actions in parallel (content already available)
  let actionsProcessed = 0;
  const sceneResults = await pMap(
    contentResults,
    async (result) => {
      try {
        if (!result) return null;
        const actions = await generateSceneActions(result.outline, result.content, aiCall, {
          agents,
          languageDirective,
        });
        log.info(`Scene "${result.outline.title}": ${actions.length} actions`);
        return { outline: result.outline, content: result.content, actions, index: result.index };
      } catch (err) {
        log.error(`Scene "${result?.outline.title ?? 'unknown'}" action generation error:`, err);
        return null;
      } finally {
        actionsProcessed += 1;
        await reportSceneProgress(
          options.onProgress,
          progressInRange(
            SCENE_PROGRESS_CONTENT_DONE,
            SCENE_PROGRESS_ACTIONS_DONE,
            actionsProcessed,
            outlines.length,
          ),
          `Generated scene actions ${actionsProcessed}/${outlines.length}`,
          0,
          outlines.length,
        );
      }
    },
    { concurrency },
  );

  // Phase B: Write to store sequentially (fast, avoids race conditions)
  let generatedScenes = 0;
  for (const result of sceneResults) {
    if (!result) continue;
    const sceneId = createSceneWithActions(
      result.outline,
      result.content,
      result.actions,
      api,
      courseTheme,
    );
    if (!sceneId) {
      log.warn(`Skipping scene "${result.outline.title}" — scene creation failed`);
      continue;
    }
    generatedScenes += 1;
    await reportSceneProgress(
      options.onProgress,
      progressInRange(
        SCENE_PROGRESS_ACTIONS_DONE,
        SCENE_PROGRESS_CREATED_DONE,
        generatedScenes,
        outlines.length,
      ),
      `Generated ${generatedScenes}/${outlines.length} scenes`,
      generatedScenes,
      outlines.length,
    );
  }

  const scenes = store.getState().scenes;
  log.info(`Pipeline complete: ${scenes.length} scenes generated`);

  if (scenes.length === 0) {
    throw new Error('No scenes were generated');
  }

  // Persist immediately so the classroom is usable
  await options.onProgress?.({
    step: 'persisting',
    progress: 90,
    message: 'Persisting classroom data',
    scenesGenerated: scenes.length,
    totalScenes: outlines.length,
  });

  const persisted = await persistClassroom({ id: stageId, stage, scenes }, options.baseUrl);

  log.info(`Classroom persisted: ${persisted.id}, URL: ${persisted.url}`);

  // Fire-and-forget: media + TTS generation in background
  const needsMedia = input.enableImageGeneration || input.enableVideoGeneration;
  const needsTTS = input.enableTTS;

  if (needsMedia || needsTTS) {
    // Don't await — let it run in background after response is sent
    (async () => {
      let updated = false;

      if (needsMedia) {
        try {
          const mediaMap = await generateMediaForClassroom(outlines, stageId, options.baseUrl);
          replaceMediaPlaceholders(scenes, mediaMap);
          log.info(`Background media complete: ${Object.keys(mediaMap).length} files`);
          updated = true;
        } catch (err) {
          log.warn('Background media generation failed:', err);
        }
      }

      if (needsTTS) {
        try {
          await generateTTSForClassroom(scenes, stageId, options.baseUrl);
          log.info('Background TTS complete');
          updated = true;
        } catch (err) {
          log.warn('Background TTS generation failed:', err);
        }
      }

      // Re-persist with media/TTS URLs
      if (updated) {
        try {
          await persistClassroom({ id: stageId, stage, scenes }, options.baseUrl);
          log.info('Classroom re-persisted with media/TTS');
        } catch (err) {
          log.warn('Failed to re-persist after media/TTS:', err);
        }
      }
    })();
  }

  await options.onProgress?.({
    step: 'completed',
    progress: 100,
    message: 'Classroom generation completed',
    scenesGenerated: scenes.length,
    totalScenes: outlines.length,
  });

  return {
    id: persisted.id,
    url: persisted.url,
    stage,
    scenes,
    scenesCount: scenes.length,
    createdAt: persisted.createdAt,
    slideQaReport,
  };
}

export async function generateClassroomContinue(
  saved: OutlineOnlyResult,
  options: {
    baseUrl: string;
    modelConfig?: {
      modelString?: string;
      apiKey?: string;
      baseUrl?: string;
    };
    onProgress?: (progress: ClassroomGenerationProgress) => Promise<void> | void;
  },
): Promise<GenerateClassroomResult> {
  const { outlines, languageDirective, agents, stage } = saved;
  const courseTheme = selectThemeForCourse(outlines);

  const {
    model: languageModel,
    modelInfo,
    modelString,
    providerId,
    apiKey,
    keyPool,
  } = await resolveModel(options.modelConfig ?? {});
  log.info(`Phase 2 using model: ${modelString}`);

  // Register key pool for rotation (if multiple keys available)
  if (keyPool.length > 1) {
    keyRotator.register(providerId, keyPool);
    log.info(`Key rotation enabled for "${providerId}": ${keyPool.length} keys`);
  }

  const concurrency = resolveConcurrency(keyPool.length);
  log.info(`Generation concurrency: ${concurrency} (keys: ${keyPool.length})`);

  if (isProviderKeyRequired(providerId) && !apiKey) {
    throw new Error(
      `No API key configured for provider "${providerId}". ` +
        `Set the appropriate key in .env.local or server-providers.yml.`,
    );
  }

  const aiCall: AICallFn = async (systemPrompt, userPrompt, _images) => {
    const result = await callLLM(
      {
        model: languageModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        maxOutputTokens: modelInfo?.outputWindow,
      },
      'generate-classroom-continue',
    );
    return result.text;
  };

  const store = createInMemoryStore(stage);
  const api = createStageAPI(store);

  log.info(
    `Phase 2: Generating ${outlines.length} scene(s) in parallel (concurrency=${concurrency})...`,
  );

  await reportSceneProgress(
    options.onProgress,
    SCENE_PROGRESS_INITIAL,
    `Generating ${outlines.length} scenes in parallel...`,
    0,
    outlines.length,
  );

  // Phase A: Generate all scene content in parallel
  let contentProcessed = 0;
  let contentResults = await pMap(
    outlines,
    async (outline, index) => {
      const safeOutline = applyOutlineFallbacks(outline, true);
      try {
        const result = await generateSceneContentWithSlideFallback(safeOutline, aiCall, {
          agents,
          languageDirective,
          themeSelection: courseTheme,
        });
        if (!result) {
          log.warn(`Skipping scene "${safeOutline.title}" — content generation failed`);
          return null;
        }
        return { ...result, index };
      } catch (err) {
        log.error(`Scene "${safeOutline.title}" content generation error:`, err);
        return null;
      } finally {
        contentProcessed += 1;
        await reportSceneProgress(
          options.onProgress,
          progressInRange(
            SCENE_PROGRESS_INITIAL,
            SCENE_PROGRESS_CONTENT_DONE,
            contentProcessed,
            outlines.length,
          ),
          `Generated scene content ${contentProcessed}/${outlines.length}`,
          0,
          outlines.length,
        );
      }
    },
    { concurrency },
  );

  const failedContentOutlines = contentResults
    .map((result, index) => (result ? null : outlines[index]))
    .filter((outline): outline is SceneOutline => outline !== null);
  if (failedContentOutlines.length > 0) {
    throw new Error(
      `天空课堂 classroom content generation failed for ${failedContentOutlines.length} scene(s): ${failedContentOutlines
        .map((outline) => outline.title)
        .join(', ')}`,
    );
  }

  await options.onProgress?.({
    step: 'qa_reviewing',
    progress: SCENE_PROGRESS_CONTENT_DONE,
    message: 'Checking generated slide layouts',
    scenesGenerated: 0,
    totalScenes: outlines.length,
  });
  const qaResult = await reviewAndRepairClassroomSlideQA(contentResults, aiCall, {
    sceneContentOptions: {
      agents,
      languageDirective,
      themeSelection: courseTheme,
    },
    onProgress: options.onProgress,
    totalScenes: outlines.length,
    concurrency,
  });
  contentResults = qaResult.contentResults;
  const slideQaReport = qaResult.slideQaReport;
  if (!slideQaReport.pass) {
    const message = formatClassroomSlideQAError(slideQaReport);
    throw new Error(message);
  }

  // Phase B: Generate all scene actions in parallel (content already available)
  let actionsProcessed = 0;
  const sceneResults = await pMap(
    contentResults,
    async (result) => {
      try {
        if (!result) return null;
        const actions = await generateSceneActions(result.outline, result.content, aiCall, {
          agents,
          languageDirective,
        });
        return { outline: result.outline, content: result.content, actions, index: result.index };
      } catch (err) {
        log.error(`Scene "${result?.outline.title ?? 'unknown'}" action generation error:`, err);
        return null;
      } finally {
        actionsProcessed += 1;
        await reportSceneProgress(
          options.onProgress,
          progressInRange(
            SCENE_PROGRESS_CONTENT_DONE,
            SCENE_PROGRESS_ACTIONS_DONE,
            actionsProcessed,
            outlines.length,
          ),
          `Generated scene actions ${actionsProcessed}/${outlines.length}`,
          0,
          outlines.length,
        );
      }
    },
    { concurrency },
  );

  // Phase B: Write to store sequentially (fast, avoids race conditions)
  let generatedScenes = 0;
  for (const result of sceneResults) {
    if (!result) continue;
    const sceneId = createSceneWithActions(
      result.outline,
      result.content,
      result.actions,
      api,
      courseTheme,
    );
    if (!sceneId) {
      log.warn(`Skipping scene "${result.outline.title}" — scene creation failed`);
      continue;
    }
    generatedScenes += 1;
    await reportSceneProgress(
      options.onProgress,
      progressInRange(
        SCENE_PROGRESS_ACTIONS_DONE,
        SCENE_PROGRESS_CREATED_DONE,
        generatedScenes,
        outlines.length,
      ),
      `Generated ${generatedScenes}/${outlines.length} scenes`,
      generatedScenes,
      outlines.length,
    );
  }

  const scenes = store.getState().scenes;
  log.info(`Phase 2 pipeline: ${scenes.length} scenes generated`);

  if (scenes.length === 0) {
    throw new Error('No scenes were generated');
  }

  const stageId = stage.id;

  // Persist immediately so the classroom is usable
  await options.onProgress?.({
    step: 'persisting',
    progress: 90,
    message: 'Persisting classroom data',
    scenesGenerated: scenes.length,
    totalScenes: outlines.length,
  });

  const persisted = await persistClassroom({ id: stageId, stage, scenes }, options.baseUrl);

  log.info(`Phase 2 classroom persisted: ${persisted.id}`);

  // Fire-and-forget: media + TTS generation in background
  const needsMedia = saved.enableImageGeneration || saved.enableVideoGeneration;
  const needsTTS = saved.enableTTS;

  if (needsMedia || needsTTS) {
    (async () => {
      let updated = false;

      if (needsMedia) {
        try {
          const mediaMap = await generateMediaForClassroom(outlines, stageId, options.baseUrl);
          replaceMediaPlaceholders(scenes, mediaMap);
          log.info(`Background media complete: ${Object.keys(mediaMap).length} files`);
          updated = true;
        } catch (err) {
          log.warn('Background media generation failed:', err);
        }
      }

      if (needsTTS) {
        try {
          await generateTTSForClassroom(scenes, stageId, options.baseUrl);
          log.info('Background TTS complete');
          updated = true;
        } catch (err) {
          log.warn('Background TTS generation failed:', err);
        }
      }

      if (updated) {
        try {
          await persistClassroom({ id: stageId, stage, scenes }, options.baseUrl);
          log.info('Classroom re-persisted with media/TTS');
        } catch (err) {
          log.warn('Failed to re-persist after media/TTS:', err);
        }
      }
    })();
  }

  await options.onProgress?.({
    step: 'completed',
    progress: 100,
    message: 'Classroom generation completed',
    scenesGenerated: scenes.length,
    totalScenes: outlines.length,
  });

  return {
    id: persisted.id,
    url: persisted.url,
    stage,
    scenes,
    scenesCount: scenes.length,
    createdAt: persisted.createdAt,
    slideQaReport,
  };
}
