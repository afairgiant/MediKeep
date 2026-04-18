/**
 * Composite identity for a lab-test trend chart: (test_name, unit).
 *
 * Same test name recorded in different units (e.g. Calcium mg/L vs mmol/L)
 * must stay separate across the entire add → persist → count-lookup round
 * trip. Both frontend and backend encode the pair as `test_name${SEP}unit`.
 * If this separator ever changes, update the backend response builder in
 * `app/api/v1/endpoints/custom_reports.py` at the same time.
 */
export const LAB_CHART_KEY_SEP = '::';

export const normalizeLabUnit = (unit: string | null | undefined): string =>
  unit == null ? '' : String(unit).trim().toLowerCase();

/** Case-insensitive composite key used for dedup and React keys. */
export const labChartKey = (
  testName: string,
  unit: string | null | undefined
): string =>
  `${testName.toLowerCase()}${LAB_CHART_KEY_SEP}${normalizeLabUnit(unit)}`;

/** Preserves the caller's casing — used for MultiSelect option values and the
 *  backend's `lab_test_counts` map, where the backend key is built from the
 *  raw (non-lowercased) test_name + unit. */
export const encodeLabChartValue = (
  testName: string,
  unit: string | null | undefined
): string =>
  `${testName}${LAB_CHART_KEY_SEP}${unit == null ? '' : String(unit).trim()}`;

export const decodeLabChartValue = (
  value: string
): { testName: string; unit: string | null } => {
  const idx = value.indexOf(LAB_CHART_KEY_SEP);
  if (idx === -1) {
    return { testName: value, unit: null };
  }
  const testName = value.slice(0, idx);
  const rawUnit = value.slice(idx + LAB_CHART_KEY_SEP.length);
  return { testName, unit: rawUnit === '' ? null : rawUnit };
};

/** Predicate used by the chart-action hooks to locate an existing chart. */
export const labChartMatches = (
  chart: { test_name: string; unit?: string | null },
  testName: string,
  unit: string | null | undefined
): boolean =>
  chart.test_name.toLowerCase() === testName.toLowerCase() &&
  normalizeLabUnit(chart.unit) === normalizeLabUnit(unit);
