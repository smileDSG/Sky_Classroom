/**
 * Diagnostic Generator — 诊断式备课引擎
 *
 * 根据授课主题和学生画像，提取前置知识点并生成诊断测验。
 */

import { KNOWLEDGE_RELATIONS } from '@/lib/knowledge-graph';
import type { StudentProfile } from '@/lib/student/profile-types';
import { createLogger } from '@/lib/logger';

const log = createLogger('DiagnosticGenerator');

export interface DiagnosticResult {
  accuracy: number;
  weakPrerequisites: string[];
  recommendedDepth: 'basic' | 'normal' | 'advanced';
}

export interface DiagnosticQuestion {
  id: number;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  knowledgePoint: string;
}

export interface DiagnosticQuiz {
  topic: string;
  questions: DiagnosticQuestion[];
}

/**
 * Extract prerequisite knowledge points for a given topic.
 * Uses KNOWLEDGE_RELATIONS and student profile to find weak prerequisites.
 */
export function extractPrerequisites(
  topic: string,
  profile: StudentProfile,
): string[] {
  // 1. Find directly related knowledge points from KNOWLEDGE_RELATIONS
  const relatedPoints = new Set<string>();

  // Exact match
  if (KNOWLEDGE_RELATIONS[topic]) {
    const rel = KNOWLEDGE_RELATIONS[topic];
    if (rel.prereqs) {
      for (const p of rel.prereqs) relatedPoints.add(p);
    }
    if (rel.related) {
      for (const r of rel.related) relatedPoints.add(r);
    }
  }

  // Partial match: find relations where topic is a prerequisite or related
  for (const [point, rel] of Object.entries(KNOWLEDGE_RELATIONS)) {
    if (topic.includes(point) || point.includes(topic)) {
      if (rel.prereqs) {
        for (const p of rel.prereqs) relatedPoints.add(p);
      }
      relatedPoints.add(point);
    }
  }

  // 2. Collect prerequisite chain (transitive closure up to depth 2)
  const prerequisites = new Set<string>();
  for (const point of relatedPoints) {
    const rel = KNOWLEDGE_RELATIONS[point];
    if (rel?.prereqs) {
      for (const p of rel.prereqs) {
        prerequisites.add(p);
        // Depth 2: prerequisites of prerequisites
        const preRel = KNOWLEDGE_RELATIONS[p];
        if (preRel?.prereqs) {
          for (const pp of preRel.prereqs) prerequisites.add(pp);
        }
      }
    }
  }

  // 3. Filter out mastered prerequisites (mastery > 80)
  const weakPrereqs = [...prerequisites].filter((p) => {
    const mastery = profile.masteryByKnowledge[p];
    return mastery === undefined || mastery <= 80;
  });

  // 4. If no prerequisites found via relations, use profile weak points that match topic
  if (weakPrereqs.length === 0) {
    const topicWeakPoints = profile.weakPoints.filter((wp) =>
      wp.includes(topic) || topic.includes(wp),
    );
    if (topicWeakPoints.length > 0) {
      return topicWeakPoints.slice(0, 5);
    }
  }

  log.info(`Extracted ${weakPrereqs.length} weak prerequisites for topic "${topic}"`);
  return weakPrereqs.slice(0, 5);
}

/**
 * Analyze diagnostic answers and compute result.
 */
export function analyzeDiagnosticResult(
  questions: DiagnosticQuestion[],
  answers: { questionId: number; selectedOption: number }[],
): DiagnosticResult {
  let correct = 0;
  const weakPrerequisites: string[] = [];

  for (const q of questions) {
    const answer = answers.find((a) => a.questionId === q.id);
    if (answer && answer.selectedOption === q.answer) {
      correct += 1;
    } else {
      weakPrerequisites.push(q.knowledgePoint);
    }
  }

  const accuracy = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;

  let recommendedDepth: 'basic' | 'normal' | 'advanced';
  if (accuracy >= 80) recommendedDepth = 'advanced';
  else if (accuracy >= 50) recommendedDepth = 'normal';
  else recommendedDepth = 'basic';

  return {
    accuracy,
    weakPrerequisites: [...new Set(weakPrerequisites)],
    recommendedDepth,
  };
}
