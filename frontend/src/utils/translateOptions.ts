/** A Select option whose label is an i18n key, e.g. 'shared:linkPurposes.baseline'. */
export interface TranslatableOption {
  value: string;
  labelKey: string;
}

/** The options for a Select, each label translated with `t`. */
export const translateOptions = (
  options: readonly TranslatableOption[],
  t: (_key: string) => unknown
): { value: string; label: string }[] =>
  options.map(option => ({
    value: option.value,
    label: String(t(option.labelKey)),
  }));
