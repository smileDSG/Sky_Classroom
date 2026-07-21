export interface ConfidenceSignals {
  imageQuality: number;
  recognitionCompleteness: number;
  graderConfidence: number;
  validatorConfidence: number;
  agentAgreement: number;
}

export type ResultDisposition = 'formal' | 'provisional' | 'undetermined';

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function computeOverallConfidence(signals: ConfidenceSignals): number {
  const weighted =
    0.25 * clamp01(signals.imageQuality) +
    0.2 * clamp01(signals.recognitionCompleteness) +
    0.25 * clamp01(signals.graderConfidence) +
    0.2 * clamp01(signals.validatorConfidence) +
    0.1 * clamp01(signals.agentAgreement);
  return Math.round(weighted * 1_000_000) / 1_000_000;
}

export function determineResultDisposition(
  confidence: number,
  hasBlockingCondition: boolean,
): ResultDisposition {
  if (hasBlockingCondition) return 'undetermined';
  const normalized = clamp01(confidence);
  if (normalized >= 0.8) return 'formal';
  if (normalized >= 0.6) return 'provisional';
  return 'undetermined';
}
