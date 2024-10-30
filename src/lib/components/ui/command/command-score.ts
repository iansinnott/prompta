/**
 * Calculate a score for how well a string matches a search query.
 * Higher scores indicate better matches.
 */
export function commandScore(str: string, query: string): number {
  if (!str || !query) return 0;

  str = str.toLowerCase();
  query = query.toLowerCase();

  // Exact match gets highest score
  if (str === query) return 1;

  // Check if string starts with query
  if (str.startsWith(query)) return 0.8;

  // Check if string contains query
  if (str.includes(query)) return 0.5;

  // Check if all characters in query appear in order in str
  let strIndex = 0;
  let queryIndex = 0;

  while (strIndex < str.length && queryIndex < query.length) {
    if (str[strIndex] === query[queryIndex]) {
      queryIndex++;
    }
    strIndex++;
  }

  // If all characters were found in order, give a lower score
  if (queryIndex === query.length) return 0.3;

  return 0;
}
