import { useTranslation } from 'react-i18next';

/**
 * Returns a function that makes "Procedures (3)": a tab label with its count, the way the
 * Episodes tab shows its own. With no count (not loaded yet, or not applicable) it is just
 * the label.
 */
export const useTabLabel = () => {
  const { t } = useTranslation(['shared']);
  return (label: string, count: number | undefined): string =>
    count === undefined
      ? label
      : t('shared:tabs.withCount', '{{label}} ({{count}})', { label, count });
};
