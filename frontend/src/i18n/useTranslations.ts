import { useTranslation } from 'react-i18next';

/**
 * Re-export useTranslation hook for convenience
 * Use directly from react-i18next for full TypeScript support
 *
 * @example
 * ```tsx
 * const { t } = useTranslations();
 * const label = t('common:buttons.save');
 *
 * // Or with namespace
 * const { t } = useTranslations('medical');
 * const label = t('allergies.allergen.label');
 * ```
 */
export const useTranslations = useTranslation;

export default useTranslations;
