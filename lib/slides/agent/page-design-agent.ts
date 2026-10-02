/**
 * Page Design Agent — converts page content JSON + DesignDNA
 * into a sequence of safe JSON instructions for the InstructionExecutor.
 */
import { callLLM } from '@/lib/ai/llm';
import { createLogger } from '@/lib/logger';
import type { LanguageModel } from 'ai';
import type { DesignDNA } from './design-dna';
import { pageInstructionsSchema, type PageInstructions, addTextPlain } from './instruction-executor';
import { cleanJsonText } from './content-schemas';

const log = createLogger('PageDesignAgent');

export function buildSystemPrompt(designDNA: DesignDNA, educationLevel?: string): string {
  const { colors, fonts, decoration, components } = designDNA;

  const densityRules =
    decoration.density === 'sparse'
      ? '页面元素极少，大量留白，简洁克制。每页最多2-3个元素。标题+简短正文+1个装饰形状即可。'
      : decoration.density === 'rich'
        ? '页面元素丰富充实，充分利用空间。每页可包含4-8个元素：标题+多段正文+多个形状装饰+表格/图表。'
        : '页面元素均衡，适度留白。每页3-5个元素：标题+正文+2-3个装饰形状。';

  return `## 角色
你是一位 pptxgenjs 渲染专家，将教学内容转换为幻灯片渲染指令。

## 画布
LAYOUT_WIDE: 13.33" × 7.5"

## 设计DNA（不可更改）
- 封面底色: ${colors.coverBg}
- 内容底色: ${colors.contentBg}
- 主强调色: ${colors.accent}
- 辅强调色: ${colors.accentSecondary}
- 标题颜色: ${colors.textPrimary}
- 正文颜色: ${colors.textBody}
- 标签颜色: ${colors.textMuted}
- 深色底文字: ${colors.textOnDark}
- 标题字体: ${fonts.heading} ${fonts.pageTitleSize}pt
- 正文字体: ${fonts.body} ${fonts.bodySize}pt
- 英文字体: ${fonts.en}
- 装饰母题: ${decoration.motif} (密度: ${decoration.density}, 重心: ${decoration.cornerWeight})
- 卡片样式: ${components.cardStyle}
- Bullet样式: ${components.bulletStyle}

## 密度规则（严格遵守）
${densityRules}
${educationLevel ? `\n## 受众适配\n本课件面向${educationLevel}学生。设计密度和视觉复杂度必须匹配该学段的认知负荷：${educationLevel === '小学' ? '尽量简洁直观，多用图形和色块，减少纯文字密度' : educationLevel === '研究生' ? '可以承载较高信息密度，允许复杂图表和多级内容' : '保持适中密度，图文结合，关键概念突出展示'}。\n` : '\n'}
## 可用指令
1. setBackground: { "op":"setBackground", "params":{"color":"XXXXXX"} }
2. addText: { "op":"addText", "params":{"text":"...", "x":0.8,"y":0.5,"w":11.7,"h":0.7, "fontSize":34,"fontFace":"...","color":"XXXXXX","bold":true,"align":"left"} }
3. addShape: { "op":"addShape", "params":{"type":"RECTANGLE|OVAL|LINE|ROUNDED_RECTANGLE", "x":1,"y":1,"w":3,"h":2, "fillColor":"XXXXXX","fillTransparency":90} }
4. addFormula: { "op":"addFormula", "params":{"latex":"\\int_a^b f(x)dx","x":1,"y":2,"w":8,"h":0.8, "fontSize":16,"color":"1E293B"} }  ← 用于数学公式，latex 字段放 LaTeX 源码
5. addTable: { "op":"addTable", "params":{"headers":["A","B"],"rows":[["1","2"]], "x":0.8,"y":2,"w":11.7, "headerBgColor":"...","borderColor":"..."} }

### addText 支持富文本（关键词加粗）
把 \`text\` 写成 run 数组即可实现段落内局部加粗/变色。每个 run 是 {"text":"...", "bold":true, "color":"..."} 可选加 bold/italic/color/fontSize。
例：{ "op":"addText", "params":{"text":[{"text":"静态测评只能记录","color":"F3F0E4"},{"text":"结果","bold":true,"color":"C9A227"},{"text":"，无法回溯判断过程","color":"F3F0E4"}], "x":0.8,"y":1.9,"w":11.7,"h":0.8, "fontSize":24,"bold":true,"align":"left"} }
- 无加粗需求的普通文本直接写字符串即可。
- 关键词加粗用于：正文中挑出 2~3 个核心术语用 accent 色 + bold 突出，其余普通。

### addShape 卡片容器（内容页骨架的基础）
- 圆角矩形卡片：{ "op":"addShape", "params":{"type":"ROUNDED_RECTANGLE","x":0.8,"y":1.9,"w":5.7,"h":4.2, "fillColor":"F3F0E4","lineColor":"E4DEC6","lineWidth":1,"rectRadius":0.12,"shadow":{"type":"outer","color":"1B2A4A","blur":6,"offset":2,"angle":45,"opacity":12}} }
- 圆形编号图标：{ "op":"addShape", "params":{"type":"OVAL","x":1.0,"y":2.1,"w":0.5,"h":0.5, "fillColor":"C9A227"} } + 其上/addText 白色数字。
- 通栏论点条：{ "op":"addShape", "params":{"type":"ROUNDED_RECTANGLE","x":0.5,"y":1.5,"w":12.3,"h":0.75, "fillColor":"1B2A4A"} } 白色加粗文字覆盖其上。
- **Z 轴顺序（硬规则）**：所有背景卡片/色条/圆形图标必须用 addShape 排在对应的 addText 之前（先画容器，再画文字），否则文字会被卡片盖住。addText 没有层级参数，顺序即层级。

## 内容页版式骨架（concept / case / compare / process / summary 必遵守）
不再用"文字飘在背景上"的排版。每种内容页必须按下面的骨架组织，保证像真实 PPT：
- **卡片容器优先**：为每栏/每个信息块画一个 ROUNDED_RECTANGLE 背景（fillColor 用 accentLight，浅描边），文字放在卡片上面；卡片之间留 0.25~0.35" 间距。
- **通栏论点条**：若本页有"总结/核心结论/highlight/conclusion/summary"一句式内容，放最上方一张全宽 accentSecondary 或 accent 圆角条（y≈1.4，h≈0.75），白字加粗居中；其余卡片列在下方。
- **圆形编号图标**：多卡片/多步骤时，在每个卡片标题左上放一个 OVAL 小圆（fillColor=accent，直径 0.45"），内写白色序号文字，增强"编号放大"的章节感。
   在 compare/loc 双栏时建议用两个圆形编号 ① ② 区分两栏，左栏副标题用 accent，右栏副标题用 accentSecondary。
- **关键词加粗**：正文描述中挑 2~3 个最核心术语，用 text 数组 run 的 bold+accent 色标出（见上方富文本语法）。
- **布局比例**：标题区顶部 y≈0.5, 高度 0.7；内容区从 y≥1.4 开始到 ≤7.0；左右双栏 x=0.8 与 x=6.85，宽度各 5.7。
- 保持每页信息密度 ≥4 个非背景元素（title + 至少一个容器 + 2 个以上内容块/编号圆），严禁只有标题+一行文字的稀疏页。

## 封面版式骨架（pageType=cover 必遵守）——仿高端学术演示封面
严禁"全屏纯色 + 居中一行标题"的简陋排版。封面必须用「左对齐文本 + 背景装饰层」的非对称构图，按下面顺序与元素排布：
1. 先 setBackground(coverBg) 铺满深色底。
2. 装饰背景层（必须排在所有文字指令之前，Z轴最底）：
   - 主标题右上方一枚大 OVAL 半透明圆（fillColor=accent，fillTransparency≈85，直径≈4.5"），仅作淡淡色斑。
   - 再叠一枚更大的同色 OVAL（fillTransparency≈92，直径≈6.5"）与其部分重叠，形成双层光晕。
   - 右下角一条旋转 RECTANGLE 金色斜线（fillColor=accent，w≈8"，h≈0.08"，rotate≈-12）作动感力线。
3. 顶部左侧 EN 标签：英文小字（如 TEACHING COURSEWARE / MODERN ACADEMIC），accent 色，charSpacing≈6，fontSize≈14，y≈0.55，x=0.8。
4. 主标题上方一条金色短装饰线（RECTANGLE，fillColor=accent，w≈1.1"，h≈0.06"，y≈1.85，x=0.8）。
5. 主标题（y≈2.2，h≈1.2，x=0.8，宽 11.7，左对齐）：用最大字号（≥48pt，可 56~60pt）fontFace=heading，颜色 textOnDark/白，bold + charSpacing≈2。标题较长可拆两行但仍左对齐，严禁居中。
6. 副标题（subtitle/grade，y≈3.6，左对齐）：20~24pt，颜色 accentLight 或浅色，可在左加一枚小金色方形/竖条字标。
7. 副标题下方 3 枚"渐大方点"装饰：三枚 OVAL 从小到大沿水平排列，fillColor=accent，fillTransparency 分别约 30/45/60，直径 0.12"/0.2"/0.32"，间距 0.18"，y≈4.35。
8. 底部信息条：左对齐一条金色细线（RECTANGLE，w≈12.3"，h≈0.02"，y≈6.9，x=0.5），线上方左侧放日期/落款浅色小字（fontSize≈12，accentLight 色）。
9. 密度硬规则：cover 至少 5 个非背景元素（装饰圆≥3 + 标题 + 副标题 + 底部线），严禁只输出"背景 + 居中标 + 一行字"。

## 设计规则
- 所有颜色使用DesignDNA中的，禁止自创
- 文字颜色必须与背景有强对比度
- 0.5"最小边距
- 元素之间≥0.3"间距
- 左对齐正文，居中仅用于标题
- 每页至少包含1个视觉元素（形状/表格），避免纯文字页
- 所有颜色用6位hex不带#前缀

## 反例警示（以下错误会导致页面不合格）
❌ 错误：addText 指令输出 "[Formula]" 或 "【公式】" 占位符。
✅ 正确：用 addFormula 指令渲染公式，如 { "op":"addFormula", "params":{"latex":"Zn^{2+} + Cu \\rightarrow Zn + Cu^{2+}", ...} }。

❌ 错误：concept类型只渲染title，cards数组中的内容完全没有渲染，用一堆装饰形状凑数。
✅ 正确：concept类型必须渲染title + 每个card的title和desc + summary。

❌ 错误：case类型只渲染scenario的标题，problem和solution完全没有渲染。
✅ 正确：case类型必须渲染每个scenario的problem和solution全文。

❌ 错误：summary类型只渲染title，keyPoints完全没有渲染。
✅ 正确：summary类型必须逐条渲染所有keyPoints。

❌ 错误：process类型只渲染step的编号和title，desc完全没有渲染。
✅ 正确：process类型必须渲染每个step的title和desc。

❌ 错误：compare类型只渲染左右栏标题，items列表完全没有渲染。
✅ 正确：compare类型必须逐条渲染left.items和right.items的所有内容。

## 公式渲染规则（硬规则，不可违反，违反会导致页面不合格）
- 数学公式、化学方程式等**必须用 addFormula 指令**，严禁用 addText 塞 LaTeX 文本
- **绝对禁止、严禁**使用 [Formula]、[formula]、【公式】等任何形式的占位符文本 — 遇到公式必须用 addFormula
- **自检清单**：生成完所有指令后，必须检查所有 addText 指令的 text 字段，确认其中不包含 [Formula]、[formula]、【公式】或任何 [xxx] 占位符模式。如果发现，立即删除该 addText 并替换为正确的 addFormula 指令。
- **如果 content 包含 formulas 数组，每个 formula 必须生成对应的 addFormula 指令，严禁忽略或省略**
- **formulas 数组渲染方式**：
  1. 先用 addText 渲染 label（普通文本，位于上方）
  2. 再用 addFormula 渲染 latex（公式图像，位于 label 下方）
  3. label 和 formula 垂直排列，间距 0.2"
  4. **如果 formulas[].latex 为空字符串或仅包含占位符（如 [Formula]），则只渲染 label，不生成 addFormula**
- formula 类型页面必须使用 addFormula 渲染 mainFormula 字段的内容
- 正文（cards.desc / keyPoints / scenarios.problem / steps.desc 等）中的数学表达式保持原文，由系统统一处理，不需要从中提取生成 addFormula。**但行内数学片段（如下标/上标/公式）务必用 $...$ 符号包裹**，例如 h'=h/n 写 $h'=h/n$、θ1 写 $theta_1$、sinθ2=sinθ1/n 写 $sin theta_2=sin theta_1/n$；未包裹的零散符号（如普通句子里的 θ）可保持原样，系统会做轻度规范。
- LaTeX 公式必须正确使用 ^ 上标和 _ 下标：电荷用 ^（如 Zn^{2+}、e^{-}），原子数用 _（如 H_2O、CO_2）。严禁省略括号写成 Zn2+ 或 H2O
- 流程步骤之间严禁使用 addText 输出孤立的 "→" 或 "->" 符号。步骤连接必须通过 addShape(LINE) 实现，或完全省略箭头，仅用编号区分步骤

## 页型布局参考（严格遵循）
- cover: 左对齐文本 + 背景装饰层(半透明圆/双层光晕/金色斜线) + 英文标签 + 金色短线条 + 超大标题 + 副标题 + 渐大方点 + 底部信息条，严格按下方"封面版式骨架"执行
- toc: 背景色 + 顶部标题"目录" + 纵向排列的章节列表(每项带序号,左对齐)
- chapter: 全屏背景色 + 左侧章节编号(极大字号,半透明) + 章节标题 + 副标题
- concept: 顶部标题 + 2-6个卡片(等宽横向排列或纵向排列) + 底部总结文本
- case: 顶部标题 + 1-3个案例卡片(问题在上,解答在下,分区明显) + 底部高亮文本。若 content 包含 formulas 数组，每个 formula 必须先用 addText 渲染 label，再用 addFormula 渲染 latex
- compare: 顶部标题 + 左右两栏对比(每栏标题+要点列表) + 底部结论(居中或横跨)
- process: 顶部标题 + 2-6个步骤(纵向列表,步骤间用LINE形状连接) + 底部说明。**关键约束**：画布高度仅7.5"，标题占0.7"，底部留0.4"边距，可用高度约6.4"。每个步骤(title+desc)至少占0.8"，连接线占0.15"。若步骤超过5个，必须大幅压缩每步高度（title高度≤0.25"，desc高度≤0.45"，间距≤0.6"），严禁内容溢出幻灯片底部(y>7.1")。
- table: 顶部标题 + 表格(居中,占页面宽度70-90%) + 底部总结。**关键约束**：表格实际高度 = 0.3" × (1+行数)，总结文本必须紧跟表格底部(y = 表格底部 + 0.2")，严禁在表格和总结之间留大片空白。
- formula: 顶部标题 + 主公式(居中,大字号,占页面核心位置) + 推导过程(下方,分步) + 应用(可选)
- timeline: 顶部标题 + 时间轴(横向或纵向主干线) + 事件节点(均匀分布)
- summary: 顶部标题 + 要点列表(纵向,每条带图标或编号)。**关键约束**：画布高度7.5"，标题占0.7"，底部留0.4"边距，可用高度约6.4"。要点数量若超过6条，必须压缩每条高度(≤0.5")和间距(≤0.55")，严禁内容溢出底部(y>7.1")。summary页不渲染公式，公式仅在concept/case/formula/process页出现。
- quiz: 顶部标题 + 1-5道题目(每题题干+选项纵向排列,选项带A/B/C/D前缀) + 答案标注
- end: 全屏背景色 + 居中结束语(大字号) + 副标语 + 底部感谢语

## 输出格式
只输出纯JSON:
{ "pageNum": N, "instructions": [...] }`;
}

