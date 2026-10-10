/**
 * Keeps the open tab when a View dialog hands over to its Edit dialog.
 *
 * The View modal calls `rememberEditTab` with the tab that is open when the user
 * clicks Edit; the Edit form calls `getRememberedEditTab` when it opens. The two
 * dialogs name their tabs differently (View "overview" is Edit "basic"), so each
 * entity has a mapping. A View tab with no Edit counterpart (null) falls back to
 * the form's first tab.
 *
 * The remembered tab expires after a couple of seconds so it can never leak into
 * an Edit opened later from a card, and it is read without being cleared so a
 * double-invoked effect (React StrictMode) sees the same value.
 */

export type EditTabEntity =
  | 'allergies'
  | 'conditions'
  | 'immunizations'
  | 'injuries'
  | 'insurance'
  | 'labResults'
  | 'medications'
  | 'procedures'
  | 'symptoms'
  | 'treatments'
  | 'visits';

type TabMap = Record<string, string | null>;

const sameTabs = (...tabs: string[]): TabMap =>
  Object.fromEntries(tabs.map(tab => [tab, tab]));

const VIEW_TO_EDIT_TAB: Record<EditTabEntity, TabMap> = {
  allergies: {
    overview: 'basic',
    ...sameTabs('reaction', 'notes', 'documents'),
  },
  conditions: {
    overview: 'basic',
    ...sameTabs(
      'clinical',
      'medications',
      'visits',
      'notes',
      'labResults',
      'documents'
    ),
  },
  immunizations: {
    overview: 'basic',
    ...sameTabs('administration', 'notes', 'documents'),
  },
  injuries: {
    overview: 'basic',
    ...sameTabs('treatment', 'documents', 'visits', 'notes'),
  },
  insurance: sameTabs(
    'basic',
    'member',
    'coverage',
    'contact',
    'documents',
    'notes'
  ),
  labResults: {
    overview: 'basic',
    'test-components': 'results',
    tags: 'basic',
    files: 'documents',
    ...sameTabs(
      'rel-conditions',
      'rel-visits',
      'rel-medications',
      'rel-procedures',
      'rel-treatments',
      'notes'
    ),
  },
  medications: {
    overview: 'basic',
    ...sameTabs(
      'details',
      'conditions',
      'reminders',
      'visits',
      'labResults',
      'notes',
      'documents'
    ),
  },
  procedures: {
    overview: 'basic',
    ...sameTabs('clinical', 'visits', 'labResults', 'notes', 'documents'),
  },
  symptoms: {
    overview: 'basic',
    // Episodes have no tab on the Edit form
    occurrences: null,
    ...sameTabs('visits', 'notes', 'documents'),
  },
  treatments: {
    overview: 'basic',
    ...sameTabs(
      'schedule',
      'medications',
      'visits',
      'labs',
      'equipment',
      'notes',
      'documents'
    ),
  },
  visits: {
    overview: 'info',
    ...sameTabs(
      'clinical',
      'link-procedures',
      'link-treatments',
      'link-injuries',
      'link-symptoms',
      'link-conditions',
      'link-medications',
      'link-labResults',
      'notes',
      'documents'
    ),
  },
};

/** How long a remembered tab stays valid after the View dialog hands over. */
export const EDIT_TAB_TTL_MS = 2000;

let remembered: { entity: EditTabEntity; tab: string; at: number } | null =
  null;

/** Call from a View modal just before it opens the Edit dialog. */
export const rememberEditTab = (entity: EditTabEntity, viewTab: string) => {
  const editTab = VIEW_TO_EDIT_TAB[entity][viewTab];
  remembered = editTab ? { entity, tab: editTab, at: Date.now() } : null;
};

/** Call from an Edit form when it opens; returns `fallback` if nothing applies. */
export const getRememberedEditTab = (
  entity: EditTabEntity,
  fallback: string
): string => {
  if (
    remembered &&
    remembered.entity === entity &&
    Date.now() - remembered.at <= EDIT_TAB_TTL_MS
  ) {
    return remembered.tab;
  }
  return fallback;
};
