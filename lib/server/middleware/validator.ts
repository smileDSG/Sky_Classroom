/**
 * Zod Validation Middleware Helper
 *
 * Provides a typed wrapper for validating API request bodies against Zod schemas.
 * Returns a standardised error response on validation failure.
 *
 * Usage:
 *   import { validateBody } from '@/lib/server/middleware/validator';
 *   import { z } from 'zod';
 *
 *   const Schema = z.object({ name: z.string().min(1) });
 *
 *   export async function POST(req: Request) {
 *     const validation = await validateBody(req, Schema);
 *     if (!validation.success) return validation.response;
 *     const { name } = validation.data;
 *     // ... handle valid request ...
 *   }
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError, API_ERROR_CODES } from '@/lib/server/api-response';

/**
 * Validate a request body against a Zod schema.
 *
 * @returns On success: `{ success: true, data: T }`
 *          On failure: `{ success: false, response: NextResponse }`
 */
export async function validateBody<T extends z.ZodType>(
  req: Request,
  schema: T,
): Promise<
  | { success: true; data: z.infer<T> }
  | { success: false; response: NextResponse }
> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return {
      success: false,
      response: apiError(
        API_ERROR_CODES.INVALID_REQUEST,
        400,
        'Invalid JSON body',
      ),
    };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    );
    return {
      success: false,
      response: apiError(
        API_ERROR_CODES.INVALID_REQUEST,
        400,
        'Validation failed',
        errors.join('; '),
      ),
    };
  }

  return { success: true, data: result.data };
}

/**
 * Validate FormData fields against a Zod schema.
 *
 * Extracts the fields from FormData into a plain object, then validates.
 */
export async function validateFormData<T extends z.ZodType>(
  req: Request,
  schema: T,
  fields: string[],
): Promise<
  | { success: true; data: z.infer<T> }
  | { success: false; response: NextResponse }
> {
  const formData = await req.formData();
  const obj: Record<string, unknown> = {};
  for (const field of fields) {
    obj[field] = formData.get(field);
  }

  const result = schema.safeParse(obj);
  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    );
    return {
      success: false,
      response: apiError(
        API_ERROR_CODES.INVALID_REQUEST,
        400,
        'Validation failed',
        errors.join('; '),
      ),
    };
  }

  return { success: true, data: result.data };
}