function buildContentCompletenessHint(pageType: string, content: Record<string, unknown>): string {
  const hints: string[] = [];

  if (pageType === 'concept') {
    const cards = (content.cards as Array<{ title?: string; desc?: string }>) || [];
    if (cards.length > 0) {
      hints.push(
        `本页有 ${cards.length} 个概念卡片(cards)，必须全部渲染为独立的文本块。每个卡片包含标题(title)和描述(desc)，不能只渲染卡片标题而忽略描述。`,
      );
      cards.forEach((c, i) => hints.push(`  卡片${i + 1}: ${c.title || ''}`));
    }
    if (content.summary) hints.push(`本页有总结(summary)，必须在卡片下方渲染。`);
  } else if (pageType === 'case') {
    const scenarios =
      (content.scenarios as Array<{ problem?: string; answer?: string; analysis?: string }>) || [];
    if (scenarios.length > 0) {
      hints.push(
        `本页有 ${scenarios.length} 个案例场景(scenarios)，必须全部渲染。每个场景包含问题(problem)和解答(answer)，不能只渲染标题。`,
      );
      scenarios.forEach((s, i) =>
        hints.push(`  场景${i + 1}问题: ${(s.problem || '').slice(0, 40)}...`),
      );
    }
    if (content.highlight) hints.push(`本页有高亮文本(highlight)，必须渲染。`);
  } else if (pageType === 'compare') {
    const left = content.left as { title?: string; bullets?: string[] } | undefined;
    const right = content.right as { title?: string; bullets?: string[] } | undefined;
    if (left || right) {
      hints.push(`本页是左右对比(compare)，必须渲染左栏(left)和右栏(right)的全部内容。`);
      if (left) hints.push(`  左栏: ${left.title || ''}，${(left.bullets || []).length} 个要点`);
      if (right) hints.push(`  右栏: ${right.title || ''}，${(right.bullets || []).length} 个要点`);
    }
    if (content.conclusion) hints.push(`本页有结论(conclusion)，必须渲染。`);
  } else if (pageType === 'process') {
    const steps = (content.steps as Array<{ title?: string; desc?: string }>) || [];
    if (steps.length > 0) {
      hints.push(
        `本页有 ${steps.length} 个流程步骤(steps)，必须全部渲染。每个步骤包含标题(title)和描述(desc)。`,
      );
      steps.forEach((s, i) => hints.push(`  步骤${i + 1}: ${s.title || ''}`));
    }
  } else if (pageType === 'summary') {
    const keyPoints = (content.keyPoints as string[]) || [];
    if (keyPoints.length > 0)
      hints.push(`本页有 ${keyPoints.length} 个要点(keyPoints)，必须全部逐条渲染。`);
  } else if (pageType === 'table') {
    const headers = (content.headers as string[]) || [];
    const rows = (content.rows as unknown[]) || [];
    if (headers.length > 0) {
      hints.push(
        `本页是表格(table)，headers=[${headers.join(', ')}]，rows=${rows.length}行，必须用 addTable 渲染。`,
      );
      hints.push(
        `表格渲染提示：系统会根据内容长度自动调整列宽、字体大小和行高，支持复杂表格。如某单元格无内容可填"—"。`,
      );
    }
  }

  const formulaCount = Array.isArray(content.formulas)
    ? (content.formulas as Array<unknown>).length
    : 0;
  if (formulaCount > 0)
    hints.push(
      `本页有 ${formulaCount} 个公式(formulas)，必须用 addText(label)+addFormula(latex) 渲染。`,
    );

  return hints.length > 0
    ? '\n## 内容完整性要求（必须全部渲染，不可省略）\n' + hints.join('\n')
    : '';
}

