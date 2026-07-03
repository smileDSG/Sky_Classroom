import { NextRequest } from 'next/server';

import { runSoftwareCupGeneration } from '@/lib/software-cup/demo-service';

export async function GET(_req: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await context.params;
  const result = await runSoftwareCupGeneration('');

  return Response.json({
    success: true,
    data: {
      ...result,
      jobId,
    },
  });
}
