import { describe, expect, test } from 'vitest';
import {
  aggregateRecognitionQuality,
  type RecognitionProblemQuality,
} from '@/lib/recognition/recognition-quality';

describe('recognition quality aggregation', () => {
  test('uses the weakest problem confidence and requires confirmation for ambiguity', () => {
    const problems: RecognitionProblemQuality[] = [
      { confidence: 0.94, ambiguities: [] },
      {
        confidence: 0.61,
        ambiguities: [{ field: 'stem', candidates: ['a', 'α'], reason: '手写字符不清晰' }],
      },
    ];

    expect(aggregateRecognitionQuality(problems)).toEqual({
      confidence: 0.61,
      ambiguities: [{ field: 'stem', candidates: ['a', 'α'], reason: '手写字符不清晰' }],
      needsConfirmation: true,
    });
  });

  test('keeps clear high-confidence recognition on the automatic solve path', () => {
    expect(aggregateRecognitionQuality([{ confidence: 0.93, ambiguities: [] }])).toEqual({
      confidence: 0.93,
      ambiguities: [],
      needsConfirmation: false,
    });
  });
});
