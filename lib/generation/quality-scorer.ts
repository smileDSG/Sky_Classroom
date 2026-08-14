/**
 * Quality scoring for generated content.
 *
 * Evaluates completeness, coherence, and structural integrity of
 * generated scene content. Scores range from 0 (worst) to 1 (best).
 */

import type {
  GeneratedSlideContent,
  GeneratedQuizContent,
  GeneratedInteractiveContent,
  GeneratedPBLContent,
} from '@/lib/types/generation';
import { auditSlideLayout } from '@/lib/slides/agent/layout-guard-agent';

export interface QualityScore {
  overall: number;
  completeness: number;
  coherence: number;
  elementDiversity: number;
  issues: string[];
  warnings: string[];
}

export interface QualityScorerOptions {
  /** Minimum overall score to consider content acceptable (default 0.4) */
  minAcceptable?: number;
}

const DEFAULT_MIN_ACCEPTABLE = 0.4;

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function weightedAverage(scores: [number, number][]): number {
  const totalWeight = scores.reduce((sum, [, w]) => sum + w, 0);
  if (totalWeight === 0) return 0;
  return clamp(scores.reduce((sum, [s, w]) => sum + s * w, 0) / totalWeight);
}

// ── Slide content scoring ──

export function scoreSlideContent(
  content: GeneratedSlideContent,
  _options?: QualityScorerOptions,
): QualityScore {
  const issues: string[] = [];
  const warnings: string[] = [];
  const { elements } = content;

  // Completeness: core fields present
  let completeness = 1.0;
  if (!elements || elements.length === 0) {
    issues.push('No slide elements generated');
    completeness -= 0.4;
  }
  if (!content.background || !content.background.color) {
    warnings.push('Missing slide background');
    completeness -= 0.1;
  }
  if (!content.remark || content.remark.length < 10) {
    warnings.push('Remark is missing or too short');
    completeness -= 0.15;
  }
  completeness = clamp(completeness);

  // Element diversity: mix of element types
  let elementDiversity = 0;
  if (elements && elements.length > 0) {
    const types = new Set(elements.map((e) => e.type));
    const uniqueCount = types.size;
    const totalCount = elements.length;
    // Reward having multiple types AND a reasonable element count
    const typeRatio = uniqueCount / 6; // 6 = max reasonable unique types
    const countScore = Math.min(totalCount / 8, 1); // 8+ elements = full score
    elementDiversity = clamp(typeRatio * 0.6 + countScore * 0.4);
    if (uniqueCount <= 1 && totalCount > 1) {
      warnings.push('All elements are the same type — consider mixing text, images, shapes');
    }
  }

  // Coherence: element placement sanity
  let coherence = 1.0;
  if (elements && elements.length > 0) {
    // Check for extreme overlap (elements with nearly identical positions)
    let overlapCount = 0;
    for (let i = 0; i < elements.length; i++) {
      for (let j = i + 1; j < elements.length; j++) {
        const dx = Math.abs(elements[i].left - elements[j].left);
        const dy = Math.abs(elements[i].top - elements[j].top);
        if (dx < 5 && dy < 5) {
          overlapCount++;
        }
      }
    }
    if (overlapCount > 1) {
      issues.push(`${overlapCount} elements have nearly identical positions`);
      coherence -= overlapCount * 0.1;
    }

    // Check for off-canvas elements
    const offCanvas = elements.filter(
      (e) => e.left < -100 || e.top < -100 || e.left > 1100 || e.top > 700,
    );
    if (offCanvas.length > 0) {
      issues.push(`${offCanvas.length} elements are positioned far off-canvas`);
      coherence -= offCanvas.length * 0.15;
    }

    // Check for zero-size elements (line elements have start/end instead)
    const zeroSize = elements.filter((e) => {
      const el = e as unknown as Record<string, unknown>;
      return ('width' in el && el.width === 0) || ('height' in el && el.height === 0);
    });
    if (zeroSize.length > 0) {
      issues.push(`${zeroSize.length} elements have zero width or height`);
      coherence -= zeroSize.length * 0.1;
    }

    const layoutIssues = auditSlideLayout(elements, { includeRichness: true });
    const hasMissingVisualAnchor = layoutIssues.some(
      (issue) => issue.type === 'missing_visual_anchor',
    );
    const hasLowContentRichness = layoutIssues.some(
      (issue) => issue.type === 'low_content_richness',
    );
    const hasWeakHierarchy = layoutIssues.some((issue) => issue.type === 'weak_visual_hierarchy');
    const hasForegroundOverlayCollision = layoutIssues.some(
      (issue) => issue.type === 'foreground_overlay_collision',
    );
    const hasExcessiveColoredPanels = layoutIssues.some(
      (issue) => issue.type === 'excessive_colored_panels',
    );
    const hasUnlabeledVisualPlaceholder = layoutIssues.some(
      (issue) => issue.type === 'unlabeled_visual_placeholder',
    );
    const hasReadableOverlap = layoutIssues.some(
      (issue) => issue.type === 'readable_element_overlap',
    );
    const hasLatexSizingIssue = layoutIssues.some((issue) => issue.type === 'latex_box_too_small');
    const hasUnsafeBounds = layoutIssues.some((issue) => issue.type === 'unsafe_bottom_zone');
    const hasMisalignedParallelGroup = layoutIssues.some(
      (issue) => issue.type === 'misaligned_parallel_group',
    );
    const readabilityIssues = layoutIssues.filter((issue) =>
      ['text_outside_background', 'text_too_small', 'low_text_contrast'].includes(issue.type),
    );

    if (hasMissingVisualAnchor) {
      issues.push('Slide is missing a dominant visual anchor');
      elementDiversity = Math.min(elementDiversity, 0.45);
      coherence -= 0.12;
    }
    if (hasLowContentRichness) {
      warnings.push('Slide has too few learning blocks for a rich classroom page');
      completeness -= 0.18;
      elementDiversity = Math.min(elementDiversity, 0.5);
    }
    if (hasWeakHierarchy) {
      warnings.push('Slide typography has weak visual hierarchy');
      coherence -= 0.1;
    }
    if (hasForegroundOverlayCollision) {
      issues.push('foreground overlay collision detected');
      coherence -= 0.14;
    }
    if (hasExcessiveColoredPanels) {
      warnings.push('Slide uses too many colored background boxes for the clean 天空课堂 style');
      coherence -= 0.1;
      elementDiversity = Math.min(elementDiversity, 0.82);
    }
    if (hasUnlabeledVisualPlaceholder) {
      warnings.push('Slide has an unlabeled visual placeholder instead of a meaningful diagram');
      coherence -= 0.12;
      elementDiversity = Math.min(elementDiversity, 0.72);
    }
    if (hasReadableOverlap) {
      issues.push('Readable slide elements overlap');
      coherence -= 0.18;
    }
    if (hasLatexSizingIssue) {
      issues.push('Formula box is too small for reliable rendering');
      coherence -= 0.14;
    }
    if (hasUnsafeBounds) {
      issues.push('Slide content exceeds classroom safe bounds');
      coherence -= 0.12;
    }
    if (hasMisalignedParallelGroup) {
      warnings.push('Parallel slide elements are not evenly aligned');
      coherence -= 0.08;
    }
    if (readabilityIssues.length > 0) {
      issues.push(`${readabilityIssues.length} slide readability issue(s) detected`);
      coherence -= readabilityIssues.length * 0.08;
    }
  }
  completeness = clamp(completeness);
  coherence = clamp(coherence);

  const overall = weightedAverage([
    [completeness, 0.35],
    [coherence, 0.35],
    [elementDiversity, 0.3],
  ]);

  return { overall, completeness, coherence, elementDiversity, issues, warnings };
}

