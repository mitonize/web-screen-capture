# web-screen-capture (wsc)

A powerful CLI tool for capturing, managing, and annotating web screenshots at scale. Built with TypeScript, Node.js, and Playwright.

![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

## Features

✨ **Core Capabilities**
- **Batch Web Capture**: Capture multiple URLs simultaneously with parallel execution
- **Comments & Replies**: Add hierarchical discussions to each capture
- **Annotations**: Mark up screenshots with rectangles, arrows, text, and highlights
- **Full-Page & Viewport**: Capture both viewport and full-page scrollable content
- **Flexible Export**: Export captures, comments, and annotations to standard JSON format
- **Local Storage**: All data stored in `.wsc/` directory (flat JSON + PNG/JPEG images)
- **JSON API**: Programmatic access with `--json` flag on all commands

## Quick Start

### Installation

```bash
npm install -g wsc
```

### Basic Usage

```bash
# Capture a single URL
wsc capture --url https://example.com

# Capture multiple URLs
wsc capture --url https://example.com https://example.org https://example.net

# Capture with device preset
wsc capture --url https://example.com --device mobile

# Capture with batch mode (from file)
wsc capture --url-file urls.txt --label "Q1 Review"

# List all captures
wsc list

# View capture details
wsc show <capture-id>

# Add a comment
wsc comment add <capture-id> --message "Please review header styling" --author "alice"

# Add an annotation (highlight a region)
wsc annotation add <capture-id> \
  --type rect \
  --x 100 --y 200 --width 300 --height 150 \
  --color red \
  --label "Fix this section"

# Export everything
wsc export --output ./my-export
```

## Commands

### `wsc capture` – Batch capture URLs

Capture one or more URLs as screenshots.

```bash
wsc capture [options]

Options:
  -u, --url <url...>     URL(s) to capture (required unless --url-file)
  -f, --url-file <file>  Read URLs from file (one per line)
  -l, --label <label>    Label for all captures in this batch
  -d, --device <device>  Device type: pc | mobile (default: pc, repeatable)
  --viewport-width <n>   Viewport width in pixels (overrides device preset)
  --viewport-height <n>  Viewport height in pixels (overrides device preset)
  --no-full-page         Capture only viewport (default: full-page)
  --format <format>      Image format: jpg | png (default: jpg)
  --quality <n>          JPEG quality 1-100 (default: 80)
  --timeout <ms>         Timeout per URL (default: 10000)
  --retries <n>          Retry attempts (default: 3)
  --concurrency <n>      Max concurrent captures (default: 5)
  --json                 Output JSON
  --storage-dir <dir>    Storage directory override
```

**Exit Codes:**
- `0` – All URLs captured successfully
- `1` – One or more URLs failed (partial success)
- `2` – Invalid arguments or missing URLs

**Example Usage:**
```bash
# Single URL
wsc capture --url https://example.com

# Multiple URLs
wsc capture --url https://example.com https://example.org https://example.net

# Mobile device preset
wsc capture --url https://example.com --device mobile

# Multiple devices (captures both pc and mobile)
wsc capture --url https://example.com --device pc --device mobile

# Custom viewport
wsc capture --url https://example.com --viewport-width 1920 --viewport-height 1080

# From file with label
wsc capture --url-file urls.txt --label "Q1 2026 Review"
```

**Example Output (Human-Readable):**
```
✓ [pc] https://example.com → 550e8400-e29b-41d4-a716-446655440000
✓ [mobile] https://example.com → 7c9e6679-7425-40de-944b-e07fc1f90ae7

2/2 captures completed
```

---

### `wsc list` – Show all captures

List all saved captures with metadata.

```bash
wsc list [options]

Options:
  --json    Output JSON
```

**Example Output:**
```
ID                                    URL                 Captured              Label
550e8400-e29b-41d4-a716-446655440000  https://example.com 2026-05-20 10:30:00   Homepage
7c9e6679-7425-40de-944b-e07fc1f90ae7  https://example.org 2026-05-20 10:30:15   -

2 captures
```

---

### `wsc show` – View capture details

Display details of a specific capture.

```bash
wsc show <capture-id> [options]

Arguments:
  <capture-id>    Capture UUID

Options:
  --json    Output JSON
```

**Exit Codes:**
- `0` – Success
- `1` – Capture not found
- `2` – Missing argument

---

### `wsc comment` – Add and view comments

#### `wsc comment add` – Add a comment

```bash
wsc comment add <capture-id> [options]

Arguments:
  <capture-id>    Target capture ID

Options:
  --message <text>    Comment text (required)
  --author <name>     Author (required or from env/config)
  --json              Output JSON
```

#### `wsc comment reply` – Reply to a comment

```bash
wsc comment reply <comment-id> [options]

Arguments:
  <comment-id>    Parent comment ID

Options:
  --message <text>    Reply text (required)
  --author <name>     Author
  --json              Output JSON
```

#### `wsc comment list` – View all comments

```bash
wsc comment list <capture-id> [options]

Arguments:
  <capture-id>    Target capture ID

Options:
  --json    Output JSON (returns nested structure)
```

**Example Output (Threaded):**
```
[alice | 2026-05-20 11:00:00] Header styling needs work
  └ [bob | 2026-05-20 11:05:00] I agree, let's update colors
  └ [alice | 2026-05-20 11:10:00] Fixed in commit abc123
```

---

### `wsc annotation` – Mark up screenshots

#### `wsc annotation add` – Add an annotation

```bash
wsc annotation add <capture-id> [options]

Arguments:
  <capture-id>    Target capture ID

Options:
  --type <type>     Annotation type: rect | arrow | text | highlight (required)
  --x <px>          Start X coordinate (required)
  --y <px>          Start Y coordinate (required)
  --width <px>      Width (required for rect/highlight)
  --height <px>     Height (required for rect/highlight)
  --x2 <px>         End X coordinate (required for arrow)
  --y2 <px>         End Y coordinate (required for arrow)
  --color <color>   CSS color name or #RRGGBB
  --label <text>    Text label (required for text type)
  --author <name>   Author
  --json            Output JSON
```

**Example Annotations:**
```bash
# Highlight a region
wsc annotation add <id> --type highlight --x 100 --y 50 --width 400 --height 200 --color yellow

# Add arrow pointing to issue
wsc annotation add <id> --type arrow --x 100 --y 100 --x2 300 --y2 300 --color red

# Add text label
wsc annotation add <id> --type text --x 50 --y 50 --label "Review this" --color blue
```

#### `wsc annotation list` – View all annotations

```bash
wsc annotation list <capture-id> [options]

Options:
  --json    Output JSON
```

#### `wsc annotation delete` – Remove annotation

```bash
wsc annotation delete <annotation-id>
```

---

### `wsc export` – Export all data

Export captures, comments, and annotations in portable format.

```bash
wsc export [options]

Options:
  --output <dir>    Output directory (default: ./wsc-export-<timestamp>)
  --json            Output JSON summary
```

**Output Structure:**
```
wsc-export-2026-05-20T120000Z/
├── export.json           (metadata + all comments/annotations)
└── images/
    ├── <capture-1-id>.jpg
    ├── <capture-2-id>.png
    └── ...
```

---

## Configuration

### Author Resolution

Specify author name in this priority order:
1. `--author` CLI flag
2. `WSC_AUTHOR` environment variable
3. `.wsc/config.json` → `author` field

### `.wsc/config.json` Structure

```json
{
  "author": "alice",
  "timeout": 15000,
  "retries": 5,
  "quality": 85,
  "format": "jpeg"
}
```

### Environment Variables

```bash
WSC_AUTHOR=alice                    # Default author
WSC_DATA_DIR=/custom/path/.wsc      # Custom storage location (default: ./.wsc)
```

---

## Data Model

### Capture
```typescript
interface Capture {
  id: string;                 // UUID v4
  url: string;
  status: 'success' | 'failure';
  captured_at: string;        // ISO 8601
  image_path: string;         // Relative to .wsc/images/
  image_format: 'jpeg' | 'png';
  viewport_width: number;
  viewport_height: number;
  full_page: boolean;
  label?: string;
}
```

### Comment
```typescript
interface Comment {
  id: string;
  capture_id: string;
  parent_id?: string;         // null for root, UUID for replies
  author: string;
  message: string;
  created_at: string;         // ISO 8601
}
```

### Annotation
```typescript
interface Annotation {
  id: string;
  capture_id: string;
  type: 'rect' | 'arrow' | 'text' | 'highlight';
  x: number;
  y: number;
  width?: number;             // rect, highlight
  height?: number;
  x2?: number;                // arrow
  y2?: number;
  color?: string;             // CSS color
  label?: string;             // text
  author: string;
  created_at: string;
}
```

---

## Programmatic Usage

All output formats support JSON mode for scripting:

```bash
# Capture with JSON output
wsc capture https://example.com --json

# Parse captures
captures=$(wsc list --json)
echo "$captures" | jq '.captures[] | {id, url, label}'

# Export programmatically
export_result=$(wsc export --output /tmp/export --json)
echo "$export_result" | jq '.output_dir'
```

---

## Performance

- **Parallel Capture**: Default 5 concurrent URLs (configurable)
- **Target**: Capture 10 URLs in under 3 minutes
- **Memory**: Typical usage ~200MB for 100 captures + metadata
- **Storage**: ~150KB per capture (varies by compression/format)

---

## Project Structure

```
web-screen-capture/
├── src/
│   ├── cli/                 # Command-line interface
│   │   ├── commands/        # Individual commands (capture, list, etc.)
│   │   ├── index.ts         # CLI entry point
│   │   └── output.ts        # Output formatting
│   ├── core/                # Core business logic
│   │   ├── capture-service.ts
│   │   ├── browser.ts
│   │   ├── image-processor.ts
│   │   └── gallery-renderer.ts
│   ├── models/              # Data structures
│   │   ├── capture.ts
│   │   ├── comment.ts
│   │   └── annotation.ts
│   ├── storage/             # Storage abstraction
│   │   ├── interface.ts
│   │   └── json-backend.ts
│   └── utils/               # Utilities
├── tests/                   # Vitest test suites
├── specs/                   # Documentation
└── dist/                    # Compiled JavaScript (generated)
```

---

## Development

### Setup

```bash
# Clone and install
git clone https://github.com/mitonize/web-screen-capture.git
cd web-screen-capture
npm install
```

### Commands

```bash
# Build
npm run build

# Run in development
npm run dev -- capture https://example.com

# Test
npm test
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report

# Type check
npm run lint
```

### Technologies

| Tool | Purpose |
|------|---------|
| **TypeScript** | Static typing, compile to ES2022+ |
| **Playwright** | Headless browser control (Chromium, Firefox, WebKit) |
| **Commander.js** | CLI framework with type safety |
| **Zod** | Runtime schema validation |
| **Vitest** | Fast unit & integration tests |
| **Sharp** | Image processing & optimization |

---

## Storage Backend

Storage is abstracted via the `StorageBackend` interface, allowing future extensibility:

```typescript
interface StorageBackend {
  saveCapture(capture: Capture): Promise<void>;
  listCaptures(): Promise<Capture[]>;
  getCapture(id: string): Promise<Capture | null>;
  // ...
}
```

**Current**: Flat JSON files + local filesystem
**Future**: SQLite, PostgreSQL, cloud storage, etc.

---

## Exit Codes

| Code | Meaning |
|------|---------|
| **0** | Success |
| **1** | Runtime error (capture failed, ID not found, etc.) |
| **2** | Usage error (missing arguments, invalid config, etc.) |

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Write tests for new functionality
4. Ensure all tests pass: `npm test`
5. Submit a pull request

---

## License

MIT

---

## Support

- **Issues**: [GitHub Issues](https://github.com/mitonize/web-screen-capture/issues)
- **Docs**: See `specs/` directory for detailed design docs
- **Quick Help**: `wsc --help` or `wsc <command> --help`

---

## Roadmap

- [ ] v1.0: Core CLI features (capture, comments, annotations, export)
- [ ] v1.1: Batch scheduling and automation
- [ ] v1.2: Web UI for gallery viewing
- [ ] v2.0: SQLite backend, remote storage support
- [ ] v2.1: Composite annotation export (merge annotations onto image)
- [ ] v2.2: Collaborative features (real-time sync)
