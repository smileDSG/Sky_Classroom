import type { Page } from '@playwright/test';

export async function loginAsDemoAdmin(page: Page) {
  await page.goto('/auth/login');
  await page.getByLabel('用户名').fill('admin');
  await page.getByLabel('密码').fill('123');
  await page.getByRole('button', { name: /登\s*录/ }).click();
  await page.waitForURL(/\/$/);
}
