/**
 * Study Group Memory Tests
 */

import { describe, it, expect } from 'vitest';
import {
  createStudyGroupMemory,
  extractMemoryFromMessages,
  mergeMemory,
  formatMemoryForPrompt,
} from '@/lib/teaching/study-group-memory';

describe('createStudyGroupMemory', () => {
  it('creates empty memory', () => {
    const mem = createStudyGroupMemory();
    expect(mem.entries).toEqual([]);
  });
});

describe('extractMemoryFromMessages', () => {
  it('extracts only agent messages', () => {
    const messages = [
      { agentName: '小萌', content: '我觉得二次函数很有趣', role: 'agent' as const },
      { agentName: '你', content: '为什么呢？', role: 'user' as const },
      { agentName: '智也', content: '因为图像很直观', role: 'agent' as const },
    ];
    const mem = extractMemoryFromMessages(messages);
    expect(mem.entries.length).toBe(2);
    expect(mem.entries[0].agentName).toBe('小萌');
    expect(mem.entries[1].agentName).toBe('智也');
  });

  it('truncates long content', () => {
    const messages = [
      { agentName: '小萌', content: 'a'.repeat(300), role: 'agent' as const },
    ];
    const mem = extractMemoryFromMessages(messages);
    expect(mem.entries[0].content.length).toBe(200);
  });
});

describe('mergeMemory', () => {
  it('merges and deduplicates', () => {
    const existing = createStudyGroupMemory();
    existing.entries.push({ agentName: '小萌', content: 'hello', timestamp: 1 });

    const incoming = createStudyGroupMemory();
    incoming.entries.push({ agentName: '小萌', content: 'hello', timestamp: 2 });
    incoming.entries.push({ agentName: '智也', content: 'world', timestamp: 3 });

    const merged = mergeMemory(existing, incoming);
    expect(merged.entries.length).toBe(2);
  });

  it('caps at max entries', () => {
    const existing = createStudyGroupMemory();
    for (let i = 0; i < 25; i++) {
      existing.entries.push({ agentName: 'A', content: `${i}`, timestamp: i });
    }
    const incoming = createStudyGroupMemory();
    incoming.entries.push({ agentName: 'A', content: 'new', timestamp: 100 });

    const merged = mergeMemory(existing, incoming);
    expect(merged.entries.length).toBeLessThanOrEqual(20);
  });
});

describe('formatMemoryForPrompt', () => {
  it('returns empty string for empty memory', () => {
    const mem = createStudyGroupMemory();
    expect(formatMemoryForPrompt(mem)).toBe('');
  });

  it('formats recent entries', () => {
    const mem = createStudyGroupMemory();
    mem.entries.push({ agentName: '小萌', content: '二次函数很重要', timestamp: 1 });
    mem.entries.push({ agentName: '智也', content: '图像法很直观', timestamp: 2 });

    const prompt = formatMemoryForPrompt(mem);
    expect(prompt).toContain('之前讨论要点');
    expect(prompt).toContain('小萌');
    expect(prompt).toContain('智也');
  });

  it('truncates long prompt', () => {
    const mem = createStudyGroupMemory();
    for (let i = 0; i < 10; i++) {
      mem.entries.push({ agentName: 'A', content: 'a'.repeat(150), timestamp: i });
    }
    const prompt = formatMemoryForPrompt(mem);
    expect(prompt.length).toBeLessThanOrEqual(803); // 800 + '...'
  });
});
