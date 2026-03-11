/**
 * Safely parse a JSON string, returning a typed fallback on failure.
 *
 * Handles `null`, `undefined`, empty strings, and malformed JSON without
 * throwing — useful for DB columns that store serialised objects.
 */
export function safeJsonParse<T>(
  raw: string | null | undefined,
  fallback: T,
): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
