import type { Page } from '@playwright/test';
import { mockOutlines } from './test-data/scene-outlines';
import { mockSceneContentResponse } from './test-data/scene-content';
import { createMockSceneActionsResponse } from './test-data/scene-actions';

/**
 * Wraps Playwright's page.route() to mock OpenMAIC API endpoints.
 * Supports both JSON and SSE (text/event-stream) responses.
 */
export class MockApi {
  constructor(private page: Page) {}

  /** Mock the SSE outline streaming endpoint */
  async mockSceneOutlinesStream(outlines = mockOutlines) {
    await this.page.route('**/api/generate/scene-outlines-stream', (route) => {
      const events = outlines
        .map(
          (outline, i) =>
            `data: ${JSON.stringify({ type: 'outline', data: outline, index: i })}\n\n`,
        )
        .join('');
      const done = `data: ${JSON.stringify({ type: 'done', outlines })}\n\n`;

      route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
        body: events + done,
      });
    });
  }

  /** Mock the scene content generation endpoint */
  async mockSceneContent(response = mockSceneContentResponse) {
    await this.page.route('**/api/generate/scene-content', (route) => {
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(response),
      });
    });
  }

  /** Mock the scene actions generation endpoint.
   *  When no stageId is provided, it is extracted from the request body
   *  so the mock response matches the dynamically-generated stage id. */
  async mockSceneActions(stageId?: string) {
    await this.page.route('**/api/generate/scene-actions', async (route) => {
      let id = stageId ?? 'test-stage';
      if (!stageId) {
        try {
          const body = route.request().postDataJSON();
          if (body?.stageId) id = body.stageId;
        } catch {
          // fallback to default
        }
      }
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createMockSceneActionsResponse(id)),
      });
    });
  }

  /** Mock the server providers endpoint (returns empty — client-side config only) */
  async mockServerProviders() {
    await this.page.route('**/api/server-providers', (route) => {
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providers: {} }),
      });
    });
  }

  /** Set up API mocks for the generation flow. Note: server-providers is already mocked by the base fixture. */
  async setupGenerationMocks(stageId?: string) {
    await this.mockSceneOutlinesStream();
    await this.mockSceneContent();
    await this.mockSceneActions(stageId);
    await this.mockClassroomJob(stageId ?? 'e2e-generated-stage');
  }

  /** Mock server-side classroom job submission, polling, and resulting classroom. */
  async mockClassroomJob(classroomId = 'e2e-generated-stage') {
    const jobId = 'e2e-job-1';
    const scenes = mockOutlines.map((outline) => ({
      id: `scene-${outline.order}`,
      stageId: classroomId,
      type: 'slide',
      title: outline.title,
      order: outline.order,
      content: mockSceneContentResponse.content,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));
    const classroom = {
      id: classroomId,
      stage: { id: classroomId, name: '光合作用', description: '演示课堂', language: 'zh-CN' },
      scenes,
    };

    await this.page.route('**/api/generate-classroom', (route) =>
      route.fulfill({
        status: 202,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          data: {
            jobId,
            status: 'running',
            step: 'generating_outlines',
            progress: 1,
            message: '生成中',
          },
        }),
      }),
    );
    await this.page.route('**/api/generate-classroom/*', (route) =>
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          data: {
            jobId,
            status: 'succeeded',
            step: 'done',
            progress: 100,
            message: '完成',
            done: true,
            result: { classroomId, url: `/classroom/${classroomId}`, scenesCount: scenes.length },
          },
        }),
      }),
    );
    await this.page.route('**/api/classroom?id=*', (route) =>
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, classroom }),
      }),
    );
  }
}
