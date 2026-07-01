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
