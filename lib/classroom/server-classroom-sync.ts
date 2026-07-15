import type { Stage } from '@/lib/types/stage';

type TimestampValue = Date | number | string | null | undefined;

export interface ServerClassroomTimestampSource {
  stage?: Pick<Stage, 'id' | 'createdAt' | 'updatedAt'> | null;
  createdAt?: TimestampValue;
  updatedAt?: TimestampValue;
}

export function timestampToMs(value: TimestampValue): number | null {
  if (value == null) return null;
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const time = Date.parse(value);
    return Number.isFinite(time) ? time : null;
  }
  return null;
}

export function getServerClassroomUpdatedAtMs(
  classroom: ServerClassroomTimestampSource,
): number | null {
  return (
    timestampToMs(classroom.updatedAt) ??
    timestampToMs(classroom.stage?.updatedAt) ??
    timestampToMs(classroom.createdAt) ??
    timestampToMs(classroom.stage?.createdAt)
  );
}

export function shouldUseServerClassroom(
  serverClassroom: ServerClassroomTimestampSource,
  localStage: Pick<Stage, 'id' | 'createdAt' | 'updatedAt'> | null | undefined,
): boolean {
  const serverStageId = serverClassroom.stage?.id;
  if (!serverStageId) return false;
  if (!localStage || localStage.id !== serverStageId) return true;
  return true;
}
