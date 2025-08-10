import React from 'react';
import { renderToString } from 'react-dom/server';
import type { DataHealthPoint } from '../../src/components/DataHealthCard';
import DataHealthCard from '../../src/components/DataHealthCard';
import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock recharts to avoid DOM/SVG dependencies in Node env
vi.mock('recharts', () => {
  const h = React.createElement;
  const passthrough = (name: string) => (props: any) => h('div', { 'data-mock': name }, props.children);
  const leafWithAttr = (name: string) => (props: any) => h('div', { 'data-mock': name, 'data-props': JSON.stringify(props) });
  const ReferenceLine = (props: any) => h('div', { 'data-mock': 'ReferenceLine' }, JSON.stringify({ y: props.y, stroke: props.stroke }));
  return {
    ResponsiveContainer: passthrough('ResponsiveContainer'),
    LineChart: passthrough('LineChart'),
    Line: leafWithAttr('Line'),
    XAxis: leafWithAttr('XAxis'),
    YAxis: leafWithAttr('YAxis'),
    Tooltip: leafWithAttr('Tooltip'),
    CartesianGrid: leafWithAttr('CartesianGrid'),
    ReferenceLine,
  };
});

describe('DataHealthCard (SSR)', () => {
  beforeAll(() => {
    // Ensure consistent environment
    process.env.TZ = 'UTC';
  });

  it('renders loading skeleton when data is null', () => {
    const html = renderToString(React.createElement(DataHealthCard, { data: null, demoMode: true }));
    expect(html).toContain('aria-label="Data Health chart"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('animate-pulse');
  });

  it('renders latest percent and sr-only table when data provided', () => {
    const points: DataHealthPoint[] = [
      { isoWeek: '2025-W01', totalStores: 100, pseudoStores: 10, pctFullAllocated: 88.2 },
      { isoWeek: '2025-W02', totalStores: 100, pseudoStores: 3, pctFullAllocated: 97.3 },
    ];
    const html = renderToString(React.createElement(DataHealthCard, { data: points, demoMode: false }));
    // aria-busy should be false now
    expect(html).toContain('aria-busy="false"');
    // latest value should be shown with one decimal
    expect(html).toContain('97.3%');
    // table rows should include isoWeek and values
    expect(html).toContain('2025-W01');
    expect(html).toContain('2025-W02');
  });

  it('includes a 90% ReferenceLine with yellow stroke', () => {
    const points: DataHealthPoint[] = [
      { isoWeek: '2025-W01', totalStores: 100, pseudoStores: 0, pctFullAllocated: 100 },
    ];
    const html = renderToString(React.createElement(DataHealthCard, { data: points, demoMode: true }));
    // Our mock serializes props; check y=90 and stroke color
    expect(html).toContain('data-mock="ReferenceLine"');
    expect(html).toContain('&quot;y&quot;:90');
    expect(html).toContain('&quot;stroke&quot;:&quot;#fde047&quot;');
  });
});
