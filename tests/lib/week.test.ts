import { describe, it, expect } from 'vitest';
import { parseIsoWeek, shiftIsoWeek, backfillIsoWeeks } from '../../src/lib/week';

describe('week.ts utilities', () => {
  it('parseIsoWeek validates and parses correctly', () => {
    expect(parseIsoWeek('2025-W10')).toEqual({ year: 2025, week: 10 });
    expect(parseIsoWeek('2025-w01')).toEqual({ year: 2025, week: 1 });
    expect(parseIsoWeek('2025-W00')).toBeNull();
    expect(parseIsoWeek('2025-W54')).toBeNull();
    expect(parseIsoWeek('bad')).toBeNull();
  });

  it('shiftIsoWeek shifts forwards and backwards', () => {
    expect(shiftIsoWeek('2025-W10', 1)).toBe('2025-W11');
    expect(shiftIsoWeek('2025-W10', -1)).toBe('2025-W09');
    // crossing year boundary
    expect(shiftIsoWeek('2025-W01', -1)).toMatch(/^2024-W(52|53)$/);
    expect(shiftIsoWeek('2024-W52', 1)).toMatch(/^2024-W(53)$|^2025-W01$/);
  });

  it('backfillIsoWeeks returns inclusive sequence ending at endIso', () => {
    expect(backfillIsoWeeks('2025-W10', 1)).toEqual(['2025-W10']);
    expect(backfillIsoWeeks('2025-W10', 4)).toEqual(['2025-W07', '2025-W08', '2025-W09', '2025-W10']);
    expect(backfillIsoWeeks('bad', 4)).toEqual([]);
  });
});
