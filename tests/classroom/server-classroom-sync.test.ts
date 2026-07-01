import { describe, expect, test } from 'vitest';
import {
  getServerClassroomUpdatedAtMs,
  shouldUseServerClassroom,
  timestampToMs,
} from '@/lib/classroom/server-classroom-sync';

describe('server classroom sync', () => {
  test('uses server classroom when local IndexedDB has no matching stage', () => {
    expect(
      shouldUseServerClassroom(
        {
          stage: { id: 'server-id', createdAt: 1000, updatedAt: 1000 },
          updatedAt: '2026-06-30T01:00:00.000Z',
        },
        { id: 'other-id', createdAt: 2000, updatedAt: 2000 },
      ),
    ).toBe(true);
  });

  test('uses server classroom when repaired server JSON is newer than local IndexedDB', () => {
    expect(
      shouldUseServerClassroom(
        {
          stage: { id: 'cIdqQKU56B', createdAt: 1000, updatedAt: 1000 },
          updatedAt: '2026-06-30T02:00:00.000Z',
        },
        {
          id: 'cIdqQKU56B',
          createdAt: timestampToMs('2026-06-30T01:00:00.000Z') ?? 0,
          updatedAt: timestampToMs('2026-06-30T01:30:00.000Z') ?? 0,
        },
      ),
    ).toBe(true);
  });

  test('uses server classroom even when local IndexedDB has a newer UI timestamp', () => {
    expect(
      shouldUseServerClassroom(
        {
          stage: { id: 'cIdqQKU56B', createdAt: 1000, updatedAt: 1000 },
          updatedAt: '2026-06-30T01:00:00.000Z',
        },
        {
          id: 'cIdqQKU56B',
          createdAt: timestampToMs('2026-06-30T01:00:00.000Z') ?? 0,
          updatedAt: timestampToMs('2026-06-30T02:00:00.000Z') ?? 0,
        },
      ),
    ).toBe(true);
  });

  test('prefers top-level server updatedAt over older stage timestamps', () => {
    expect(
      getServerClassroomUpdatedAtMs({
        stage: { id: 'classroom', createdAt: 1000, updatedAt: 2000 },
        createdAt: '2026-06-30T01:00:00.000Z',
        updatedAt: '2026-06-30T03:00:00.000Z',
      }),
    ).toBe(timestampToMs('2026-06-30T03:00:00.000Z'));
  });
});
