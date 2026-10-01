/**
 * Build the Generate Report button label, e.g. "Generate Report (1 record,
 * 2 charts)". Each count is pluralized on its own so singular/plural is right
 * in every combination, and the parts are joined with a locale-aware list.
 */
export const buildGenerateButtonLabel = (
  t,
  language,
  recordCount,
  chartCount
) => {
  const parts = [];
  if (recordCount > 0 || chartCount === 0) {
    parts.push(t('categories.recordCount', { count: recordCount }));
  }
  if (chartCount > 0) {
    parts.push(t('builder.counts.charts', { count: chartCount }));
  }
  const summary = new Intl.ListFormat(language, {
    style: 'short',
    type: 'unit',
  }).format(parts);
  return t('builder.buttons.generateReportSummary', { summary });
};

/**
 * Order category keys alphabetically by their displayed (translated) name,
 * using the language's own collation rules (e.g. "Ö" sorts with "O" in German
 * but after "Z" in Swedish). Ties fall back to the key so the order is stable.
 */
export const sortCategoriesByName = (categories, displayNames, language) => {
  const collator = new Intl.Collator(language, { sensitivity: 'base' });
  const nameOf = category => displayNames[category] || category;
  return [...categories].sort(
    (a, b) => collator.compare(nameOf(a), nameOf(b)) || a.localeCompare(b, 'en')
  );
};
