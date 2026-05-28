/**
 * GET /api/beta/admin/feedback
 * 管理员查看反馈列表
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const category = searchParams.get('category');
  const limit = parseInt(searchParams.get('limit') || '50');

  const db = createClient(supabaseUrl, supabaseKey);
  let query = db.from('beta_feedback').select().order('created_at', { ascending: false }).limit(limit);

  if (status) query = query.eq('status', status);
  if (category) query = query.eq('category', category);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}

/**
 * PATCH /api/beta/admin/feedback
 * 更新反馈状态
 */
export async function PATCH(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
  }

  const body = await request.json();
  const db = createClient(supabaseUrl, supabaseKey);

  const { error } = await db
    .from('beta_feedback')
    .update({
      status: body.status,
      admin_notes: body.admin_notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
