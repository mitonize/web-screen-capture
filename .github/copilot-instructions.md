<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan at:
`specs/001-web-screen-capture/plan.md`

Key decisions:
- Language: TypeScript / Node.js 20 LTS
- CLI framework: Commander.js
- Headless browser: Playwright (Chromium)
- Storage: Flat JSON files + PNG images under `.wsc/`
- Testing: Vitest
- Storage abstraction: `src/storage/interface.ts` (StorageBackend interface)
<!-- SPECKIT END -->
