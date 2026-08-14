import { z } from 'zod';

import type { StorageProvider } from '@/lib/storage/storage-types';
import {
  simulationRunResultSchema,
  type SimulationRunResult,
} from '@/lib/adaptive-learning/simulation/virtual-student';

const TABLE = 'virtual_student_simulations';

export const virtualSimulationRecordSchema = simulationRunResultSchema.extend({
  createdAt: z.string().datetime(),
});

export type VirtualSimulationRecord = z.infer<typeof virtualSimulationRecordSchema>;

export function createVirtualSimulationDAO(storage: StorageProvider) {
  return {
    async add(result: SimulationRunResult): Promise<VirtualSimulationRecord> {
      const record = virtualSimulationRecordSchema.parse({
        ...result,
        createdAt: new Date().toISOString(),
      });
      const timestamp = new Date(record.createdAt).getTime();
      await storage.set(TABLE, {
        id: record.runId,
        data: record,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return record;
    },

    async get(runId: string): Promise<VirtualSimulationRecord | null> {
      const entry = await storage.get<VirtualSimulationRecord>(TABLE, runId);
      return entry ? virtualSimulationRecordSchema.parse(entry.data) : null;
    },

    async list(limit = 50): Promise<VirtualSimulationRecord[]> {
      const entries = await storage.getAll<VirtualSimulationRecord>(TABLE);
      return entries
        .map((entry) => virtualSimulationRecordSchema.parse(entry.data))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, Math.max(1, Math.min(100, limit)));
    },
  };
}
