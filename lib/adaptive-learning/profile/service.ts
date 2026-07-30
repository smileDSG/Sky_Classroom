import {
  learnerPreferencesInputSchema,
  learnerPreferencesSchema,
  type LearnerPreferences,
  type LearnerPreferencesInput,
} from '@/lib/adaptive-learning/contracts';
import { AdaptiveLearningError } from '@/lib/adaptive-learning/errors';
import { StorageEntryAlreadyExistsError } from '@/lib/storage/storage-errors';

import { LearnerProfileRepository } from './repository';

interface Clock {
  now(): Date;
}

interface SavePreferencesCommand {
  userId: string;
  expectedVersion: number;
  updatedBy: LearnerPreferences['updatedBy'];
  preferences: LearnerPreferencesInput;
}

const systemClock: Clock = {
  now: () => new Date(),
};

function versionConflict(expectedVersion: number, currentVersion: number): AdaptiveLearningError {
  return new AdaptiveLearningError({
    code: 'PROFILE_VERSION_CONFLICT',
    message: 'Learner preferences changed since they were loaded',
    retryable: false,
    stage: 'profile-preferences-save',
    details: { expectedVersion, currentVersion },
  });
}

export class LearnerProfileService {
  constructor(
    private readonly repository: LearnerProfileRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  async savePreferences(command: SavePreferencesCommand): Promise<LearnerPreferences> {
    if (
      !command.userId ||
      !Number.isInteger(command.expectedVersion) ||
      command.expectedVersion < 0
    ) {
      throw new AdaptiveLearningError({
        code: 'INVALID_SCHEMA',
        message: 'Invalid learner preferences save command',
        retryable: false,
        stage: 'profile-preferences-save',
      });
    }

    const preferencesInput = learnerPreferencesInputSchema.parse(command.preferences);
    const current = await this.repository.getLatestPreferences(command.userId);
    const currentVersion = current?.version ?? 0;
    if (command.expectedVersion !== currentVersion) {
      throw versionConflict(command.expectedVersion, currentVersion);
    }

    const preferences = learnerPreferencesSchema.parse({
      ...preferencesInput,
      userId: command.userId,
      version: currentVersion + 1,
      schemaVersion: '1.0.0',
      updatedAt: this.clock.now().toISOString(),
      updatedBy: command.updatedBy,
    });

    try {
      await this.repository.insertPreferences(preferences);
    } catch (error) {
      if (error instanceof StorageEntryAlreadyExistsError) {
        throw versionConflict(command.expectedVersion, currentVersion + 1);
      }
      throw error;
    }

    return preferences;
  }
}
