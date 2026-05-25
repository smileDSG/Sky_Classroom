/**
 * Streaming solver — wraps streamLLM to emit steps incrementally.
 *
 * Uses a lightweight state machine to parse the streaming JSON response
 * from the LLM, extracting individual step objects as they are completed.
 * Emits each step via an async callback so the caller can SSE them.
 */

import { streamLLM } from '@/lib/ai/llm';
import { getModel } from '@/lib/ai/providers';
import type { ProviderId } from '@/lib/ai/providers';
import { buildSolverPrompt } from './solver-prompts';
import type { SolverAgentType } from './types';
import { createLogger } from '@/lib/logger';

const log = createLogger('StreamingSolver');

// ── Model mapping (same as solver-agent.ts) ──────────────────────────

const AGENT_MODEL_MAP: Record<SolverAgentType, { providerId: ProviderId; modelId: string }> = {
  universal: { providerId: 'deepseek', modelId: 'deepseek-v4-flash' },
  science: { providerId: 'glm', modelId: 'glm-5.1' },
  humanities: { providerId: 'qwen', modelId: 'qwen3.6-plus' },
  grading: { providerId: 'deepseek', modelId: 'deepseek-v4-flash' },
};

// ── Event types emitted during streaming ─────────────────────────────

export interface StepEvent {
  type: 'step';
  label: string;
  content: string;
  keyPoints: string[];
}

export interface AnswerEvent {
  type: 'answer';
  answer: string;
}

export interface KnowledgeEvent {
  type: 'knowledge';
  points: { name: string; description: string; difficulty: string }[];
}

export interface SimilarEvent {
  type: 'similar';
  questions: { problem: string; difficulty: number; knowledgePoint: string }[];
}

export interface PhaseEvent {
  type: 'phase';
  phase: string;
}

export type StreamEvent = StepEvent | AnswerEvent | KnowledgeEvent | SimilarEvent | PhaseEvent;

// ── Streaming JSON parser state machine ──────────────────────────────

type ParseState =
  | 'init'          // looking for "steps" key
  | 'in_steps'      // found "steps", looking for first {
  | 'in_step'       // inside a step object, tracking braces
  | 'after_steps'   // steps array closed, looking for "answer"
  | 'in_answer'     // inside answer string
  | 'in_knowledge'  // looking for knowledge array
  | 'in_similar';   // looking for similar array

/**
 * Lightweight streaming JSON step parser.
 *
 * Tracks brace depth to identify complete step objects within the
 * "steps" array as the LLM streams its JSON response.
 */
class StepStreamParser {
  private state: ParseState = 'init';
  private buffer = '';
  private braceDepth = 0;
  private stepStart = -1;

  private steps: StepEvent[] = [];
  private answer = '';
  private knowledge: KnowledgeEvent['points'] = [];
  private similar: SimilarEvent['questions'] = [];

  /** Feed a chunk of text, returns any newly completed steps */
  feed(chunk: string): StreamEvent[] {
    const events: StreamEvent[] = [];
    this.buffer += chunk;

    switch (this.state) {
      case 'init':
        this.tryFindSteps(events);
        break;
      case 'in_steps':
        this.tryEnterStep(events);
        break;
      case 'in_step':
        this.trackStepObject(events);
        break;
      case 'after_steps':
        this.tryFindAnswer(events);
        break;
      case 'in_answer':
        this.trackAnswer(events);
        break;
      case 'in_knowledge':
        this.tryFindKnowledge(events);
        break;
      case 'in_similar':
        this.tryFindSimilar(events);
        break;
    }

    return events;
  }

  /** Get all collected results at end of stream */
  finalize(): { answer: string; steps: StepEvent[]; knowledge: KnowledgeEvent['points']; similar: SimilarEvent['questions'] } {
    // Try to extract remaining data from buffer
    this.extractFallback();
    return {
      answer: this.answer,
      steps: this.steps,
      knowledge: this.knowledge,
      similar: this.similar,
    };
  }

  // ── State handlers ────────────────────────────────────────

  private tryFindSteps(events: StreamEvent[]): void {
    const idx = this.buffer.indexOf('"steps"');
    if (idx === -1) return;

    // Find the array opening after "steps"
    const after = this.buffer.substring(idx + 7);
    const bracketIdx = after.indexOf('[');
    if (bracketIdx === -1) return;

    this.state = 'in_steps';
    this.buffer = after.substring(bracketIdx + 1);
    // Try to immediately find a step
    this.tryEnterStep(events);
  }

  private tryEnterStep(events: StreamEvent[]): void {
    const braceIdx = this.buffer.indexOf('{');
    if (braceIdx === -1) return;

    this.state = 'in_step';
    this.braceDepth = 0;
    this.stepStart = braceIdx;
    this.trackStepObject(events);
  }