export function buildUserPrompt(
  pageNum: number,
  pageType: string,
  content: Record<string, unknown>,
  totalPages: number,
  designDNA: DesignDNA,
  educationLevel?: string,
): string {
  const formulaCount = Array.isArray(content.formulas)
    ? (content.formulas as Array<unknown>).length
    : 0;
  const formulaHint =
    formulaCount > 0
      ? `\n⚠️ 重要：本页 content 包含 ${formulaCount} 个公式（formulas 数组），必须在 instructions 中为每个公式生成 addText(label) + addFormula(latex) 指令，不可省略。`
      : '';
  const mainFormulaHint =
    typeof (content as { mainFormula?: string }).mainFormula === 'string' &&
    (content as { mainFormula?: string }).mainFormula!.length > 0
      ? `\n⚠️ 重要：本页 content 包含主公式 mainFormula，必须用 addFormula 指令渲染，不可省略。`
      : '';
  const tableHint =
    pageType === 'table' && Array.isArray(content.headers) && Array.isArray(content.rows)
      ? `\n⚠️ 重要：本页是 table 类型，必须使用 addTable 指令渲染表格。headers: ${(content.headers as string[]).join(', ')}。rows 共 ${(content.rows as unknown[]).length} 行。`
      : '';
  const contentHint = buildContentCompletenessHint(pageType, content);

  return `页号: ${pageNum} / ${totalPages}${educationLevel ? `\n目标受众: ${educationLevel}` : ''}
页面类型: ${pageType}
背景色: ${pageNum === 1 || pageNum === totalPages ? designDNA.colors.coverBg : designDNA.colors.contentBg}
页面内容: ${JSON.stringify(content)}${formulaHint}${mainFormulaHint}${tableHint}${contentHint}

## 硬规则（不可违反）
1. 必须严格使用上面"页面内容"中的文本，**禁止扩展、补充或改写任何文字**。如果内容被截断（如标题末尾不完整），也必须原样使用，不可自行补全。
2. 所有文字内容（标题、正文、描述、结论等）必须完全来自页面内容JSON中的字段，禁止从 focus/keyConcepts/notes 中额外提取信息生成新文本。
3. 如果 content 中的文本为空或缺失，使用空字符串占位，不可自行编造内容。
4. **table 类型必须渲染 addTable 指令**，不能只用 addText 描述表格内容。
5. **formulas 数组中的每个公式必须渲染 addFormula 指令**，不能只渲染 label 文字。
6. **content 中的每个字段（cards/steps/scenarios/keyPoints/left/right 等）都必须渲染为对应的指令**，不能只渲染标题而忽略内容主体。
7. concept 类型：cards 数组中的每个 card 必须单独渲染标题+描述，不能只列标题。summary 必须渲染。
8. case 类型：scenarios 数组中的每个场景必须渲染 problem+answer，不能只渲染标题。
9. compare 类型：left 和 right 的所有 bullets 必须逐条渲染，不能只渲染栏目标题。conclusion 必须渲染。
10. process 类型：steps 数组中的每个步骤必须渲染标题+描述，不能只渲染标题。
11. summary 类型：keyPoints 数组中的每个要点必须逐条渲染，不能只渲染标题。

请严格按"页型布局参考"中 ${pageType} 的规范输出渲染指令JSON。`;
}

// ── Public API ──────────────────────────────────────────────────────

export interface PageDesignResult {
  success: boolean;
  pageInstructions?: PageInstructions;
  error?: string;
  fallback?: boolean;
}

