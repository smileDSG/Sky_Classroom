import { describe, test, expect } from 'vitest';
import { SolveGraphAnnotation } from '@/lib/solve/solve-graph-state';

describe('SolveGraphAnnotation', () => {
  test('state annotation is defined', () => {
    expect(SolveGraphAnnotation).toBeDefined();
  });

  test('state annotation has all required fields', () => {
    const spec = SolveGraphAnnotation.spec;
    expect(spec).toHaveProperty('problemText');
    expect(spec).toHaveProperty('problemImage');
    expect(spec).toHaveProperty('userAnswer');
    expect(spec).toHaveProperty('agentId');
    expect(spec).toHaveProperty('solution');
    expect(spec).toHaveProperty('gradeResult');
    expect(spec).toHaveProperty('votingResults');
    expect(spec).toHaveProperty('fourPartOutput');
    expect(spec).toHaveProperty('fromQuestionBank');
    expect(spec).toHaveProperty('fromSolveCache');
    expect(spec).toHaveProperty('selectedAgentId');
    expect(spec).toHaveProperty('agentRoute');
    expect(spec).toHaveProperty('error');
  });

  test('state annotation carries answer self-verification channels', () => {
    const spec = SolveGraphAnnotation.spec;
    expect(spec).toHaveProperty('answerReview');
    expect(spec).toHaveProperty('verified');
  });

  test('state annotation field count matches current graph schema', () => {
    const fieldCount = Object.keys(SolveGraphAnnotation.spec).length;
    expect(fieldCount).toBeGreaterThanOrEqual(21);
  });

  test('all fields are valid LangGraph channels', () => {
    for (const [name, field] of Object.entries(SolveGraphAnnotation.spec)) {
      expect(field).toHaveProperty('lg_is_channel');
      expect(field).toHaveProperty('lc_graph_name');
    }
  });
});
