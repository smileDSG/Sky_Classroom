import { apiError, apiSuccess, API_ERROR_CODES } from '@/lib/server/api-response';
import {
  applyPersonalizationLabEvent,
  createPersonalizationLabState,
  type PersonalizationLabEventType,
  type PersonalizationLabState,
} from '@/lib/adaptive-learning/decision/personalization-lab';

export const dynamic = 'force-dynamic';

const DEFAULT_SESSION_ID = 'default-demo';
const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const EVENT_TYPES = new Set<PersonalizationLabEventType>([
  'answer-correct',
  'answer-incorrect',
  'review-success',
  'review-failure',
]);
const states = new Map<string, PersonalizationLabState>();

function normalizeSessionId(value: unknown): string {
  return typeof value === 'string' && SESSION_ID_PATTERN.test(value) ? value : DEFAULT_SESSION_ID;
}

function getState(sessionId: string): PersonalizationLabState {
  const existing = states.get(sessionId);
  if (existing) return existing;

  const initial = createPersonalizationLabState(sessionId);
  states.set(sessionId, initial);
  return initial;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = normalizeSessionId(url.searchParams.get('sessionId'));
  return apiSuccess({ data: getState(sessionId) });
}

export async function POST(request: Request) {
  let body: { sessionId?: unknown; eventType?: unknown };
  try {
    body = await request.json();
  } catch {
    return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, '请求内容必须是有效 JSON');
  }

  const sessionId = normalizeSessionId(body.sessionId);
  if (body.eventType === 'reset') {
    const resetState = createPersonalizationLabState(sessionId);
    states.set(sessionId, resetState);
    return apiSuccess({ data: resetState });
  }

  if (
    typeof body.eventType !== 'string' ||
    !EVENT_TYPES.has(body.eventType as PersonalizationLabEventType)
  ) {
    return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, '不支持的实验事件');
  }

  const nextState = applyPersonalizationLabEvent(getState(sessionId), {
    type: body.eventType as PersonalizationLabEventType,
  });
  states.set(sessionId, nextState);
  return apiSuccess({ data: nextState });
}