// ── Quiz content scoring ──

export function scoreQuizContent(
  content: GeneratedQuizContent,
  _options?: QualityScorerOptions,
): QualityScore {
  const issues: string[] = [];
  const warnings: string[] = [];
  const { questions } = content;

  let completeness = 1.0;
  if (!questions || questions.length === 0) {
    issues.push('No quiz questions generated');
    completeness = 0;
  }
  completeness = clamp(completeness);

  let coherence = 1.0;
  let totalOptions = 0;
  let missingAnswers = 0;
  if (questions && questions.length > 0) {
    for (const q of questions) {
      if (!q.options || q.options.length < 2) {
        issues.push(`Question "${q.question?.substring(0, 30)}..." has fewer than 2 options`);
        coherence -= 0.15;
      }
      if (!q.answer || q.answer.length === 0) {
        missingAnswers++;
      }
      totalOptions += q.options?.length || 0;
    }
    if (missingAnswers > 0) {
      issues.push(`${missingAnswers}/${questions.length} questions missing correct answer`);
      coherence -= missingAnswers * 0.2;
    }
  }
  coherence = clamp(coherence);

  const elementDiversity =
    questions && questions.length > 0
      ? clamp(Math.min(totalOptions / (questions.length * 4), 1))
      : 0;

  const overall = weightedAverage([
    [completeness, 0.4],
    [coherence, 0.4],
    [elementDiversity, 0.2],
  ]);

  return { overall, completeness, coherence, elementDiversity, issues, warnings };
}

// ── Interactive content scoring ──

