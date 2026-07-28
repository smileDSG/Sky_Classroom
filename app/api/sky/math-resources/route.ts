import { NextResponse } from 'next/server';

import { adaptiveLearningApiError, createCorrelationId } from '@/lib/adaptive-learning/api-error';
import { mathResourceQuerySchema } from '@/lib/adaptive-learning/contracts/resource';
import { AdaptiveLearningError } from '@/lib/adaptive-learning/errors';
import { createGaokaoMathResourceRepository } from '@/lib/adaptive-learning/resources/repository';
import { requireAuth } from '@/lib/server/auth/helpers';

export async function GET(request: Request): Promise<NextResponse> {
  const correlationId = createCorrelationId(request.headers.get('x-correlation-id'));

  let auth: Awaited<ReturnType<typeof requireAuth>>;
  try {
    auth = await requireAuth();
  } catch (cause) {
    return adaptiveLearningApiError(
      new AdaptiveLearningError({
        code: 'SYNC_FAILED',
        message: 'Authentication service is unavailable',
        retryable: true,
        stage: 'math-resources-auth',
        cause,
      }),
      correlationId,
    );
  }

  if ('error' in auth) {
    return adaptiveLearningApiError(
      new AdaptiveLearningError({
        code: 'UNAUTHENTICATED',
        message: 'Authentication is required',
        retryable: false,
        stage: 'math-resources-auth',
      }),
      correlationId,
    );
  }

  try {
    const queryValues = Object.fromEntries(new URL(request.url).searchParams.entries());
    const query = mathResourceQuerySchema.safeParse(queryValues);
    if (!query.success) {
      throw new AdaptiveLearningError({
        code: 'INVALID_SCHEMA',
        message: 'Math resource query is invalid',
        retryable: false,
        stage: 'math-resources-api',
        details: { issues: query.error.issues },
      });
    }

    const data = await createGaokaoMathResourceRepository().findVerified(query.data);
    return NextResponse.json(
      { success: true, data, correlationId },
      { headers: { 'x-correlation-id': correlationId } },
    );
  } catch (error) {
    return adaptiveLearningApiError(error, correlationId);
  }
}
