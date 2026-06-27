import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

import type { ClassroomGenerationJob } from '@/lib/server/classroom-job-store';

let tempRoot = '';
let jobsDir = '';

async function writeDiskJob(job: ClassroomGenerationJob) {
  await fs.mkdir(jobsDir, { recursive: true });
  await fs.writeFile(path.join(jobsDir, `${job.id}.json`), JSON.stringify(job, null, 2), 'utf-8');
}

describe('classroom job hybrid store', () => {
  beforeEach(async () => {
    vi.resetModules();
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'classroom-job-store-'));
    jobsDir = path.join(tempRoot, 'jobs');

    vi.doMock('@/lib/server/classroom-storage', async () => {
      const actual = await vi.importActual<typeof import('@/lib/server/classroom-storage')>(
        '@/lib/server/classroom-storage',
      );
      return {
        ...actual,
        CLASSROOM_JOBS_DIR: jobsDir,
        ensureClassroomJobsDir: async () => {
          await fs.mkdir(jobsDir, { recursive: true });
        },
        writeJsonFileAtomic: async (filePath: string, data: unknown) => {
          await fs.mkdir(path.dirname(filePath), { recursive: true });
          await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
        },
      };
    });
  });

  afterEach(async () => {
    vi.doUnmock('@/lib/server/classroom-storage');
    vi.resetModules();
    if (tempRoot) {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  test('refreshes a non-terminal cached job when disk has newer completion state', async () => {
    const store = await import('@/lib/server/classroom-job-store-hybrid');
    const input = { requirement: 'Teach quadratic functions' };
    const created = await store.createClassroomGenerationJobHybrid('job_sync_1', input);

    expect(created.progress).toBe(1);

    await writeDiskJob({
      ...created,
      status: 'succeeded',
      step: 'completed',
      progress: 100,
      message: 'Classroom generation completed',
      updatedAt: '2026-06-27T04:30:00.000Z',
      completedAt: '2026-06-27T04:30:00.000Z',
      scenesGenerated: 7,
      result: {
        classroomId: 'classroom_1',
        url: 'http://localhost:3000/classroom/classroom_1',
        scenesCount: 7,
      },
    });

    const read = await store.readClassroomGenerationJobHybrid('job_sync_1');

    expect(read).toMatchObject({
      status: 'succeeded',
      progress: 100,
      result: { classroomId: 'classroom_1' },
    });
  });
});
