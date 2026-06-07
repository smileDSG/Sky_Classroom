import { createLogger } from '@/lib/logger';

const log = createLogger('SettingsStore');

export interface StateLogger {
  onStateChange: (changes: Record<string, unknown>) => void;
}

export function createStateLogger(name: string): StateLogger {
  return {
    onStateChange: (changes: Record<string, unknown>) => {
      log.debug(`[${name}]`, changes);
    },
  };
}
