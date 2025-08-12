import React from 'react';
import { renderToString } from 'react-dom/server';
import DataHealthCard, { type DataHealthPoint } from '../../src/components/DataHealthCard';
import { describe, it, expect, vi } from 'vitest';

// Mock recharts to avoid DOM/SVG dependencies in Node env (mirrors other test)
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

describe('DataHealthCard issues callout', () => {
  it('renders a non-blocking issues callout when issues are provided', () => {
    const points: DataHealthPoint[] = [
      { isoWeek: '2025-W10', totalStores: 100, pseudoStores: 20, pctFullAllocated: 80 },
      { isoWeek: '2025-W11', totalStores: 100, pseudoStores: 5, pctFullAllocated: 95 },
    ];
    const issues = [
      'Low allocation in week 2025-W10: 80.0% (< 90%)',
      'Pseudo-UPC allocations present in week 2025-W10',
      'No store totals found for week 2025-W09',
    ];
    const html = renderToString(React.createElement(DataHealthCard, { data: points, demoMode: false, issues }));
    expect(html).toContain('Data issues detected');
    // React SSR may wrap numbers with comment nodes (<!-- -->3<!-- -->)
    expect(html).toMatch(/Data issues detected \((?:<!-- -->)?3(?:<!-- -->)?\)/);
    expect(html).toContain('Low allocation in week 2025-W10');
  });
});
