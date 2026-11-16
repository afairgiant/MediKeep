import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  compareVisitsByDate,
  isUpcomingVisit,
  matchesVisitTiming,
} from '../upcomingVisits';

const visit = (date: string | null) => ({ date });

describe('upcomingVisits', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Late evening local time, so the end-of-today boundary is exercised.
    vi.setSystemTime(new Date(2026, 10, 15, 23, 30));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('isUpcomingVisit', () => {
    it('treats tomorrow as upcoming', () => {
      expect(isUpcomingVisit(visit('2026-11-16'))).toBe(true);
    });

    it('treats today and earlier as past', () => {
      expect(isUpcomingVisit(visit('2026-11-15'))).toBe(false);
      expect(isUpcomingVisit(visit('2026-11-14'))).toBe(false);
    });

    it('handles missing visits and dates', () => {
      expect(isUpcomingVisit(null)).toBe(false);
      expect(isUpcomingVisit(visit(null))).toBe(false);
    });
  });

  describe('matchesVisitTiming', () => {
    it('splits visits into upcoming and past', () => {
      expect(matchesVisitTiming(visit('2027-01-01'), 'upcoming')).toBe(true);
      expect(matchesVisitTiming(visit('2027-01-01'), 'past')).toBe(false);
      expect(matchesVisitTiming(visit('2026-11-15'), 'upcoming')).toBe(false);
      expect(matchesVisitTiming(visit('2026-11-15'), 'past')).toBe(true);
    });

    it('keeps everything for all', () => {
      expect(matchesVisitTiming(visit('2027-01-01'), 'all')).toBe(true);
      expect(matchesVisitTiming(visit('2020-01-01'), 'all')).toBe(true);
    });
  });

  describe('compareVisitsByDate', () => {
    const dates = [
      '2026-11-10',
      '2027-03-01',
      null,
      '2026-11-15',
      '2026-11-20',
      '2025-01-01',
    ];
    const sortedBy = (order: 'asc' | 'desc') =>
      dates
        .map(visit)
        .sort((a, b) => compareVisitsByDate(a, b, order))
        .map(v => v.date);

    it('descending lists upcoming soonest first, then past newest first', () => {
      expect(sortedBy('desc')).toEqual([
        '2026-11-20',
        '2027-03-01',
        '2026-11-15',
        '2026-11-10',
        '2025-01-01',
        null,
      ]);
    });

    it('orders same-day visits by start time, all-day first', () => {
      const sameDay = [
        { date: '2026-11-20', visit_time: '14:00:00' },
        { date: '2026-11-20', visit_time: null },
        { date: '2026-11-20', visit_time: '08:30:00' },
      ];
      const times = (order: 'asc' | 'desc') =>
        [...sameDay]
          .sort((a, b) => compareVisitsByDate(a, b, order))
          .map(v => v.visit_time);
      expect(times('asc')).toEqual([null, '08:30:00', '14:00:00']);
      expect(times('desc')).toEqual([null, '08:30:00', '14:00:00']);
    });

    it('ascending is plain chronological', () => {
      expect(sortedBy('asc')).toEqual([
        '2025-01-01',
        '2026-11-10',
        '2026-11-15',
        '2026-11-20',
        '2027-03-01',
        null,
      ]);
    });
  });
});
