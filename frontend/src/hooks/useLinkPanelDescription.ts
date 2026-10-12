import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

/** The kinds of record a link panel lists. */
export type LinkPanelItems =
  | 'medications'
  | 'labResults'
  | 'visits'
  | 'procedures'
  | 'treatments'
  | 'injuries'
  | 'symptoms'
  | 'conditions'
  | 'equipment';

/** The kinds of record that own a link panel. */
export type LinkPanelRecord =
  | 'visit'
  | 'labResult'
  | 'medication'
  | 'procedure'
  | 'condition'
  | 'treatment'
  | 'injury'
  | 'symptom';

/**
 * The line shown under a link panel's title, e.g. "Add Lab Results related to this
 * Condition." The noun forms come from separate keys, so each language can put them
 * in the grammatical form its sentence needs.
 */
export const useLinkPanelDescription = () => {
  const { t } = useTranslation('common');
  return useCallback(
    (items: LinkPanelItems, record: LinkPanelRecord): string =>
      t('linkPanels.addRelated', {
        items: t(`linkPanels.items.${items}`),
        record: t(`linkPanels.records.${record}`),
      }),
    [t]
  );
};
