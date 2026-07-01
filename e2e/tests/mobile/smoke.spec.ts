import { expect, test } from "@playwright/test";

const mobileViewports = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
];

for (const viewport of mobileViewports) {
  test(`mobile shell works at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/sky");

    await expect(
      page.getByRole("navigation", { name: "移动端主导航" }),
    ).toBeVisible();
    const bottomNav = page.getByRole("navigation", { name: "移动端主导航" });
    await expect(bottomNav.getByRole("link", { name: /工坊/ })).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: /助手/ })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
  });
}

test("mobile login page accepts input", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/auth/login");

  await page.getByLabel(/用户名/).fill("admin");
  await page.getByLabel(/密码/).fill("123");

  await expect(page.getByRole("button", { name: /登\s*录/ })).toBeVisible();
});
