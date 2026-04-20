import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { useFormHandlers } from './useFormHandlers';
import { getDateParseFormats } from '../utils/dateUtils';

dayjs.extend(customParseFormat);

// Simulate what useDateFormat's dateParser does for a given format code
const makeDateParser = formatCode => value => {
  if (!value) return undefined;
  for (const fmt of getDateParseFormats(formatCode)) {
    const parsed = dayjs(value, fmt, true);
    if (parsed.isValid()) return parsed.toDate();
  }
  return undefined;
};

describe('useFormHandlers — handleDateChange', () => {
  it('stores a Date object as YYYY-MM-DD', () => {
    const onInputChange = vi.fn();
    const { result } = renderHook(() => useFormHandlers(onInputChange));

    act(() => result.current.handleDateChange('onset_date')(new Date(2018, 0, 16)));

    expect(onInputChange).toHaveBeenCalledWith({
      target: { name: 'onset_date', value: '2018-01-16' },
    });
  });

  it('stores null as empty string', () => {
    const onInputChange = vi.fn();
    const { result } = renderHook(() => useFormHandlers(onInputChange));

    act(() => result.current.handleDateChange('onset_date')(null));

    expect(onInputChange).toHaveBeenCalledWith({
      target: { name: 'onset_date', value: '' },
    });
  });

  it('stores an already-formatted YYYY-MM-DD string unchanged', () => {
    const onInputChange = vi.fn();
    const { result } = renderHook(() => useFormHandlers(onInputChange));

    act(() => result.current.handleDateChange('onset_date')('2018-01-16'));

    expect(onInputChange).toHaveBeenCalledWith({
      target: { name: 'onset_date', value: '2018-01-16' },
    });
  });

  it('stores empty string for an invalid date', () => {
    const onInputChange = vi.fn();
    const { result } = renderHook(() => useFormHandlers(onInputChange));

    act(() => result.current.handleDateChange('onset_date')(new Date('not-a-date')));

    expect(onInputChange).toHaveBeenCalledWith({
      target: { name: 'onset_date', value: '' },
    });
  });

  it('uses local date parts — no UTC timezone shift', () => {
    // new Date(year, month, day) is local time; formatting must not call toISOString()
    // which would shift the date in negative UTC offsets.
    const onInputChange = vi.fn();
    const { result } = renderHook(() => useFormHandlers(onInputChange));

    // Dec 31 local — toISOString() could produce Jan 1 next year in UTC+
    act(() => result.current.handleDateChange('date')(new Date(2023, 11, 31)));

    expect(onInputChange).toHaveBeenCalledWith({
      target: { name: 'date', value: '2023-12-31' },
    });
  });
});

describe('handleDateChange — full round-trip from user input', () => {
  it('dmy: 16/1/2018 → dateParser → handleDateChange → 2018-01-16', () => {
    const onInputChange = vi.fn();
    const { result } = renderHook(() => useFormHandlers(onInputChange));
    const dateParser = makeDateParser('dmy');

    const parsed = dateParser('16/1/2018');
    expect(parsed).toBeInstanceOf(Date);

    act(() => result.current.handleDateChange('onset_date')(parsed));

    expect(onInputChange).toHaveBeenCalledWith({
      target: { name: 'onset_date', value: '2018-01-16' },
    });
  });

  it('dmy: 01/01/2026 → dateParser → handleDateChange → 2026-01-01', () => {
    const onInputChange = vi.fn();
    const { result } = renderHook(() => useFormHandlers(onInputChange));
    const dateParser = makeDateParser('dmy');

    const parsed = dateParser('01/01/2026');
    act(() => result.current.handleDateChange('date')(parsed));

    expect(onInputChange).toHaveBeenCalledWith({
      target: { name: 'date', value: '2026-01-01' },
    });
  });

  it('mdy: 01/25/2026 → dateParser → handleDateChange → 2026-01-25', () => {
    const onInputChange = vi.fn();
    const { result } = renderHook(() => useFormHandlers(onInputChange));
    const dateParser = makeDateParser('mdy');

    const parsed = dateParser('01/25/2026');
    act(() => result.current.handleDateChange('date')(parsed));

    expect(onInputChange).toHaveBeenCalledWith({
      target: { name: 'date', value: '2026-01-25' },
    });
  });

  it('ymd: 2026-01-25 → dateParser → handleDateChange → 2026-01-25', () => {
    const onInputChange = vi.fn();
    const { result } = renderHook(() => useFormHandlers(onInputChange));
    const dateParser = makeDateParser('ymd');

    const parsed = dateParser('2026-01-25');
    act(() => result.current.handleDateChange('date')(parsed));

    expect(onInputChange).toHaveBeenCalledWith({
      target: { name: 'date', value: '2026-01-25' },
    });
  });

  it('dot-separated input is rejected by dateParser and produces no change', () => {
    const onInputChange = vi.fn();
    const { result } = renderHook(() => useFormHandlers(onInputChange));
    const dateParser = makeDateParser('dmy');

    const parsed = dateParser('21.10.2026');
    expect(parsed).toBeUndefined();

    // Mantine passes undefined to onChange when dateParser returns undefined —
    // handleDateChange receives null/undefined and stores empty string
    act(() => result.current.handleDateChange('date')(parsed));

    expect(onInputChange).toHaveBeenCalledWith({
      target: { name: 'date', value: '' },
    });
  });
});
