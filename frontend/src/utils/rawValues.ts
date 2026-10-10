export type Raw = Record<string, unknown>;

/** A non-empty string, or null: how API fields are read into link rows. */
export const asString = (value: unknown): string | null =>
  typeof value === 'string' && value ? value : null;

export const asList = (value: unknown): Raw[] =>
  Array.isArray(value) ? value : [];
