import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError } from '@/lib/server/api-response';

import { checkSoftwareCupContentSafety } from '@/lib/software-cup/demo-service';

const CheckSchema = z
  .object({
    input: z.string().max(20000, 'input exceeds 20000 chars').optional(),
    content: z.string().max(20000, 'content exceeds 20000 chars').optional(),
  })
  .refine((d) => Boolean(d.input || d.content), { message: 'input or content is required' });

export async function POST(req: NextRequest) {
  const parsed = CheckSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return apiError('INVALID_REQUEST', 400, 'Invalid request', parsed.error.issues[0].message);
  }
  const result = checkSoftwareCupContentSafety(parsed.data.input || parsed.data.content || '');

  return Response.json({
    success: true,
    data: result,
  });
}
