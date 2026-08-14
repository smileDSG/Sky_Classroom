import {
  domainLearnerProfileSchema,
  learnerPreferencesSchema,
  learningEventSchema,
  type DomainLearnerProfile,
  type LearnerPreferences,
  type LearningEvent,
} from '@/lib/adaptive-learning/contracts';
import type { StorageEntry, StorageProvider } from '@/lib/storage/storage-types';
import { StorageEntryAlreadyExistsError } from '@/lib/storage/storage-errors';

const PREFERENCES_TABLE = 'learner-preference-versions';
const DOMAIN_PROFILES_TABLE = 'domain-learner-profile-versions';
const LEARNING_EVENTS_TABLE = 'learning-events';

function preferencesIdPrefix(userId: string): string {
  return `preferences:${encodeURIComponent(userId)}:`;
}

function preferencesEntryId(userId: string, version: number): string {
  return `${preferencesIdPrefix(userId)}v${version}`;
}

function domainProfileIdPrefix(userId: string, domainProfileId: string): string {
  return `domain:${encodeURIComponent(userId)}:${encodeURIComponent(domainProfileId)}:`;
}

function domainProfileEntryId(userId: string, domainProfileId: string, version: number): string {
  return `${domainProfileIdPrefix(userId, domainProfileId)}v${version}`;
}

function learningEventIdPrefix(userId: string): string {
  return `event:${encodeURIComponent(userId)}:`;
}

function learningEventEntryId(userId: string, eventId: string): string {
  return `${learningEventIdPrefix(userId)}${encodeURIComponent(eventId)}`;
}

export class LearnerProfileRepository {
  constructor(private readonly storage: StorageProvider) {}

  async insertPreferences(input: LearnerPreferences): Promise<void> {
    const preferences = learnerPreferencesSchema.parse(input);
    const timestamp = new Date(preferences.updatedAt).getTime();
    const entry: StorageEntry<LearnerPreferences> = {
      id: preferencesEntryId(preferences.userId, preferences.version),
      data: preferences,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await this.storage.insert(PREFERENCES_TABLE, entry);
  }

  async getLatestPreferences(userId: string): Promise<LearnerPreferences | null> {
    const prefix = preferencesIdPrefix(userId);
    const entries = await this.storage.getAll<unknown>(PREFERENCES_TABLE, (entry) =>
      entry.id.startsWith(prefix),
    );
    if (entries.length === 0) return null;

    const preferences = entries.map((entry) => learnerPreferencesSchema.parse(entry.data));
    preferences.sort((left, right) => right.version - left.version);
    return preferences[0] ?? null;
  }

  async insertDomainProfile(input: DomainLearnerProfile): Promise<void> {
    const profile = domainLearnerProfileSchema.parse(input);
    const timestamp = new Date(profile.updatedAt).getTime();
    await this.storage.insert(DOMAIN_PROFILES_TABLE, {
      id: domainProfileEntryId(profile.userId, profile.id, profile.version),
      data: profile,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  async getLatestDomainProfile(
    userId: string,
    domainProfileId: string,
  ): Promise<DomainLearnerProfile | null> {
    const prefix = domainProfileIdPrefix(userId, domainProfileId);
    const entries = await this.storage.getAll<unknown>(DOMAIN_PROFILES_TABLE, (entry) =>
      entry.id.startsWith(prefix),
    );
    if (entries.length === 0) return null;

    const profiles = entries.map((entry) => domainLearnerProfileSchema.parse(entry.data));
    profiles.sort((left, right) => right.version - left.version);
    return profiles[0] ?? null;
  }

  async appendLearningEvent(input: LearningEvent): Promise<boolean> {
    const event = learningEventSchema.parse(input);
    const timestamp = new Date(event.occurredAt).getTime();
    try {
      await this.storage.insert(LEARNING_EVENTS_TABLE, {
        id: learningEventEntryId(event.userId, event.eventId),
        data: event,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return true;
    } catch (error) {
      if (error instanceof StorageEntryAlreadyExistsError) return false;
      throw error;
    }
  }

  async listLearningEvents(userId: string): Promise<LearningEvent[]> {
    const prefix = learningEventIdPrefix(userId);
    const entries = await this.storage.getAll<unknown>(LEARNING_EVENTS_TABLE, (entry) =>
      entry.id.startsWith(prefix),
    );
    const events = entries.map((entry) => learningEventSchema.parse(entry.data));
    events.sort(
      (left, right) =>
        left.occurredAt.localeCompare(right.occurredAt) ||
        left.eventId.localeCompare(right.eventId),
    );
    return events;
  }
}
