import { auditSlideLayout, type LayoutGuardIssue } from '@/lib/slides/agent/layout-guard-agent';
import type {
  GeneratedSlideContent,
  GeneratedSlideQAIssue,
  GeneratedSlideQAReport,
  SceneOutline,
} from '@/lib/types/generation';

type SlideElement = GeneratedSlideContent['elements'][number];

function elementRecord(element: SlideElement): Record<string, unknown> {
  return element as unknown as Record<string, unknown>;
}

function getElementHeight(element: SlideElement, fallback: number): number {
  if ('height' in element) {
    return toFiniteNumber(element.height, fallback);
  }
  if (element.type === 'line') {
    return toFiniteNumber(Math.abs(element.end[1] - element.start[1]), fallback);
  }
  return fallback;
}

const BLOCKING_LAYOUT_TYPES = new Set<LayoutGuardIssue['type']>([
  'readable_element_overlap',
  'foreground_overlay_collision',
  'latex_box_too_small',
  'unsafe_bottom_zone',
  'text_outside_background',
]);

export interface ClassroomSlideQAIssue extends GeneratedSlideQAIssue {
  sceneId: string;
  sceneTitle: string;
  order: number;
}

export interface ClassroomSlideQAReport {
  pass: boolean;
  totalSlides: number;
  issueCount: number;
  blockingIssueCount: number;
  warningIssueCount: number;
  issues: ClassroomSlideQAIssue[];
}

export function auditGeneratedSlideContent(content: GeneratedSlideContent): GeneratedSlideQAReport {
  const issues = [
    ...auditSlideLayout(content.elements).map(toGeneratedSlideQAIssue),
    ...auditSlideLanguage(content),
    ...auditSlideVisualStyle(content),
    ...auditSlideTeachingDensity(content),
    ...auditSlideTeachingSubstance(content),
    ...auditQASafeFallbackGeometry(content),
  ];
  const blockingIssueCount = issues.filter((issue) => issue.severity === 'blocking').length;

  return {
    pass: blockingIssueCount === 0,
    blockingIssueCount,
    warningIssueCount: issues.length - blockingIssueCount,
    issues,
  };
}

export function auditClassroomSlideContents(
  results: Array<{ outline: SceneOutline; content: unknown } | null>,
): ClassroomSlideQAReport {
  const slideResults = results.filter(
    (result): result is { outline: SceneOutline; content: GeneratedSlideContent } =>
      !!result && result.outline.type === 'slide' && isGeneratedSlideContent(result.content),
  );

  const issues = slideResults.flatMap(({ outline, content }) =>
    [
      ...auditGeneratedSlideContent(content).issues,
      ...auditSlideSemanticConsistency(outline, content),
    ].map((issue) => ({
      ...issue,
      sceneId: outline.id,
      sceneTitle: outline.title,
      order: outline.order,
    })),
  );
  issues.push(...auditDeckTemplateDiversity(slideResults));
  const blockingIssueCount = issues.filter((issue) => issue.severity === 'blocking').length;

  return {
    pass: blockingIssueCount === 0,
    totalSlides: slideResults.length,
    issueCount: issues.length,
    blockingIssueCount,
    warningIssueCount: issues.length - blockingIssueCount,
    issues,
  };
}

export function formatClassroomSlideQAError(report: ClassroomSlideQAReport): string {
  const brokenScenes = [
    ...new Set(
      report.issues
        .filter((issue) => issue.severity === 'blocking')
        .map((issue) => issue.sceneTitle),
    ),
  ];

  const details = report.issues
    .filter((issue) => issue.severity === 'blocking')
    .slice(0, 6)
    .map((issue, index) => {
      const element = issue.elementId ? ` element=${issue.elementId}` : '';
      return `${index + 1}. ${issue.sceneTitle}: ${issue.type}${element} - ${issue.detail}`;
    })
    .join('; ');

  return `天空课堂 classroom slide QA failed for ${brokenScenes.length} scene(s): ${brokenScenes.join(
    ', ',
  )}${details ? `. Blocking details: ${details}` : ''}`;
}

