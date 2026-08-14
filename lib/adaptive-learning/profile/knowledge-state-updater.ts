/**
 * Compatibility export.
 *
 * Knowledge-state math lives in knowledge-state-engine.ts so quiz evidence
 * and generic learning events cannot drift into different learner profiles.
 */
export { updateKnowledgeStateFromAnswer, type AnswerEvidenceInput } from './knowledge-state-engine';
