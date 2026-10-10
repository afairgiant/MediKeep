import {
  RECORD_LINK_KIND_CONFIG,
  RECORD_LINK_KINDS,
  type RecordLinkKind,
  type RecordLinkPath,
} from '../constants/recordLinkKinds';
import {
  linkCountKey,
  useLinkCounts,
  useLoadLinkCounts,
} from '../utils/linkCountStore';
import type { PendingLink } from '../types/encounterLinks';

/** Key of a record's count of one kind of link, shared with the card that changes it. */
export const recordLinkCountKey = (
  path: RecordLinkPath,
  recordId: number | null | undefined,
  kind: RecordLinkKind
) => linkCountKey(path, recordId, kind);

/**
 * How many links a record has of each of its kinds. For a saved record the counts are
 * loaded up front (a card only loads when its tab is opened) and kept current by the
 * cards; for a new record they are the number of links chosen so far.
 */
export const useRecordLinkCounts = (
  path: RecordLinkPath,
  recordId: number | null | undefined,
  pendingLinks: Partial<Record<RecordLinkKind, PendingLink[]>> = {}
): Partial<Record<RecordLinkKind, number | undefined>> => {
  const kinds = RECORD_LINK_KINDS[path];
  const keys = kinds.map(kind => recordLinkCountKey(path, recordId, kind));

  useLoadLinkCounts(
    kinds.map((kind, index) => ({
      key: keys[index],
      load: async signal => {
        const rows = await RECORD_LINK_KIND_CONFIG[kind].list(
          path,
          recordId as number,
          signal
        );
        return Array.isArray(rows) ? rows.length : 0;
      },
    })),
    Boolean(recordId)
  );

  const stored = useLinkCounts(keys);
  return Object.fromEntries(
    kinds.map((kind, index) => [
      kind,
      recordId ? stored[index] : (pendingLinks[kind]?.length ?? 0),
    ])
  );
};
