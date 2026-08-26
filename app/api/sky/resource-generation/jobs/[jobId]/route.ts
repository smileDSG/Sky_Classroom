import { NextRequest } from 'next/server';

export async function GET(_req: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await context.params;
  return Response.json(
    {
      success: false,
      error: 'Resource generation is synchronous; use the POST response directly.',
      jobId,
    },
    { status: 410 },
  );
}
