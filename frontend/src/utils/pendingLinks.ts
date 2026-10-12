import logger from '../services/logger';

interface PendingLinkFailureLog {
  /** snake_case log event, e.g. `record_pending_lab_result_links_failed` */
  event: string;
  message: string;
  component: string;
  /** Ids that identify the owner of the links, never record content */
  context: Record<string, unknown>;
}

/**
 * Create the links chosen in an Add form once the record exists. The calls do not
 * depend on each other, so they run together rather than holding the form open for one
 * round trip after another, and a failed call never stops the rest. Returns the number
 * of calls that failed.
 */
export const savePendingLinks = async <T>(
  items: T[],
  create: (_item: T) => Promise<unknown>,
  failure: PendingLinkFailureLog
): Promise<number> => {
  const results = await Promise.allSettled(items.map(item => create(item)));
  let failed = 0;
  results.forEach(result => {
    if (result.status !== 'rejected') return;
    failed += 1;
    logger.error(failure.event, {
      message: failure.message,
      ...failure.context,
      error:
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason),
      component: failure.component,
    });
  });
  return failed;
};
