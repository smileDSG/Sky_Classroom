/**
 * Post-hoc confidence validation for solver agent responses.
 *
 * Replaces the LLM's self-reported confidence score with a structured
 * validator that checks completeness, answer quality, and uncertainty signals.
 *
 * The validator awards/bases points on:
 *   - Answer presence and length
 *   - Step completeness
 *   - Knowledge point presence
 *   - Solution text length (substance check)
 *   - Uncertainty phrase penalties
 *   - Agent-type bonuses
 *
 * Final score clamped to [0, 1]. Threshold: 0.55
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
  '可能', '不确定', '大概', '也许', '或许', '难以判断', '无法确定',
  'I\'m not sure', 'uncertain', 'cannot determine', 'hard to tell',
] as const;

/**
 * Validate confidence of a solved response using post-hoc heuristics.
 *
 * @param solution - The parsed LLM response
 * @param agentType - Which agent produced this (science/humanities/universal)
 * @returns A confidence score in [0, 1]
 */
export function validateConfidence(
  solution: SolutionLike,
  agentType: SolverAgentType,
): number {
  let score = 0.3; // base score — LLM responded, something came back

  // ── Answer presence (max +0.15) ──
  if (solution.answer && solution.answer.length >= 2) {
    score += 0.15;
  } else if (solution.answer && solution.answer.length > 0) {
    score += 0.05;
  }

  // ── Step completeness (max +0.2) ──
  if (solution.steps.length >= 3) {
    score += 0.2;
  } else if (solution.steps.length >= 1) {
    score += 0.1;
  }

  // ── Knowledge points (max +0.1) ──
  if (solution.knowledgePoints.length >= 1) {
    score += 0.1;
  }

  // ── Solution text substance (max +0.1) ──
  if (solution.solution.length > 100) {
    score += 0.1;
  } else if (solution.solution.length > 50) {
    score += 0.05;
  }

  // ── Agent-type bonuses ──
  // Science: reward if solution contains calculation-like content
  if (agentType === 'science' && /[=≈≥≤+\-×÷]/.test(solution.solution)) {
    score += 0.05;
  }
  // Humanities: reward if solution has analytical structure
  if (agentType === 'humanities' && solution.solution.length > 80) {
    score += 0.05;
  }

  // ── Uncertainty phrase penalty ──
  const lowerSolution = solution.solution.toLowerCase() + solution.answer.toLowerCase();
  for (const phrase of UNCERTAINTY_PHRASES) {
    if (lowerSolution.includes(phrase)) {
      score -= 0.15;
      break; // only penalize once
    }
  }

  // ── Empty/failure penalty ──
  if (!solution.solution.trim() || !solution.answer.trim()) {
    score -= 0.3;
  }

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, score));
}

/** Minimum validated confidence to accept a single agent's answer. */
export const MIN_VALIDATED_CONFIDENCE = 0.55;
