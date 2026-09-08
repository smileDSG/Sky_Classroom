import { describe, it, expect } from 'vitest';
import {
  analyzeWeakPoints,
  buildSupplementalSections,
  decideAdaptiveAdjustment,
} from '@/lib/teaching/adaptive-engine';
import type { LessonSection } from '@/lib/teaching/lesson-types';

describe('adaptive-engine', () => {
  describe('analyzeWeakPoints', () => {
    it('collects knowledge points from needs_review feedback', () => {
      const weak = analyzeWeakPoints(
        [
          {
            sectionId: 's1',
            feedbackType: 'needs_review',
            knowledgePoints: ['二次函数'],
            timestamp: 1,
          },
        ],
        [],
      );
      expect(weak).toContain('二次函数');
    });

    it('collects knowledge points from incorrect quiz results', () => {
      const weak = analyzeWeakPoints(
        [],
        [
          {
            sectionId: 's1',
            chunkOrder: 1,
            knowledgePoints: ['导数'],
            isCorrect: false,
            timestamp: 1,
          },
        ],
      );
      expect(weak).toContain('导数');
    });

    it('ignores mastered feedback', () => {
      const weak = analyzeWeakPoints(
        [
          {
            sectionId: 's1',
            feedbackType: 'mastered',
            knowledgePoints: ['二次函数'],
            timestamp: 1,
          },
        ],
        [],
      );
      expect(weak).not.toContain('二次函数');
    });

    it('ignores correct quiz results', () => {
      const weak = analyzeWeakPoints(
        [],
        [
          {
            sectionId: 's1',
            chunkOrder: 1,
            knowledgePoints: ['导数'],
            isCorrect: true,
            timestamp: 1,
          },
        ],
      );
      expect(weak).not.toContain('导数');
    });

    it('deduplicates weak points', () => {
      const weak = analyzeWeakPoints(
        [
          {
            sectionId: 's1',
            feedbackType: 'needs_review',
            knowledgePoints: ['二次函数'],
            timestamp: 1,
          },
        ],
        [
          {
            sectionId: 's1',
            chunkOrder: 1,
            knowledgePoints: ['二次函数'],
            isCorrect: false,
            timestamp: 1,
          },
        ],
      );
      expect(weak).toEqual(['二次函数']);
    });
  });

  describe('buildSupplementalSections', () => {
    it('returns empty when no weak points', () => {
      const sections = buildSupplementalSections([], []);
      expect(sections).toHaveLength(0);
    });

    it('creates one section for up to 3 weak points', () => {
      const existing: LessonSection[] = [
        {
          id: 's1',
          title: 'A',
          contentType: 'explanation',
          depth: 'basic',
          knowledgePoints: ['A'],
          estimatedDuration: 5,
          hasQuiz: false,
        },
      ];
      const sections = buildSupplementalSections(['X', 'Y', 'Z'], existing);
      expect(sections).toHaveLength(1);
      expect(sections[0].knowledgePoints).toEqual(['X', 'Y', 'Z']);
      expect(sections[0].depth).toBe('basic');
    });

    it('creates two sections for more than 3 weak points', () => {
      const existing: LessonSection[] = [];
      const sections = buildSupplementalSections(['A', 'B', 'C', 'D', 'E'], existing);
      expect(sections).toHaveLength(2);
    });

    it('deduplicates against existing section knowledge points', () => {
      const existing: LessonSection[] = [
        {
          id: 's1',
          title: 'A',
          contentType: 'explanation',
          depth: 'basic',
          knowledgePoints: ['X'],
          estimatedDuration: 5,
          hasQuiz: false,
        },
      ];
      const sections = buildSupplementalSections(['X', 'Y'], existing);
      expect(sections[0].knowledgePoints).toEqual(['Y']);
    });
  });

  describe('decideAdaptiveAdjustment', () => {
    it('returns no supplement when all feedback is mastered', () => {
      const decision = decideAdaptiveAdjustment(
        [{ sectionId: 's1', feedbackType: 'mastered', knowledgePoints: ['A'], timestamp: 1 }],
        [],
        [],
      );
      expect(decision.shouldSupplement).toBe(false);
    });

    it('returns supplement for needs_review feedback', () => {
      const decision = decideAdaptiveAdjustment(
        [{ sectionId: 's1', feedbackType: 'needs_review', knowledgePoints: ['B'], timestamp: 1 }],
        [],
        [],
      );
      expect(decision.shouldSupplement).toBe(true);
      expect(decision.weakKnowledgePoints).toContain('B');
      expect(decision.supplementalSections.length).toBeGreaterThan(0);
    });
  });
});
