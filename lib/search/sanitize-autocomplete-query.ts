/** Strip PostgREST filter syntax characters from user search input. */
export function sanitizeAutocompleteQuery(raw: string): string {
  return raw.trim().replace(/[(),]/g, "");
}
