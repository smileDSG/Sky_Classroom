import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError } from '@/lib/server/api-response';

import { verifySoftwareCupAcademicContent } from '@/lib/software-cup/demo-service';

const VerifyAcademicSchema = z.object({
  content: z.string().max(20000, 'content exceeds 20000 chars').optional(),
  citations: z.array(z.string().max(2000, 'citation exceeds 2000 chars')).max(100).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = VerifyAcademicSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return apiError('INVALID_REQUEST', 400, 'Invalid request', parsed.error.issues[0].message);
  }
  const result = await verifySoftwareCupAcademicContent({
    content: parsed.data.content,
    citations: parsed.data.citations,
  });

  return Response.json({
    success: true,
    data: result,
  });
}