export async function designPage(
  pageNum: number,
  pageType: string,
  content: Record<string, unknown>,
  totalPages: number,
  designDNA: DesignDNA,
  languageModel: LanguageModel,
  educationLevel?: string,
): Promise<PageDesignResult> {
  try {
    const system = buildSystemPrompt(designDNA, educationLevel);
    const user = buildUserPrompt(pageNum, pageType, content, totalPages, designDNA, educationLevel);

    log.info(`Designing page ${pageNum} (${pageType})`);

    // Cover is composed deterministically for guaranteed quality & run-to-run
    // consistency — the LLM's improvisation fluctuates and underperforms the
    // reference-informed layout here.
    if (pageType === 'cover') {
      const deterministic = buildFallbackInstructions(pageNum, pageType, content, designDNA);
      if (deterministic) {
        log.info(`Cover page ${pageNum}: deterministic cover composer`);
        return { success: true, pageInstructions: deterministic };
      }
    }

    const pageTypeTokenMap: Record<string, number> = {
      cover: 4096,
      toc: 4096,
      end: 4096,
      chapter: 4096,
      concept: 6144,
      case: 6144,
      compare: 6144,
      process: 6144,
      timeline: 6144,
      summary: 6144,
      quiz: 6144,
      table: 8192,
      formula: 8192,
    };

    const result = await callLLM(
      {
        model: languageModel,
        system,
        prompt: user,
        maxOutputTokens: pageTypeTokenMap[pageType] || 6144,
        temperature: 0.3,
      },
      `page-design-${pageNum}`,
      {
        retries: 2,
        timeoutMs: 300_000,
        validate: (text) => {
          try {
            const parsed = JSON.parse(cleanJsonText(text));
            return pageInstructionsSchema.safeParse(parsed).success;
          } catch {
            return false;
          }
        },
      },
      { mode: 'disabled', enabled: false },
    );

    let jsonText = cleanJsonText(result.text);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (parseErr) {
      const errMsg = parseErr instanceof Error ? parseErr.message : String(parseErr);
      const posMatch = errMsg.match(/position\s+(\d+)/i);
      const pos = posMatch ? parseInt(posMatch[1], 10) : -1;
      let repaired = false;

      if (pos > 0 && pos < jsonText.length) {
        // Strategy 1: unescaped quote just before error position
        if (jsonText[pos - 1] === '"') {
          const candidate = jsonText.slice(0, pos - 1) + '\\"' + jsonText.slice(pos);
          try {
            parsed = JSON.parse(candidate);
            jsonText = candidate;
            log.info(`Page ${pageNum} JSON repaired by escaping quote at pos=${pos - 1}`);
            repaired = true;
          } catch {
            /* fall through */
          }
        }

        // Strategy 2: missing comma — scan backwards and insert comma after terminators
        if (
          !repaired &&
          (errMsg.includes("Expected ',' or ']' after array element") ||
            errMsg.includes("Expected ',' or '}' after property value"))
        ) {
          for (let i = pos - 1; i >= 0; i--) {
            if (jsonText[i] === '}' || jsonText[i] === ']' || jsonText[i] === '"') {
              const candidate = jsonText.slice(0, i + 1) + ',' + jsonText.slice(i + 1);
              try {
                parsed = JSON.parse(candidate);
                jsonText = candidate;
                log.info(`Page ${pageNum} JSON repaired by inserting comma at pos=${i + 1}`);
                repaired = true;
                break;
              } catch {
                continue;
              }
            }
          }
        }
      }

      if (!repaired) {
        const rawPreview = result.text.slice(0, 1000);
        log.error(
          `Page ${pageNum} JSON parse failed. Raw preview:\n${rawPreview}\nParse error: ${errMsg}`,
        );
        return { success: false, error: `Page ${pageNum} JSON parse failed` };
      }
    }

    const validated = pageInstructionsSchema.safeParse(parsed);

    if (!validated.success) {
      // Log detailed diagnostic information
      const issues = validated.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
      const rawPreview = result.text.slice(0, 1000);
      log.error(
        `Page ${pageNum} instruction validation failed. Issues: ${issues}. Raw preview:\n${rawPreview}`,
      );

      // Attempt to auto-repair common issues
      const repaired = tryRepairInstructions(parsed as Record<string, unknown>);
      if (repaired) {
        const revalidated = pageInstructionsSchema.safeParse(repaired);
        if (revalidated.success) {
          log.info(`Page ${pageNum} auto-repaired and accepted`);
          return { success: true, pageInstructions: revalidated.data, fallback: true };
        }
      }

      // Last resort: generate fallback layout so the page is never empty
      log.warn(
        `Page ${pageNum} instruction validation failed after all repair attempts. Generating fallback.`,
      );
      const fallback = buildFallbackInstructions(pageNum, pageType, content, designDNA);
      if (fallback) {
        return { success: true, pageInstructions: fallback, fallback: true };
      }

      return {
        success: false,
        error: `Page ${pageNum} instruction validation failed after repair attempt`,
      };
    }

    let instructions = validated.data.instructions;

    // Post-validation A: deduplicate repeated text shapes on the same page
    const seenTexts = new Set<string>();
    const deduped: typeof instructions = [];
    let removedDups = 0;
    for (const inst of instructions) {
      if (inst.op === 'addText') {
        const p = (inst.params as Record<string, unknown>)?.text;
        const joined =
          typeof p === 'string' ? p : addTextPlain(p as Array<{ text: string }>);
        if (seenTexts.has(joined)) {
          removedDups++;
          continue;
        }
        seenTexts.add(joined);
      }
      deduped.push(inst);
    }
    if (removedDups > 0) {
      log.warn(`Page ${pageNum} removed ${removedDups} duplicate text shape(s)`);
      instructions = deduped;
    }

    // Post-validation B: ensure instruction density matches content richness
    // Threshold relaxed by 1: LLMs often skip optional fields (subtitle, tagline,
    // decorative shapes).  A page with title + main content is acceptable.
    const minInstructions = Math.max(2, getMinInstructionCount(pageType, content) - 1);
    const nonBgInstructions = instructions.filter((i) => i.op !== 'setBackground');
    const hasTable = instructions.some((i) => i.op === 'addTable');
    const hasFormula = instructions.some((i) => i.op === 'addFormula');
    const contentHasFormulas =
      (Array.isArray(content.formulas) && (content.formulas as Array<unknown>).length > 0) ||
      (pageType === 'formula' &&
        typeof (content as { mainFormula?: string }).mainFormula === 'string' &&
        (content as { mainFormula?: string }).mainFormula!.length > 0);
    const contentHasTable =
      pageType === 'table' &&
      Array.isArray(content.headers) &&
      (content.headers as Array<unknown>).length > 0;

    let needFallback = nonBgInstructions.length < minInstructions;
    if (contentHasTable && !hasTable) {
      log.warn(`Page ${pageNum} is table type but missing addTable instruction. Forcing fallback.`);
      needFallback = true;
    }
    if (contentHasFormulas && !hasFormula) {
      log.warn(
        `Page ${pageNum} has formulas but missing addFormula instruction. Forcing fallback.`,
      );
      needFallback = true;
    }

    // Post-validation C: content coverage check (prevent LLM from passing density check with decorative shapes only)
    const coverageResult = checkContentCoverage(instructions, content, pageType);
    if (!coverageResult.ok) {
      log.warn(
        `Page ${pageNum} (${pageType}) content coverage check failed: ${coverageResult.reason}. Forcing fallback.`,
      );
      needFallback = true;
    }

    if (needFallback) {
      log.warn(
        `Page ${pageNum} (${pageType}) has only ${nonBgInstructions.length} instructions, expected at least ${minInstructions}. Building fallback.`,
      );
      const fallback = buildFallbackInstructions(pageNum, pageType, content, designDNA);
      if (fallback) {
        // Coverage passed → LLM already rendered all content; only add decorative (non-text) elements
        // Coverage failed → need missing content, but deduplicate carefully
        const coveragePassed = coverageResult.ok;

        // Build a smarter text dedup index: strip common prefixes (bullets, numbering, step labels)
        const llmTextSet = new Set<string>();
        const llmTextCleanSet = new Set<string>();
        const llmFormulaSet = new Set<string>();
        for (const i of instructions) {
          if (i.op === 'addText') {
            const p = (i.params as Record<string, unknown>)?.text;
            const raw = (typeof p === 'string' ? p : addTextPlain(p as Array<{ text: string }>)).trim();
            llmTextSet.add(raw);
            llmTextCleanSet.add(stripTextPrefix(raw));
          }
          if (i.op === 'addFormula' && typeof i.params?.latex === 'string') {
            llmFormulaSet.add(i.params.latex.trim());
          }
        }

        const mergedInstructions = [...instructions];
        for (const inst of fallback.instructions) {
          // Skip background if LLM already set one
          if (inst.op === 'setBackground') {
            if (instructions.some((i) => i.op === 'setBackground')) continue;
          }

          if (inst.op === 'addText' && typeof inst.params?.text === 'string') {
            const fbText = (inst.params as { text: string }).text.trim();
            // If coverage already passed, never add fallback text (avoid duplication)
            if (coveragePassed) continue;
            // Smart dedup: exact match OR stripped-prefix match OR substring containment
            if (isDuplicateText(fbText, llmTextSet, llmTextCleanSet)) continue;
          }

          // Deduplicate fallback formulas against LLM formulas
          if (inst.op === 'addFormula' && typeof inst.params?.latex === 'string') {
            const fbLatex = inst.params.latex.trim();
            if (llmFormulaSet.has(fbLatex)) continue;
            // Also skip placeholder-only formulas
            if (/^\\text\{[^}]*\}$/.test(fbLatex)) continue;
          }

          mergedInstructions.push(inst);
        }
        log.info(
          `Page ${pageNum} using density fallback (merged): LLM=${instructions.length} + added=${mergedInstructions.length - instructions.length} instructions, coveragePassed=${coveragePassed}`,
        );
        return {
          success: true,
          pageInstructions: { pageNum, instructions: mergedInstructions },
          fallback: true,
        };
      }
    }

    return { success: true, pageInstructions: { pageNum, instructions } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`Page ${pageNum} design failed: ${msg}`);
    // Last resort: generate fallback so the page is never empty
    const fallback = buildFallbackInstructions(pageNum, pageType, content, designDNA);
    if (fallback) {
      log.warn(`Page ${pageNum} caught exception, using fallback layout`);
      return { success: true, pageInstructions: fallback, fallback: true };
    }
    return { success: false, error: `Page ${pageNum} design failed: ${msg}` };
  }
}

/**
 * Check whether the rendered instructions cover all content fields.
 * Prevents LLMs from passing density checks with decorative shapes only.
 */
