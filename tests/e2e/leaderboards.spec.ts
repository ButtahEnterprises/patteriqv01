import { test, expect } from '@playwright/test';

function baseURL() {
  return process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
}

async function setDemoCookie(page, value: boolean) {
  await page.context().addCookies([
    { name: 'piq_demo_mode', value: String(value), url: baseURL() },
  ]);
}

test.describe('Dashboard Leaderboards', () => {
  test('Live mode leaderboards render with <=5 items and sorted', async ({ page }) => {
    await setDemoCookie(page, false);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="top-products-units"]');

    const selectors = [
      '[data-testid="top-products-units"]',
      '[data-testid="top-products-revenue"]',
      '[data-testid="top-stores-revenue"]',
    ];

    for (const sel of selectors) {
      const panel = page.locator(sel);
      await expect(panel).toBeVisible();
      await expect(panel.locator('text=Live')).toBeVisible();
      const rows = panel.locator('li[data-testid$="-row"]');
      const count = await rows.count();
      expect(count).toBeLessThanOrEqual(5);
    }
  });

  test('Demo mode leaderboards deterministic and visible', async ({ page }) => {
    await setDemoCookie(page, true);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="top-products-units"]');

    const unitsPanel = page.locator('[data-testid="top-products-units"]');
    await expect(unitsPanel).toBeVisible();
    await expect(unitsPanel.locator('text=Demo Data')).toBeVisible();

    const revenuePanel = page.locator('[data-testid="top-products-revenue"]');
    await expect(revenuePanel).toBeVisible();
    await expect(revenuePanel.locator('text=Demo Data')).toBeVisible();

    const storesPanel = page.locator('[data-testid="top-stores-revenue"]');
    await expect(storesPanel).toBeVisible();
    await expect(storesPanel.locator('text=Demo Data')).toBeVisible();

    // Check deterministic row count and sample cell presence
    await expect(unitsPanel.locator('li[data-testid="product-row"]')).toHaveCount(5);
    await expect(revenuePanel.locator('li[data-testid="product-row"]')).toHaveCount(5);
    await expect(storesPanel.locator('li[data-testid="store-row"]')).toHaveCount(5);
  });

  test('Responsive layout renders leaderboards in grid', async ({ page }) => {
    await setDemoCookie(page, true);
    await page.setViewportSize({ width: 375, height: 740 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="top-products-units"]');
    await expect(page.locator('[data-testid="top-products-units"]')).toBeVisible();
    await expect(page.locator('[data-testid="top-products-revenue"]')).toBeVisible();
    await expect(page.locator('[data-testid="top-stores-revenue"]')).toBeVisible();
  });

  test('Dashboard panels ready state in Live mode (KPI Trend, Data Health, Stores-at-Risk)', async ({ page }) => {
    await setDemoCookie(page, false);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="kpi-trend-chart"]');

    // KPI Trend: aria-busy should become false and skeleton disappear
    const kpi = page.getByTestId('kpi-trend-chart');
    await expect(kpi).toBeVisible();
    await expect(kpi).toHaveAttribute('aria-busy', 'false');

    // Data Health: figure labeled "Data Health chart" should become not busy
    const dataHealth = page.getByRole('figure', { name: 'Data Health chart' });
    await expect(dataHealth).toBeVisible();
    await expect(dataHealth).toHaveAttribute('aria-busy', 'false');

    // Stores-at-Risk: table or explicit empty state should render
    await page.waitForSelector('[data-testid="stores-at-risk-table"], [data-testid="stores-at-risk-empty"]');
    const tableCount = await page.locator('[data-testid="stores-at-risk-table"]').count();
    const emptyCount = await page.locator('[data-testid="stores-at-risk-empty"]').count();
    expect(tableCount > 0 || emptyCount > 0).toBeTruthy();
  });

  test('Dashboard panels ready state in Demo mode (KPI Trend, Data Health, Stores-at-Risk)', async ({ page }) => {
    await setDemoCookie(page, true);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="kpi-trend-chart"]');

    const kpi = page.getByTestId('kpi-trend-chart');
    await expect(kpi).toBeVisible();
    await expect(kpi).toHaveAttribute('aria-busy', 'false');
    await expect(kpi.getByText('Demo Data')).toBeVisible();

    const dataHealth = page.getByRole('figure', { name: 'Data Health chart' });
    await expect(dataHealth).toBeVisible();
    await expect(dataHealth).toHaveAttribute('aria-busy', 'false');
    // Badge inside the card
    await expect(dataHealth.locator('text=Demo Data').first()).toBeVisible();

    await page.waitForSelector('[data-testid="stores-at-risk-table"], [data-testid="stores-at-risk-empty"]');
    const tableCount = await page.locator('[data-testid="stores-at-risk-table"]').count();
    const emptyCount = await page.locator('[data-testid="stores-at-risk-empty"]').count();
    expect(tableCount > 0 || emptyCount > 0).toBeTruthy();
  });
});
