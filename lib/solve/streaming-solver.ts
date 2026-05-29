/**
 * Streaming solver — wraps streamLLM to emit steps incrementally.
 *
 * Uses a lightweight state machine to parse the streaming JSON response
 * from the LLM, extracting individual step objects as they are completed.
 * Emits each step via an async callback so the caller can SSE them.
 */

import { streamLLM } from '@/lib/ai/llm';
import { getModel } from '@/lib/ai/providers';
import { buildSolverPrompt } from './solver-prompts';
import { resolveSolverModel } from './solver-constants';
import type { SolverAgentType } from './types';
import { createLogger } from '@/lib/logger';

const log = createLogger('StreamingSolver');

// ── LaTeX JSON escape fixer ──────────────────────────────────────────
// LLMs often emit LaTeX commands (\frac, \partial, \int, etc.) inside
// JSON strings. These backslash-letter sequences are invalid JSON escapes
// and cause JSON.parse to fail. We fix them by double-escaping the
// backslash.
//
// Key insight: if a backslash-letter is followed by another letter,
// it's a LaTeX command (e.g. \frac, \neq, \times) and must ALWAYS be
// double-escaped, even if the first letter is b/f/n/r/t.

const VALID_JSON_ESCAPE = new Set('bfnrtu');
const LATEX_LETTER = /[a-zA-Z]/;

function fixLatexJsonEscapes(json: string): string {
  let changed = false;
  const fixed = json.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (_match, content) => {
    const fixedContent = content.replace(/\\([a-zA-Z])/g, (_m: string, ch: string, offset: number, str: string) => {
      const nextChar = str[offset + 2];
      const isLatexCommand = nextChar != null && LATEX_LETTER.test(nextChar);

      if (VALID_JSON_ESCAPE.has(ch) && !isLatexCommand) {
        return _m; // real JSON escape: \n, \t — keep as-is
      }
      changed = true;
      return `\\\\${ch}`; // LaTeX command — double-escape for JSON
    });
    return `"${fixedContent}"`;
  });
  return changed ? fixed : json;
}

// ── LaTeX content cleaner ───────────────────────────────────────────
// LLMs emit messy LaTeX: stray newlines inside $...$, misplaced $,
// \sqrtn (missing braces), etc. Clean before display.

