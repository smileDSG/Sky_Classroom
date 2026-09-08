/**
 * Billing Order DAO.
 */

import { createStorageProvider } from '@/lib/storage/storage-factory';
import type { StorageProvider } from '@/lib/storage/storage-types';

const TABLE = 'billing_orders';

export type OrderStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type PaymentMethod = 'alipay' | 'wechat' | 'mock';

export interface OrderEntry {
  id: string;
  userId: string;
  planType: string;
  amount: number;
  currency: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  outTradeNo: string;
  createdAt: number;
  updatedAt: number;
  paidAt: number | null;
}

let _provider: StorageProvider | null = null;

async function ensureProvider(): Promise<StorageProvider> {
  if (!_provider) {
    _provider = await createStorageProvider({
      databaseName: 'MAIC-Billing',
    });
  }
  return _provider;
}

export async function createBillingDAO(storage?: StorageProvider) {
  const s = storage ?? (await ensureProvider());

  return {
    async create(
      order: Omit<OrderEntry, 'createdAt' | 'updatedAt' | 'paidAt'>,
    ): Promise<OrderEntry> {
      const now = Date.now();
      const entry = {
        id: order.id,
        data: { ...order, createdAt: now, updatedAt: now, paidAt: null } as unknown as Record<
          string,
          unknown
        >,
        createdAt: now,
        updatedAt: now,
      };
      await s.set(TABLE, entry);
      return entry.data as unknown as OrderEntry;
    },

    async getById(id: string): Promise<OrderEntry | null> {
      const result = await s.get<OrderEntry>(TABLE, id);
      return result?.data ?? null;
    },

    async getByUserId(userId: string): Promise<OrderEntry[]> {
      const all = await s.getAll<OrderEntry>(TABLE);
      return all
        .filter((e) => (e.data as OrderEntry).userId === userId)
        .map((e) => e.data as OrderEntry)
        .sort((a, b) => b.createdAt - a.createdAt);
    },

    async update(id: string, data: Partial<OrderEntry>): Promise<OrderEntry | null> {
      const existing = await s.get<OrderEntry>(TABLE, id);
      if (!existing) return null;
      const updated = {
        ...existing,
        data: { ...existing.data, ...data, updatedAt: Date.now() },
        updatedAt: Date.now(),
      };
      await s.set(TABLE, updated);
      return updated.data as unknown as OrderEntry;
    },

    async delete(id: string): Promise<boolean> {
      return s.delete(TABLE, id);
    },
  };
}

export type BillingDAO = ReturnType<typeof createBillingDAO>;
