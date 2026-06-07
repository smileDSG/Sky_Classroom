/**
 * P1-003: Zod validation middleware tests
 *
 * Tests validateBody and validateFormData.
 */
import { describe, test, expect, vi } from 'vitest';
import { validateBody, validateFormData } from '@/lib/server/middleware/validator';
import { z } from 'zod';

// ─── validateBody ───

describe('validateBody', () => {
  const TestSchema = z.object({
    name: z.string().min(1),
    age: z.number().int().min(0),
  });

  test('returns success with valid JSON body', async () => {
    const req = new Request('https://example.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice', age: 25 }),
    });
    const result = await validateBody(req, TestSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: 'Alice', age: 25 });
    }
  });

  test('returns error for invalid JSON', async () => {
    const req = new Request('https://example.com', {
      method: 'POST',
      body: 'not-json',
    });
    const result = await validateBody(req, TestSchema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.response.status).toBe(400);
      const body = await result.response.json();
      expect(body.success).toBe(false);
      expect(body.errorCode).toBe('INVALID_REQUEST');
      expect(body.error).toBe('Invalid JSON body');
    }
  });

  test('returns error when required field missing', async () => {
    const req = new Request('https://example.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ age: 25 }), // missing name
    });
    const result = await validateBody(req, TestSchema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.response.status).toBe(400);
      const body = await result.response.json();
      expect(body.error).toBe('Validation failed');
      expect(body.details).toContain('name');
    }
  });

  test('returns error when field type is wrong', async () => {
    const req = new Request('https://example.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Bob', age: 'not-a-number' }),
    });
    const result = await validateBody(req, TestSchema);
    expect(result.success).toBe(false);
    if (!result.success) {
      const body = await result.response.json();
      expect(body.details).toContain('age');
    }
  });

  test('returns error for multiple validation failures', async () => {
    const req = new Request('https://example.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '', age: -1 }),
    });
    const result = await validateBody(req, TestSchema);
    expect(result.success).toBe(false);
    if (!result.success) {
      const body = await result.response.json();
      // Both errors should be in details, separated by "; "
      expect(body.details).toContain('name');
      expect(body.details).toContain('age');
    }
  });

  test('works with nested schema', async () => {
    const NestedSchema = z.object({
      user: z.object({
        email: z.string().email(),
      }),
    });
    const req = new Request('https://example.com', {
      method: 'POST',
      body: JSON.stringify({ user: { email: 'alice@test.com' } }),
    });
    const result = await validateBody(req, NestedSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.user.email).toBe('alice@test.com');
    }
  });

  test('works with array schema', async () => {
    const ArraySchema = z.object({
      tags: z.array(z.string()).min(1),
    });
    const req = new Request('https://example.com', {
      method: 'POST',
      body: JSON.stringify({ tags: ['math', 'physics'] }),
    });
    const result = await validateBody(req, ArraySchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tags).toEqual(['math', 'physics']);
    }
  });

  test('passes through optional fields', async () => {
    const OptSchema = z.object({
      name: z.string(),
      optional: z.string().optional(),
    });
    const req = new Request('https://example.com', {
      method: 'POST',
      body: JSON.stringify({ name: 'test' }),
    });
    const result = await validateBody(req, OptSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.optional).toBeUndefined();
    }
  });
});

// ─── validateFormData ───

describe('validateFormData', () => {
  const FormSchema = z.object({
    title: z.string().min(1),
    file: z.any(),
  });

  test('returns success with valid FormData', async () => {
    const formData = new FormData();
    formData.set('title', 'My Title');
    formData.set('file', 'file-content');

    const req = new Request('https://example.com', {
      method: 'POST',
      body: formData,
    });
    const result = await validateFormData(req, FormSchema, ['title', 'file']);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('My Title');
    }
  });

  test('returns error when required field missing', async () => {
    const formData = new FormData();
    formData.set('file', 'file-content');
    // title is missing

    const req = new Request('https://example.com', {
      method: 'POST',
      body: formData,
    });
    const result = await validateFormData(req, FormSchema, ['title', 'file']);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.response.status).toBe(400);
      const body = await result.response.json();
      expect(body.error).toBe('Validation failed');
      expect(body.details).toContain('title');
    }
  });

  test('extracts only specified fields from FormData', async () => {
    const SimpleSchema = z.object({ name: z.string() });
    const formData = new FormData();
    formData.set('name', 'test');
    formData.set('extra', 'should-be-ignored');

    const req = new Request('https://example.com', {
      method: 'POST',
      body: formData,
    });
    const result = await validateFormData(req, SimpleSchema, ['name']);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: 'test' });
    }
  });

  test('handles empty string fields', async () => {
    const formData = new FormData();
    formData.set('title', '');

    const req = new Request('https://example.com', {
      method: 'POST',
      body: formData,
    });
    const result = await validateFormData(req, FormSchema, ['title']);
    expect(result.success).toBe(false);
  });
});
