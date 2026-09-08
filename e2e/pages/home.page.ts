import type { Page, Locator } from '@playwright/test';

export class HomePage {
  readonly page: Page;
  readonly logo: Locator;
  readonly textarea: Locator;
  readonly enterButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.logo = page.locator('img[alt="天空课堂"], img[alt="OpenMAIC"]').first();
    this.textarea = page.locator('textarea');
    this.enterButton = page.getByRole('button', { name: /enter|开始讲解|进入课堂/i }).first();
  }

  async goto() {
    await this.page.goto('/');
  }

  async fillRequirement(text: string) {
    await this.textarea.fill(text);
  }

  async submit() {
    await this.enterButton.click();
  }
}
