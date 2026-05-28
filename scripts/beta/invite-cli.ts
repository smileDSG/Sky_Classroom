#!/usr/bin/env tsx
/**
 * Beta 邀请码管理 CLI
 *
 * Usage:
 *   npx tsx scripts/beta/invite-cli.ts create [--count N] [--uses N] [--days N] [--prefix PREFIX]
 *   npx tsx scripts/beta/invite-cli.ts list [--status STATUS]
 *   npx tsx scripts/beta/invite-cli.ts revoke <CODE>
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const db = createClient(supabaseUrl, supabaseKey);
const TABLE = 'invitation_codes';

function generateCode(length: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

async function createCodes(options: { count: number; uses: number; days: number; prefix: string }) {
  const expiresAt = new Date(Date.now() + options.days * 24 * 60 * 60 * 1000);
  const codes = [];

  for (let i = 0; i < options.count; i++) {
    const code = `${options.prefix}-${generateCode(8)}`;
    codes.push({
      code,
      type: 'direct' as const,
      created_by: 'cli',
      expires_at: expiresAt.toISOString(),
      max_uses: options.uses,
      current_uses: 0,
      status: 'active',
    });
  }

  const { data, error } = await db.from(TABLE).insert(codes).select();
  if (error) {
    console.error('❌ 创建失败:', error.message);
    process.exit(1);
  }

  console.log(`\n✅ 成功创建 ${data.length} 个邀请码:\n`);
  for (const item of data) {
    console.log(`  ${item.code}  (可用 ${item.max_uses} 次, 过期: ${new Date(item.expires_at).toLocaleDateString('zh-CN')})`);
  }
  console.log(`\n总计: ${data.length} 个\n`);
}

async function listCodes(status?: string) {
  let query = db.from(TABLE).select().order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) {
    console.error('❌ 查询失败:', error.message);
    process.exit(1);
  }

  console.log(`\n邀请码列表 (${data.length} 个):\n`);
  console.log('  %-25s %-8s %-8s %-12s %-10s', 'CODE', 'STATUS', 'USES', 'EXPIRES', 'NOTES');
  console.log('  ' + '-'.repeat(70));
  for (const item of data) {
    console.log(
      '  %-25s %-8s %-8s %-12s %-10s',
      item.code,
      item.status,
      `${item.current_uses}/${item.max_uses}`,
      item.expires_at ? new Date(item.expires_at).toLocaleDateString('zh-CN') : '永不过期',
      item.notes || '',
    );
  }
  console.log();
}

async function revokeCode(code: string) {
  const { data, error } = await db
    .from(TABLE)
    .update({ status: 'expired' })
    .eq('code', code.toUpperCase())
    .select();

  if (error) {
    console.error('❌ 撤销失败:', error.message);
    process.exit(1);
  }
  if (!data || data.length === 0) {
    console.error('❌ 未找到邀请码:', code);
    process.exit(1);
  }

  console.log(`✅ 已撤销邀请码: ${code.toUpperCase()}`);
}

const args = process.argv.slice(2);
const command = args[0];

if (command === 'create') {
  const count = parseInt(args.find((a) => a.startsWith('--count='))?.split('=')[1] || '10');
  const uses = parseInt(args.find((a) => a.startsWith('--uses='))?.split('=')[1] || '1');
  const days = parseInt(args.find((a) => a.startsWith('--days='))?.split('=')[1] || '30');
  const prefix = args.find((a) => a.startsWith('--prefix='))?.split('=')[1] || 'BETA';

  createCodes({ count, uses, days, prefix });
} else if (command === 'list') {
  const status = args.find((a) => a.startsWith('--status='))?.split('=')[1];
  listCodes(status);
} else if (command === 'revoke') {
  if (!args[1]) {
    console.error('Usage: npx tsx scripts/beta/invite-cli.ts revoke <CODE>');
    process.exit(1);
  }
  revokeCode(args[1]);
} else {
  console.log('用法:');
  console.log('  npx tsx scripts/beta/invite-cli.ts create [--count N] [--uses N] [--days N] [--prefix PREFIX]');
  console.log('  npx tsx scripts/beta/invite-cli.ts list [--status STATUS]');
  console.log('  npx tsx scripts/beta/invite-cli.ts revoke <CODE>');
}
