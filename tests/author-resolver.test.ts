import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveAuthor } from '../src/core/author-resolver.js';
import type { Config } from '../src/models/config.js';

function makeConfig(author?: string): Config {
  return {
    version: 1,
    author,
    storage_backend: 'filesystem',
    capture: {
      timeout_ms: 30000,
      retries: 3,
      viewport_width: 1280,
      viewport_height: 720,
      full_page: true,
      concurrency: 5,
    },
  };
}

describe('resolveAuthor', () => {
  const originalEnv = process.env['WSC_AUTHOR'];

  beforeEach(() => {
    delete process.env['WSC_AUTHOR'];
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env['WSC_AUTHOR'] = originalEnv;
    } else {
      delete process.env['WSC_AUTHOR'];
    }
  });

  it('CLI flag takes highest priority', () => {
    process.env['WSC_AUTHOR'] = 'env-author';
    const config = makeConfig('config-author');
    expect(resolveAuthor('cli-author', config)).toBe('cli-author');
  });

  it('env var takes priority over config', () => {
    process.env['WSC_AUTHOR'] = 'env-author';
    const config = makeConfig('config-author');
    expect(resolveAuthor(undefined, config)).toBe('env-author');
  });

  it('config fallback when no CLI flag or env var', () => {
    const config = makeConfig('config-author');
    expect(resolveAuthor(undefined, config)).toBe('config-author');
  });

  it('throws when no author set anywhere', () => {
    const config = makeConfig(undefined);
    expect(() => resolveAuthor(undefined, config)).toThrow(/Author is required/);
  });

  it('throws with helpful message listing all options', () => {
    const config = makeConfig(undefined);
    expect(() => resolveAuthor(undefined, config)).toThrow(/--author/);
    expect(() => resolveAuthor(undefined, config)).toThrow(/WSC_AUTHOR/);
  });

  it('ignores empty string CLI flag', () => {
    const config = makeConfig('config-author');
    expect(resolveAuthor('', config)).toBe('config-author');
  });

  it('ignores whitespace-only CLI flag', () => {
    const config = makeConfig('config-author');
    expect(resolveAuthor('   ', config)).toBe('config-author');
  });

  it('trims whitespace from result', () => {
    const config = makeConfig('  config-author  ');
    expect(resolveAuthor(undefined, config)).toBe('config-author');
  });
});
