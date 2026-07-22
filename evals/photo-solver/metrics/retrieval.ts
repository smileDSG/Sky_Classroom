export interface RetrievalMetrics {
  hitAtK: number;
  precisionAtK: number;
  recallAtK: number;
  mrr: number;
}

export const evaluateRetrieval = (
  goldDocumentIds: string[],
  retrievedDocumentIds: string[],
  k: number,
): RetrievalMetrics => {
  if (!Number.isInteger(k) || k <= 0) throw new Error('k must be a positive integer');

  const gold = new Set(goldDocumentIds);
  const retrieved = [...new Set(retrievedDocumentIds)];
  if (gold.size === 0) {
    const perfect = retrieved.length === 0 ? 1 : 0;
    return { hitAtK: perfect, precisionAtK: perfect, recallAtK: perfect, mrr: perfect };
  }

  const topK = retrieved.slice(0, k);
  const relevant = topK.filter((id) => gold.has(id)).length;
  const firstRelevantIndex = retrieved.findIndex((id) => gold.has(id));

  return {
    hitAtK: Number(relevant > 0),
    precisionAtK: topK.length === 0 ? 0 : relevant / topK.length,
    recallAtK: relevant / gold.size,
    mrr: firstRelevantIndex < 0 ? 0 : 1 / (firstRelevantIndex + 1),
  };
};