function checkContentCoverage(
  instructions: Array<Record<string, unknown>>,
  content: Record<string, unknown>,
  pageType: string,
): { ok: boolean; reason?: string } {
  const renderedTexts = new Set(
    instructions
      .filter((i) => i.op === 'addText')
      .map((i) => {
        const p = (i.params as Record<string, unknown>)?.text;
        return Array.isArray(p)
          ? p.map((r) => ((r as Record<string, unknown>).text as string) ?? '').join('')
          : ((p as string | undefined) ?? '');
      })
      .map((t) => t.trim()),
  );
  const renderedClean = new Set([...renderedTexts].map((t) => stripTextPrefix(t)));

  /** Check if a raw content text is present in rendered output (with prefix tolerance). */
  function isRendered(rawText: string): boolean {
    const trimmed = rawText.trim();
    if (renderedTexts.has(trimmed)) return true;
    if (renderedClean.has(stripTextPrefix(trimmed))) return true;
    // Substring match: rendered text may be truncated or wrapped
    for (const rt of renderedTexts) {
      if (rt.includes(trimmed) || trimmed.includes(rt)) return true;
      const rtClean = stripTextPrefix(rt);
      if (rtClean.includes(trimmed) || trimmed.includes(rtClean)) return true;
    }
    return false;
  }

  switch (pageType) {
    case 'concept': {
      const cards = (content.cards as Array<{ title?: string; desc?: string }>) || [];
      if (cards.length === 0) return { ok: true }; // no cards to render
      const missedCards = cards.filter(
        (c) => !isRendered(c.title?.trim() || '') || !isRendered(c.desc?.trim() || ''),
      );
      if (missedCards.length > 0) {
        return {
          ok: false,
          reason: `${missedCards.length}/${cards.length} cards not rendered (title or desc missing)`,
        };
      }
      const summary = (content.summary as string) || '';
      if (summary.length > 10 && !isRendered(summary.trim())) {
        return { ok: false, reason: 'summary not rendered' };
      }
      return { ok: true };
    }
    case 'case': {
      const scenarios = (content.scenarios as Array<{ problem?: string; solution?: string }>) || [];
      if (scenarios.length === 0) return { ok: true };
      const missed = scenarios.filter(
        (s) => !isRendered(s.problem?.trim() || '') || !isRendered(s.solution?.trim() || ''),
      );
      if (missed.length > 0) {
        return { ok: false, reason: `${missed.length}/${scenarios.length} scenarios not rendered` };
      }
      return { ok: true };
    }
    case 'compare': {
      const left = content.left as { title?: string; items?: string[] } | undefined;
      const right = content.right as { title?: string; items?: string[] } | undefined;
      const leftItems = left?.items || [];
      const rightItems = right?.items || [];
      const allItems = [...leftItems, ...rightItems];
      const missed = allItems.filter((item) => !isRendered(item?.trim() || ''));
      if (missed.length > 0) {
        return {
          ok: false,
          reason: `${missed.length}/${allItems.length} compare items not rendered`,
        };
      }
      const conclusion = (content.conclusion as string) || '';
      if (conclusion.length > 10 && !isRendered(conclusion.trim())) {
        return { ok: false, reason: 'conclusion not rendered' };
      }
      return { ok: true };
    }
    case 'process': {
      const steps = (content.steps as Array<{ title?: string; desc?: string }>) || [];
      if (steps.length === 0) return { ok: true };
      const missed = steps.filter(
        (s) => !isRendered(s.title?.trim() || '') || !isRendered(s.desc?.trim() || ''),
      );
      if (missed.length > 0) {
        return { ok: false, reason: `${missed.length}/${steps.length} steps not rendered` };
      }
      return { ok: true };
    }
    case 'summary': {
      const keyPoints = (content.keyPoints as string[]) || [];
      if (keyPoints.length === 0) return { ok: true };
      const missed = keyPoints.filter((kp) => !isRendered(kp?.trim() || ''));
      if (missed.length > 0) {
        return { ok: false, reason: `${missed.length}/${keyPoints.length} keyPoints not rendered` };
      }
      return { ok: true };
    }
    case 'timeline': {
      const events = (content.events as Array<{ date?: string; content?: string }>) || [];
      if (events.length === 0) return { ok: true };
      const missed = events.filter(
        (e) => !isRendered(e.date?.trim() || '') || !isRendered(e.content?.trim() || ''),
      );
      if (missed.length > 0) {
        return {
          ok: false,
          reason: `${missed.length}/${events.length} timeline events not rendered`,
        };
      }
      return { ok: true };
    }
    case 'formula': {
      const mainFormula = (content.mainFormula as string) || '';
      const derivation = (content.derivation as string) || '';
      if (mainFormula.length > 0) {
        const hasFormulaInstr = instructions.some((i) => i.op === 'addFormula');
        if (!hasFormulaInstr)
          return { ok: false, reason: 'mainFormula not rendered as addFormula' };
      }
      if (derivation.length > 10 && !renderedTexts.has(derivation.trim())) {
        return { ok: false, reason: 'derivation not rendered' };
      }
      return { ok: true };
    }
    default:
      return { ok: true };
  }
}

/**
 * Calculate minimum expected instruction count based on page type and content richness.
 */
function getMinInstructionCount(pageType: string, content: Record<string, unknown>): number {
  switch (pageType) {
    case 'cover':
      return 6; // layered decor + title + subtitle + dots + footer strip
    case 'toc':
      return 3; // bg + title + items
    case 'chapter':
      return 3; // bg + num + title + subtitle
    case 'concept': {
      const cards = (content.cards as Array<unknown>)?.length || 0;
      return 2 + Math.max(cards * 2, 2); // bg + title + cards(title+desc each) + summary
    }
    case 'case': {
      const scenarios = (content.scenarios as Array<unknown>)?.length || 0;
      return 2 + Math.max(scenarios * 2, 2); // bg + title + scenarios(problem+answer)
    }
    case 'compare': {
      const leftBullets = (content.left as { bullets?: string[] })?.bullets?.length || 0;
      const rightBullets = (content.right as { bullets?: string[] })?.bullets?.length || 0;
      return 3 + leftBullets + rightBullets; // bg + title + left title + bullets + right title + bullets + conclusion
    }
    case 'process': {
      const steps = (content.steps as Array<unknown>)?.length || 0;
      return 2 + Math.max(steps * 2, 2); // bg + title + steps(title+desc)
    }
    case 'table': {
      return 3; // bg + title + table
    }
    case 'summary': {
      const keyPoints = (content.keyPoints as Array<unknown>)?.length || 0;
      return 2 + Math.max(keyPoints, 2); // bg + title + keyPoints
    }
    case 'formula':
      return 3; // bg + title + formula
    case 'timeline':
      return 3;
    case 'quiz':
      return 3;
    case 'end':
      return 3; // bg + slogan + thanks
    default:
      return 2;
  }
}

// ── Smart text deduplication helpers ────────────────────────────────

/** Strip common decorative prefixes for dedup comparison. */
function stripTextPrefix(text: string): string {
  return text
    .replace(/^[•·\-*–—\s]+/, '') // Bullet prefixes
    .replace(/^\d+[.．]\s*/, '') // Numbered list "1. "
    .replace(/^[(（]\d+[)）]\s*/, '') // "(1) "
    .replace(/^步骤\s*\d+[：:]\s*/, '') // "步骤1："
    .replace(/^第\s*\d+\s*步[：:]\s*/, '') // "第1步："
    .replace(/^[问题解答分析案例场景][:：]\s*/, '') // "问题：" "解答：" "分析："
    .trim();
}

/** Check if fallback text is semantically duplicate of any LLM-rendered text. */
function isDuplicateText(
  fallbackText: string,
  llmTextSet: Set<string>,
  llmTextCleanSet: Set<string>,
): boolean {
  const ft = fallbackText.trim();
  if (llmTextSet.has(ft)) return true;

  const ftClean = stripTextPrefix(ft);
  if (llmTextCleanSet.has(ftClean)) return true;

  // Substring containment for long text (LLM may truncate or wrap)
  if (ftClean.length > 15) {
    for (const clean of llmTextCleanSet) {
      if (clean.length > 15) {
        if (clean.includes(ftClean) || ftClean.includes(clean)) return true;
      }
    }
  }

  // Prefix match: LLM may render a truncated version of the same text
  // e.g. LLM: "光合作用的总反应方程式为 6CO₂ +"  vs fallback: "光合作用的总反应方程式为 6CO₂ + 12H₂O..."
  if (ftClean.length >= 20) {
    const prefixLen = Math.min(40, Math.floor(ftClean.length * 0.6));
    const ftPrefix = ftClean.slice(0, prefixLen);
    for (const clean of llmTextCleanSet) {
      if (clean.length >= 20 && clean.slice(0, prefixLen) === ftPrefix) return true;
    }
  }

  return false;
}

/**
 * Build fallback instructions when LLM output is too sparse.
 * Generates basic but complete layout instructions based on content type.
 */
