import { timezoneService } from '../services/timezoneService';

interface DatedVisit {
  date?: string | null;
}

const dateKey = (visit: DatedVisit | null | undefined): string =>
  (visit?.date ?? '').slice(0, 10);

/** A visit dated after today in the server timezone has not happened yet. */
export const isUpcomingVisit = (
  visit: DatedVisit | null | undefined
): boolean => {
  const key = dateKey(visit);
  return key !== '' && key > timezoneService.getTodayKey();
};

/** Filter predicate for the Upcoming / Past / All visit filter. */
export const matchesVisitTiming = (
  visit: DatedVisit,
  timing: string
): boolean => {
  if (timing === 'upcoming') return isUpcomingVisit(visit);
  if (timing === 'past') return !isUpcomingVisit(visit);
  return true;
};

/**
 * Date comparator for visit lists.
 *
 * Descending puts upcoming visits first (soonest first), then past visits
 * newest first. Ascending is plain oldest-to-newest. Undated visits sort last.
 */
export const compareVisitsByDate = (
  a: DatedVisit,
  b: DatedVisit,
  sortOrder: string
): number => {
  const aKey = dateKey(a);
  const bKey = dateKey(b);
  if (!aKey || !bKey) {
    if (aKey === bKey) return 0;
    return aKey ? -1 : 1;
  }

  if (sortOrder === 'asc') return aKey.localeCompare(bKey);

  const todayKey = timezoneService.getTodayKey();
  const aUpcoming = aKey > todayKey;
  const bUpcoming = bKey > todayKey;
  if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
  return aUpcoming ? aKey.localeCompare(bKey) : bKey.localeCompare(aKey);
};
