/**
 * Beta access request DAO.
 * Uses Supabase PostgreSQL.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabase() {
  return createClient(supabaseUrl, supabaseKey);
}

export interface BetaRequest {
  id: string;
  email: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  appliedAt: Date;
  reviewedBy: string | null;
  reviewedAt: Date | null;
}

export async function createBetaRequestDAO() {
  const db = getSupabase();
  const TABLE = 'beta_requests';

  return {
    async create(input: { email: string; reason?: string }): Promise<BetaRequest> {
      const { data, error } = await db
        .from(TABLE)
        .insert({
          email: input.email,
          reason: input.reason ?? null,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to create beta request: ${error.message}`);
      return mapBetaRequest(data);
    },

    async getByEmail(email: string): Promise<BetaRequest | null> {
      const { data, error } = await db
        .from(TABLE)
        .select()
        .eq('email', email)
        .order('applied_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) return null;
      return mapBetaRequest(data);
    },

    async list(filter?: { status?: string }): Promise<BetaRequest[]> {
      let query = db.from(TABLE).select();
      if (filter?.status) query = query.eq('status', filter.status);
      query = query.order('applied_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw new Error(`Failed to list beta requests: ${error.message}`);
      return (data as any[]).map(mapBetaRequest);
    },

    async review(
      id: string,
      status: 'approved' | 'rejected',
      reviewerId: string,
    ): Promise<BetaRequest> {
      const { data, error } = await db
        .from(TABLE)
        .update({
          status,
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(`Failed to review beta request: ${error.message}`);
      return mapBetaRequest(data);
    },
  };
}

function mapBetaRequest(data: any): BetaRequest {
  return {
    id: data.id,
    email: data.email,
    reason: data.reason,
    status: data.status,
    appliedAt: new Date(data.applied_at),
    reviewedBy: data.reviewed_by,
    reviewedAt: data.reviewed_at ? new Date(data.reviewed_at) : null,
  };
}
