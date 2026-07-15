import type { SceneOutline } from '@/lib/types/generation';

type LayoutRecipe = {
  name: string;
  anchor: string;
  composition: string;
  requiredBlocks: string;
  avoid: string;
};

const LAYOUT_RECIPES: LayoutRecipe[] = [
  {
    name: 'overview-matrix',
    anchor: 'decision table plus short takeaway band',
    composition: 'wide title, one central comparison table, one compact bottom summary',
    requiredBlocks: 'scenario, choice rule, risk check, one-sentence conclusion',
    avoid: '2x2 cards and title-only pages',
  },
  {
    name: 'process-chain',
    anchor: 'left-to-right flow diagram',
    composition: '3-4 aligned steps with arrows, plus one caution note below',
    requiredBlocks: 'input, processing step, result, failure point',
    avoid: 'floating labels that are not inside the step boxes',
  },
  {
    name: 'internal-structure',
    anchor: 'structure diagram',
    composition: 'large visual anchor on one side, explanation ladder on the other side',
    requiredBlocks: 'component name, role, operation, classroom takeaway',
    avoid: 'decorative shapes without semantic labels',
  },
  {
    name: 'split-details',
    anchor: 'two-column detail map',
    composition: 'one side uses stacked detail rows, the other side uses a concrete diagram',
    requiredBlocks: 'definition, example, common mistake, verification',
    avoid: 'same-size empty cards with only headings',
  },
  {
    name: 'comparison-bands',
    anchor: 'two horizontal content bands',
    composition: 'top band for concept contrast, bottom band for application contrast',
    requiredBlocks: 'what changes, when to use it, command or formula, summary',
    avoid: 'thin bottom text and unexplained icons',
  },
  {
    name: 'chain-and-notes',
    anchor: 'linked-node diagram',
    composition: 'node chain or relation graph across the middle, notes panel near one edge',
    requiredBlocks: 'node meaning, transition rule, example, limitation',
    avoid: 'node labels like Node 1/2/3 without content',
  },
  {
    name: 'center-stage',
    anchor: 'center upgrade path or state transition',
    composition: 'main diagram centered, left and right callouts aligned to the diagram',
    requiredBlocks: 'starting state, trigger, upgraded state, why it matters',
    avoid: 'random callouts that do not line up with the visual',
  },
  {
    name: 'dual-index',
    anchor: 'dual-structure diagram',
    composition: 'two related structures share one title row and one explanation row',
    requiredBlocks: 'structure A, structure B, query path, update path',
    avoid: 'busy patterned backgrounds',
  },
  {
    name: 'command-observation',
    anchor: 'command sequence with observed result',
    composition: 'commands on one side, observations and teaching notes on the other side',
    requiredBlocks: 'command, expected result, why it happens, mistake to avoid',
    avoid: 'English command labels without Chinese explanation',
  },
  {
    name: 'problem-solution',
    anchor: 'problem-to-solution bridge',
    composition: 'left problem stack, center bridge, right solution stack',
    requiredBlocks: 'problem signal, chosen method, implementation hint, validation',
    avoid: 'generic labels such as Step 1 or Core Feature',
  },
  {
    name: 'decision-ladder',
    anchor: 'numbered decision ladder',
    composition: 'vertical numbered ladder with a compact example panel',
    requiredBlocks: 'question, branch condition, selected structure, final check',
    avoid: 'reusing the same card grid from nearby pages',
  },
  {
    name: 'project-mapping',
    anchor: 'project mapping cards',
    composition: '3-4 unequal mapping blocks tied to one implementation sequence',
    requiredBlocks: 'business object, data structure, key pattern, landing order',
    avoid: 'cards with identical text rhythm',
  },
  {
    name: 'recap-triad',
    anchor: 'three-weight recap layout',
    composition: 'one large recap block and two smaller supporting blocks',
    requiredBlocks: 'why, how, verify, next action',
    avoid: 'copying an earlier summary page composition',
  },
  {
    name: 'formula-stage',
    anchor: 'formula or rule stage',
    composition: 'formula/rule is large and centered, examples sit in two side lanes',
    requiredBlocks: 'symbol meaning, substitution example, interpretation, caution',
    avoid: 'LaTeX inside text elements',
  },
  {
    name: 'case-board',
    anchor: 'case board',
    composition: 'one realistic case occupies the left half, right half breaks it into decisions',
    requiredBlocks: 'case context, decision point, operation path, result check',
    avoid: 'abstract slogans without a concrete case',
  },
  {
    name: 'timeline-compare',
    anchor: 'timeline plus comparison',
    composition: 'timeline runs across the top or bottom, comparison blocks fill the rest',
    requiredBlocks: 'before, transition, after, reason',
    avoid: 'timeline markers with no teaching text',
  },
  {
    name: 'diagnostic-grid',
    anchor: 'diagnostic grid',
    composition: 'grid is used for meaningful checks, not decoration',
    requiredBlocks: 'symptom, cause, fix, verification',
    avoid: 'blank table cells or repeated table headers',
  },
  {
    name: 'concept-map',
    anchor: 'concept map',
    composition: 'central concept with 3-4 connected branches and a concise conclusion',
    requiredBlocks: 'concept, relation, example, conclusion',
    avoid: 'unconnected floating branches',
  },
];

function recipeForOrder(order: number | undefined): LayoutRecipe {
  const safeOrder = typeof order === 'number' && Number.isFinite(order) ? Math.max(1, order) : 1;
  return LAYOUT_RECIPES[(Math.floor(safeOrder) - 1) % LAYOUT_RECIPES.length];
}

export function buildSlideStyleContract(outline: Pick<SceneOutline, 'order' | 'title'>): string {
  const recipe = recipeForOrder(outline.order);

  return [
    'OpenMAIC golden sample style contract:',
    `- Page-specific composition for this page: ${recipe.name}.`,
    `- Main visual anchor: ${recipe.anchor}.`,
    `- Layout recipe: ${recipe.composition}.`,
    `- Required teaching blocks: ${recipe.requiredBlocks}.`,
    `- Avoid on this page: ${recipe.avoid}.`,
    '- Keep the page clean and blue-related: use white, very light blue, slate text, and one blue accent family.',
    '- Do not use orange bars, orange stripes, unrelated corner ornaments, or decorative shapes that do not explain the lesson.',
    '- Every visible label must carry real teaching meaning; do not output placeholder headings like Step 1, Core Feature, or 要点一.',
    '- If content is sparse, merge adjacent ideas into one richer page and add a meaningful table, flow, command diagram, formula stage, or structure diagram.',
    '- Make this slide visually different from nearby pages by changing the main anchor type, its side/row, and the text rhythm.',
  ].join('\n');
}
