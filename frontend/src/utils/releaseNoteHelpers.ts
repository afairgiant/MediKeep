/**
 * Strip a leading "v" prefix from a version string (e.g., "v0.55.0" -> "0.55.0").
 */
export function normalizeVersion(version: string): string {
  return version.replace(/^v/, '');
}

/**
 * Compare two semver-like version strings (e.g., "v0.55.0" or "0.55.0").
 * Returns positive if a > b, negative if a < b, 0 if equal.
 */
export function compareVersions(a: string, b: string): number {
  const partsA = normalizeVersion(a).split('.').map(Number);
  const partsB = normalizeVersion(b).split('.').map(Number);
  const len = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < len; i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA !== numB) return numA - numB;
  }
  return 0;
}

/**
 * Return true when tagName matches currentVersion (ignoring leading "v").
 */
export function isCurrentRelease(
  tagName: string,
  currentVersion: string
): boolean {
  return normalizeVersion(tagName) === normalizeVersion(currentVersion);
}

/**
 * Format an ISO date string as a human-readable locale date.
 */
export function formatReleaseDate(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return dateString;
  }
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
