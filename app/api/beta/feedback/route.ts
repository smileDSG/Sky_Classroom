/**
 * POST /api/beta/feedback
 * 用户提交反馈到 Supabase
 */
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const FeedbackSchema = z.object({
  session_id: z.string(),
  category: z.enum(['bug', 'suggestion', 'complaint', 'praise']),
  severity: z.enum(['blocker', 'major', 'minor', 'trivial']),
  test_case_ref: z.string().optional(),
  page_context: z.record(z.unknown()).optional(),
  quick_tags: z.array(z.string()).default([]),
  description: z.string().min(1, '描述不能为空'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = FeedbackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const db = createClient(supabaseUrl, supabaseKey);
    const { error } = await db.from('beta_feedback').insert({
      session_id: parsed.data.session_id,
      category: parsed.data.category,
      severity: parsed.data.severity,
      test_case_ref: parsed.data.test_case_ref || null,
      page_context: parsed.data.page_context || null,
      quick_tags: parsed.data.quick_tags,
      description: parsed.data.description,
    });

    if (error) {
      return NextResponse.json(
        { success: false, error: '保存反馈失败' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 },
    );
  }
}
