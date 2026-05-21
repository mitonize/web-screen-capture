export function printSuccess(msg: string): void {
  process.stdout.write(`${msg}\n`);
}

export function printError(msg: string): void {
  process.stderr.write(`Error: ${msg}\n`);
}

export function printJson(data: unknown): void {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

export function formatTable(headers: string[], rows: string[][]): string {
  const colWidths = headers.map((h, i) => {
    const maxRow = rows.reduce(
      (max, row) => Math.max(max, (row[i] ?? '').length),
      0,
    );
    return Math.max(h.length, maxRow);
  });

  const sep = colWidths.map((w) => '-'.repeat(w)).join('-+-');
  const headerRow = headers
    .map((h, i) => h.padEnd(colWidths[i] ?? 0))
    .join(' | ');

  const dataRows = rows.map((row) =>
    headers
      .map((_, i) => (row[i] ?? '').padEnd(colWidths[i] ?? 0))
      .join(' | '),
  );

  return [headerRow, sep, ...dataRows].join('\n');
}