function toGeneratedSlideQAIssue(issue: LayoutGuardIssue): GeneratedSlideQAIssue {
  return {
    type: issue.type,
    severity: BLOCKING_LAYOUT_TYPES.has(issue.type) ? 'blocking' : 'warning',
    detail: issue.detail,
    elementId: issue.textId,
    backgroundId: issue.backgroundId,
  };
}

function auditSlideLanguage(content: GeneratedSlideContent): GeneratedSlideQAIssue[] {
  return getVisibleTextItems(content)
    .filter(({ text }) => hasMostlyEnglishVisibleText(text) || isGenericPlaceholderLabel(text))
    .map(({ id, text }) => ({
      type: isGenericPlaceholderLabel(text)
        ? 'generic_placeholder_label'
        : 'mostly_non_chinese_text',
      severity: 'blocking' as const,
      detail: isGenericPlaceholderLabel(text)
        ? `Generic placeholder label should be replaced with concrete Chinese teaching content: ${text}`
        : `Visible slide text must be Chinese-first; translate or explain this text in Chinese: ${text}`,
      elementId: id,
    }));
}

function auditSlideVisualStyle(content: GeneratedSlideContent): GeneratedSlideQAIssue[] {
  return content.elements
    .filter((element) => isOrangeDecorativeElement(element))
    .map((element) => ({
      type: 'orange_decorative_element',
      severity: 'blocking' as const,
      detail:
        'Clean 天空课堂 classroom slides should use blue-related accents; remove orange bars, stripes, corner marks, and unrelated decoration.',
      elementId: element.id,
    }));
}

function auditSlideTeachingDensity(content: GeneratedSlideContent): GeneratedSlideQAIssue[] {
  if (content.elements.length < 2) return [];

  const visibleText = getVisibleTextItems(content)
    .map(({ text }) => text)
    .join(' ');
  const compactLength = visibleText.replace(/\s+/g, '').length;
  const teachingUnitCount = getVisibleTextItems(content).reduce(
    (sum, { text }) => sum + countConcreteTeachingUnits(text),
    0,
  );
  const hasAnchor = hasSemanticVisualAnchor(content);
  const requiredLength = hasAnchor ? 42 : 90;
  const requiredUnits = hasAnchor ? 3 : 4;

  if (compactLength >= requiredLength && teachingUnitCount >= requiredUnits) return [];

  return [
    {
      type: 'thin_teaching_content',
      severity: 'blocking',
      detail:
        'Slide has too little concrete teaching content; add Chinese explanations, examples, checks, or a richer table/flow/command/structure diagram.',
    },
  ];
}

function auditSlideTeachingSubstance(content: GeneratedSlideContent): GeneratedSlideQAIssue[] {
  const visibleText = getVisibleTextItems(content)
    .map(({ text }) => text)
    .join(' ');
  const compactText = visibleText.replace(/\s+/g, '');

  if (!isOperationalKnowledgeSlide(visibleText)) return [];
  if (compactText.length < 36) return [];

  const facets = getOperationalTeachingFacets(visibleText);
  const facetCount = Object.values(facets).filter(Boolean).length;
  const teachingUnitCount = getVisibleTextItems(content).reduce(
    (sum, { text }) => sum + countConcreteTeachingUnits(text),
    0,
  );

  const hasWorkedTeachingExample = facets.workedExample;
  const hasEnoughLongFormTeaching =
    compactText.length >= 150 && teachingUnitCount >= 4 && facetCount >= 4;
  const hasExampleBackedTeaching = hasWorkedTeachingExample && facetCount >= 3;

  if (hasEnoughLongFormTeaching || hasExampleBackedTeaching) return [];

  return [
    {
      type: 'insufficient_teaching_substance',
      severity: 'blocking',
      detail:
        'Operational knowledge slide is keyword-only; add a concrete syntax/command example plus meaning, scenario, result, or caution/checkpoint text.',
    },
  ];
}

