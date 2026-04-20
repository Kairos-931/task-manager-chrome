# Changelog

All notable changes to this project are documented in this file.

This project was iteratively developed using AI coding assistants (Coze / Claude), with each version preserved as a snapshot archive.

---

## [1.0.0] - 2026-04-18

### Added

- **Cross-device Data Sync** — New `shared/sync.ts` implementing multi-device sync via chrome.storage.sync
  - Sync status indicator (Idle / Syncing / Synced / Remote Updated / Error)
  - Chunked storage to bypass chrome.storage.sync 8KB per-item limit
- **Dual Storage Mechanism** — Improved `shared/storage.ts` with simultaneous local and sync writes
  - Prioritizes reading from sync data
  - Auto-recovers from local backup when sync data is cleared
  - Dual-write ensures data safety, preventing data loss from extension uninstall
- **Eisenhower Matrix Migration** — New `convert-eisenhower.cjs` migration script
  - Automatically converts four-quadrant tasks to the new format
  - Priority mapping: Urgent-Important → High, Important-Not-Urgent → Medium
  - Generates `taskmaster-import.json` for plugin import
- **Data Import** — Support for importing tasks from the legacy Eisenhower matrix system
- **Build Artifacts** — New `chrome-extension-sync/` directory with ready-to-load extension
- **Release Assets** — New `release/` directory, `README.md`, `GITHUB_GUIDE.md`, `LICENSE`

### Improved

- Simplified installation: load the `chrome-extension-sync/` folder directly
- Build system optimization with esbuild producing single JS bundles
- Enhanced import data format validation

---

## [0.7.0] - 2026-04-18

### Improved

- UI rendering and interaction refinements
- Business logic polish

---

## [0.6.0] - 2026-04-18

### Improved

- UI and business logic iteration
- Data storage layer stability improvements

---

## [0.5.0] - 2026-04-18

### Added

- `shared/background.ts` + `background.js` — Chrome extension background script (Service Worker)
- `shared/chrome.d.ts` — Chrome API TypeScript type declarations
- `scripts/package-for-store.sh` — Chrome Web Store packaging script
- UI preview image

### Improved

- TypeScript type safety enhancements

---

## [0.3.0] - 2026-04-17

### Changed (Major Refactor)

- **Architecture overhaul**: dropped Vite + Node.js server-side architecture in favor of a pure Chrome extension project
- Removed `server/`, `src/`, `vite.config.ts`
- Flattened project directory structure
- Migrated from pnpm to npm

### Added

- `shared/entry.ts` bundle entry point
- `.npmrc.json` configuration
- AI Agent collaboration files: `PROMPT.md`, `NEXT_AGENT_PROMPT.txt`, `AGENTS.md`
- `PRD.md` product requirements document

---

## [0.2.0] - 2026-04-16

### Added

- `chrome-extension-loadable/` directory with build artifacts loadable directly into Chrome
- `scripts/bundle.mjs` build script

### Improved

- Removed duplicate HTML/JS files and SVG icon source files

---

## [0.1.0] - 2026-04-16

### Added

- Project initialization
- Vite + Node.js server architecture
- TypeScript + Tailwind CSS + pnpm
- Chrome extension base structure: popup, newtab, shared modules
- Server-side (server/) and web frontend (src/)
- Basic task CRUD functionality

---

## Feature Evolution Overview

```
v0.1.0      Foundation — Vite full-stack + Chrome extension prototype
    ↓
v0.2.0      Build pipeline — Loadable Chrome extension output
    ↓
v0.3.0      Architecture refactor — Pure extension, no server
    ↓
v0.5.0      Core features — Service Worker + type system
    ↓
v0.6.0–0.7.0  Polish — UI/logic refinements
    ↓
v1.0.0      Release — Data sync + migration tool + open source
```

---

*Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Version numbering follows [Semantic Versioning](https://semver.org/).*