/**
 * Post-hoc confidence validation for solver agent responses.
 *
 * Replaces the LLM's self-reported confidence score with a content-quality
 * validator that checks answer specificity, step coherence, and uncertainty signals.
 *
 * Key change: previous version used structural heuristics (length, count) that
 * rewarded hallucinated long answers over correct short ones. This version
 * checks whether the answer looks like a real answer (concise, specific).
 *
 * Final score clamped to [0, 1]. Threshold: 0.50
 */

import type { SolverAgentType } from './types';

/** Parsed solution shape — minimal fields we validate against. */
interface SolutionLike {
  solution: string;
  answer: string;
  confidence: number;
  steps: { label: string; content: string; keyPoints?: string[] }[];
  knowledgePoints: { name: string; description: string; difficulty: string }[];
}

// Uncertainty / hedging phrases in Chinese and English
const UNCERTAINTY_PHRASES = [
  '可能',
  '不确定',
  '大概',
  '也许',
  '或许',
  '难以判断',
  '无法确定',
  "I'm not sure",
  'uncertain',
  'cannot determine',
  'hard to tell',
] as const;

/**
 * Validate confidence of a solved response using content-quality heuristics.
 *
 * Scoring:
 *   - Answer quality (concise & specific): +0.2
 *   - Step presence (at least one meaningful step): +0.15
 *   - Solution substance (30-5000 chars): +0.1
 *   - Uncertainty phrase penalty: -0.2
 *   - Empty/failure penalty: -0.4
 *   - Answer too long (likely not a final answer): -0.2
 */
export function validateConfidence(solution: SolutionLike, _agentType: SolverAgentType): number {
  let score = 0.5; // base score — LLM responded, something came back

  // ── Answer quality: should be concise and specific ──
  const answerLen = solution.answer.trim().length;
  if (answerLen >= 1 && answerLen <= 100) {
    score += 0.2; // reasonable answer length
  } else if (answerLen > 100) {
    score -= 0.2; // answer too long, likely not a final answer
  } else {
    score -= 0.3; // empty answer
  }

  // ── Step presence: at least one meaningful step ──
  if (solution.steps.length >= 1) {
    const hasContent = solution.steps.some((s) => s.content.trim().length > 10);
    if (hasContent) score += 0.15;
  }

  // ── Solution substance: substantial but not excessive ──
  const solLen = solution.solution.trim().length;
  const hasStepContent = solution.steps.some((s) => s.content.trim().length > 0);
  if (solLen > 30 && solLen < 5000) {
    score += 0.1;
  } else if (solLen <= 30 && !hasStepContent) {
    // Gibberish / truncated answers with no step content carry almost no
    // information; reject them so the hybrid strategy tries another agent.
    score -= 0.25;
  }

  // ── Uncertainty phrase penalty ──
  const lowerSolution = solution.solution.toLowerCase() + solution.answer.toLowerCase();
  for (const phrase of UNCERTAINTY_PHRASES) {
    if (lowerSolution.includes(phrase)) {
      score -= 0.2;
      break; // only penalize once
    }
  }

  // ── Empty/failure penalty ──
  if (!solution.solution.trim() || !solution.answer.trim()) {
    score -= 0.4;
  }

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, score));
}

/** Minimum validated confidence to accept a single agent's answer. */
export const MIN_VALIDATED_CONFIDENCE = 0.5;