export function scoreInteractiveContent(
  content: GeneratedInteractiveContent,
  _options?: QualityScorerOptions,
): QualityScore {
  const issues: string[] = [];
  const warnings: string[] = [];

  let completeness = 1.0;
  if (!content.html || content.html.length < 50) {
    issues.push('Interactive content has no or minimal HTML');
    completeness -= 0.5;
  }
  if (!content.widgetType) {
    warnings.push('No widgetType specified');
    completeness -= 0.15;
  }
  if (!content.widgetConfig) {
    warnings.push('No widgetConfig provided');
    completeness -= 0.15;
  }
  completeness = clamp(completeness);

  let coherence = 1.0;
  if (content.teacherActions && content.teacherActions.length === 0) {
    warnings.push('No teacher actions for interactive widget');
    coherence -= 0.1;
  }
  if (content.html && content.html.length < 200) {
    warnings.push('Interactive HTML content is very short');
  }
  coherence = clamp(coherence);

  const elementDiversity = content.html && content.html.length > 200 ? 0.8 : 0.4;

  const overall = weightedAverage([
    [completeness, 0.4],
    [coherence, 0.35],
    [elementDiversity, 0.25],
  ]);

  return { overall, completeness, coherence, elementDiversity, issues, warnings };
}

// ── PBL content scoring ──

export function scorePBLContent(
  content: GeneratedPBLContent,
  _options?: QualityScorerOptions,
): QualityScore {
  const issues: string[] = [];
  const warnings: string[] = [];
  const cfg = content.projectConfig;

  let completeness = 1.0;
  if (!cfg) {
    issues.push('No projectConfig in PBL content');
    completeness = 0;
  } else {
    if (!cfg.projectInfo?.title && !cfg.projectInfo?.description) {
      issues.push('PBL project missing title and description');
      completeness -= 0.5;
    }
    if (!cfg.agents || cfg.agents.length === 0) {
      issues.push('PBL project has no agents configured');
      completeness -= 0.3;
    }
  }
  completeness = clamp(completeness);

  let coherence = 1.0;
  if (cfg) {
    if (cfg.agents && cfg.agents.length > 6) {
      warnings.push('Large number of PBL agents may dilute focus');
    }
    if (!cfg.issueboard) {
      warnings.push('No issue board configured for PBL project');
    }
  }
  coherence = clamp(coherence);

  const elementDiversity = cfg?.agents ? clamp(cfg.agents.length / 4) : 0;

  const overall = weightedAverage([
    [completeness, 0.45],
    [coherence, 0.35],
    [elementDiversity, 0.2],
  ]);

  return { overall, completeness, coherence, elementDiversity, issues, warnings };
}

// ── Dispatcher ──

export type ScorableContent =
  | { type: 'slide'; content: GeneratedSlideContent }
  | { type: 'quiz'; content: GeneratedQuizContent }
  | { type: 'interactive'; content: GeneratedInteractiveContent }
  | { type: 'pbl'; content: GeneratedPBLContent };

export function scoreContent(
  scorable: ScorableContent,
  options?: QualityScorerOptions,
): QualityScore {
  switch (scorable.type) {
    case 'slide':
      return scoreSlideContent(scorable.content, options);
    case 'quiz':
      return scoreQuizContent(scorable.content, options);
    case 'interactive':
      return scoreInteractiveContent(scorable.content, options);
    case 'pbl':
      return scorePBLContent(scorable.content, options);
  }
}

export function isAcceptable(score: QualityScore, minAcceptable?: number): boolean {
  const threshold = minAcceptable ?? DEFAULT_MIN_ACCEPTABLE;
  return score.overall >= threshold && score.completeness >= threshold;
}

export function scoreQuality(
  content:
    | GeneratedSlideContent
    | GeneratedQuizContent
    | GeneratedInteractiveContent
    | GeneratedPBLContent,
  type: ScorableContent['type'],
  options?: QualityScorerOptions,
): QualityScore {
  switch (type) {
    case 'slide':
      return scoreSlideContent(content as GeneratedSlideContent, options);
    case 'quiz':
      return scoreQuizContent(content as GeneratedQuizContent, options);
    case 'interactive':
      return scoreInteractiveContent(content as GeneratedInteractiveContent, options);
    case 'pbl':
      return scorePBLContent(content as GeneratedPBLContent, options);
  }
}

export function dispatchScorer(
  content:
    | GeneratedSlideContent
    | GeneratedQuizContent
    | GeneratedInteractiveContent
    | GeneratedPBLContent,
  type: ScorableContent['type'],
  options?: QualityScorerOptions,
): QualityScore {
  if (!['slide', 'quiz', 'interactive', 'pbl'].includes(type)) {
    return {
      overall: 0,
      completeness: 0,
      coherence: 0,
      elementDiversity: 0,
      issues: [`Unknown content type: ${String(type)}`],
      warnings: [],
    };
  }
  return scoreQuality(content, type, options);
}
