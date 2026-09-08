import { test, expect } from '../fixtures/base';
import { HomePage } from '../pages/home.page';
import { createSettingsStorage } from '../fixtures/test-data/settings';
import { loginAsDemoAdmin } from '../fixtures/auth';
import { mockOutlines } from '../fixtures/test-data/scene-outlines';

const SETTINGS_STORAGE = createSettingsStorage({ timelineCollapsed: false });

test.describe('Full Happy Path', () => {
  test.beforeEach(async ({ page, mockApi }) => {
    // Pre-seed settings in localStorage (all tests do this)
    await page.addInitScript((settings) => {
      localStorage.setItem('settings-storage', settings);
    }, SETTINGS_STORAGE);
    await loginAsDemoAdmin(page);

    // Set up generation API mocks BEFORE any navigation —
    // generation auto-starts when generation-preview mounts.
    await mockApi.setupGenerationMocks();
  });

  test('home → classroom with scene navigation', async ({ page }) => {
    // ── Phase 1: Home page ──────────────────────────────────────────────
    const home = new HomePage(page);
    await home.goto();

    // Core UI elements visible
    await expect(home.logo).toBeVisible();
    await expect(home.textarea).toBeVisible();
    await expect(home.enterButton).toBeDisabled();

    // Fill requirement text → submit button activates
    await home.fillRequirement('讲解光合作用');
    await expect(home.enterButton).toBeEnabled();

    // Submit → background job completes → classroom opens
    await home.submit();
    await page.waitForURL(/\/classroom\//);
    expect(page.url()).toMatch(/\/classroom\//);

    // ── Classroom ───────────────────────────────────────────────────────
    await expect(page.getByRole('heading', { name: mockOutlines[0].title })).toBeVisible();

    // Current classroom navigation uses the bottom toolbar rather than the hidden legacy sidebar.
    await page.getByRole('button', { name: 'Next scene' }).click();
    await expect(page.getByRole('heading', { name: mockOutlines[1].title })).toBeVisible();
  });
});
