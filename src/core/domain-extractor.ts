/**
 * Extracts domain from a URL string.
 * Examples:
 *   https://example.com/path → example.com
 *   http://sub.example.com:8080/path → sub.example.com
 *   https://localhost:3000/path → localhost
 */
export function extractDomain(urlString: string): string {
  try {
    const url = new URL(urlString);
    return url.hostname;
  } catch {
    // If URL parsing fails, return empty string
    return '';
  }
}

/**
 * Gets all unique domains from a list of captures.
 */
export function getUniqueDomains(captures: Array<{ url: string }>): string[] {
  const domains = new Set<string>();
  for (const capture of captures) {
    const domain = extractDomain(capture.url);
    if (domain) {
      domains.add(domain);
    }
  }
  return Array.from(domains).sort();
}

/**
 * Filters captures by domain.
 */
export function filterByDomain(captures: Array<{ url: string }>, domain: string): Array<{ url: string }> {
  return captures.filter((capture) => extractDomain(capture.url) === domain);
}
