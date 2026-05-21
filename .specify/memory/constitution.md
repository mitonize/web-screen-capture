<!--
SYNC IMPACT REPORT
==================
Version change: (none) → 0.1.0 (initial constitution)
Modified principles: N/A — first version
Added sections:
  - Core Principles (I–VI)
  - Technical Standards
  - Development Workflow
  - Governance
Removed sections: N/A
Templates checked:
  - .specify/templates/plan-template.md    ✅ aligned — Constitution Check section already present
  - .specify/templates/spec-template.md    ✅ aligned — user story + requirements structure matches principles
  - .specify/templates/tasks-template.md   ✅ aligned — phase/story structure supports batch & collaboration tasks
  - .github/copilot-instructions.md        ✅ no updates required — generic reference to plan
Deferred TODOs: none — all placeholders resolved
-->

# web-screen-capture Constitution

## Core Principles

### I. CLI-First Interface

All operations MUST be accessible via the command-line interface; no graphical UI is required or
planned. Commands MUST produce human-readable output by default. A `--json` flag MUST be available
on every command that returns data, emitting valid JSON to `stdout`. Errors MUST go to `stderr`;
normal output to `stdout`. Exit codes MUST accurately reflect outcome: `0` for success,
non-zero for any failure.

**Rationale**: The tool targets team power users who integrate it into scripts, CI pipelines, and
automated workflows. A consistent, scriptable CLI interface delivers more durable value than a GUI.

### II. Batch Capture

The tool MUST accept multiple URLs in a single invocation and attempt to capture all of them.
Processing MUST continue for all URLs regardless of individual failures. Per-URL success/failure
status MUST be reported in the output (both human-readable and JSON modes). Partial success is a
valid and expected outcome — the tool MUST NOT abort an entire batch on a single-URL failure.

**Rationale**: Teams capture many pages at once (regression suites, competitive audits). Forcing
one-at-a-time invocations or aborting on the first error undermines the tool's primary value.

### III. Team Collaboration

Every comment attached to a screenshot MUST record: (a) the author identifier and (b) an ISO 8601
timestamp. Comments MUST support threaded replies — a comment may have zero or more child replies,
and replies MUST also carry author and timestamp. Team members MUST be able to view all comments
and reply threads for any screenshot. Comment data MUST be stored in a structured, queryable form;
unstructured free-text file dumps are not acceptable.

**Rationale**: Shared review workflows require attribution and threading to remain useful over time.
Without author and timestamp, accountability and conversation context are lost.

### IV. Image Annotation

Captured screenshots MUST support post-capture annotation. Supported annotation primitives MUST
include: rectangles, arrows, text labels, and highlights. Annotations MUST be stored as structured
data (coordinates, style, content) separately from the base image pixels, so they can be
re-rendered, edited, or exported independently. A compositing/export step that bakes annotations
onto the base image MAY be provided, but MUST NOT be the only storage representation.

**Rationale**: Visual communication about specific regions of a page is a primary use case.
Storing annotations as structured data preserves editability and enables future annotation types
without migrating pixel data.

### V. Data Portability & Storage Flexibility

The storage backend MUST be abstracted behind a well-defined interface so it can be swapped
(e.g., local filesystem, SQLite, remote store) without changing any CLI commands or user workflows.
Data MUST be exportable in a documented, open format (e.g., JSON metadata + image files). No
proprietary binary formats are permitted without a documented, lossless export path. The storage
backend MUST be configurable at project init time and overridable at runtime via CLI flag or config.

**Rationale**: Teams must be able to migrate data as infrastructure evolves. Backend lock-in is
unacceptable for a shared collaboration tool used across different environments.

### VI. Simplicity & Reliability

The codebase MUST follow YAGNI: no feature is added without a concrete use case in the current
scope. Each new runtime dependency MUST be justified in the relevant spec or plan. Error messages
MUST be actionable — they MUST state what failed, why it failed, and what the user can do to
resolve it. Commands that perform network operations (capture, remote storage sync) MUST implement
a configurable retry strategy with sensible defaults for transient failures.

**Rationale**: A simple, reliable tool earns long-term trust. Complexity accumulates silently;
the YAGNI rule and dependency discipline keep the tool maintainable as the team grows.

## Technical Standards

The following constraints apply across all features and releases:

- **Language**: The implementation language MUST be decided in the first feature spec. Once chosen,
  it MUST NOT be changed without a MAJOR version amendment to this constitution.
- **Screenshot engine**: A headless browser or browser-automation engine MUST be used for captures
  (not plain HTTP fetches), ensuring JavaScript-rendered pages are captured correctly.
- **Image format**: Screenshots MUST be saved in PNG by default. Alternate formats (e.g., JPEG,
  WebP) MAY be offered as explicit opt-in options via CLI flag.
- **Configuration precedence**: All configurable values (timeouts, output directories, storage
  backend, retry counts) MUST be settable via both a config file and CLI flags. CLI flags MUST
  take precedence over config file values.
- **Security**: Credentials and API tokens MUST NOT be stored in plain text without explicit user
  acknowledgement and a documented warning in the output.

## Development Workflow

- **Spec before code**: Every feature MUST have an approved spec before implementation begins.
- **User story independence**: Each user story MUST be independently implementable and
  demonstrable as an MVP increment without requiring other stories to be complete.
- **Testing**: Unit and integration tests MUST cover all CLI commands and storage operations.
  Capture tests MAY use recorded/mocked fixtures to avoid live network dependencies in CI.
- **Constitution Check in plans**: Every implementation plan MUST include a Constitution Check
  section validating compliance with all six principles before Phase 0 research begins, and MUST
  be re-checked after Phase 1 design.
- **Commit discipline**: Commits MUST be atomic (one logical change per commit) and MUST reference
  the feature spec or task ID in the commit message.

## Governance

This constitution supersedes all other project practices, conventions, and preferences. Any
conflict between this document and another guide, README, or coding convention is resolved in
favor of this constitution.

**Amendment procedure**: Amendments MUST be proposed as a pull request modifying this file. The
PR MUST include: (a) the change described in plain language, (b) the version bump type justified
per the versioning policy below, (c) an updated Sync Impact Report comment at the top of this
file, and (d) updated dependent template files if the amendment affects them.

**Versioning policy**:
- MAJOR: Principle removal or backward-incompatible redefinition of a principle.
- MINOR: New principle or new major section added or materially expanded.
- PATCH: Clarifications, wording improvements, and non-semantic refinements.

**Compliance review**: All implementation plans and pull request reviews MUST include a
Constitution Check gate. Violations MUST be documented and justified in the Complexity Tracking
table of the relevant plan. Unjustified violations are grounds for PR rejection.

**Version**: 0.1.0 | **Ratified**: 2026-05-20 | **Last Amended**: 2026-05-20
