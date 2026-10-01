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