function cleanLatexContent(text: string): string {
  if (!text) return text;

  let s = text;

  // 1. /sum → \sum, /frac → \frac (LLM sometimes emits forward slash)
  s = s.replace(
    /\/(sum|prod|int|frac|sqrt|lim|sin|cos|tan|log|ln|exp|partial|nabla|infty|alpha|beta|gamma|delta|theta|lambda|mu|pi|sigma|phi|omega|cdot|times|div|pm|mp|leq|geq|neq|approx|equiv|sim|rightarrow|leftarrow|Rightarrow|Leftarrow|to|in|notin|subset|supset|subseteq|supseteq|cup|cap|forall|exists|neg|land|lor|emptyset)/g,
    (_m, cmd: string) => `\\${cmd}`,
  );

  // 2. Fix \sqrtn → \sqrt{n}, \sqrtabc → \sqrt{abc}
  s = s.replace(/\\sqrt(?![\[{])([a-zA-Z]+)/g, (_m, letters: string) => `\\sqrt{${letters}}`);

  // 3. Fix bare subscripts: \sum_n → \sum_{n}
  s = s.replace(
    /(\\(?:sum|prod|int|lim|bigcup|bigcap))_([a-zA-Z0-9]+)/g,
    (_m, cmd: string, sub: string) => `${cmd}_{${sub}}`,
  );
  s = s.replace(
    /(\\(?:sum|prod|int|lim))\^([a-zA-Z0-9]+)/g,
    (_m, cmd: string, sup: string) => `${cmd}^{${sup}}`,
  );

  // 4. Remove newlines inside $...$ blocks
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, (_m, math: string) => {
    return '$$' + math.replace(/\n/g, ' ') + '$$';
  });
  s = s.replace(/\$([^$]+?)\$/g, (_m, math: string) => {
    if (!math.includes('\n')) return '$' + math + '$';
    return '$' + math.replace(/\n/g, ' ') + '$';
  });

  // 5. Fix stray $ inside expressions: (-1$)^n → (-1)^n
  s = s.replace(/\$(?=[)}\]])/g, '');
  s = s.replace(/(?<=[({\[])\$/g, '');
  s = s.replace(/([a-zA-Z0-9])\$(?=[_^])/g, '$1');

  // 6. Fix split fractions: \frac{a}\n{b} → \frac{a}{b}
  s = s.replace(/(\\(?:frac|dfrac|tfrac|binom|dbinom|tbinom)\{[^}]*\})\s*\n\s*(\{)/g, '$1$2');

  return s;
}

// ── Answer cleaner ──────────────────────────────────────────────────
// LLMs sometimes ignore the "answer only" instruction and include
// explanation text like "所以答案是$3$" or "Therefore, x = 4".
// This strips explanation prefixes, keeping only the final result.

const EXPLANATION_PREFIXES = /^(所以|因此|故|综上|答案[是为：:]?\s*|answer\s*[:：]?\s*|∴\s*)/i;
const EXPLANATION_WORDS = /[,，;；。.\s]*(所以|因此|故|综上|即|也就是|等于|答案[是为])/;

function cleanAnswer(raw: string): string {
  let s = raw.trim();
  // Remove trailing explanation after the answer
  const explanationIdx = s.search(/[,，;；。.]\s*(所以|因此|故|综上|即|也就是)/);
  if (explanationIdx > 0) {
    s = s.substring(0, explanationIdx).trim();
  }
  // Remove leading explanation prefixes
  s = s.replace(EXPLANATION_PREFIXES, '').trim();
  // If the string contains both explanation and a LaTeX expression, extract the last expression
  const latexMatches = s.match(/\$[^$]+\$/g);
  if (latexMatches && latexMatches.length > 0 && s.length > latexMatches[latexMatches.length - 1].length + 10) {
    return latexMatches[latexMatches.length - 1];
  }
  return s;
}

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
      this.answer = cleanLatexContent(cleanAnswer(match[1]));
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
      // Not yet in buffer — stay in in_knowledge to wait for more data
      // Only skip to similar if we've accumulated enough buffer to be sure
      // the key is truly missing (e.g., buffer contains "similarQuestions")
      if (this.buffer.indexOf('"similarQuestions"') !== -1) {
        this.state = 'in_similar';
        this.tryFindSimilar(events);
      }
      return;
    }

    try {
      const after = this.buffer.substring(idx + 17);
      const bracketIdx = after.indexOf('[');
      if (bracketIdx === -1) return; // wait for more data
      const endIdx = after.indexOf(']', bracketIdx);

      if (endIdx !== -1) {
        const arrStr = after.substring(bracketIdx, endIdx + 1);
        const arr = JSON.parse(fixLatexJsonEscapes(arrStr));
        if (Array.isArray(arr) && arr.length > 0) {
          this.knowledge = arr.map((k: any) => ({
            name: cleanLatexContent(k.name || ''),
            description: cleanLatexContent(k.description || ''),
            difficulty: k.difficulty || 'medium',
          }));
          events.push({ type: 'knowledge', points: this.knowledge });
        }
        // Successfully parsed (or empty array) — move to similar
        this.state = 'in_similar';
        this.tryFindSimilar(events);
      }
      // else: end bracket not found, wait for more data
    } catch {
      // Parse failed — wait for more data, don't transition yet
    }
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
        const arr = JSON.parse(fixLatexJsonEscapes(arrStr));
        if (Array.isArray(arr)) {
          this.similar = arr.map((q: any) => ({
            problem: cleanLatexContent(q.problem || ''),
            difficulty: typeof q.difficulty === 'number' ? q.difficulty : 5,
            knowledgePoint: cleanLatexContent(q.knowledgePoint || ''),
          }));
          events.push({ type: 'similar', questions: this.similar });
        }
      }
    } catch {
      // incomplete
    }
  }

  private tryParseStep(json: string): StepEvent | null {
    const obj = this.tryJsonParse(json);
    if (obj?.label && obj.content) {
      return {
        type: 'step',
        label: String(obj.label),
        content: cleanLatexContent(String(obj.content)),
        keyPoints: Array.isArray(obj.keyPoints) ? (obj.keyPoints as string[]).map(cleanLatexContent) : [],
      };
    }
    return null;
  }

  /**
   * Parse JSON with automatic LaTeX escape repair.
   * LLMs often emit \frac, \partial etc. inside JSON strings, which are
   * invalid JSON escape sequences. We fix them before parsing.
   */
  private tryJsonParse(json: string): Record<string, unknown> | null {
    try {
      return JSON.parse(json);
    } catch {
      const fixed = fixLatexJsonEscapes(json);
      if (fixed !== json) {
        try {
          return JSON.parse(fixed);
        } catch {
          // still broken
        }
      }
    }
    return null;
  }

  /** Last-resort: try to parse the entire buffer as JSON to extract data */
  private extractFallback(): void {
    if (this.steps.length > 0 && this.answer && this.knowledge.length > 0 && this.similar.length > 0) return;

    try {
      // Try to find a valid JSON object in the buffer
      const match = this.buffer.match(/\{[\s\S]*\}/);
      if (!match) return;
      const obj = this.tryJsonParse(match[0]);
      if (!obj) return;

      if (!this.answer && obj.answer) {
        this.answer = cleanAnswer(obj.answer as string);
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

// ── Main streaming solve function ────────────────────────────────────

export async function* streamSolve(
  agentType: SolverAgentType,
  problemText: string,
  problemImage: string | null,
): AsyncGenerator<StreamEvent> {
  const modelConfig = resolveSolverModel(agentType);
  const modelWithInfo = getModel(modelConfig);

  const systemPrompt = buildSolverPrompt(agentType, problemText, problemImage ?? undefined);

  yield { type: 'phase', phase: 'solving' };

  // Dynamic token limit: short problems get fewer tokens for faster generation
  const maxTokens = problemText.length < 100 ? 2048 : problemText.length < 300 ? 3072 : 4096;

  const result = streamLLM(
    {
      model: modelWithInfo.model,
      system: systemPrompt,
      messages: [{ role: 'user', content: problemText }] as any,
      temperature: 0.3,
      maxOutputTokens: maxTokens,
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

  const modelConfig = resolveSolverModel(agentType);
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
            content: cleanLatexContent(s.content),
            keyPoints: Array.isArray(s.keyPoints) ? s.keyPoints.map(cleanLatexContent) : [],
          };
        }
      }
    }
    if (parsed.answer) {
      yield { type: 'answer', answer: cleanLatexContent(cleanAnswer(parsed.answer)) };
    }
    if (Array.isArray(parsed.knowledgePoints)) {
      yield {
        type: 'knowledge',
        points: parsed.knowledgePoints.map((k: any) => ({
          name: cleanLatexContent(k.name || ''),
          description: cleanLatexContent(k.description || ''),
          difficulty: k.difficulty || 'medium',
        })),
      };
    }
    if (Array.isArray(parsed.similarQuestions)) {
      yield {
        type: 'similar',
        questions: parsed.similarQuestions.map((q: any) => ({
          problem: cleanLatexContent(q.problem || ''),
          difficulty: typeof q.difficulty === 'number' ? q.difficulty : 5,
          knowledgePoint: cleanLatexContent(q.knowledgePoint || ''),
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
