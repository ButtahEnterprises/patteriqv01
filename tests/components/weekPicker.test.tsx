// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import WeekPicker from '../../src/components/WeekPicker';

let pushMock: ReturnType<typeof vi.fn>;
let pathnameMock = '/';
let queryString = 'week=2025-W10&weeks=12';

vi.mock('next/navigation', () => {
  return {
    useRouter: () => ({ push: pushMock }),
    usePathname: () => pathnameMock,
    useSearchParams: () => ({
      get: (k: string) => new URLSearchParams(queryString).get(k),
      toString: () => queryString,
    }),
  };
});

beforeEach(() => {
  pushMock = vi.fn();
});

describe('WeekPicker (client)', () => {
  it('renders input and controls with a11y labels', () => {
    render(<WeekPicker />);
    expect(screen.getByLabelText('ISO week input')).toBeInTheDocument();
    expect(screen.getByLabelText('Previous week')).toBeInTheDocument();
    expect(screen.getByLabelText('Next week')).toBeInTheDocument();
    expect(screen.getByLabelText('Use latest completed week')).toBeInTheDocument();
    expect(screen.getByLabelText('Weeks window')).toBeInTheDocument();
  });

  it('prev/next update the week query param', () => {
    render(<WeekPicker />);
    fireEvent.click(screen.getByLabelText('Previous week'));
    {
      const url = pushMock.mock.calls.at(-1)?.[0] as string;
      expect(url).toContain('week=2025-W09');
      expect(url).toContain('weeks=12');
    }
    fireEvent.click(screen.getByLabelText('Next week'));
    {
      const url = pushMock.mock.calls.at(-1)?.[0] as string;
      expect(url).toContain('week=2025-W11');
      expect(url).toContain('weeks=12');
    }
  });

  it('changing weeks window updates query preserving week', () => {
    render(<WeekPicker />);
    fireEvent.change(screen.getByLabelText('Weeks window'), { target: { value: '8' } });
    expect(pushMock).toHaveBeenCalledWith('/?week=2025-W10&weeks=8');
  });

  it('typing a valid week and pressing Enter updates URL', () => {
    queryString = '';
    render(<WeekPicker />);
    const input = screen.getByLabelText('ISO week input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2025-W12' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(pushMock).toHaveBeenCalledWith('/?week=2025-W12');
  });
});
