export interface RecognitionAmbiguity {
  field: string;
  candidates: string[];
  reason: string;
}

export interface RecognitionProblemQuality {
  confidence: number;
  ambiguities: RecognitionAmbiguity[];
}

export interface RecognitionQuality {
  confidence: number;
  ambiguities: RecognitionAmbiguity[];
  needsConfirmation: boolean;
}

const CONFIRMATION_THRESHOLD = 0.8;

export function aggregateRecognitionQuality(
  problems: RecognitionProblemQuality[],
  fallbackConfidence = 0,
): RecognitionQuality {
  if (problems.length === 0) {
    const confidence = Number.isFinite(fallbackConfidence)
      ? Math.max(0, Math.min(1, fallbackConfidence))
      : 0;
    return {
      confidence,
      ambiguities: [],
      needsConfirmation: confidence < CONFIRMATION_THRESHOLD,
    };
  }

  const confidence = problems.reduce((lowest, problem) => {
    const value = Number.isFinite(problem.confidence) ? problem.confidence : 0;
    return Math.min(lowest, Math.max(0, Math.min(1, value)));
  }, 1);
  const ambiguities = problems.flatMap((problem) => problem.ambiguities ?? []);

  return {
    confidence,
    ambiguities,
    needsConfirmation: confidence < CONFIRMATION_THRESHOLD || ambiguities.length > 0,
  };
}
