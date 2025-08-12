import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import Breadcrumbs from '../../src/components/Breadcrumbs';

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe('Breadcrumbs (SSR)', () => {
  it('renders nav with aria-label and items', () => {
    const html = renderToString(
      React.createElement(Breadcrumbs, {
        items: [
          { label: 'Dashboard', href: '/' },
          { label: 'Week 2025-W10', srLabel: 'selected week' },
          { label: 'Last 12', srLabel: 'weeks window' },
        ],
      })
    );
    expect(html).toContain('aria-label="Breadcrumbs"');
    expect(countOccurrences(html, 'data-testid="breadcrumb-item"')).toBe(3);
    // first is a link
    expect(html).toContain('<a href="/"');
    // last has aria-current
    expect(html).toContain('aria-current="page"');
  });

  it('omits link for last crumb', () => {
    const html = renderToString(
      React.createElement(Breadcrumbs, {
        items: [
          { label: 'A', href: '/' },
          { label: 'B' },
        ],
      })
    );
    // only one link present
    expect(countOccurrences(html, '<a ')).toBe(1);
  });
});
