/**
 * P6-001 Test 17: 质量评分
 *
 * Tests the quality scoring system — automatic assessment of
 * generated scene content for completeness, coherence, and
 * educational value.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { scoreQuality, dispatchScorer } from '@/lib/generation/quality-scorer';
import type { GeneratedSlideContent, GeneratedQuizContent } from '@/lib/types/generation';

// ─── Test fixtures ───

const GOOD_SLIDE: GeneratedSlideContent = {
  elements: [
    { id: 'title', type: 'text', left: 60, top: 40, width: 900, height: 60, content: '<p>光合作用</p>', defaultFontName: '', defaultColor: '#333' },
    { id: 'body', type: 'text', left: 60, top: 120, width: 900, height: 200, content: '<p>光合作用是植物利用光能将二氧化碳和水转化为有机物的过程。</p>', defaultFontName: '', defaultColor: '#666' },
  ],
  background: { type: 'solid', color: '#ffffff' },
  remark: 'Well structured slide',
};

const POOR_SLIDE: GeneratedSlideContent = {
  elements: [],
  background: undefined,
  remark: '',
};

const GOOD_QUIZ: GeneratedQuizContent = {
  questions: [
    {
      id: 'q1',
      type: 'single',
      question: '光合作用发生在哪里？',
      options: [
        { label: 'A', value: 'A' },
        { label: 'B', value: 'B' },
        { label: 'C', value: 'C' },
        { label: 'D', value: 'D' },
      ],
      answer: ['A'],
      analysis: '叶绿体是光合作用的场所',
    },
    {
      id: 'q2',
      type: 'single',
      question: '光合作用的产物是什么？',
      options: [
        { label: 'A', value: 'A' },
        { label: 'B', value: 'B' },
      ],
      answer: ['B'],
      analysis: '葡萄糖和氧气',
    },
  ],
};

const POOR_QUIZ: GeneratedQuizContent = {
  questions: [
    {
      id: 'q1',
      type: 'single',
      question: '',
      options: [],
      answer: [],
      analysis: '',
    },
  ],
};

// ─── Tests ───

describe('P6-001 Test 17: 质量评分', () => {
  describe('slide quality scoring', () => {
    test('good slide gets high score', () => {
      const score = scoreQuality(GOOD_SLIDE, 'slide');
      expect(score.overall).toBeGreaterThan(0.5);
    });

    test('poor slide gets low score', () => {
      const score = scoreQuality(POOR_SLIDE, 'slide');
      expect(score.overall).toBeLessThan(0.5);
    });

    test('good slide has multiple elements', () => {
      const score = scoreQuality(GOOD_SLIDE, 'slide');
      expect(score.completeness).toBeGreaterThan(0.5);
    });

    test('slide with background scores higher', () => {
      const withBg: GeneratedSlideContent = {
        ...GOOD_SLIDE,
        background: { type: 'solid', color: '#fff' },
      };
      const withoutBg: GeneratedSlideContent = {
        ...GOOD_SLIDE,
        background: undefined,
      };

      const scoreWith = scoreQuality(withBg, 'slide');
      const scoreWithout = scoreQuality(withoutBg, 'slide');

      expect(scoreWith.completeness).toBeGreaterThanOrEqual(scoreWithout.completeness);
    });
  });

  describe('quiz quality scoring', () => {
    test('good quiz gets high score', () => {
      const score = scoreQuality(GOOD_QUIZ, 'quiz');
      expect(score.overall).toBeGreaterThan(0.5);
    });

    test('poor quiz gets low score', () => {
      const score = scoreQuality(POOR_QUIZ, 'quiz');
      expect(score.overall).toBeLessThan(0.5);
    });

    test('quiz with multiple questions scores higher', () => {
      const twoQuestions = { ...GOOD_QUIZ, questions: [...GOOD_QUIZ.questions] };
      const oneQuestion = { ...GOOD_QUIZ, questions: [GOOD_QUIZ.questions[0]] };

      const score2 = scoreQuality(twoQuestions, 'quiz');
      const score1 = scoreQuality(oneQuestion, 'quiz');

      expect(score2.completeness).toBeGreaterThanOrEqual(score1.completeness);
    });

    test('quiz with analysis scores higher', () => {
      const withAnalysis = { ...GOOD_QUIZ };
      const withoutAnalysis = {
        ...GOOD_QUIZ,
        questions: GOOD_QUIZ.questions.map((q) => ({ ...q, analysis: '' })),
      };

      const scoreWith = scoreQuality(withAnalysis, 'quiz');
      const scoreWithout = scoreQuality(withoutAnalysis, 'quiz');

      expect(scoreWith.coherence).toBeGreaterThanOrEqual(scoreWithout.coherence);
    });
  });

  describe('quality score dispatcher', () => {
    test('dispatchScorer routes to correct scorer', () => {
      const slideScore = dispatchScorer(GOOD_SLIDE, 'slide');
      expect(slideScore).toHaveProperty('overall');
      expect(slideScore).toHaveProperty('completeness');
    });

    test('dispatchScorer handles quiz type', () => {
      const quizScore = dispatchScorer(GOOD_QUIZ, 'quiz');
      expect(quizScore).toHaveProperty('overall');
    });

    test('dispatchScorer returns low score for unknown type', () => {
      const score = dispatchScorer(GOOD_SLIDE, 'unknown' as 'slide');
      expect(score.overall).toBeLessThanOrEqual(0.5);
    });
  });

  describe('quality thresholds', () => {
    test('good slide passes quality threshold', () => {
      const score = scoreQuality(GOOD_SLIDE, 'slide');
      const THRESHOLD = 0.4;
      expect(score.overall).toBeGreaterThan(THRESHOLD);
    });

    test('poor slide fails quality threshold', () => {
      const score = scoreQuality(POOR_SLIDE, 'slide');
      const THRESHOLD = 0.4;
      expect(score.overall).toBeLessThan(THRESHOLD);
    });

    test('score has all required fields', () => {
      const score = scoreQuality(GOOD_SLIDE, 'slide');
      expect(score).toHaveProperty('overall');
      expect(score).toHaveProperty('completeness');
      expect(score).toHaveProperty('coherence');
      expect(typeof score.overall).toBe('number');
    });

    test('score values are between 0 and 1', () => {
      const slideScore = scoreQuality(GOOD_SLIDE, 'slide');
      const quizScore = scoreQuality(GOOD_QUIZ, 'quiz');

      for (const score of [slideScore, quizScore]) {
        expect(score.overall).toBeGreaterThanOrEqual(0);
        expect(score.overall).toBeLessThanOrEqual(1);
        expect(score.completeness).toBeGreaterThanOrEqual(0);
        expect(score.completeness).toBeLessThanOrEqual(1);
        expect(score.coherence).toBeGreaterThanOrEqual(0);
        expect(score.coherence).toBeLessThanOrEqual(1);
      }
    });
  });
});
