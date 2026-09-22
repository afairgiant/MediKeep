// Mirrors the backend allowlist in app/schemas/base_tags.py
// (normalize_and_validate_tag): letters, digits, and . - : only. Spaces are
// normalized to '-' before the check, matching backend normalization, so a
// tag can never carry markup wherever it's later rendered.
const ALLOWED_TAG_PATTERN = /^[\p{L}\p{N}.:-]+$/u;

// A tag made entirely of allowed punctuation (e.g. "..." or "---") passes
// the pattern above but carries no information - and "   " normalizes to
// "" which the `+` quantifier alone would still reject, but only for the
// fully-empty case. Require at least one letter or digit, matching the
// backend's explicit rejection of blank/punctuation-only tags.
const HAS_ALPHANUMERIC = /[\p{L}\p{N}]/u;

export function isValidTagName(tag: string): boolean {
  const normalized = tag.trim().replace(/ /g, '-');
  return (
    ALLOWED_TAG_PATTERN.test(normalized) && HAS_ALPHANUMERIC.test(normalized)
  );
}