function isOperationalKnowledgeSlide(text: string): boolean {
  return /\b(sql|select|from|where|order\s+by|group\s+by|insert|update|delete|join|python|javascript|typescript|java|redis|mongodb|mysql|postgresql|api|http|print\s*\(|input\s*\(|def\s+\w+|for\s+\w+|while\s*\(|if\s*\(|class\s+\w+|SELECT|FROM|WHERE|ORDER\s+BY)\b|查询|数据库|数据表|字段|索引|变量|函数|循环|条件语句|命令|语法|代码|脚本|缓存|队列|事务|接口/i.test(
    text,
  );
}

function getOperationalTeachingFacets(text: string): Record<string, boolean> {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return {
    syntaxOrCommand: hasOperationalSyntaxOrCommand(normalized),
    workedExample: hasWorkedOperationalExample(normalized),
    meaning:
      /作用|用于|表示|指定|过滤|排序|返回|输出|执行|含义|解释|条件|字段|列|行|读取|写入|更新|删除|统计|匹配|遍历|调用|赋值/i.test(
        normalized,
      ),
    scenario: /场景|适用|当.+时|如果.+就|业务|项目|需求|常用于|适合|用于.+时|从.+中|在.+里/i.test(
      normalized,
    ),
    result: /结果|得到|查出|返回|输出|命中|保留|排除|降序|升序|成功|失败|影响|变化|最终/i.test(
      normalized,
    ),
    cautionOrCheckpoint:
      /注意|易错|不要|避免|检查|确认|必须|不能|建议|真实项目|生产环境|先.+后|优先|区别|否则|风险|边界|空值|性能/i.test(
        normalized,
      ),
  };
}

function hasOperationalSyntaxOrCommand(text: string): boolean {
  return /\bSELECT\b.+\bFROM\b|\bWHERE\b|\bORDER\s+BY\b|\bGROUP\s+BY\b|\bJOIN\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bSET\b|\bGET\b|\bHSET\b|\bLPUSH\b|\bZADD\b|print\s*\(|input\s*\(|def\s+\w+\s*\(|for\s+\w+\s+in|while\s+.+:|if\s+.+:|=\s*[^=]/i.test(
    text,
  );
}

function hasWorkedOperationalExample(text: string): boolean {
  return /示例|例子|例如|比如|以.+为例|假设|样例|演示|实战|练习|students|users|orders|score|name|age|SELECT\s+[\w*,\s]+\s+FROM\s+\w+|print\s*\([^)]{1,80}\)|def\s+\w+\s*\([^)]*\)\s*:/i.test(
    text,
  );
}

function auditQASafeFallbackGeometry(content: GeneratedSlideContent): GeneratedSlideQAIssue[] {
  const issues: GeneratedSlideQAIssue[] = [];

  for (const element of content.elements) {
    const id = element.id ?? '';
    if (!id.startsWith('classroom_qa_safe_')) continue;

    const bottom = element.top + getElementHeight(element, 24);
    if (bottom > 514.5) {
      issues.push({
        type: 'qa_safe_fallback_overflow',
        severity: 'blocking',
        detail: `QA safe fallback element exceeds the classroom safe bottom: ${id}`,
        elementId: id,
      });
    }

    if (element.type === 'text' && id.includes('_block_')) {
      const height = getElementHeight(element, 0);
      const fontSize = getFontSize(String(element.content ?? ''));
      if (height < 84 || fontSize < 22) {
        issues.push({
          type: 'qa_safe_fallback_text_too_small',
          severity: 'blocking',
          detail: `QA safe fallback text block must use at least 22px text and 84px height: ${id}`,
          elementId: id,
        });
      }
    }

    if (element.type === 'table' && id.startsWith('classroom_qa_safe_table_')) {
      const data = element.data;
      const rowCount = Array.isArray(data) ? data.length : 0;
      const minHeight = Math.max(rowCount * 44, 44);
      const height = getElementHeight(element, 0);
      const cellMinHeight = toFiniteNumber(element.cellMinHeight, 0);
      if (height < minHeight || cellMinHeight < 44) {
        issues.push({
          type: 'qa_safe_fallback_table_too_short',
          severity: 'blocking',
          detail: `QA safe fallback table must reserve at least 44px per row: ${id}`,
          elementId: id,
        });
      }
    }
  }

  return issues;
}

function auditSlideSemanticConsistency(
  outline: SceneOutline,
  content: GeneratedSlideContent,
): GeneratedSlideQAIssue[] {
  return [
    ...auditSlideDomainConsistency(outline, content),
    ...auditSlideStepCountConsistency(outline, content),
  ];
}

function auditSlideDomainConsistency(
  outline: SceneOutline,
  content: GeneratedSlideContent,
): GeneratedSlideQAIssue[] {
  const outlineSignal = getOutlineSignalText(outline);
  const visibleText = getVisibleTextItems(content)
    .map(({ text }) => text)
    .join(' ');

  if (isRedisLessonSignal(outlineSignal)) return [];
  if (!isPythonLessonSignal(outlineSignal)) return [];
  if (!hasRedisSpecificTeachingLeak(visibleText)) return [];

  return [
    {
      type: 'semantic_domain_mismatch',
      severity: 'blocking',
      detail:
        'Python slide contains Redis-specific commands, storage structures, or fallback wording. Rebuild with content tied to this Python topic instead of reusing Redis templates.',
    },
  ];
}

function auditSlideStepCountConsistency(
  outline: SceneOutline,
  content: GeneratedSlideContent,
): GeneratedSlideQAIssue[] {
  const visibleItems = getVisibleTextItems(content);
  const visibleText = visibleItems.map(({ text }) => text).join(' ');
  const promisedStepCount = getPromisedStepCount(`${getOutlineSignalText(outline)} ${visibleText}`);
  if (!promisedStepCount) return [];

  const visibleStepCount = countVisibleStepMarkers(visibleItems.map(({ text }) => text));
  if (visibleStepCount === 0 || visibleStepCount >= promisedStepCount) return [];

  return [
    {
      type: 'step_count_mismatch',
      severity: 'blocking',
      detail: `Slide promises ${promisedStepCount} steps but only renders ${visibleStepCount} visible step item(s). Keep the wording and rendered step cards in sync.`,
    },
  ];
}

function getOutlineSignalText(outline: SceneOutline): string {
  return [outline.title, outline.description, ...(outline.keyPoints ?? [])]
    .filter(Boolean)
    .join(' ');
}

function isPythonLessonSignal(text: string): boolean {
  return /\bpython\b|print\s*\(|input\s*\(|f-string|def\s+\w+|if\s+.*:|elif|else|while|for\s+\w+|字符串|变量|函数|循环|列表|安装与运行环境|运行环境/i.test(
    text,
  );
}

function isRedisLessonSignal(text: string): boolean {
  return /\b(redis|sds|quicklist|listpack|intset|skiplist|lpush|rpush|lpop|rpop|hset|hget|hdel|zadd|zrange|zrevrange|zscore|zrank|incr|decr|expire|ttl)\b|键值模型|缓存配置|过期时间|排行榜/i.test(
    text,
  );
}

function hasRedisSpecificTeachingLeak(text: string): boolean {
  return /\b(redis|sds|quicklist|listpack|intset|skiplist|lpush|rpush|lpop|rpop|hset|hget|hdel|zadd|zrange|zrevrange|zscore|zrank|incr|decr|expire|ttl)\b|键值模型|缓存配置|验证码|过期时间|字段很多.*Hash|可改用\s*Hash/i.test(
    text,
  );
}

function getPromisedStepCount(text: string): number | null {
  const match = text.match(/([一二两三四五六七八九十\d])\s*(?:个)?(?:步骤|步|阶段|环节)/);
  if (!match) return null;
  return chineseCountToNumber(match[1]);
}

function chineseCountToNumber(value: string): number | null {
  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric > 0) return numeric;
  const table: Record<string, number> = {
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
  };
  return table[value] ?? null;
}

function countVisibleStepMarkers(textItems: string[]): number {
  const joined = textItems.join(' ');
  const circled = joined.match(/[①②③④⑤⑥⑦⑧⑨]/g) ?? [];
  const numbered = joined.match(/(?:^|[\s。；;])(?:[1-9])\s*[.、)]?\s*(?=[^\s\d])/g) ?? [];
  return new Set([...circled, ...numbered.map((item) => item.trim())]).size;
}

function auditDeckTemplateDiversity(
  slideResults: Array<{ outline: SceneOutline; content: GeneratedSlideContent }>,
): ClassroomSlideQAIssue[] {
  if (slideResults.length < 3) return [];

  const groups = new Map<
    string,
    Array<{ outline: SceneOutline; signature: string; order: number }>
  >();

  for (const { outline, content } of slideResults) {
    if (isDeckDiversityExemptTitle(outline.title)) continue;

    const signature = getMainLayoutSignature(content);
    if (!signature) continue;

    const entry = { outline, signature, order: outline.order };
    groups.set(signature, [...(groups.get(signature) ?? []), entry]);
  }

  const issues: ClassroomSlideQAIssue[] = [];
  for (const entries of groups.values()) {
    if (entries.length < 2) continue;

    const sorted = [...entries].sort((a, b) => a.order - b.order);
    const keeper = sorted[0];
    for (const duplicate of sorted.slice(1)) {
      issues.push({
        type: 'repeated_layout_signature',
        severity: 'blocking',
        detail: `Main slide layout repeats scene "${keeper.outline.title}" (signature ${duplicate.signature}). Rebuild this page with a different composition, visual anchor, and background rhythm.`,
        sceneId: duplicate.outline.id,
        sceneTitle: duplicate.outline.title,
        order: duplicate.outline.order,
      });
    }
  }

  return issues;
}

function isDeckDiversityExemptTitle(title: string): boolean {
  return /(cover|opening|ending|thanks|outline|agenda|quiz|practice|封面|开场|结束|谢谢|目录|练习|测验)/i.test(
    title,
  );
}

function getMainLayoutSignature(content: GeneratedSlideContent): string | null {
  const atoms = content.elements.filter(isMainLayoutSignatureElement).map(toLayoutAtom).sort();

  if (atoms.length < 5) return null;

  return atoms.join('|');
}

function isMainLayoutSignatureElement(element: SlideElement): boolean {
  const id = element.id ?? '';
  if (
    id.startsWith('polish_deck_signature_') ||
    id.startsWith('polish_density_') ||
    id.startsWith('polish_rich_') ||
    id.startsWith('polish_plain_') ||
    id.startsWith('classroom_qa_safe_card_') ||
    id.startsWith('classroom_qa_safe_accent_') ||
    id.startsWith('classroom_qa_safe_title_rule_')
  ) {
    return false;
  }

  if (element.type === 'line') return false;

  const width = toFiniteNumber(element.width, 0);
  const height = getElementHeight(element, 24);
  if (width <= 0 || height <= 0) return false;

  if (element.type === 'shape') {
    if (hasShapeText(element)) return true;
    if (width <= 18 || height <= 14) return false;
    return width * height >= 2400;
  }

  if (element.type === 'text') {
    return getElementPlainText(element).replace(/\s+/g, '').length > 0;
  }

  return ['image', 'video', 'chart', 'table', 'latex', 'code'].includes(element.type);
}

function isOrangeDecorativeElement(element: SlideElement): boolean {
  if (!['shape', 'line', 'chart'].includes(element.type)) return false;

  const values = collectColorValues(element);
  if (values.length === 0) return false;

  const hasOrange = values.some((color) => isOrangeAccentColor(color));
  if (!hasOrange) return false;

  if (element.type === 'chart') return true;

  const text = getElementPlainText(element).replace(/\s+/g, '');
  if (text.length >= 8) return false;

  const width = toFiniteNumber(element.width, 0);
  const height = getElementHeight(element, 0);
  const isRuleLike = width <= 12 || height <= 12 || width / Math.max(height, 1) >= 8;
  const isSmallOrnament = width * height <= 9000;

  return isRuleLike || isSmallOrnament;
}

function collectColorValues(element: SlideElement): string[] {
  const record = element as unknown as Record<string, unknown>;
  const colors: string[] = [];
  for (const key of ['fill', 'color', 'defaultColor', 'textColor']) {
    const value = record[key];
    if (typeof value === 'string') colors.push(value);
  }

  const outline = record.outline as { color?: unknown } | undefined;
  if (typeof outline?.color === 'string') colors.push(outline.color);

  const theme = record.theme as { color?: unknown } | undefined;
  if (typeof theme?.color === 'string') colors.push(theme.color);

  const themeColors = record.themeColors;
  if (Array.isArray(themeColors)) {
    colors.push(...themeColors.filter((value): value is string => typeof value === 'string'));
  }

  return colors;
}

function isOrangeAccentColor(color: string): boolean {
  const rgb = parseHexColor(color);
  if (!rgb) return false;

  const [r, g, b] = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 24) return false;

  const hue = rgbToHue(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;
  const brightness = max / 255;

  return hue >= 18 && hue <= 52 && saturation >= 0.28 && brightness >= 0.45;
}

function parseHexColor(color: string): [number, number, number] | null {
  const normalized = color.trim().toLowerCase();
  const short = normalized.match(/^#([0-9a-f]{3})$/i);
  if (short) {
    return short[1].split('').map((value) => parseInt(`${value}${value}`, 16)) as [
      number,
      number,
      number,
    ];
  }

  const full = normalized.match(/^#([0-9a-f]{6})$/i);
  if (!full) return null;

  return [
    parseInt(full[1].slice(0, 2), 16),
    parseInt(full[1].slice(2, 4), 16),
    parseInt(full[1].slice(4, 6), 16),
  ];
}

function rgbToHue(r: number, g: number, b: number): number {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  if (delta === 0) return 0;

  let hue: number;
  if (max === red) {
    hue = ((green - blue) / delta) % 6;
  } else if (max === green) {
    hue = (blue - red) / delta + 2;
  } else {
    hue = (red - green) / delta + 4;
  }

  return (hue * 60 + 360) % 360;
}

function hasShapeText(element: SlideElement): boolean {
  const text = elementRecord(element).text as { content?: string } | undefined;
  return stripHtml(String(text?.content ?? '')).length > 0;
}

function getElementPlainText(element: SlideElement): string {
  if (element.type === 'latex') {
    return String(element.latex ?? '');
  }
  if (element.type === 'shape') {
    const text = elementRecord(element).text as { content?: string } | undefined;
    return stripHtml(String(text?.content ?? ''));
  }
  return stripHtml(String(elementRecord(element).content ?? ''));
}

function toLayoutAtom(element: SlideElement): string {
  const role = getLayoutRole(element);
  const left = bucketPosition(element.left, 48);
  const top = bucketPosition(element.top, 42);
  const width = bucketPosition(element.width, 72);
  const height = bucketPosition(getElementHeight(element, 24), 34);

  return `${role}@${left},${top},${width},${height}`;
}

function getLayoutRole(element: SlideElement): string {
  if (element.type === 'text') {
    const content = String(element.content ?? '');
    const fontSize = getFontSize(content);
    if (element.top < 130 && (fontSize >= 26 || element.width >= 600)) return 'title';
    if (element.top < 180) return 'subtitle';
    if (fontSize >= 24) return 'heading-text';
    return 'body-text';
  }

  if (element.type === 'shape') return hasShapeText(element) ? 'shape-text' : 'panel';
  return element.type;
}

function bucketPosition(value: number, bucketSize: number): number {
  return Math.round(value / bucketSize);
}

function toFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function getFontSize(content: string): number {
  const match = content.match(/font-size\s*:\s*(\d+(?:\.\d+)?)px/i);
  return match ? Number(match[1]) : 18;
}

function getVisibleTextItems(content: GeneratedSlideContent): Array<{ id?: string; text: string }> {
  return content.elements
    .map((element) => {
      if (element.type === 'text') {
        const textElement = element as unknown as Record<string, unknown>;
        return {
          id: element.id,
          text: stripHtml(String(textElement.content ?? '')),
        };
      }

      if (element.type === 'shape') {
        const shapeElement = element as unknown as Record<string, unknown>;
        const text = shapeElement.text as { content?: string } | undefined;
        return {
          id: element.id,
          text: stripHtml(String(text?.content ?? '')),
        };
      }

      if (element.type === 'table') {
        return {
          id: element.id,
          text: getTablePlainText(element),
        };
      }

      return { id: element.id, text: '' };
    })
    .filter((item) => item.text.length > 0);
}

function getTablePlainText(element: SlideElement): string {
  const tableElement = element as unknown as { data?: unknown };
  if (!Array.isArray(tableElement.data)) return '';

  return tableElement.data
    .flatMap((row) => (Array.isArray(row) ? row : []))
    .map((cell) => {
      if (typeof cell === 'string') return cell;
      if (cell && typeof cell === 'object' && 'text' in cell) {
        return String((cell as { text?: unknown }).text ?? '');
      }
      return '';
    })
    .filter(Boolean)
    .join(' ');
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasMostlyEnglishVisibleText(text: string): boolean {
  if (isAllowedTechnicalLabelOrCommand(text)) return false;

  const withoutAllowedTerms = text.replace(
    /\b(redis|lua|multi|exec|discard|watch|set|get|incr|decr|expire|ttl|hash|list|zset|sorted\s*set)\b/gi,
    ' ',
  );
  const latinLetters = (withoutAllowedTerms.match(/[A-Za-z]/g) ?? []).length;
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
  return latinLetters >= 12 && chineseChars < 4;
}

function isAllowedTechnicalLabelOrCommand(text: string): boolean {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return false;

  const commandTokens = normalized.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) ?? [];
  const hasRedisCommand = commandTokens.some((token) =>
    /^(SET|GET|HSET|HGET|HDEL|LPUSH|RPUSH|LPOP|RPOP|ZADD|ZRANGE|ZREVRANGE|ZSCORE|ZRANK|INCR|DECR|EXPIRE|TTL|MULTI|EXEC|DISCARD|WATCH|SADD|SMEMBERS|SINTER|SUNION)$/i.test(
      token,
    ),
  );
  if (hasRedisCommand) return true;

  const technicalDiagramLabel = normalized
    .replace(/[：:,+/(){}\[\]\-→>]+/g, ' ')
    .split(' ')
    .filter(Boolean);
  if (technicalDiagramLabel.length > 0 && technicalDiagramLabel.length <= 5) {
    return technicalDiagramLabel.every((token) =>
      /^(redis|sds|dict|skiplist|listpack|quicklist|intset|zset|string|hash|list|set|member|score|key|value|field|ttl|o|log|n|1)$/i.test(
        token,
      ),
    );
  }

  return false;
}

function isGenericPlaceholderLabel(text: string): boolean {
  const normalized = text.replace(/\s+/g, '');
  return /^(要点[一二三四五六七八九十\d]+|重点[一二三四五六七八九十\d]+|Step\d+)$/i.test(
    normalized,
  );
}

function isConcreteTeachingUnit(text: string): boolean {
  if (isGenericPlaceholderLabel(text)) return false;
  return text.replace(/\s+/g, '').length >= 12;
}

function countConcreteTeachingUnits(text: string): number {
  const segments = text
    .split(/(?:\s*[-•·]\s+|[。；;]\s*|\s{2,})/u)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length === 0) return 0;

  const concreteSegments = segments.filter(isConcreteTeachingSegment).length;
  if (concreteSegments > 0) return concreteSegments;

  return isConcreteTeachingUnit(text) ? 1 : 0;
}

function isConcreteTeachingSegment(text: string): boolean {
  if (isGenericPlaceholderLabel(text)) return false;
  return text.replace(/\s+/g, '').length >= 8;
}

function hasSemanticVisualAnchor(content: GeneratedSlideContent): boolean {
  if (
    content.elements.some((element) =>
      ['image', 'video', 'chart', 'table', 'latex', 'code'].includes(element.type),
    )
  ) {
    return true;
  }

  if (
    content.elements.some((element) =>
      /(^polish_ref_redis_|^classroom_qa_safe_|_visual_|_diagram_|_flow_|_step_|_command_|_layout_)/i.test(
        element.id ?? '',
      ),
    )
  ) {
    return true;
  }

  const largePanelCount = content.elements.filter((element) => {
    if (element.type !== 'shape') return false;
    const width = Number(element.width ?? 0);
    const height = Number(element.height ?? 0);
    if (width <= 0 || height <= 0) return false;
    return width * height >= 10000;
  }).length;
  const teachingTextCount = getVisibleTextItems(content).filter(({ text }) =>
    isConcreteTeachingUnit(text),
  ).length;

  return largePanelCount >= 3 && teachingTextCount >= 4;
}

function isGeneratedSlideContent(content: unknown): content is GeneratedSlideContent {
  return (
    typeof content === 'object' &&
    content !== null &&
    Array.isArray((content as GeneratedSlideContent).elements)
  );
}
