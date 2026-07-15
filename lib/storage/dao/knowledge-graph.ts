/**
 * Knowledge Graph DAO (Data Access Object)
 *
 * Builds and manages a knowledge point relationship graph from
 * question bank and mistake data. Supports mastery analysis
 * and weak point detection.
 */

import type { StorageProvider, StorageEntry } from '../storage-types';
import type { QuestionBankEntry } from './question-bank';
import type { MistakeBookEntry } from './mistakes';

/** A node in the knowledge graph — represents one knowledge point */
export interface KnowledgeGraphNode {
  /** Unique identifier (knowledge point name or slug) */
  id: string;
  /** Display name */
  name: string;
  /** Category (e.g., 'math', 'physics', 'chemistry') */
  category: string;
  /** Number of questions covering this point */
  questionCount: number;
  /** Number of mistakes on this point */
  mistakeCount: number;
  /** Average mastery level (0-6, from Ebbinghaus intervals) */
  avgMastery: number;
}

/** An edge in the knowledge graph — represents a relationship between two points */
export interface KnowledgeGraphEdge {
  /** Source node ID */
  source: string;
  /** Target node ID */
  target: string;
  /** Relationship type */
  type: 'prerequisite' | 'related' | 'similar';
  /** Confidence score (0-1) */
  weight: number;
}

/** Complete knowledge graph */
export interface KnowledgeGraphData {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  /** Knowledge points where mastery is below threshold */
  weakPoints: string[];
  /** Overall average mastery across all points */
  overallMastery: number;
}

/** Stored knowledge graph entry */
export interface KnowledgeGraphEntry {
  /** Graph ID (e.g., 'default', 'math-2026') */
  graphId: string;
  /** Graph data */
  graph: KnowledgeGraphData;
  /** Last rebuild timestamp */
  rebuiltAt: number;
}

const TABLE = 'knowledge-graph';
const MASTERY_THRESHOLD = 2; // Below this = weak point

export function createKnowledgeGraphDAO(storage: StorageProvider) {
  return {
    /** Save a knowledge graph */
    async save(entry: KnowledgeGraphEntry): Promise<void> {
      const now = Date.now();
      const storageEntry: StorageEntry<KnowledgeGraphEntry> = {
        id: entry.graphId,
        data: entry,
        createdAt: now,
        updatedAt: now,
      };
      await storage.set(TABLE, storageEntry);
    },

    /** Load a knowledge graph by ID */
    async load(graphId: string): Promise<KnowledgeGraphEntry | null> {
      const result = await storage.get<KnowledgeGraphEntry>(TABLE, graphId);
      return result?.data ?? null;
    },

    /** Build a knowledge graph from question bank and mistake data */
    buildGraph(
      questions: QuestionBankEntry[],
      mistakes: MistakeBookEntry[],
    ): KnowledgeGraphData {
      // Collect all knowledge points
      const pointMap = new Map<string, { name: string; questions: number; mistakes: number; masterySum: number }>();

      // From question bank
      for (const q of questions) {
        for (const kp of q.knowledgePoints) {
          const key = kp.name.toLowerCase();
          const existing = pointMap.get(key) ?? { name: kp.name, questions: 0, mistakes: 0, masterySum: 0 };
          existing.questions += 1;
          pointMap.set(key, existing);
        }
      }

      // From mistakes
      for (const m of mistakes) {
        for (const kp of m.knowledgePoints) {
          const key = kp.toLowerCase();
          const existing = pointMap.get(key) ?? {
            name: kp,
            questions: 0,
            mistakes: 0,
            masterySum: 0,
          };
          existing.mistakes += 1;
          // Mastery from mistake's masteryLevel (inverted — more mistakes = lower mastery)
          existing.masterySum += (6 - m.masteryLevel);
          pointMap.set(key, existing);
        }
      }

      // Build nodes
      const nodes: KnowledgeGraphNode[] = [...pointMap.entries()].map(([key, data]) => ({
        id: key,
        name: data.name,
        category: guessCategory(key),
        questionCount: data.questions,
        mistakeCount: data.mistakes,
        avgMastery: data.mistakes > 0
          ? Math.round((data.masterySum / data.mistakes) * 100) / 100
          : 6,
      }));

      // Build edges — co-occurrence based
      const edges: KnowledgeGraphEdge[] = [];
      const questionGroups = new Map<string, Set<string>>();

      for (const q of questions) {
        for (const kp of q.knowledgePoints) {
          const key = kp.name.toLowerCase();
          if (!questionGroups.has(key)) questionGroups.set(key, new Set());
          for (const other of q.knowledgePoints) {
            const otherKey = other.name.toLowerCase();
            if (key !== otherKey) {
              questionGroups.get(key)!.add(otherKey);
            }
          }
        }
      }

      const edgeSet = new Set<string>();
      for (const [source, targets] of questionGroups) {
        for (const target of targets) {
          const edgeKey = [source, target].sort().join('||');
          if (edgeSet.has(edgeKey)) continue;
          edgeSet.add(edgeKey);

          const coCount = questionGroups.get(target)?.has(source) ? 1 : 0;
          const totalQuestions = Math.max(
            nodes.find((n) => n.id === source)?.questionCount ?? 1,
            1,
          );

          edges.push({
            source,
            target,
            type: 'related',
            weight: Math.round((coCount / totalQuestions) * 100) / 100,
          });
        }
      }

      // Detect weak points
      const weakPoints = nodes
        .filter((n) => n.avgMastery < MASTERY_THRESHOLD && n.mistakeCount > 0)
        .map((n) => n.id);

      const overallMastery = nodes.length > 0
        ? Math.round((nodes.reduce((s, n) => s + n.avgMastery, 0) / nodes.length) * 100) / 100
        : 0;

      return { nodes, edges, weakPoints, overallMastery };
    },

    /** Delete a knowledge graph */
    async delete(graphId: string): Promise<boolean> {
      return storage.delete(TABLE, graphId);
    },

    /** List all stored graphs */
    async listGraphIds(): Promise<string[]> {
      const all = await storage.getAll<KnowledgeGraphEntry>(TABLE);
      return all.map((e) => e.data.graphId);
    },
  };
}

/** Simple heuristic to guess a knowledge point's category from its name */
function guessCategory(name: string): string {
  const n = name.toLowerCase();

  if (/equation|algebra|function|derivative|integral|matrix|trigonometr|calculus|geometry|probability|statistics/.test(n))
    return 'math';
  if (/force|energy|wave|electric|magnet|thermodynam|kinemat|optics|momentum|acceleration/.test(n))
    return 'physics';
  if (/atom|molecule|reaction|acid|base|organic|inorganic|element|bond|oxidation/.test(n))
    return 'chemistry';
  if (/grammar|vocabulary|sentence|verb|noun|adjective|pronoun|tense/.test(n))
    return 'language';
  if (/dynasty|revolution|war|treaty|empire|civilization|government/.test(n))
    return 'history';

  return 'general';
}
