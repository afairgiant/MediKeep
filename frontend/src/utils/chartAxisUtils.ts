/**
 * Chart Y-Axis Utilities
 *
 * Pure math helpers for computing "nice" Y-axis domains and tick marks
 * in Recharts line/composed charts. Used by VitalTrendChart and
 * TestComponentTrendChart to avoid floating-point precision artifacts.
 */

export interface YAxisConfig {
  domain: [number, number];
  ticks: number[];
}

const DEFAULT_DOMAIN: YAxisConfig = {
  domain: [0, 100],
  ticks: [0, 25, 50, 75, 100],
};

/**
 * Select a human-friendly tick interval from the set {1, 2, 2.5, 5, 10}
 * scaled to the appropriate order of magnitude for the given range.
 */
export function calculateNiceInterval(range: number, targetTickCount: number = 5): number {
  const roughInterval = range / targetTickCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughInterval)));
  const normalized = roughInterval / magnitude;

  let niceInterval: number;
  if (normalized <= 1) {
    niceInterval = 1;
  } else if (normalized <= 2) {
    niceInterval = 2;
  } else if (normalized <= 2.5) {
    niceInterval = 2.5;
  } else if (normalized <= 5) {
    niceInterval = 5;
  } else {
    niceInterval = 10;
  }

  return niceInterval * magnitude;
}

/** Round down to the nearest multiple of `interval`. */
export function floorToInterval(value: number, interval: number): number {
  return Math.floor(value / interval) * interval;
}

/** Round up to the nearest multiple of `interval`. */
export function ceilToInterval(value: number, interval: number): number {
  return Math.ceil(value / interval) * interval;
}

/**
 * Build evenly-spaced tick marks from `start` to `end` (inclusive)
 * with the given `interval`, rounding each value to avoid
 * floating-point drift.
 */
function buildTicks(start: number, end: number, interval: number): number[] {
  const ticks: number[] = [];
  // The `+ interval * 0.01` tolerance ensures the final tick is included
  // even when floating-point arithmetic falls just short of the end value.
  for (let tick = start; tick <= end + interval * 0.01; tick += interval) {
    ticks.push(Number(tick.toFixed(10)));
  }
  return ticks;
}

/**
 * Compute a Y-axis domain and tick array that produces clean, rounded
 * labels for the given set of numeric values.
 *
 * Returns a sensible default when the values array is empty, and
 * handles the edge case where every value is identical.
 */
export function generateYAxisConfig(allValues: number[]): YAxisConfig {
  if (allValues.length === 0) {
    return DEFAULT_DOMAIN;
  }

  const dataMin = Math.min(...allValues);
  const dataMax = Math.max(...allValues);

  // All values identical -- add symmetric padding so the chart is not flat.
  if (dataMin === dataMax) {
    const padding = Math.abs(dataMax) * 0.1 || 1;
    const interval = calculateNiceInterval(padding * 2);
    const niceMin = floorToInterval(dataMin - padding, interval);
    const niceMax = ceilToInterval(dataMax + padding, interval);
    return { domain: [niceMin, niceMax], ticks: buildTicks(niceMin, niceMax, interval) };
  }

  const range = dataMax - dataMin;
  const interval = calculateNiceInterval(range);

  // Extend bounds by 5% of the range, then snap to a nice boundary.
  const niceMin = floorToInterval(dataMin - range * 0.05, interval);
  const niceMax = ceilToInterval(dataMax + range * 0.05, interval);

  return { domain: [niceMin, niceMax], ticks: buildTicks(niceMin, niceMax, interval) };
}
