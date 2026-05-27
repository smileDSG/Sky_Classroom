/**
 * Invitation code DAO for beta access control.
 * Uses Supabase PostgreSQL.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabase() {
  return createClient(supabaseUrl, supabaseKey);
}

export interface InvitationCode {
  id: string;
  code: string;
  type: 'direct' | 'request';
  status: 'active' | 'used' | 'expired';
  createdBy: string;
  createdAt: Date;
  usedBy: string | null;
  usedAt: Date | null;
  expiresAt: Date | null;
  maxUses: number;
  currentUses: number;
  notes: string | null;
}

export async function createInvitationDAO() {
  const db = getSupabase();
  const TABLE = 'invitation_codes';

  return {
    async create(input: { code: string; type: 'direct' | 'request'; createdBy: string; expiresAt?: Date; maxUses?: number; notes?: string }): Promise<InvitationCode> {
      const { data, error } = await db
        .from(TABLE)
        .insert({
          code: input.code,
          type: input.type,
          created_by: input.createdBy,
          expires_at: input.expiresAt?.toISOString() ?? null,
          max_uses: input.maxUses ?? 1,
          notes: input.notes ?? null,
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to create invitation code: ${error.message}`);
      return mapInvitationCode(data);
    },

    async batchCreate(input: { prefix: string; count: number; type: 'direct' | 'request'; createdBy: string; expiresAt?: Date; notes?: string }): Promise<InvitationCode[]> {
      const codes: { code: string; type: string; created_by: string; expires_at: string | null; max_uses: number; notes: string | null }[] = [];
      for (let i = 0; i < input.count; i++) {
        const suffix = generateCode(8);
        codes.push({
          code: `${input.prefix}-${suffix}`,
          type: input.type,
          created_by: input.createdBy,
          expires_at: input.expiresAt?.toISOString() ?? null,
          max_uses: 1,
          notes: input.notes ?? null,
        });
      }

      const { data, error } = await db.from(TABLE).insert(codes).select();
      if (error) throw new Error(`Failed to batch create invitation codes: ${error.message}`);
      return (data as any[]).map(mapInvitationCode);
    },

    async getByCode(code: string): Promise<InvitationCode | null> {
      const { data, error } = await db
        .from(TABLE)
        .select()
        .eq('code', code)
        .eq('status', 'active')
        .single();

      if (error || !data) return null;

      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        await db.from(TABLE).update({ status: 'expired' }).eq('id', data.id);
        return null;
      }

      return mapInvitationCode(data);
    },

    async markUsed(id: string, userId: string): Promise<InvitationCode> {
      const { data, error } = await db
        .from(TABLE)
        .update({
          status: 'used',
          used_by: userId,
          used_at: new Date().toISOString(),
          current_uses: (await db.from(TABLE).select('current_uses').eq('id', id).single()).data?.current_uses + 1,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(`Failed to mark invitation as used: ${error.message}`);
      return mapInvitationCode(data);
    },

    async list(filter?: { status?: string }): Promise<InvitationCode[]> {
      let query = db.from(TABLE).select();
      if (filter?.status) query = query.eq('status', filter.status);
      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw new Error(`Failed to list invitation codes: ${error.message}`);
      return (data as any[]).map(mapInvitationCode);
    },
  };
}

function generateCode(length: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function mapInvitationCode(data: any): InvitationCode {
  return {
    id: data.id,
    code: data.code,
    type: data.type,
    status: data.status,
    createdBy: data.created_by,
    createdAt: new Date(data.created_at),
    usedBy: data.used_by,
    usedAt: data.used_at ? new Date(data.used_at) : null,
    expiresAt: data.expires_at ? new Date(data.expires_at) : null,
    maxUses: data.max_uses,
    currentUses: data.current_uses,
    notes: data.notes,
  };
}
