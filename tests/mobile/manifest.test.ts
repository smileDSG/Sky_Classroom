import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

describe('mobile PWA manifest', () => {
  test('public manifest contains installable mobile basics', () => {
    const manifestPath = path.join(process.cwd(), 'public', 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.display).toMatch(/standalone|fullscreen|minimal-ui/);
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.theme_color).toMatch(/^#/);
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);
  });
});
