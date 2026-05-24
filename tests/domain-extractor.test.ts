import { describe, it, expect } from 'vitest';
import { extractDomain, getUniqueDomains, filterByDomain } from '../src/core/domain-extractor.js';

describe('domain-extractor', () => {
  describe('extractDomain', () => {
    it('should extract domain from simple URL', () => {
      expect(extractDomain('https://example.com/path')).toBe('example.com');
    });

    it('should extract domain from URL with subdomain', () => {
      expect(extractDomain('https://sub.example.com/path')).toBe('sub.example.com');
    });

    it('should extract domain from URL with port', () => {
      expect(extractDomain('http://localhost:3000/path')).toBe('localhost');
    });

    it('should extract domain from URL with query string', () => {
      expect(extractDomain('https://example.com/path?q=test&foo=bar')).toBe('example.com');
    });

    it('should extract domain from URL with fragment', () => {
      expect(extractDomain('https://example.com/path#section')).toBe('example.com');
    });

    it('should return empty string for invalid URL', () => {
      expect(extractDomain('not-a-url')).toBe('');
    });

    it('should handle multiple subdomains', () => {
      expect(extractDomain('https://api.v2.example.com/data')).toBe('api.v2.example.com');
    });
  });

  describe('getUniqueDomains', () => {
    it('should return unique domains from captures', () => {
      const captures = [
        { url: 'https://example.com/page1' },
        { url: 'https://example.com/page2' },
        { url: 'https://google.com/search' },
        { url: 'https://github.com/repo' },
      ];
      expect(getUniqueDomains(captures)).toEqual(['example.com', 'github.com', 'google.com']);
    });

    it('should return sorted unique domains', () => {
      const captures = [
        { url: 'https://zeta.com' },
        { url: 'https://alpha.com' },
        { url: 'https://beta.com' },
      ];
      expect(getUniqueDomains(captures)).toEqual(['alpha.com', 'beta.com', 'zeta.com']);
    });

    it('should skip invalid URLs', () => {
      const captures = [
        { url: 'https://example.com' },
        { url: 'not-a-url' },
        { url: 'https://google.com' },
      ];
      expect(getUniqueDomains(captures)).toEqual(['example.com', 'google.com']);
    });

    it('should return empty array for empty captures', () => {
      expect(getUniqueDomains([])).toEqual([]);
    });
  });

  describe('filterByDomain', () => {
    it('should filter captures by domain', () => {
      const captures = [
        { url: 'https://example.com/page1' },
        { url: 'https://example.com/page2' },
        { url: 'https://google.com/search' },
      ];
      const filtered = filterByDomain(captures, 'example.com');
      expect(filtered).toHaveLength(2);
      expect(filtered.every((c) => new URL(c.url).hostname === 'example.com')).toBe(true);
    });

    it('should return empty array when domain has no matches', () => {
      const captures = [{ url: 'https://example.com/page' }];
      expect(filterByDomain(captures, 'google.com')).toHaveLength(0);
    });

    it('should handle subdomains correctly', () => {
      const captures = [
        { url: 'https://api.example.com/data' },
        { url: 'https://example.com/page' },
        { url: 'https://app.example.com/section' },
      ];
      const filtered = filterByDomain(captures, 'api.example.com');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].url).toBe('https://api.example.com/data');
    });
  });
});
