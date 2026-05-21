/**
 * Sky Classroom recognition module — barrel export.
 */

export { recognizeImage } from './image-recognizer';
export { preprocessImage } from './image-preprocessor';
export { splitProblems } from './multi-problem-splitter';
export { extractFormulas } from './formula-extractor';

export type { RecognizeOptions } from './image-recognizer';
export type { PreprocessOptions } from './image-preprocessor';
export type { ProblemRegion } from './multi-problem-splitter';
export { validateImage } from './image-validator';
export type { ValidationResult } from './image-validator';
