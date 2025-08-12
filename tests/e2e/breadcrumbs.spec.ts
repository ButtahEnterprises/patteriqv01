import { test, expect } from '@playwright/test';

function baseURL() {
  return process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
}

async function setDemoCookie(page, value: boolean) {
  await page.context().addCookies([
    { name: 'piq_demo_mode', value: String(value), url: baseURL() },
  ]);
}

test.describe('Breadcrumbs', () => {
  test('dashboard shows breadcrumb trail with selected week and window', async ({ page }) => {
    await setDemoCookie(page, true);
    await page.goto('/?week=2025-W10&weeks=12', { waitUntil: 'domcontentloaded' });
    const trail = page.getByTestId('breadcrumbs');
    await expect(trail).toBeVisible();
    await expect(trail.getByText('Dashboard')).toBeVisible();
    await expect(trail.getByText('Week 2025-W10')).toBeVisible();
    await expect(trail.getByText('Last 12')).toBeVisible();
  });

  test('store page shows breadcrumb trail with selected week and window', async ({ page }) => {
    await setDemoCookie(page, true);
    await page.goto('/store/1?week=2025-W10&weeks=8', { waitUntil: 'domcontentloaded' });
    const trail = page.getByTestId('breadcrumbs');
    await expect(trail).toBeVisible();
    await expect(trail.getByText('Dashboard')).toBeVisible();
    await expect(trail.getByText('Week 2025-W10')).toBeVisible();
    await expect(trail.getByText('Last 8')).toBeVisible();
  });
});
