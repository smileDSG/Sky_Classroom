/**
 * B-004: Docker multi-stage build tests
 *
 * Validates Dockerfile structure without requiring a Docker build.
 * Checks stage count, HEALTHCHECK, non-root user, and best practices.
 */
import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const dockerDir = path.join(process.cwd(), 'docker');

function readDockerfile(name: string): string {
  return fs.readFileSync(path.join(dockerDir, name), 'utf-8');
}

// ─── Production Dockerfile ───

describe('Dockerfile.prod', () => {
  const content = readDockerfile('Dockerfile.prod');

  test('has 4 build stages', () => {
    const fromStatements = content.match(/^FROM /gm);
    expect(fromStatements).not.toBeNull();
    expect(fromStatements!.length).toBe(4);
  });

  test('uses Alpine base for smaller image', () => {
    expect(content).toContain('node:22-alpine');
  });

  test('has HEALTHCHECK instruction', () => {
    expect(content).toMatch(/HEALTHCHECK/);
  });

  test('healthcheck calls /api/health endpoint', () => {
    expect(content).toContain('/api/health');
  });

  test('uses non-root user', () => {
    expect(content).toContain('USER nextjs');
  });

  test('sets NODE_ENV=production', () => {
    expect(content).toContain('NODE_ENV=production');
  });

  test('runner stage uses standalone output', () => {
    expect(content).toContain('.next/standalone');
    // Builder stage needs COPY . . for build; runner copies only artifacts
    const runnerSection = content.split('FROM node:22-alpine AS runner')[1];
    expect(runnerSection).not.toContain('COPY . .');
  });

  test('uses pnpm frozen-lockfile for reproducible builds', () => {
    expect(content).toContain('--frozen-lockfile');
  });
});

// ─── Dev Dockerfile ───

describe('Dockerfile.dev', () => {
  const content = readDockerfile('Dockerfile.dev');

  test('is a single-stage build', () => {
    const fromStatements = content.match(/^FROM /gm);
    expect(fromStatements).not.toBeNull();
    expect(fromStatements!.length).toBe(1);
  });

  test('sets NODE_ENV=development', () => {
    expect(content).toContain('NODE_ENV=development');
  });

  test('uses pnpm dev for hot-reload', () => {
    expect(content).toMatch(/pnpm.*dev|CMD.*dev/);
  });

  test('installs build deps for native modules', () => {
    expect(content).toContain('cairo-dev');
    expect(content).toContain('pango-dev');
  });

  test('copies full source for development', () => {
    expect(content).toContain('COPY . .');
  });

  test('exposes port 3000', () => {
    expect(content).toContain('EXPOSE 3000');
  });
});

// ─── Cross-validation ───

describe('Dockerfiles cross-validation', () => {
  test('both files exist', () => {
    expect(fs.existsSync(path.join(dockerDir, 'Dockerfile.prod'))).toBe(true);
    expect(fs.existsSync(path.join(dockerDir, 'Dockerfile.dev'))).toBe(true);
  });

  test('prod is larger than dev (more stages)', () => {
    const prodLines = readDockerfile('Dockerfile.prod').split('\n').length;
    const devLines = readDockerfile('Dockerfile.dev').split('\n').length;
    expect(prodLines).toBeGreaterThan(devLines);
  });

  test('both use the same Node.js version', () => {
    const prod = readDockerfile('Dockerfile.prod');
    const dev = readDockerfile('Dockerfile.dev');
    expect(prod).toContain('node:22-alpine');
    expect(dev).toContain('node:22-alpine');
  });

  test('both use pnpm 10.28.0', () => {
    const prod = readDockerfile('Dockerfile.prod');
    const dev = readDockerfile('Dockerfile.dev');
    expect(prod).toContain('pnpm@10.28.0');
    expect(dev).toContain('pnpm@10.28.0');
  });
});
