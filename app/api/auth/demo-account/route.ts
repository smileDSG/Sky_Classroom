import { NextResponse } from 'next/server';
import { isDemoAccountEnabled } from '@/lib/server/demo-user';

export async function GET() {
  return NextResponse.json({ enabled: isDemoAccountEnabled() });
}
