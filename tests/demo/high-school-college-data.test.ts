import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface DemoQuestion {
  grade: string;
  knowledgePoints: string[];
}

interface DemoProfileCache {
  profile: {
    masteryByKnowledge: Record<string, number>;
    weakPoints: string[];
    strongPoints: string[];
  };
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(resolve(process.cwd(), relativePath), 'utf8')) as T;
}

describe('高中与大学演示数据', () => {
  it('题库只包含高中和大学样例', () => {
    const questions = readJson<DemoQuestion[]>('data/question-bank-fallback.json');
    const serialized = JSON.stringify(questions);

    expect(questions.length).toBeGreaterThanOrEqual(16);
    expect(questions.some((question) => question.grade.startsWith('高'))).toBe(true);
    expect(questions.some((question) => question.grade.startsWith('大'))).toBe(true);
    expect(serialized).not.toMatch(/初中|初一|初二|初三|二次函数/);
  });

  it.each(['default-user', 'admin-default'])('%s 默认画像使用高中和大学知识点', (userId) => {
    const cache = readJson<DemoProfileCache>(`data/student-profiles/${userId}.json`);
    const topics = [
      ...Object.keys(cache.profile.masteryByKnowledge),
      ...cache.profile.weakPoints,
      ...cache.profile.strongPoints,
    ];

    expect(topics.some((topic) => topic.startsWith('高中'))).toBe(true);
    expect(topics.some((topic) => topic.startsWith('大学'))).toBe(true);
    expect(JSON.stringify(topics)).not.toMatch(/初中|初一|初二|初三|加法/);
  });
});
