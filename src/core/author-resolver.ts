import type { Config } from '../models/config.js';

export function resolveAuthor(
  cliFlag: string | undefined,
  config: Config,
): string {
  if (cliFlag && cliFlag.trim().length > 0) return cliFlag.trim();
  const envAuthor = process.env['WSC_AUTHOR'];
  if (envAuthor && envAuthor.trim().length > 0) return envAuthor.trim();
  if (config.author && config.author.trim().length > 0) return config.author.trim();

  throw new Error(
    'Author is required. Set it via:\n' +
      '  --author <name>  CLI flag\n' +
      '  WSC_AUTHOR       environment variable\n' +
      '  author           field in .wsc/config.json',
  );
}
