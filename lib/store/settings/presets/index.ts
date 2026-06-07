export { type SettingsPreset, EDUCATION_PRESET } from './education';
export { DEMO_PRESET } from './demo';
export { DEVELOPMENT_PRESET } from './development';

import { EDUCATION_PRESET } from './education';
import { DEMO_PRESET } from './demo';
import { DEVELOPMENT_PRESET } from './development';
import type { SettingsPreset } from './education';

export const ALL_PRESETS: ReadonlyArray<Readonly<SettingsPreset>> = Object.freeze([
  EDUCATION_PRESET,
  DEMO_PRESET,
  DEVELOPMENT_PRESET,
]);
