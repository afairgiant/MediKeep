import { timezoneService } from '../services/timezoneService';

interface DatedVisit {
  date?: string | null;
  visit_time?: string | null;
}

const dateKey = (visit: DatedVisit | null | undefined): string =>
  (visit?.date ?? '').slice(0, 10);

/** Start time as HH:MM, or '' for an all-day visit. */
export const getVisitStartTime = (
  visit: DatedVisit | null | undefined
): string => (visit?.visit_time ?? '').slice(0, 5);

/** Formatted date followed by the start time, when the visit has one. */
export const withStartTime = (
  dateText: string,
  visit: DatedVisit | null | undefined
): string => {
  const time = getVisitStartTime(visit);
  return time ? `${dateText} ${time}` : dateText;
};

// All-day visits sort before timed visits on the same day
const sortKey = (visit: DatedVisit): string =>
  `${dateKey(visit)}T${getVisitStartTime(visit)}`;

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
 * newest first. Ascending is plain oldest-to-newest. Same-day visits order by
 * start time. Undated visits sort last.
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

  const aSort = sortKey(a);
  const bSort = sortKey(b);
  if (sortOrder === 'asc') return aSort.localeCompare(bSort);

  const todayKey = timezoneService.getTodayKey();
  const aUpcoming = aKey > todayKey;
  const bUpcoming = bKey > todayKey;
  if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
  return aUpcoming ? aSort.localeCompare(bSort) : bSort.localeCompare(aSort);
};
