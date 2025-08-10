import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

async function setModeCookie(page: Page, value: 'true' | 'false') {
  const baseURL = test.info().project.use.baseURL ?? 'http://localhost:3000';
  await page.context().addCookies([
    { name: 'piq_demo_mode', value, url: baseURL },
  ]);
}

async function setErrorCookie(page: Page, on: boolean) {
  const baseURL = test.info().project.use.baseURL ?? 'http://localhost:3000';
  await page.context().addCookies([
    { name: 'piq_test_error_promotions', value: on ? 'true' : 'false', url: baseURL },
  ]);
}

function pctPattern() {
  return /^[-+]?\d+(?:\.\d)?%$/; // e.g., +12.3%
}

test.describe('Promotion Calendar', () => {
  test('renders in Demo mode with badges and sparklines', async ({ page }) => {
    await setModeCookie(page, 'true');
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="promotion-calendar"]');

    const cal = page.getByTestId('promotion-calendar');
    await expect(cal).toBeVisible();
    await expect(cal.getByText('Demo Data')).toBeVisible();

    const cards = page.getByTestId('promo-card');
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    // First card details
    const first = cards.first();
    await expect(first.getByTestId('promo-sparkline')).toBeVisible();
    const effect = await first.getByTestId('promo-effect').innerText();
    expect(effect.trim()).toMatch(pctPattern());

    // Best/Worst badges should appear when multiple cards exist
    if (count > 1) {
      await expect(page.getByTestId('promo-badge-best').first()).toBeVisible();
      await expect(page.getByTestId('promo-badge-worst').first()).toBeVisible();
    }
  });

  test('renders in Live mode and shows cards', async ({ page }) => {
    await setModeCookie(page, 'false');
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="promotion-calendar"]');

    const cal = page.getByTestId('promotion-calendar');
    await expect(cal).toBeVisible();
    await expect(cal.getByText('Live')).toBeVisible();

    const cards = page.getByTestId('promo-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    // If 2+ cards, badges should exist
    if (count > 1) {
      await expect(page.getByTestId('promo-badge-best').first()).toBeVisible();
      await expect(page.getByTestId('promo-badge-worst').first()).toBeVisible();
    }

    // Effect format is percentage string (may be 0.0%)
    const effectText = await cards.first().getByTestId('promo-effect').innerText();
    expect(effectText.trim()).toMatch(/^[-+]?\d+(?:\.\d)?%$/);
  });
  
  test('shows accessible error state when API fails (Demo mode)', async ({ page }) => {
    await setModeCookie(page, 'true');
    await setErrorCookie(page, true);
    await page.route('**/api/promotions*', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'forced' }) });
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="promotion-calendar"]');

    const cal = page.getByTestId('promotion-calendar');
    await expect(cal).toBeVisible();
    await expect(cal.getByText('Demo Data')).toBeVisible();

    const alert = page.getByTestId('promotion-calendar-error');
    await expect(alert).toBeVisible();
    await expect(alert).toHaveAttribute('role', 'alert');
    await expect(alert).toContainText('Unable to load promotions');
  });

  test('shows accessible error state when API fails (Live mode)', async ({ page }) => {
    await setModeCookie(page, 'false');
    await setErrorCookie(page, true);
    await page.route('**/api/promotions*', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'forced' }) });
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="promotion-calendar"]');

    const cal = page.getByTestId('promotion-calendar');
    await expect(cal).toBeVisible();
    await expect(cal.getByText('Live')).toBeVisible();

    const alert = page.getByTestId('promotion-calendar-error');
    await expect(alert).toBeVisible();
    await expect(alert).toHaveAttribute('role', 'alert');
    await expect(alert).toContainText('Unable to load promotions');
  });
});