  private trackStepObject(events: StreamEvent[]): void {
    // Scan through the buffer tracking brace depth
    for (let i = this.stepStart; i < this.buffer.length; i++) {
      const ch = this.buffer[i];
      if (ch === '{') {
        this.braceDepth++;
      } else if (ch === '}') {
        this.braceDepth--;
        if (this.braceDepth === 0) {
          // Complete step object found
          const stepJson = this.buffer.substring(this.stepStart, i + 1);
          const parsed = this.tryParseStep(stepJson);
          if (parsed) {
            events.push(parsed);
            this.steps.push(parsed);
          }
          // Continue scanning after this step
          this.buffer = this.buffer.substring(i + 1);
          this.state = 'in_steps';
          // Check if there are more steps or if array ended
          const nextBrace = this.buffer.indexOf('{');
          const arrayEnd = this.buffer.indexOf(']');
          if (nextBrace !== -1 && (arrayEnd === -1 || nextBrace < arrayEnd)) {
            this.state = 'in_step';
            this.stepStart = nextBrace;
            this.braceDepth = 0;
            return this.trackStepObject(events);
          }
          // Steps array ended, look for answer
          this.state = 'after_steps';
          return this.tryFindAnswer(events);
        }
      }
    }
  }

  private tryFindAnswer(events: StreamEvent[]): void {
    const idx = this.buffer.indexOf('"answer"');
    if (idx === -1) return;

    // Extract answer string value
    const after = this.buffer.substring(idx + 8);
    const colonIdx = after.indexOf(':');
    if (colonIdx === -1) return;

    const valuePart = after.substring(colonIdx + 1).trim();
    const match = valuePart.match(/"([^"]*)"/);
    if (match) {
      this.answer = match[1];
      events.push({ type: 'answer', answer: this.answer });
      this.state = 'in_knowledge';
      this.tryFindKnowledge(events);
    }
  }

  private trackAnswer(events: StreamEvent[]): void {
    // Fallback — handled in tryFindAnswer
    this.tryFindAnswer(events);
  }

  private tryFindKnowledge(events: StreamEvent[]): void {
    const idx = this.buffer.indexOf('"knowledgePoints"');
    if (idx === -1) {
      // Might be after similarQuestions
      this.state = 'in_similar';
      return this.tryFindSimilar(events);
    }

    try {
      const after = this.buffer.substring(idx + 18);
      const bracketIdx = after.indexOf('[');
      if (bracketIdx === -1) return;
      const endIdx = after.indexOf(']', bracketIdx);

      if (endIdx !== -1) {
        const arrStr = after.substring(bracketIdx, endIdx + 1);
        const arr = JSON.parse(arrStr);
        if (Array.isArray(arr)) {
          this.knowledge = arr.map((k: any) => ({
            name: k.name || '',
            description: k.description || '',
            difficulty: k.difficulty || 'medium',
          }));
          events.push({ type: 'knowledge', points: this.knowledge });
        }
      }
    } catch {
      // incomplete, will retry with more data
    }
    this.state = 'in_similar';
    this.tryFindSimilar(events);
  }

  private tryFindSimilar(events: StreamEvent[]): void {
    const idx = this.buffer.indexOf('"similarQuestions"');
    if (idx === -1) return;

    try {
      const after = this.buffer.substring(idx + 18);
      const bracketIdx = after.indexOf('[');
      if (bracketIdx === -1) return;
      const endIdx = after.indexOf(']', bracketIdx);

      if (endIdx !== -1) {
        const arrStr = after.substring(bracketIdx, endIdx + 1);
        const arr = JSON.parse(arrStr);
        if (Array.isArray(arr)) {
          this.similar = arr.map((q: any) => ({
            problem: q.problem || '',
            difficulty: typeof q.difficulty === 'number' ? q.difficulty : 5,
            knowledgePoint: q.knowledgePoint || '',
          }));
          events.push({ type: 'similar', questions: this.similar });
        }
      }
    } catch {
      // incomplete
    }
  }

  private tryParseStep(json: string): StepEvent | null {
    try {
      const obj = JSON.parse(json);
      if (obj.label && obj.content) {
        return {
          type: 'step',
          label: obj.label,
          content: obj.content,
          keyPoints: Array.isArray(obj.keyPoints) ? obj.keyPoints : [],
        };
      }
    } catch {
      // malformed step, skip
    }
    return null;
  }

  /** Last-resort: try to parse the entire buffer as JSON to extract data */
  private extractFallback(): void {
    if (this.steps.length > 0 && this.answer) return;

    try {
      // Try to find a valid JSON object in the buffer
      const match = this.buffer.match(/\{[\s\S]*\}/);
      if (!match) return;
      const obj = JSON.parse(match[0]);

      if (!this.answer && obj.answer) {
        this.answer = obj.answer;
      }
      if (this.steps.length === 0 && Array.isArray(obj.steps)) {
        for (const s of obj.steps) {
          if (s.label && s.content) {
            this.steps.push({
              type: 'step',
              label: s.label,
              content: s.content,
              keyPoints: Array.isArray(s.keyPoints) ? s.keyPoints : [],
            });
          }
        }
      }
      if (this.knowledge.length === 0 && Array.isArray(obj.knowledgePoints)) {
        this.knowledge = obj.knowledgePoints.map((k: any) => ({
          name: k.name || '',
          description: k.description || '',
          difficulty: k.difficulty || 'medium',
        }));
      }
      if (this.similar.length === 0 && Array.isArray(obj.similarQuestions)) {
        this.similar = obj.similarQuestions.map((q: any) => ({
          problem: q.problem || '',
          difficulty: typeof q.difficulty === 'number' ? q.difficulty : 5,
          knowledgePoint: q.knowledgePoint || '',
        }));
      }
    } catch {
      // give up
    }
  }
}

