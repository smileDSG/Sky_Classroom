import { test, expect } from '../fixtures/base';
import { loginAsDemoAdmin } from '../fixtures/auth';

test.describe('动画讲解（Animation Explainer）', () => {
  test.beforeEach(async ({ page, mockApi }) => {
    await loginAsDemoAdmin(page);
    await mockApi.mockAnimationFlow();
  });

  test('生成页渲染核心元素', async ({ page }) => {
    await page.goto('/sky/animation');
    await expect(page.getByRole('heading', { name: '动画讲解' })).toBeVisible();
    await expect(page.getByPlaceholder('例如：二叉堆的插入与上浮')).toBeVisible();
    await expect(page.getByRole('button', { name: '生成' })).toBeDisabled();
    await expect(page.getByRole('button', { name: '二叉堆的插入与上浮' })).toBeVisible();
  });

  test('提交话题 → 跳转播放页 → 单步/回溯可用', async ({ page }) => {
    await page.goto('/sky/animation');
    await page.getByRole('button', { name: '二叉堆的插入与上浮' }).click();
    await page.getByRole('button', { name: '生成' }).click();

    // mock job 直接 succeeded → 自动跳转到播放页
    await page.waitForURL(/\/sky\/animation\/e2e-anim-1$/, { timeout: 15_000 });

    // 播放页核心元素：标题、画布、字幕、控制条
    await expect(page.getByRole('heading', { name: '冒烟：数组反转' })).toBeVisible();
    await expect(page.getByLabel('冒烟：数组反转')).toBeVisible(); // SVG 画布（role=img）
    await expect(page.getByRole('slider', { name: '进度' })).toBeVisible();
    await expect(page.getByText('1 / 3')).toBeVisible();
    await expect(page.getByRole('button', { name: '上一步' })).toBeDisabled();

    // 单步前进 → 2/3，上一步恢复可用
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(page.getByText('2 / 3')).toBeVisible();
    await expect(page.getByRole('button', { name: '上一步' })).toBeEnabled();

    // 回溯：滑块拉回第 1 步
    await page.getByRole('slider', { name: '进度' }).fill('0');
    await expect(page.getByText('1 / 3')).toBeVisible();
  });

  test('历史记录展示并可进入', async ({ page }) => {
    await page.goto('/sky/animation');
    await expect(page.getByText('历史记录')).toBeVisible();
    await page.getByRole('button', { name: /冒烟：数组反转/ }).click();
    await page.waitForURL(/\/sky\/animation\/e2e-anim-1$/);
    await expect(page.getByRole('heading', { name: '冒烟：数组反转' })).toBeVisible();
  });
});