function buildFallbackInstructions(
  pageNum: number,
  pageType: string,
  content: Record<string, unknown>,
  designDNA: DesignDNA,
): PageInstructions | null {
  const { colors, fonts } = designDNA;
  const bg = pageNum === 1 ? colors.coverBg : colors.contentBg;
  const instructions: Array<Record<string, unknown>> = [
    { op: 'setBackground', params: { color: bg } },
  ];

  const addTxt = (
    text: string,
    x: number,
    y: number,
    w: number,
    h: number,
    opts: Record<string, unknown> = {},
  ) => ({
    op: 'addText',
    params: {
      text,
      x,
      y,
      w,
      h,
      fontSize: 14,
      fontFace: fonts.body,
      color: colors.textBody,
      align: 'left',
      ...opts,
    },
  });

  const PANEL = (
    x: number,
    y: number,
    w: number,
    h: number,
    opts: Record<string, unknown> = {},
  ) => ({
    op: 'addShape',
    params: {
      type: 'ROUNDED_RECTANGLE',
      x,
      y,
      w,
      h,
      fillColor: colors.accentLight,
      lineColor: 'E4DEC6',
      lineWidth: 1,
      rectRadius: 0.12,
      shadow: {
        type: 'outer',
        color: colors.textPrimary,
        blur: 6,
        offset: 2,
        angle: 45,
        opacity: 12,
      },
      ...opts,
    } as Record<string, unknown>,
  });

  // Numbered circle chip: must be requested with an OVAL then the numeral text.
  const chipOv = (x: number, y: number, d = 0.42, fill = colors.accent) => ({
    op: 'addShape',
    params: { type: 'OVAL', x, y, w: d, h: d, fillColor: fill },
  });
  const chipNum = (label: string | number, x: number, y: number, d = 0.42) =>
    addTxt(String(label), x, y + 0.04, d, d - 0.06, {
      fontSize: 16,
      fontFace: fonts.heading,
      color: colors.textOnDark,
      bold: true,
      align: 'center',
      valign: 'middle',
    });

  const title = (content.title as string) || '';

  switch (pageType) {
    case 'concept': {
      instructions.push(
        addTxt(title, 0.8, 0.5, 11.7, 0.7, {
          fontSize: fonts.pageTitleSize,
          fontFace: fonts.heading,
          color: colors.textPrimary,
          bold: true,
        }),
      );
      const cards = (content.cards as Array<{ title?: string; desc?: string }>) || [];
      // Wrap the whole card list in one rounded panel; add per-card number chips.
      const panelTop = 1.4;
      const panelBottom = cards.length > 0 ? Math.min(6.9, panelTop + cards.length * 1.25 + 0.4) : 2.2;
      instructions.push(PANEL(0.5, panelTop, 12.3, Math.max(0.8, panelBottom - panelTop)));
      let y = panelTop + 0.3;
      cards.forEach((card, ci) => {
        const chipX = 0.85;
        instructions.push(chipOv(chipX, y, 0.42));
        instructions.push(chipNum(ci + 1, chipX, y, 0.42));
        instructions.push(
          addTxt(card.title || '', chipX + 0.6, y - 0.02, 10.6, 0.42, {
            fontSize: 16,
            fontFace: fonts.heading,
            color: colors.textPrimary,
            bold: true,
          }),
        );
        instructions.push(
          addTxt(card.desc || '', chipX + 0.6, y + 0.42, 10.9, 0.72, { fontSize: 13 }),
        );
        y += 1.2;
      });
      if (content.summary) {
        instructions.push(
          addTxt(content.summary as string, 0.8, Math.min(y + 0.15, 6.5), 11.7, 0.5, {
            fontSize: 13,
            fontFace: fonts.heading,
            color: colors.textMuted,
            italic: true,
            bold: false,
          }),
        );
      }
      // Formulas are appended uniformly after the switch block (see below)
      // to avoid double-injection when fallback merges with LLM output.
      break;
    }
    case 'case': {
      instructions.push(
        addTxt(title, 0.8, 0.5, 11.7, 0.7, {
          fontSize: fonts.pageTitleSize,
          fontFace: fonts.heading,
          color: colors.textPrimary,
          bold: true,
        }),
      );
      const scenarios =
        (content.scenarios as Array<{ problem?: string; solution?: string; analysis?: string }>) ||
        [];
      // One panel wrapping the scenario stack (cases are tall; panel adapts).
      const scenarioTop = 1.4;
      let y = scenarioTop + 0.3;
      const scenarioH = scenarios.length * 3.2;
      instructions.push(PANEL(0.5, scenarioTop, 12.3, Math.min(4.6, Math.max(1.2, scenarioH))));
      scenarios.forEach((s, si) => {
        const chipX = 0.85;
        instructions.push(chipOv(chipX, y, 0.42));
        instructions.push(chipNum(si + 1, chipX, y, 0.42));
        instructions.push(
          addTxt('问题: ' + (s.problem || ''), chipX + 0.6, y, 11.0, 0.7, {
            fontSize: 14,
            fontFace: fonts.heading,
            color: colors.textPrimary,
            bold: true,
          }),
        );
        instructions.push(
          addTxt('解答: ' + (s.solution || ''), chipX + 0.6, y + 0.75, 11.0, 1.1, {
            fontSize: 13,
          }),
        );
        if (s.analysis) {
          instructions.push(
            addTxt('分析: ' + s.analysis, chipX + 0.6, y + 1.95, 11.0, 0.8, {
              fontSize: 12,
              color: colors.textMuted,
              italic: true,
            }),
          );
        }
        y += 3.2;
      });
      if (content.highlight) {
        // Full-width accent banner with white bold text (核心论点条)
        instructions.push({
          op: 'addShape',
          params: {
            type: 'ROUNDED_RECTANGLE',
            x: 0.5,
            y: 6.15,
            w: 12.3,
            h: 0.72,
            fillColor: colors.accentSecondary,
            rectRadius: 0.1,
          },
        });
        instructions.push(
          addTxt(content.highlight as string, 0.9, 6.22, 11.5, 0.6, {
            fontSize: 15,
            fontFace: fonts.heading,
            color: colors.textOnDark,
            bold: true,
            align: 'center',
            valign: 'middle',
          }),
        );
      }
      break;
    }
    case 'compare': {
      instructions.push(
        addTxt(title, 0.8, 0.5, 11.7, 0.7, {
          fontSize: fonts.pageTitleSize,
          fontFace: fonts.heading,
          color: colors.textPrimary,
          bold: true,
        }),
      );
      const left = content.left as { title?: string; bullets?: string[] } | undefined;
      const right = content.right as { title?: string; bullets?: string[] } | undefined;
      // Two-panel symmetric skeleton with number chips ① ②.
      const colY = 1.4;
      const colH = 4.6;
      instructions.push(PANEL(0.5, colY, 6.05, colH));
      instructions.push(PANEL(6.8, colY, 6.05, colH));
      if (left) {
        instructions.push(chipOv(0.85, colY + 0.25, 0.42, colors.accent));
        instructions.push(chipNum('①', 0.85, colY + 0.25, 0.42));
        instructions.push(
          addTxt(left.title || '', 1.4, colY + 0.28, 5.05, 0.45, {
            fontSize: 16,
            fontFace: fonts.heading,
            color: colors.accent,
            bold: true,
          }),
        );
        let y = colY + 0.95;
        for (const b of left.bullets || []) {
          instructions.push(addTxt('• ' + b, 0.85, y, 5.5, 0.5, { fontSize: 13 }));
          y += 0.55;
        }
      }
      if (right) {
        instructions.push(chipOv(7.15, colY + 0.25, 0.42, colors.accentSecondary));
        instructions.push(chipNum('②', 7.15, colY + 0.25, 0.42));
        instructions.push(
          addTxt(right.title || '', 7.7, colY + 0.28, 5.05, 0.45, {
            fontSize: 16,
            fontFace: fonts.heading,
            color: colors.accentSecondary,
            bold: true,
          }),
        );
        let y = colY + 0.95;
        for (const b of right.bullets || []) {
          instructions.push(addTxt('• ' + b, 7.15, y, 5.5, 0.5, { fontSize: 13 }));
          y += 0.55;
        }
      }
      if (content.conclusion) {
        instructions.push({
          op: 'addShape',
          params: {
            type: 'ROUNDED_RECTANGLE',
            x: 0.5,
            y: 6.2,
            w: 12.3,
            h: 0.72,
            fillColor: colors.accentSecondary,
            rectRadius: 0.1,
          },
        });
        instructions.push(
          addTxt(content.conclusion as string, 0.9, 6.27, 11.5, 0.6, {
            fontSize: 15,
            fontFace: fonts.heading,
            color: colors.textOnDark,
            bold: true,
            align: 'center',
            valign: 'middle',
          }),
        );
      }
      break;
    }
    case 'process': {
      instructions.push(
        addTxt(title, 0.8, 0.5, 11.7, 0.7, {
          fontSize: fonts.pageTitleSize,
          fontFace: fonts.heading,
          color: colors.textPrimary,
          bold: true,
        }),
      );
      const steps = (content.steps as Array<{ title?: string; desc?: string }>) || [];
      // Dynamically compute step height so all steps fit within slide bounds (title ends at 1.2, leave 0.4" margin)
      const availableH = 7.5 - 1.2 - 0.4; // ≈ 5.9"
      const stepSpacing = steps.length > 0 ? availableH / steps.length : 1.4;
      // Wrap steps in one rounded panel + per-step number chips.
      instructions.push(PANEL(0.5, 1.2, 12.3, Math.min(5.8, steps.length * stepSpacing + 0.4)));
      let y = 1.4;
      let si = 1;
      for (const s of steps) {
        const chipX = 0.85;
        instructions.push(chipOv(chipX, y, 0.4));
        instructions.push(chipNum(si, chipX, y, 0.4));
        instructions.push(
          addTxt(s.title || '', chipX + 0.55, y - 0.02, 11.2, 0.35, {
            fontSize: 15,
            fontFace: fonts.heading,
            color: colors.textPrimary,
            bold: true,
          }),
        );
        instructions.push(
          addTxt(s.desc || '', chipX + 0.55, y + 0.4, 11.3, stepSpacing - 0.45, { fontSize: 13 }),
        );
        y += stepSpacing;
        si++;
        if (y > 7.0) break; // hard stop before bottom
      }
      break;
    }
    case 'table': {
      instructions.push(
        addTxt(title, 0.8, 0.5, 11.7, 0.7, {
          fontSize: fonts.pageTitleSize,
          fontFace: fonts.heading,
          color: colors.textPrimary,
          bold: true,
        }),
      );
      const headers = (content.headers as string[]) || [];
      const rows = (content.rows as string[][]) || [];
      if (headers.length > 0) {
        instructions.push({
          op: 'addTable',
          params: {
            headers,
            rows,
            x: 0.5,
            y: 1.5,
            w: 12.3,
            headerBgColor: colors.accent,
            borderColor: colors.textMuted,
            fontFace: fonts.body,
            textColor: colors.textBody,
          },
        });
      }
      if (content.summary) {
        // Estimate table height: header ~0.3" + each row ~0.3" to avoid large gap between table and summary
        const estimatedTableH = 0.3 * (1 + rows.length);
        const summaryY = Math.min(1.5 + estimatedTableH + 0.2, 6.5);
        instructions.push(
          addTxt(content.summary as string, 0.8, summaryY, 11.7, Math.max(0.5, 7.1 - summaryY), {
            fontSize: 13,
            fontFace: fonts.heading,
            color: colors.textMuted,
            italic: true,
          }),
        );
      }
      break;
    }
    case 'formula': {
      instructions.push(
        addTxt(title, 0.8, 0.5, 11.7, 0.7, {
          fontSize: fonts.pageTitleSize,
          fontFace: fonts.heading,
          color: colors.textPrimary,
          bold: true,
        }),
      );
      const mainFormula = (content.mainFormula as string) || '';
      if (mainFormula) {
        instructions.push({
          op: 'addFormula',
          params: {
            latex: mainFormula,
            x: 1,
            y: 2,
            w: 10.7,
            h: 1.2,
            fontSize: 18,
            color: colors.textBody,
          },
        });
      }
      const derivation = (content.derivation as string) || '';
      if (derivation) {
        instructions.push(addTxt(derivation, 0.8, 3.5, 11.7, 2.0, { fontSize: 13 }));
      }
      const application = (content.application as string) || '';
      if (application) {
        instructions.push(
          addTxt(application, 0.8, 5.8, 11.7, 0.8, {
            fontSize: 12,
            color: colors.textMuted,
            italic: true,
          }),
        );
      }
      break;
    }
    case 'summary': {
      instructions.push(
        addTxt(title, 0.8, 0.5, 11.7, 0.7, {
          fontSize: fonts.pageTitleSize,
          fontFace: fonts.heading,
          color: colors.textPrimary,
          bold: true,
        }),
      );
      const keyPoints = (content.keyPoints as string[]) || [];
      // Dynamically adjust height so all keyPoints fit within slide bounds (leave 0.5" margin at bottom)
      const availableH = 7.5 - 1.5 - 0.5; // from y=1.5 to bottom margin
      const pointH = keyPoints.length > 0 ? Math.min(0.6, availableH / keyPoints.length) : 0.6;
      const spacing = keyPoints.length > 0 ? Math.min(0.7, availableH / keyPoints.length) : 0.7;
      // Wrap key points in one rounded panel + per-point number chips.
      instructions.push(
        PANEL(0.5, 1.4, 12.3, Math.min(5.6, keyPoints.length * spacing + 0.5)),
      );
      let y = 1.6;
      keyPoints.forEach((kp, ki) => {
        const chipX = 0.85;
        instructions.push(chipOv(chipX, y, 0.4));
        instructions.push(chipNum(ki + 1, chipX, y, 0.4));
        instructions.push(addTxt(kp, chipX + 0.55, y - 0.02, 11.2, pointH, { fontSize: 14 }));
        y += spacing;
      });
      // Summary pages should NOT render formulas — formulas belong on concept/case/formula/process pages
      break;
    }
    case 'chapter': {
      const num = (content.num as string) || '';
      const subtitle = (content.subtitle as string) || '';
      // Layout: num (large, top) → line → title → subtitle (bottom)
      // Generous spacing prevents overlap with large num font
      if (num) {
        instructions.push(
          addTxt(num, 0.8, 1.2, 11.7, 1.6, {
            fontSize: 64,
            fontFace: fonts.heading,
            color: colors.accent,
            bold: true,
            align: 'center',
          }),
        );
      }
      // Decorative line under number
      instructions.push({
        op: 'addShape',
        params: { shapeType: 'rect', x: 5.5, y: 3.0, w: 1.5, h: 0.04, fillColor: colors.accent },
      });
      // Title below line
      instructions.push(
        addTxt(title, 0.8, 3.3, 11.7, 0.9, {
          fontSize: fonts.pageTitleSize,
          fontFace: fonts.heading,
          color: colors.textPrimary,
          bold: true,
          align: 'center',
        }),
      );
      // Subtitle below title
      if (subtitle) {
        instructions.push(
          addTxt(subtitle, 0.8, 4.4, 11.7, 0.8, {
            fontSize: 16,
            fontFace: fonts.body,
            color: colors.textMuted,
            align: 'center',
          }),
        );
      }
      break;
    }
    case 'cover': {
      const subtitle = (content.subtitle as string) || '';
      // 中式封面：水墨底纹 + 竖排楷体标题 + 朱红印鉴
      const isChineseStyle =
        /中式|古典|水墨/.test(String(designDNA.styleName || '')) ||
        designDNA.decoration?.motif === 'chinese-seal';
      if (isChineseStyle) {
        const ink = colors.accentSecondary || colors.textPrimary; // 深墨
        const accent = colors.accent; // 朱红
        const onDark = colors.textOnDark; // 暖白
        // ── 背景装饰层（Z轴最底）──
        instructions.push({
          op: 'addShape',
          params: {
            type: 'OVAL',
            x: -0.4,
            y: 0.1,
            w: 4.6,
            h: 4.6,
            fillColor: ink,
            fillTransparency: 88,
          },
        });
        instructions.push({
          op: 'addShape',
          params: {
            type: 'OVAL',
            x: 8.6,
            y: 4.3,
            w: 3.7,
            h: 3.7,
            fillColor: ink,
            fillTransparency: 88,
          },
        });
        // 主标题背后的淡朱光晕，为深墨标题托底形成对比
        instructions.push({
          op: 'addShape',
          params: {
            type: 'OVAL',
            x: 8.4,
            y: 1.1,
            w: 3.9,
            h: 4.1,
            fillColor: accent,
            fillTransparency: 92,
          },
        });
        // 顶部 / 底部朱砂细边
        for (const [yy, hh] of [
          [0, 0.045],
          [7.455, 0.045],
        ] as const) {
          instructions.push({
            op: 'addShape',
            params: {
              type: 'RECTANGLE',
              x: 0,
              y: yy,
              w: 13.33,
              h: hh,
              fillColor: accent,
              fillTransparency: 30,
            },
          });
        }
        // 左侧朱红竖线（填充留白 + 划分信息区）
        instructions.push({
          op: 'addShape',
          params: {
            type: 'RECTANGLE',
            x: 3.05,
            y: 1.3,
            w: 0.035,
            h: 4.7,
            fillColor: accent,
            fillTransparency: 8,
          },
        });
        // 底部深墨信息带（强对比、填底）
        instructions.push({
          op: 'addShape',
          params: {
            type: 'RECTANGLE',
            x: 0,
            y: 6.5,
            w: 13.33,
            h: 1.0,
            fillColor: ink,
          },
        });
        instructions.push({
          op: 'addShape',
          params: {
            type: 'RECTANGLE',
            x: 0,
            y: 6.47,
            w: 13.33,
            h: 0.035,
            fillColor: accent,
          },
        });
        // ── 顶部学科标签 ──
        instructions.push(
          addTxt('OPTICS  ·  光 学', 0.8, 0.58, 6, 0.42, {
            fontSize: 13,
            fontFace: fonts.en,
            color: accent,
            bold: true,
            charSpacing: 4,
          }),
        );
        // ── 左侧竖排章节字（补白）──
        ;['高', '中', '物', '理'].forEach((ch, i) => {
          instructions.push(
            addTxt(ch, 1.15, 1.95 + i * 0.5, 1.2, 0.5, {
              fontSize: 18,
              fontFace: 'KaiTi',
              color: accent,
              bold: true,
              align: 'center',
            }),
          );
        });
        // ── 竖排主标题（首字朱红对比，余字深墨）──
        const coverChars = String(content.title || title || '')
          .replace(/\s/g, '')
          .split('');
        const ccH = 0.66;
        const ccTotal = coverChars.length * ccH;
        const ccStart = (7.2 - ccTotal) / 2;
        coverChars.forEach((ch, i) => {
          instructions.push(
            addTxt(ch, 8.9, ccStart + i * ccH, 2.6, ccH, {
              fontSize: Math.min(44, fonts.pageTitleSize),
              fontFace: 'KaiTi',
              color: i === 0 ? accent : ink,
              bold: true,
              align: 'center',
            }),
          );
        });
        // ── 朱红印章（logo 落款，置于信息带之上）──
        instructions.push({
          op: 'addShape',
          params: {
            type: 'RECTANGLE',
            x: 12.15,
            y: 6.62,
            w: 0.78,
            h: 0.78,
            fillColor: accent,
            lineColor: onDark,
            lineWidth: 0.6,
          },
        });
        instructions.push(
          addTxt('雅', 12.15, 6.62, 0.78, 0.78, {
            fontSize: 16,
            fontFace: 'KaiTi',
            color: onDark,
            align: 'center',
            valign: 'middle',
            bold: true,
          }),
        );
        // ── 底部信息带文字（白字，强对比）──
        instructions.push(
          addTxt(subtitle || '教学课件', 0.95, 6.68, 10, 0.6, {
            fontSize: 20,
            fontFace: fonts.heading,
            color: onDark,
            bold: true,
            align: 'left',
          }),
        );
        instructions.push(
          addTxt('书 于 灯 火 处 · 传 授 光 之 理', 8.1, 6.72, 3.8, 0.5, {
            fontSize: 11,
            fontFace: fonts.en,
            color: colors.accent,
            align: 'right',
            charSpacing: 2,
          }),
        );
        return { pageNum, instructions: instructions as PageInstructions['instructions'] };
      }
      // Top-left EN micro-label (wide letter-spacing for a designed feel)
      instructions.push(
        addTxt('TEACHING COURSEWARE', 0.8, 0.55, 8, 0.4, {
          fontSize: 14,
          fontFace: fonts.en,
          color: colors.accent,
          charSpacing: 6,
        }),
      );
      // Gold short overline above the main title
      instructions.push({
        op: 'addShape',
        params: {
          type: 'RECTANGLE',
          x: 0.8,
          y: 1.85,
          w: 1.1,
          h: 0.06,
          fillColor: colors.accent,
        },
      });
      // Main title: oversized, left-aligned
      instructions.push(
        addTxt(title, 0.8, 2.2, 11.7, 1.3, {
          fontSize: Math.max(fonts.pageTitleSize + 12, 56),
          fontFace: fonts.heading,
          color: colors.textOnDark,
          bold: true,
          charSpacing: 2,
        }),
      );
      // Subtitle: smaller, with a small gold chip marker on the left
      if (subtitle) {
        instructions.push({
          op: 'addShape',
          params: { type: 'RECTANGLE', x: 0.8, y: 3.78, w: 0.09, h: 0.32, fillColor: colors.accent },
        });
        instructions.push(
          addTxt(subtitle, 1.05, 3.6, 9, 0.7, {
            fontSize: 22,
            fontFace: fonts.body,
            color: colors.accentLight,
          }),
        );
      }
      // Three progressively larger dots (concentric up), signature academic accent
      const dotY = 4.55;
      const dots: Array<[number, number, number]> = [
        [0.8, 0.12, 30],
        [1.1, 0.2, 45],
        [1.5, 0.32, 60],
      ];
      for (const [x, d, t] of dots) {
        instructions.push({
          op: 'addShape',
          params: {
            type: 'OVAL',
            x,
            y: dotY - d / 2,
            w: d,
            h: d,
            fillColor: colors.accent,
            fillTransparency: t,
          },
        });
      }
      // Footer anchoring hairline + date
      instructions.push({
        op: 'addShape',
        params: { type: 'RECTANGLE', x: 0.5, y: 6.9, w: 12.33, h: 0.02, fillColor: colors.accent },
      });
      instructions.push(
        addTxt('高中教学课件', 0.8, 6.55, 6, 0.4, {
          fontSize: 12,
          fontFace: fonts.body,
          color: colors.accentLight,
        }),
      );
      break;
    }
    case 'end': {
      const slogan = (content.slogan as string) || '';
      const thanks = (content.thanks as string) || '感谢您的学习与探索';
      // Thanks centered
      instructions.push(
        addTxt(thanks, 0.8, 2.5, 11.7, 1.0, {
          fontSize: fonts.pageTitleSize + 2,
          fontFace: fonts.heading,
          color: colors.textPrimary,
          bold: true,
          align: 'center',
        }),
      );
      // Decorative line
      instructions.push({
        op: 'addShape',
        params: { shapeType: 'rect', x: 5.5, y: 3.7, w: 1.5, h: 0.04, fillColor: colors.accent },
      });
      // Slogan
      if (slogan) {
        instructions.push(
          addTxt(slogan, 0.8, 4.0, 11.7, 0.7, {
            fontSize: 16,
            fontFace: fonts.body,
            color: colors.textMuted,
            align: 'center',
          }),
        );
      }
      break;
    }
    default: {
      // Generic fallback: just title
      instructions.push(
        addTxt(title, 0.8, 0.5, 11.7, 0.7, {
          fontSize: fonts.pageTitleSize,
          fontFace: fonts.heading,
          color: colors.textPrimary,
          bold: true,
        }),
      );
    }
  }

  // Append formulas if any (only for page types that actually support them)
  // summary type handles formulas inside its switch-case above
  const formulaEligibleTypes = ['concept', 'case', 'formula', 'process'];
  if (formulaEligibleTypes.includes(pageType)) {
    const formulas = (content.formulas as Array<{ label?: string; latex?: string }>) || [];
    // Compute a safe Y so formulas don't fall off the 7.5" slide.
    // Find the bottom-most text/formula shape already placed.
    let maxY = 1.0;
    for (const inst of instructions) {
      const p = inst.params as Record<string, unknown> | undefined;
      if (p && typeof p.y === 'number' && typeof p.h === 'number') {
        const bottom = (p.y as number) + (p.h as number);
        if (bottom > maxY) maxY = bottom;
      }
    }
    let formulaY = Math.min(maxY + 0.3, 6.0);
    for (const f of formulas) {
      // Skip placeholder formulas that are just \text{label} with no actual math/chem content
      const isPlaceholder = f.latex && /^\\text\{[^}]*\}$/.test(f.latex.trim());
      if (isPlaceholder) continue;
      if (f.label) {
        instructions.push(
          addTxt(f.label, 0.8, formulaY, 11.7, 0.4, {
            fontSize: 13,
            fontFace: fonts.heading,
            bold: true,
            color: colors.textMuted,
          }),
        );
        formulaY += 0.45;
      }
      if (f.latex) {
        instructions.push({
          op: 'addFormula',
          params: {
            latex: f.latex,
            x: 0.8,
            y: formulaY,
            w: 11.7,
            h: 0.6,
            fontSize: 14,
            color: colors.textBody,
          },
        });
        formulaY += 0.7;
      }
      // Prevent cascading off-slide
      if (formulaY > 7.0) break;
    }
  }

  if (instructions.length <= 1) return null;
  return { pageNum, instructions: instructions as PageInstructions['instructions'] };
}

