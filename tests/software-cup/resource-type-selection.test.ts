import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

describe('software cup on-demand single-type generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates only the selected resource type, not all six', async () => {
    const { runSoftwareCupGeneration } = await import('@/lib/software-cup/demo-service');

    const result = await runSoftwareCupGeneration('软件工程学生，想补强 RAG。', {
      resourceTypes: ['markdown_lecture'],
      enableLlm: false,
    });

    expect(result.resources).toHaveLength(1);
    expect(result.resources[0].type).toBe('markdown_lecture');
    expect(result.resources.every((resource) => resource.type === 'markdown_lecture')).toBe(true);
  });

  it('generates a small multi-type subset when several are selected', async () => {
    const { runSoftwareCupGeneration } = await import('@/lib/software-cup/demo-service');

    const result = await runSoftwareCupGeneration('软件工程学生，想补强 RAG。', {
      resourceTypes: ['self_check', 'learning_path'],
      enableLlm: false,
    });

    const producedTypes = result.resources.map((resource) => resource.type).sort();
    expect(producedTypes).toEqual(['learning_path', 'self_check']);
  });

  it('rejects when the caller selects no valid resource type', async () => {
    const { runSoftwareCupGeneration } = await import('@/lib/software-cup/demo-service');

    await expect(
      runSoftwareCupGeneration('软件工程学生，想补强 RAG。', {
        resourceTypes: ['not-a-real-type'],
        enableLlm: false,
      }),
    ).rejects.toThrow('所选资源类型无效');
  });
});
