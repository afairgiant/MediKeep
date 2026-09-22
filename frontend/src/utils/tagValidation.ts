// Mirrors the backend allowlist in app/schemas/base_tags.py
// (normalize_and_validate_tag): letters, digits, and . - : only. Spaces are
// normalized to '-' before the check, matching backend normalization, so a
// tag can never carry markup wherever it's later rendered.
const ALLOWED_TAG_PATTERN = /^[\p{L}\p{N}.:-]*$/u;

export function isValidTagName(tag: string): boolean {
  return ALLOWED_TAG_PATTERN.test(tag.trim().replace(/ /g, '-'));
}
