/**
 * P1-003: Knowledge Graph DAO tests
 *
 * Tests save/load, buildGraph, delete, listGraphIds.
 */
import { describe, test, expect, beforeEach } from 'vitest';
import { createKnowledgeGraphDAO } from '@/lib/storage/dao/knowledge-graph';
import { MemoryStorageProvider } from '@/lib/storage/memory-provider';
import type { QuestionBankEntry } from '@/lib/storage/dao/question-bank';
import type { MistakeBookEntry } from '@/lib/storage/dao/mistakes';

function makeQuestion(hash: string, kps: string[]): QuestionBankEntry {
  return {
    problemHash: hash,
    problemText: `Question ${hash}`,
    answer: '42',
    steps: ['step1'],
    knowledgePoints: kps.map(k => ({ name: k, description: '', difficulty: 'easy' })),
    agentId: 'test-agent',
    verified: false,
  };
}

function makeMistake(id: string, kps: string[], masteryLevel = 0): MistakeBookEntry {
  return {
    id,
    problemText: `Mistake ${id}`,
    userAnswer: 'wrong',
    correctAnswer: 'right',
    errorType: 'calculation',
    knowledgePoints: kps,
    reviewCount: 0,
    masteryLevel,
    reviewed: false,
  };
}

describe('KnowledgeGraphDAO', () => {
  let dao: ReturnType<typeof createKnowledgeGraphDAO>;

  beforeEach(() => {
    const storage = new MemoryStorageProvider();
    dao = createKnowledgeGraphDAO(storage);
  });

  // ─── save / load ───

  describe('save / load', () => {
    test('saves and loads a graph', async () => {
      const entry = {
        graphId: 'test-graph',
        graph: { nodes: [], edges: [], weakPoints: [], overallMastery: 0 },
        rebuiltAt: Date.now(),
      };
      await dao.save(entry);
      const loaded = await dao.load('test-graph');
      expect(loaded).not.toBeNull();
      expect(loaded?.graphId).toBe('test-graph');
      expect(loaded?.graph).toEqual(entry.graph);
    });

    test('returns null for non-existent graph', async () => {
      const loaded = await dao.load('nonexistent');
      expect(loaded).toBeNull();
    });

    test('overwrites on second save', async () => {
      await dao.save({
        graphId: 'g1',
        graph: { nodes: [], edges: [], weakPoints: [], overallMastery: 0 },
        rebuiltAt: 1000,
      });
      await dao.save({
        graphId: 'g1',
        graph: { nodes: [{ id: 'a', name: 'A', category: 'math', questionCount: 1, mistakeCount: 0, avgMastery: 6 }], edges: [], weakPoints: [], overallMastery: 6 },
        rebuiltAt: 2000,
      });
      const loaded = await dao.load('g1');
      expect(loaded?.graph.nodes).toHaveLength(1);
    });
  });

  // ─── buildGraph ───

  describe('buildGraph', () => {
    test('builds nodes from question knowledge points', () => {
      const questions = [
        makeQuestion('q1', ['algebra', 'equation']),
        makeQuestion('q2', ['geometry']),
      ];
      const graph = dao.buildGraph(questions, []);
      expect(graph.nodes.length).toBe(3);
      const algebraNode = graph.nodes.find((n) => n.id === 'algebra');
      expect(algebraNode).toBeDefined();
      expect(algebraNode?.questionCount).toBe(1);
    });

    test('aggregates question counts', () => {
      const questions = [
        makeQuestion('q1', ['algebra']),
        makeQuestion('q2', ['algebra']),
        makeQuestion('q3', ['algebra']),
      ];
      const graph = dao.buildGraph(questions, []);
      const algebraNode = graph.nodes.find((n) => n.id === 'algebra');
      expect(algebraNode?.questionCount).toBe(3);
    });

    test('incorporates mistake data', () => {
      const questions = [makeQuestion('q1', ['algebra'])];
      const mistakes = [
        makeMistake('m1', ['algebra'], 0), // mastery 0 → inverted = 6
        makeMistake('m2', ['algebra'], 3), // mastery 3 → inverted = 3
      ];
      const graph = dao.buildGraph(questions, mistakes);
      const algebraNode = graph.nodes.find((n) => n.id === 'algebra');
      expect(algebraNode?.mistakeCount).toBe(2);
      // avgMastery = (6 + 3) / 2 = 4.5
      expect(algebraNode?.avgMastery).toBe(4.5);
    });

    test('defaults avgMastery to 6 when no mistakes', () => {
      const questions = [makeQuestion('q1', ['algebra'])];
      const graph = dao.buildGraph(questions, []);
      const algebraNode = graph.nodes.find((n) => n.id === 'algebra');
      expect(algebraNode?.avgMastery).toBe(6);
    });

    test('builds edges from co-occurring knowledge points', () => {
      const questions = [
        makeQuestion('q1', ['algebra', 'equation']),
      ];
      const graph = dao.buildGraph(questions, []);
      // Should have algebra <-> equation edge
      expect(graph.edges.length).toBeGreaterThanOrEqual(1);
      const edge = graph.edges.find(
        (e) =>
          (e.source === 'algebra' && e.target === 'equation') ||
          (e.source === 'equation' && e.target === 'algebra'),
      );
      expect(edge).toBeDefined();
      expect(edge?.type).toBe('related');
    });

    test('deduplicates edges', () => {
      const questions = [
        makeQuestion('q1', ['algebra', 'equation']),
        makeQuestion('q2', ['algebra', 'equation']),
      ];
      const graph = dao.buildGraph(questions, []);
      // Only one algebra <-> equation edge
      const count = graph.edges.filter(
        (e) =>
          (e.source === 'algebra' && e.target === 'equation') ||
          (e.source === 'equation' && e.target === 'algebra'),
      ).length;
      expect(count).toBe(1);
    });

    test('detects weak points', () => {
      const questions = [makeQuestion('q1', ['algebra'])];
      const mistakes = [
        makeMistake('m1', ['algebra'], 0), // mastery 0 → inverted = 6 → avgMastery = 6 / 1 = 6... wait
        // Actually avgMastery for 1 mistake: masterySum / mistakes = 6 / 1 = 6
        // That's not < 2. Let me use a higher mastery.
      ];
      // For weak point: avgMastery < 2 AND mistakeCount > 0
      // masterySum = 6 - masteryLevel. For avgMastery < 2:
      // Need masterySum / mistakes < 2 → masterySum < 2 * mistakes
      // With masteryLevel=5: inverted = 1. With 1 mistake: avgMastery = 1 < 2 ✓
      const mistakes2 = [makeMistake('m1', ['algebra'], 5)];
      const graph = dao.buildGraph(questions, mistakes2);
      expect(graph.weakPoints).toContain('algebra');
    });

    test('computes overallMastery', () => {
      const questions = [
        makeQuestion('q1', ['algebra']),
        makeQuestion('q2', ['geometry']),
      ];
      const graph = dao.buildGraph(questions, []);
      // Both nodes have avgMastery = 6 → overall = 6
      expect(graph.overallMastery).toBe(6);
    });

    test('returns empty graph for no data', () => {
      const graph = dao.buildGraph([], []);
      expect(graph.nodes).toEqual([]);
      expect(graph.edges).toEqual([]);
      expect(graph.weakPoints).toEqual([]);
      expect(graph.overallMastery).toBe(0);
    });

    test('guesses categories correctly', () => {
      const questions = [
        makeQuestion('q1', ['quadratic equation']),
        makeQuestion('q2', ['kinematics']),
        makeQuestion('q3', ['chemical reaction']),
        makeQuestion('q4', ['grammar']),
        makeQuestion('q5', ['world war']),
        makeQuestion('q6', ['random thing']),
      ];
      const graph = dao.buildGraph(questions, []);
      const categories = graph.nodes.map((n) => ({ name: n.name, category: n.category }));
      expect(categories.find((c) => c.name === 'quadratic equation')?.category).toBe('math');
      expect(categories.find((c) => c.name === 'kinematics')?.category).toBe('physics');
      expect(categories.find((c) => c.name === 'chemical reaction')?.category).toBe('chemistry');
      expect(categories.find((c) => c.name === 'grammar')?.category).toBe('language');
      expect(categories.find((c) => c.name === 'world war')?.category).toBe('history');
      expect(categories.find((c) => c.name === 'random thing')?.category).toBe('general');
    });
  });

  // ─── delete ───

  describe('delete', () => {
    test('deletes a graph', async () => {
      await dao.save({
        graphId: 'g1',
        graph: { nodes: [], edges: [], weakPoints: [], overallMastery: 0 },
        rebuiltAt: Date.now(),
      });
      expect(await dao.delete('g1')).toBe(true);
      expect(await dao.load('g1')).toBeNull();
    });

    test('returns false for non-existent graph', async () => {
      expect(await dao.delete('nonexistent')).toBe(false);
    });
  });

  // ─── listGraphIds ───

  describe('listGraphIds', () => {
    test('returns all graph IDs', async () => {
      await dao.save({ graphId: 'g1', graph: { nodes: [], edges: [], weakPoints: [], overallMastery: 0 }, rebuiltAt: Date.now() });
      await dao.save({ graphId: 'g2', graph: { nodes: [], edges: [], weakPoints: [], overallMastery: 0 }, rebuiltAt: Date.now() });
      const ids = await dao.listGraphIds();
      expect(ids.sort()).toEqual(['g1', 'g2']);
    });

    test('returns empty array when no graphs', async () => {
      expect(await dao.listGraphIds()).toEqual([]);
    });
  });
});
