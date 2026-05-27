/**
 * Supabase Storage Provider
 *
 * Server-side storage using Supabase (PostgreSQL).
 * Used by API routes for persistent user data.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { StorageProvider, StorageEntry } from './storage-types';
import { createLogger } from '@/lib/logger';

const log = createLogger('Storage:Supabase');

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }

  _client = createClient(url, key);
  return _client;
}

export class SupabaseStorageProvider implements StorageProvider {
  private tableName: string;

  constructor(tableName: string = 'storage_entries') {
    this.tableName = tableName;
  }

  async set<T>(table: string, entry: StorageEntry<T>): Promise<void> {
    const client = getClient();
    const { error } = await client
      .from(this.tableName)
      .upsert({
        id: entry.id,
        table_name: table,
        data: entry.data,
        created_at: new Date(entry.createdAt).toISOString(),
        updated_at: new Date(entry.updatedAt).toISOString(),
      }, { onConflict: 'id,table_name' });

    if (error) {
      log.error('Supabase set error:', error);
      throw new Error(`Failed to set entry: ${error.message}`);
    }
  }

  async get<T>(table: string, id: string): Promise<StorageEntry<T> | null> {
    const client = getClient();
    const { data, error } = await client
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .eq('table_name', table)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // not found
      log.error('Supabase get error:', error);
      throw new Error(`Failed to get entry: ${error.message}`);
    }

    return {
      id: data.id,
      data: data.data as T,
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
    };
  }

  async getAll<T>(table: string, filter?: (entry: StorageEntry<T>) => boolean): Promise<StorageEntry<T>[]> {
    const client = getClient();
    const { data, error } = await client
      .from(this.tableName)
      .select('*')
      .eq('table_name', table);

    if (error) {
      log.error('Supabase getAll error:', error);
      throw new Error(`Failed to get entries: ${error.message}`);
    }

    const entries: StorageEntry<T>[] = data.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      data: row.data as T,
      createdAt: new Date(row.created_at as string).getTime(),
      updatedAt: new Date(row.updated_at as string).getTime(),
    }));

    return filter ? entries.filter(filter) : entries;
  }

  async delete(table: string, id: string): Promise<boolean> {
    const client = getClient();
    const { error, count } = await client
      .from(this.tableName)
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('table_name', table);

    if (error) {
      log.error('Supabase delete error:', error);
      throw new Error(`Failed to delete entry: ${error.message}`);
    }

    return (count ?? 0) > 0;
  }

  async clear(table: string): Promise<void> {
    const client = getClient();
    const { error } = await client
      .from(this.tableName)
      .delete()
      .eq('table_name', table);

    if (error) {
      log.error('Supabase clear error:', error);
      throw new Error(`Failed to clear entries: ${error.message}`);
    }
  }

  async count(table: string): Promise<number> {
    const client = getClient();
    const { count, error } = await client
      .from(this.tableName)
      .select('*', { count: 'exact', head: true })
      .eq('table_name', table);

    if (error) {
      log.error('Supabase count error:', error);
      throw new Error(`Failed to count entries: ${error.message}`);
    }

    return count ?? 0;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const client = getClient();
      const { error } = await client.from(this.tableName).select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }
}

/**
 * Create a dedicated Supabase-backed user DAO.
 * Uses a direct `users` table for better query performance.
 */
export function createSupabaseUserDAO() {
  const client = getClient();

  return {
    async create(user: Record<string, unknown>) {
      const now = new Date().toISOString();
      const { data, error } = await client
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          username: user.username,
          password_hash: user.passwordHash,
          role: user.role,
          status: user.status,
          guest_id: user.guestId,
          plan_type: user.planType,
          avatar: user.avatar ?? null,
          nickname: user.nickname ?? null,
          bio: user.bio ?? null,
          email_verified: user.emailVerified ?? false,
          email_verify_token: user.emailVerifyToken ?? null,
          reset_token: user.resetToken ?? null,
          reset_token_expiry: user.resetTokenExpiry ?? null,
          created_at: now,
          updated_at: now,
          last_login_at: null,
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to create user: ${error.message}`);
      return mapRowToUserEntry(data);
    },

    async getById(id: string) {
      const { data, error } = await client
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error) return null;
      return mapRowToUserEntry(data);
    },

    async getByEmail(email: string) {
      const { data, error } = await client
        .from('users')
        .select('*')
        .ilike('email', email)
        .single();

      if (error) return null;
      return mapRowToUserEntry(data);
    },

    async getByUsername(username: string) {
      const { data, error } = await client
        .from('users')
        .select('*')
        .ilike('username', username)
        .single();

      if (error) return null;
      return mapRowToUserEntry(data);
    },

    async getByGuestId(guestId: string) {
      const { data, error } = await client
        .from('users')
        .select('*')
        .eq('guest_id', guestId)
        .single();

      if (error) return null;
      return mapRowToUserEntry(data);
    },

    async update(id: string, updates: Record<string, unknown>) {
      const mapped: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (updates.email !== undefined) mapped.email = updates.email;
      if (updates.username !== undefined) mapped.username = updates.username;
      if (updates.passwordHash !== undefined) mapped.password_hash = updates.passwordHash;
      if (updates.role !== undefined) mapped.role = updates.role;
      if (updates.status !== undefined) mapped.status = updates.status;
      if (updates.planType !== undefined) mapped.plan_type = updates.planType;
      if (updates.avatar !== undefined) mapped.avatar = updates.avatar;
      if (updates.nickname !== undefined) mapped.nickname = updates.nickname;
      if (updates.bio !== undefined) mapped.bio = updates.bio;
      if (updates.emailVerified !== undefined) mapped.email_verified = updates.emailVerified;
      if (updates.emailVerifyToken !== undefined) mapped.email_verify_token = updates.emailVerifyToken;
      if (updates.resetToken !== undefined) mapped.reset_token = updates.resetToken;
      if (updates.resetTokenExpiry !== undefined) mapped.reset_token_expiry = updates.resetTokenExpiry;
      if (updates.lastLoginAt !== undefined) mapped.last_login_at = updates.lastLoginAt ? new Date(updates.lastLoginAt).toISOString() : null;

      const { data, error } = await client
        .from('users')
        .update(mapped)
        .eq('id', id)
        .select()
        .single();

      if (error) return null;
      return mapRowToUserEntry(data);
    },

    async delete(id: string) {
      const { error } = await client.from('users').delete().eq('id', id);
      return !error;
    },

    async list() {
      const { data, error } = await client.from('users').select('*');
      if (error) return [];
      return data.map(mapRowToUserEntry);
    },
  };
}

/** Map a Supabase row (snake_case) to UserEntry (camelCase) */
function mapRowToUserEntry(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    email: row.email as string | null,
    username: row.username as string,
    passwordHash: row.password_hash as string | null,
    role: row.role as 'guest' | 'user' | 'admin',
    status: row.status as 'active' | 'suspended',
    guestId: row.guest_id as string | null,
    planType: row.plan_type as 'free' | 'basic' | 'pro' | 'enterprise',
    createdAt: new Date(row.created_at as string).getTime(),
    updatedAt: new Date(row.updated_at as string).getTime(),
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at as string).getTime() : null,
    avatar: row.avatar as string | null,
    nickname: row.nickname as string | null,
    bio: row.bio as string | null,
    emailVerified: row.email_verified as boolean,
    emailVerifyToken: row.email_verify_token as string | null,
    resetToken: row.reset_token as string | null,
    resetTokenExpiry: row.reset_token_expiry ? new Date(row.reset_token_expiry as string).getTime() : null,
  };
}
