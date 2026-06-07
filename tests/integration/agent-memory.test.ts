/**
 * P6-001 Test 19: 智能体记忆跨轮次
 *
 * Tests agent memory across conversation turns — agents remember
 * user preferences, previous answers, and progress information
 * across multiple rounds of dialogue.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

// ─── Memory types ───

interface MemoryEntry {
  id: string;
  type: 'preference' | 'fact' | 'progress' | 'question';
  content: string;
  turnNumber: number;
  importance: number; // 0-1
}

interface AgentMemory {
  agentId: string;
  entries: MemoryEntry[];
  maxEntries: number;
}

// ─── Memory system ───

function createMemory(agentId: string, maxEntries = 50): AgentMemory {
  return { agentId, entries: [], maxEntries };
}

function addMemory(
  memory: AgentMemory,
  type: MemoryEntry['type'],
  content: string,
  turnNumber: number,
  importance = 0.5,
): void {
  memory.entries.push({
    id: `mem-${Date.now()}-${Math.random()}`,
    type,
    content,
    turnNumber,
    importance,
  });

  // Evict lowest importance if over limit
  if (memory.entries.length > memory.maxEntries) {
    memory.entries.sort((a, b) => a.importance - b.importance);
    memory.entries.shift();
  }
}

function getMemoriesByType(memory: AgentMemory, type: MemoryEntry['type']): MemoryEntry[] {
  return memory.entries.filter((e) => e.type === type);
}

function getRecentMemories(memory: AgentMemory, n: number): MemoryEntry[] {
  return memory.entries.slice(-n);
}

function searchMemories(memory: AgentMemory, query: string): MemoryEntry[] {
  const q = query.toLowerCase();
  return memory.entries.filter((e) => e.content.toLowerCase().includes(q));
}

// ─── Tests ───

describe('P6-001 Test 19: 智能体记忆跨轮次', () => {
  describe('memory creation', () => {
    test('agent starts with empty memory', () => {
      const memory = createMemory('teacher-1');
      expect(memory.entries).toHaveLength(0);
    });

    test('adding memory stores the entry', () => {
      const memory = createMemory('teacher-1');
      addMemory(memory, 'fact', 'Student likes visual explanations', 1, 0.8);

      expect(memory.entries).toHaveLength(1);
      expect(memory.entries[0].content).toBe('Student likes visual explanations');
      expect(memory.entries[0].importance).toBe(0.8);
    });

    test('different memory types are tracked', () => {
      const memory = createMemory('teacher-1');
      addMemory(memory, 'preference', 'Prefers Chinese', 1);
      addMemory(memory, 'fact', 'Topic is photosynthesis', 2);
      addMemory(memory, 'progress', 'Completed scene 1', 3);
      addMemory(memory, 'question', 'Asked about light reaction', 4);

      expect(getMemoriesByType(memory, 'preference')).toHaveLength(1);
      expect(getMemoriesByType(memory, 'fact')).toHaveLength(1);
      expect(getMemoriesByType(memory, 'progress')).toHaveLength(1);
      expect(getMemoriesByType(memory, 'question')).toHaveLength(1);
    });

    test('turn number is recorded', () => {
      const memory = createMemory('student-1');
      addMemory(memory, 'fact', 'First question', 1);
      addMemory(memory, 'fact', 'Second question', 5);

      expect(memory.entries[0].turnNumber).toBe(1);
      expect(memory.entries[1].turnNumber).toBe(5);
    });
  });

  describe('cross-turn memory', () => {
    test('agent remembers preference across turns', () => {
      const memory = createMemory('teacher-1');

      // Turn 1: user states preference
      addMemory(memory, 'preference', 'Student prefers simple language', 1, 0.9);

      // Turn 5: agent recalls preference
      const preferences = getMemoriesByType(memory, 'preference');
      expect(preferences).toHaveLength(1);
      expect(preferences[0].content).toContain('simple language');
    });

    test('agent remembers previous answers', () => {
      const memory = createMemory('teacher-1');

      // Turn 1: teacher explains
      addMemory(memory, 'fact', 'Photosynthesis converts light to energy', 1, 0.7);

      // Turn 3: student asks follow-up
      addMemory(memory, 'question', 'What about dark reaction?', 3, 0.5);

      // Teacher should have access to previous explanation
      const facts = searchMemories(memory, 'photosynthesis');
      expect(facts).toHaveLength(1);
    });

    test('agent tracks progress across rounds', () => {
      const memory = createMemory('teacher-1');

      addMemory(memory, 'progress', 'Scene 1 completed', 1, 0.8);
      addMemory(memory, 'progress', 'Scene 2 started', 5, 0.6);
      addMemory(memory, 'progress', 'Scene 2 completed', 10, 0.8);

      const progress = getMemoriesByType(memory, 'progress');
      expect(progress).toHaveLength(3);
      expect(progress[2].content).toContain('Scene 2 completed');
    });
  });

  describe('memory retrieval', () => {
    test('search finds relevant memories', () => {
      const memory = createMemory('teacher-1');
      addMemory(memory, 'fact', 'Photosynthesis is important', 1);
      addMemory(memory, 'fact', 'Respiration is different', 2);
      addMemory(memory, 'fact', 'Plants need sunlight', 3);

      const results = searchMemories(memory, 'photosynthesis');
      expect(results).toHaveLength(1);
      expect(results[0].content).toContain('Photosynthesis');
    });

    test('recent memories are accessible', () => {
      const memory = createMemory('teacher-1');
      for (let i = 0; i < 10; i++) {
        addMemory(memory, 'fact', `Fact ${i}`, i);
      }

      const recent = getRecentMemories(memory, 3);
      expect(recent).toHaveLength(3);
      expect(recent[2].content).toBe('Fact 9');
    });

    test('search is case insensitive', () => {
      const memory = createMemory('teacher-1');
      addMemory(memory, 'fact', 'Photosynthesis', 1);

      const results = searchMemories(memory, 'photosynthesis');
      expect(results).toHaveLength(1);
    });
  });

  describe('memory eviction', () => {
    test('low importance entries are evicted first', () => {
      const memory = createMemory('teacher-1', 3);
      addMemory(memory, 'fact', 'Important fact', 1, 0.9);
      addMemory(memory, 'fact', 'Less important', 2, 0.2);
      addMemory(memory, 'fact', 'Somewhat important', 3, 0.5);
      addMemory(memory, 'fact', 'New important fact', 4, 0.8); // triggers eviction

      expect(memory.entries).toHaveLength(3);
      // Least important (0.2) should be removed
      const contents = memory.entries.map((e) => e.content);
      expect(contents).not.toContain('Less important');
    });

    test('max entries is respected', () => {
      const memory = createMemory('teacher-1', 5);
      for (let i = 0; i < 10; i++) {
        addMemory(memory, 'fact', `Fact ${i}`, i, 0.5 + Math.random() * 0.5);
      }

      expect(memory.entries.length).toBeLessThanOrEqual(5);
    });
  });

  describe('multi-agent memory isolation', () => {
    test('each agent has separate memory', () => {
      const teacherMemory = createMemory('teacher-1');
      const studentMemory = createMemory('student-1');

      addMemory(teacherMemory, 'fact', 'Teacher knowledge', 1);
      addMemory(studentMemory, 'question', 'Student question', 1);

      expect(teacherMemory.entries).toHaveLength(1);
      expect(studentMemory.entries).toHaveLength(1);
      expect(teacherMemory.entries[0].content).not.toBe(studentMemory.entries[0].content);
    });
  });
});
