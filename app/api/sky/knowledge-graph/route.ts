/**
 * GET /api/sky/knowledge-graph
 *
 * Reads mistake data from the unified storage DAO, builds a knowledge graph
 * (nodes + edges + weak points), and returns the structured response.
 */
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { createStorageProvider } from '@/lib/storage/storage-factory';
import { createMistakeBookDAO } from '@/lib/storage/dao/mistakes';
import { buildGraphFromMistakes } from '@/lib/graph/builder';
import { overallMastery } from '@/lib/graph/mastery';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:SkyKnowledgeGraph');

let _daoPromise: ReturnType<typeof initDAO> | null = null;

async function initDAO() {
  const storage = await createStorageProvider();
  return createMistakeBookDAO(storage);
}

async function getDAO() {
  if (!_daoPromise) _daoPromise = initDAO();
  return _daoPromise;
}

export async function GET() {
  try {
    const dao = await getDAO();
    const { items: mistakes } = await dao.list({ pageSize: 9999 });

    const graph = buildGraphFromMistakes(mistakes);
    const mastery = overallMastery(graph.nodes);

    log.info(`Knowledge graph built: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);

    return apiSuccess({
      nodes: graph.nodes,
      edges: graph.edges,
      weakPoints: graph.weakPoints,
      overallMastery: mastery,
    });
  } catch (err) {
    log.error('Knowledge graph API error:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '知识图谱生成失败');
  }
}
