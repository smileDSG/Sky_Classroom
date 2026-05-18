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
    expect(spec).toHaveProperty('selectedAgentId');
    expect(spec).toHaveProperty('agentRoute');
    expect(spec).toHaveProperty('error');
  });
});