// ── Env key lookup (same as solver-agent.ts) ─────────────────────────

const ENV_KEY_MAP: Record<string, string> = {
  deepseek: 'DEEPSEEK_API_KEY',
  glm: 'GLM_API_KEY',
  qwen: 'QWEN_API_KEY',
};

function resolveModelConfig(agentType: SolverAgentType): Parameters<typeof getModel>[0] {
  const { providerId, modelId } = AGENT_MODEL_MAP[agentType];
  const apiKey = process.env[ENV_KEY_MAP[providerId] ?? ''] ?? '';
  return { providerId, modelId, apiKey, providerType: 'openai' as const };
}

// ── Main streaming solve function ────────────────────────────────────

export async function* streamSolve(
  agentType: SolverAgentType,
  problemText: string,
  problemImage: string | null,
): AsyncGenerator<StreamEvent> {
  const modelConfig = resolveModelConfig(agentType);
  const modelWithInfo = getModel(modelConfig);

  const systemPrompt = buildSolverPrompt(agentType, problemText, problemImage ?? undefined);

  yield { type: 'phase', phase: 'solving' };

  const result = streamLLM(
    {
      model: modelWithInfo.model,
      system: systemPrompt,
      messages: [{ role: 'user', content: problemText }] as any,
      temperature: 0.3,
      maxOutputTokens: 4096,
    },
    'solve-streaming',
    undefined,
  );

  const parser = new StepStreamParser();

  try {
    for await (const chunk of result.textStream) {
      const events = parser.feed(chunk);
      for (const event of events) {
        yield event;
      }
    }
  } catch (err) {
    log.error('Stream solve error:', err);
    throw err;
  }

  // Finalize — emit anything the parser missed
  const final = parser.finalize();

  if (final.steps.length === 0 || !final.answer) {
    // Streaming parse failed — try fallback with full text
    yield* fallbackSolve(agentType, problemText, problemImage);
    return;
  }

  // Emit answer if not already emitted
  if (final.answer) {
    // Check if we already emitted answer during streaming
    const wasEmitted = parser['answer'] !== ''; // heuristic
    if (!wasEmitted || !final.answer) {
      yield { type: 'answer', answer: final.answer };
    }
  }

  if (final.knowledge.length > 0) {
    yield { type: 'knowledge', points: final.knowledge };
  }
  if (final.similar.length > 0) {
    yield { type: 'similar', questions: final.similar };
  }
}

/** Fallback: non-streaming solve when streaming parse fails */
async function* fallbackSolve(
  agentType: SolverAgentType,
  problemText: string,
  problemImage: string | null,
): AsyncGenerator<StreamEvent> {
  const { callLLM } = await import('@/lib/ai/llm');
  const { getModel: getModelFn } = await import('@/lib/ai/providers');
  const { parseJsonResponse } = await import('@/lib/generation/json-repair');

  const modelConfig = resolveModelConfig(agentType);
  const modelWithInfo = getModelFn(modelConfig);

  const systemPrompt = buildSolverPrompt(agentType, problemText, problemImage ?? undefined);

  const result = await callLLM(
    {
      model: modelWithInfo.model,
      messages: [{ role: 'user', content: problemText }] as any,
      temperature: 0.3,
      maxOutputTokens: 4096,
    },
    'solve-fallback',
    { retries: 0 },
    undefined,
    systemPrompt,
  );

  const parsed = parseJsonResponse<any>(result.text || '');

  if (parsed) {
    if (Array.isArray(parsed.steps)) {
      for (const s of parsed.steps) {
        if (s.label && s.content) {
          yield {
            type: 'step',
            label: s.label,
            content: s.content,
            keyPoints: Array.isArray(s.keyPoints) ? s.keyPoints : [],
          };
        }
      }
    }
    if (parsed.answer) {
      yield { type: 'answer', answer: parsed.answer };
    }
    if (Array.isArray(parsed.knowledgePoints)) {
      yield {
        type: 'knowledge',
        points: parsed.knowledgePoints.map((k: any) => ({
          name: k.name || '',
          description: k.description || '',
          difficulty: k.difficulty || 'medium',
        })),
      };
    }
    if (Array.isArray(parsed.similarQuestions)) {
      yield {
        type: 'similar',
        questions: parsed.similarQuestions.map((q: any) => ({
          problem: q.problem || '',
          difficulty: typeof q.difficulty === 'number' ? q.difficulty : 5,
          knowledgePoint: q.knowledgePoint || '',
        })),
      };
    }
  } else {
    // Raw text fallback
    const text = result.text || '';
    yield { type: 'step', label: '解答', content: text, keyPoints: [] };
    yield { type: 'answer', answer: text };
    yield { type: 'knowledge', points: [] };
    yield { type: 'similar', questions: [] };
  }
}
