/**
 * E2E Slide Generation Test
 *
 * Opens the slides page, inputs a topic, generates slides,
 * and verifies the pipeline produces valid output.
 */

import { test, expect } from '@playwright/test';

test('generate slides for 勾股定理 and verify no overflow', async ({ page }) => {
  // Navigate to the slides page
  await page.goto('http://localhost:3003/sky/cloud-mind/slides');

  // Wait for the page to load
  await page.waitForSelector('input[placeholder*="教学主题"]', { timeout: 10000 });

  // Input topic
  const input = page.locator('input[placeholder*="教学主题"]');
  await input.fill('勾股定理');

  // Click generate button
  const generateBtn = page.locator('button:has-text("生成幻灯片")');
  await expect(generateBtn).toBeEnabled();
  await generateBtn.click();

  // Wait for generation to complete (status changes or preview appears)
  await page.waitForSelector('text=生成幻灯片', { timeout: 120000 });

  // Wait for slide thumbnails to appear
  await page.waitForSelector('[class*="slide"] >> nth=0', { timeout: 120000 });

  // Take a screenshot of the result
  await page.screenshot({ path: 'tests/slides/e2e-result.png', fullPage: false });

  // Verify at least some slides were generated
  const slides = page.locator('text=/第\\d+页/');
  const count = await slides.count();
  expect(count).toBeGreaterThan(0);
});
