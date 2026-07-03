import { NextRequest } from 'next/server';

import { verifySoftwareCupAcademicContent } from '@/lib/software-cup/demo-service';

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    content?: string;
    citations?: string[];
  };
  const result = await verifySoftwareCupAcademicContent({
    content: body.content,
    citations: body.citations,
  });

  return Response.json({
    success: true,
    data: result,
  });
}
