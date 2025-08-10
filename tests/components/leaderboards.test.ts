import React from 'react';
import { renderToString } from 'react-dom/server';
import LeaderboardTopProducts, { type ProductItem } from '../../src/components/LeaderboardTopProducts';
import LeaderboardTopStores, { type StoreItem } from '../../src/components/LeaderboardTopStores';
import { describe, it, expect } from 'vitest';

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe('LeaderboardTopProducts (SSR)', () => {
  it('loading state shows aria-busy and no rows', () => {
    const html = renderToString(React.createElement(LeaderboardTopProducts, { items: null, by: 'units', demoMode: true }));
    expect(html).toContain('aria-busy="true"');
    expect(countOccurrences(html, 'data-testid="product-row"')).toBe(0);
  });

  it('empty demo shows demo empty text', () => {
    const html = renderToString(React.createElement(LeaderboardTopProducts, { items: [], by: 'units', demoMode: true }));
    expect(html).toContain('No leaderboard data in current mode');
  });

  it('empty live shows waiting message', () => {
    const html = renderToString(React.createElement(LeaderboardTopProducts, { items: [], by: 'units', demoMode: false }));
    expect(html).toContain('No data yet. Waiting for ingestion...');
  });

  it('populated (units) shows correct count and number format', () => {
    const items: ProductItem[] = [
      { skuId: 1, skuName: 'Alpha Item', brand: 'Acme', revenue: 54321, units: 1234 },
      { skuId: 2, skuName: 'Beta Item', brand: 'Zen', revenue: 43210, units: 987 },
    ];
    const html = renderToString(React.createElement(LeaderboardTopProducts, { items, by: 'units', demoMode: false }));
    expect(countOccurrences(html, 'data-testid="product-row"')).toBe(items.length);
    expect(html).toContain('data-testid="product-metric">1,234');
    expect(html).toContain('data-testid="product-name">Alpha Item');
    expect(html).toContain('data-testid="product-brand">Acme');
  });

  it('populated (revenue) shows currency without decimals', () => {
    const items: ProductItem[] = [
      { skuId: 10, skuName: 'Gamma', brand: undefined, revenue: 12345, units: 100 },
    ];
    const html = renderToString(React.createElement(LeaderboardTopProducts, { items, by: 'revenue', demoMode: true }));
    expect(html).toContain('data-testid="product-metric">$12,345');
  });

  it('shows Demo badge and correct role/label/testid for units', () => {
    const html = renderToString(React.createElement(LeaderboardTopProducts, { items: [], by: 'units', demoMode: true }));
    expect(html).toContain('Demo Data');
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Top Products by Units"');
    expect(html).toContain('data-testid="top-products-units"');
  });

  it('shows Live badge and correct role/label/testid for revenue', () => {
    const html = renderToString(React.createElement(LeaderboardTopProducts, { items: [], by: 'revenue', demoMode: false }));
    expect(html).toContain('>Live<');
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Top Products by Revenue"');
    expect(html).toContain('data-testid="top-products-revenue"');
  });
});

describe('LeaderboardTopStores (SSR)', () => {
  it('loading state shows aria-busy and no rows', () => {
    const html = renderToString(React.createElement(LeaderboardTopStores, { items: null, demoMode: true }));
    expect(html).toContain('aria-busy="true"');
    expect(countOccurrences(html, 'data-testid="store-row"')).toBe(0);
  });

  it('empty demo shows demo empty text', () => {
    const html = renderToString(React.createElement(LeaderboardTopStores, { items: [], demoMode: true }));
    expect(html).toContain('No leaderboard data in current mode');
  });

  it('populated shows title, correct count and currency format', () => {
    const items: StoreItem[] = [
      { storeId: 101, storeName: 'Store A', city: 'Austin', state: 'TX', revenue: 54321, units: 999 },
      { storeId: 102, storeName: 'Store B', city: 'Seattle', state: 'WA', revenue: 12345, units: 500 },
    ];
    const html = renderToString(React.createElement(LeaderboardTopStores, { items, demoMode: false }));
    expect(html).toContain('Top Stores — Revenue');
    expect(countOccurrences(html, 'data-testid="store-row"')).toBe(items.length);
    expect(html).toContain('data-testid="store-revenue">$54,321');
    expect(html).toContain('data-testid="store-name">Store A');
    expect(html).toContain('data-testid="store-loc">Austin, TX');
  });

  it('empty live shows waiting message & Live badge', () => {
    const html = renderToString(React.createElement(LeaderboardTopStores, { items: [], demoMode: false }));
    expect(html).toContain('No data yet. Waiting for ingestion...');
    expect(html).toContain('>Live<');
    expect(html).toContain('role="region"');
    expect(html).toContain('data-testid="top-stores-revenue"');
  });

  it('demo shows Demo badge', () => {
    const html = renderToString(React.createElement(LeaderboardTopStores, { items: [], demoMode: true }));
    expect(html).toContain('Demo Data');
  });
});
