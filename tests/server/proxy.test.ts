import { NextRequest } from 'next/server';
import { describe, expect, test } from 'vitest';
import proxy from '@/proxy';

describe('proxy public classroom reads', () => {
  test('allows classroom JSON reads without an access token so repaired decks can hydrate', async () => {
    const response = await proxy(
      new NextRequest('http://localhost:3000/api/classroom?id=cIdqQKU56B'),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  test('still blocks classroom mutations without an access token', async () => {
    const response = await proxy(
      new NextRequest('http://localhost:3000/api/classroom', { method: 'POST' }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Not authenticated' });
  });
});

describe('proxy public software cup demo routes', () => {
  test('allows the software cup showcase page without an access token', async () => {
    const response = await proxy(new NextRequest('http://localhost:3000/sky/software-cup'));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  test('allows integrated learning workspace pages without an access token', async () => {
    const paths = ['/sky/cloud-mind/course-studio', '/sky/study-lab'];

    for (const path of paths) {
      const response = await proxy(new NextRequest(`http://localhost:3000${path}`));

      expect(response.status).toBe(200);
      expect(response.headers.get('x-middleware-next')).toBe('1');
    }
  });

  test('allows software cup demo APIs without an access token', async () => {
    const paths = [
      '/api/sky/cloud-mind/personalization-context',
      '/api/sky/workshop',
      '/api/sky/learning-path',
      '/api/sky/student/profile/conversation',
      '/api/sky/course-knowledge/search?q=RAG',
      '/api/sky/resource-generation/jobs',
      '/api/sky/resource-generation/jobs/demo-job-1/stream',
      '/api/sky/content-safety/check',
      '/api/sky/learning-effect/evaluate',
    ];

    for (const path of paths) {
      const response = await proxy(new NextRequest(`http://localhost:3000${path}`));

      expect(response.status).toBe(200);
      expect(response.headers.get('x-middleware-next')).toBe('1');
    }
  });
});
