import { describe, it, expect } from 'vitest';
import {
  createMemory,
  addTurn,
  getRecentTurns,
  rememberFact,
  recallFacts,
  getTopFacts,
  summariseMemory,
  injectMemoryContext,
  type AgentMemory,
} from '@/lib/ai/agent-memory';

function makeTurn(role: 'user' | 'assistant', content: string) {
  return { role, content, timestamp: Date.now() };
}

describe('addTurn', () => {
  it('adds a turn to short-term memory', () => {
    const mem = createMemory();
    const next = addTurn(mem, makeTurn('user', 'hello'));
    expect(next.shortTerm).toHaveLength(1);
    expect(next.shortTerm[0].content).toBe('hello');
  });

  it('caps at 20 turns', () => {
    let mem = createMemory();
    for (let i = 0; i < 25; i++) {
      mem = addTurn(mem, makeTurn('user', `msg${i}`));
    }
    expect(mem.shortTerm).toHaveLength(20);
    expect(mem.shortTerm[19].content).toBe('msg24');
  });

  it('does not mutate original', () => {
    const mem = createMemory();
    addTurn(mem, makeTurn('user', 'test'));
    expect(mem.shortTerm).toHaveLength(0);
  });
});

describe('getRecentTurns', () => {
  it('returns last N turns', () => {
    let mem = createMemory();
    for (let i = 0; i < 5; i++) {
      mem = addTurn(mem, makeTurn('user', `msg${i}`));
    }
    expect(getRecentTurns(mem, 3)).toHaveLength(3);
    expect(getRecentTurns(mem, 3)[2].content).toBe('msg4');
  });
});

describe('rememberFact', () => {
  it('adds a new fact', () => {
    const mem = createMemory();
    const next = rememberFact(mem, '数学', '学生对代数掌握较好');
    expect(next.longTerm).toHaveLength(1);
    expect(next.longTerm[0].topic).toBe('数学');
  });

  it('updates existing fact on same topic', () => {
    let mem = createMemory();
    mem = rememberFact(mem, '数学', '旧信息');
    mem = rememberFact(mem, '数学', '新信息');
    expect(mem.longTerm).toHaveLength(1);
    expect(mem.longTerm[0].fact).toBe('新信息');
    expect(mem.longTerm[0].accessCount).toBe(1);
  });

  it('caps at 50 facts', () => {
    let mem = createMemory();
    for (let i = 0; i < 60; i++) {
      mem = rememberFact(mem, `topic${i}`, `fact${i}`);
    }
    expect(mem.longTerm.length).toBeLessThanOrEqual(50);
  });
});

describe('recallFacts', () => {
  it('finds facts by topic', () => {
    let mem = createMemory();
    mem = rememberFact(mem, '薄弱点', '二次函数容易出错');
    mem = rememberFact(mem, '强项', '几何证明很好');
    const results = recallFacts(mem, '二次函数');
    expect(results).toHaveLength(1);
    expect(results[0].topic).toBe('薄弱点');
  });

  it('returns empty for no match', () => {
    const mem = createMemory();
    expect(recallFacts(mem, 'nonexistent')).toHaveLength(0);
  });
});

describe('getTopFacts', () => {
  it('returns most accessed facts', () => {
    let mem = createMemory();
    mem = rememberFact(mem, 'a', '1');
    mem = rememberFact(mem, 'b', '2');
    // Access 'b' more
    recallFacts(mem, 'b');
    recallFacts(mem, 'b');
    const top = getTopFacts(mem, 2);
    expect(top[0].topic).toBe('b');
  });
});

describe('summariseMemory', () => {
  it('includes recent conversation', () => {
    let mem = createMemory();
    mem = addTurn(mem, makeTurn('user', '你好'));
    mem = addTurn(mem, makeTurn('assistant', '你好！有什么可以帮你的？'));
    const summary = summariseMemory(mem);
    expect(summary).toContain('你好');
    expect(summary).toContain('学生');
  });

  it('includes key facts', () => {
    let mem = createMemory();
    mem = rememberFact(mem, '偏好', '喜欢启发式教学');
    const summary = summariseMemory(mem);
    expect(summary).toContain('偏好');
    expect(summary).toContain('启发式教学');
  });

  it('handles empty memory', () => {
    expect(summariseMemory(createMemory())).toBe('');
  });
});

describe('injectMemoryContext', () => {
  it('appends memory to base prompt', () => {
    let mem = createMemory();
    mem = rememberFact(mem, '学习风格', '视觉型学习者');
    const result = injectMemoryContext('You are a tutor.', mem);
    expect(result).toContain('You are a tutor.');
    expect(result).toContain('学习风格');
  });

  it('returns base prompt unchanged when memory is empty', () => {
    const result = injectMemoryContext('Base prompt', createMemory());
    expect(result).toBe('Base prompt');
  });
});

describe('createMemory', () => {
  it('returns empty memory structure', () => {
    const mem = createMemory();
    expect(mem.shortTerm).toEqual([]);
    expect(mem.longTerm).toEqual([]);
  });
});
