import { NextRequest } from 'next/server';

import { checkSoftwareCupContentSafety } from '@/lib/software-cup/demo-service';

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { input?: string; content?: string };
  const result = checkSoftwareCupContentSafety(body.input || body.content || '');

  return Response.json({
    success: true,
    data: result,
  });
}
