import { NextRequest } from 'next/server';

import { runSoftwareCupGeneration } from '@/lib/software-cup/demo-service';

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    input?: string;
    studentInput?: string;
    userId?: string;
  };
  const result = await runSoftwareCupGeneration(body.input || body.studentInput || '', {
    userId: body.userId,
    enableLlm: true,
  });

  return Response.json({
    success: true,
    data: result,
  });
}