/**
 * Attempt to auto-repair common LLM output issues in page instructions.
 * Returns repaired object or null if unrepairable.
 */
function tryRepairInstructions(parsed: Record<string, unknown>): Record<string, unknown> | null {
  if (!parsed || typeof parsed !== 'object') return null;

  const pageNum = typeof parsed.pageNum === 'number' ? parsed.pageNum : 1;
  const rawInstructions = Array.isArray(parsed.instructions) ? parsed.instructions : [];
  const repairedInstructions: Array<Record<string, unknown>> = [];

  for (const inst of rawInstructions) {
    if (!inst || typeof inst !== 'object') continue;
    const i = inst as Record<string, unknown>;
    const op = typeof i.op === 'string' ? i.op : undefined;
    if (!op) continue;

    // Ensure params exists
    if (!i.params || typeof i.params !== 'object') {
      i.params = {};
    }
    const params = i.params as Record<string, unknown>;

    // Strip # from color values in params
    for (const key of Object.keys(params)) {
      if (typeof params[key] === 'string' && /^(#?[0-9A-Fa-f]{6})$/.test(params[key] as string)) {
        params[key] = (params[key] as string).replace(/^#/, '');
      }
    }

    // Ensure numeric coordinates are actually numbers
    for (const numKey of [
      'x',
      'y',
      'w',
      'h',
      'fontSize',
      'lineWidth',
      'rotate',
      'rectRadius',
      'fillTransparency',
      'transparency',
    ]) {
      if (numKey in params && typeof params[numKey] !== 'number') {
        const n = Number(params[numKey]);
        if (!Number.isNaN(n)) params[numKey] = n;
      }
    }

    // Clamp coordinates to safe slide bounds
    for (const boundKey of ['x', 'y']) {
      if (boundKey in params && typeof params[boundKey] === 'number') {
        params[boundKey] = Math.max(0, Math.min(10, params[boundKey] as number));
      }
    }
    for (const sizeKey of ['w', 'h']) {
      if (sizeKey in params && typeof params[sizeKey] === 'number') {
        params[sizeKey] = Math.max(0.1, Math.min(13.3, params[sizeKey] as number));
      }
    }

    // Ensure booleans are actually booleans
    for (const boolKey of ['bold', 'italic', 'rounding', 'showTitle', 'showLegend']) {
      if (boolKey in params) {
        const v = params[boolKey];
        if (typeof v === 'string') {
          params[boolKey] = v.toLowerCase() === 'true';
        }
      }
    }

    // Fix shadow: if it's a boolean, convert to default shadow object or remove
    if ('shadow' in params) {
      const v = params.shadow;
      if (typeof v === 'boolean') {
        if (v) {
          params.shadow = {
            type: 'outer',
            color: '808080',
            blur: 3,
            offset: 2,
            angle: 45,
            opacity: 0.3,
          };
        } else {
          delete params.shadow;
        }
      } else if (v && typeof v === 'object') {
        // Ensure numeric fields in shadow object are numbers
        const shadowObj = v as Record<string, unknown>;
        for (const numKey of ['blur', 'offset', 'angle', 'opacity']) {
          if (numKey in shadowObj && typeof shadowObj[numKey] !== 'number') {
            const n = Number(shadowObj[numKey]);
            if (!Number.isNaN(n)) shadowObj[numKey] = n;
          }
        }
        if (shadowObj.color && typeof shadowObj.color === 'string') {
          shadowObj.color = (shadowObj.color as string).replace(/^#/, '');
        }
      }
    }

    repairedInstructions.push(i);
  }

  if (repairedInstructions.length === 0) return null;
  return { pageNum, instructions: repairedInstructions };
}
