# Changelog

All notable changes to this project are documented in this file.

This project was iteratively developed using AI coding assistants (Coze / Claude), with each version preserved as a snapshot archive.

---

## [3.9.0] - 2026-07-10

### Added

- **Weekly goal tracking** — collapsible rhythm card in the stats bar
  - Shows expected / actual / gap hours, progress bar with target line
  - Auto-anchors to earliest completion date, supports manual anchor & goal adjustment

- **Quick date picker** — 7-day shortcut buttons above the date input in task modal
  - Starts from today, shows "Today / Tomorrow / weekday" labels
  - Click fills the date input, two-way synced

### Fixed

- **Remote tasks not marked as synced after import** — extension never called the sync API after pulling from `pending_tasks`, causing deleted tasks to reappear on next open
  - Fix: call `/api/tasks/sync` after successful merge

---

## [3.8.0] - 2026-06-17

### Fixed (Major)

- **Deleted tasks reappearing / completed state overwritten** — loadData no longer merges cloud over local
  - Root cause: opening the extension always merged cloud data into local, and merge used "union" semantics (cloud-only tasks get added). cloudSyncWrite pushes async and may not finish before the extension is closed → cloud lags behind, still holds deleted tasks → next open merges them back, or overwrites local's latest complete/edit with stale state
  - Fix: loadData now treats local as authoritative — uses local directly when it has data, no cloud merge; only restores from cloud when local is empty (reinstall/new device)
  - Removed the now-dead merge functions (mergeStorageData / mergeTasks / mergeCategories)
  - Cross-device pull moved to the manual "Pull from cloud" button to avoid auto-merge clobbering local

---

## [3.7.0] - 2026-06-16

### Changed (Major)

- **Removed chrome.storage.sync channel** — unreachable in China (always empty, silent write failures misled users)
  - Removed chunked sync read/write and onChanged listener
  - `loadData` simplified to: Cloudflare → local backup → default
  - Sync unified to single Cloudflare backend; cross-device via pull-on-open

---

## [3.6.0] - 2026-06-16

### Added

- **Cloud data safety: optimistic lock + empty-overwrite guard** — prevents reinstall/exception from wiping cloud with empty data
  - Backend `/api/fullsync`: 409 on empty overwrite; 409 conflict on stale `baseUpdatedAt`
  - Frontend tracks cloud base version, auto-refreshes on conflict
  - `loadData` merges cloud with local backup to preserve unsynced edits
  - Force-upload bypasses protection via `force:true`

### Improved

- background.ts: API token moved from URL query to `Authorization` header
- task.ts: throttle recurring task double-toggle (500ms)

---

## [1.0.0] - 2026-04-18

### Added

- **Cross-device Data Sync** — `shared/sync.ts` with multi-device sync via chrome.storage.sync
  - Sync status indicator (Idle / Syncing / Synced / Remote Updated / Error)
  - Chunked storage to bypass chrome.storage.sync 8KB per-item limit
- **Dual Storage Mechanism** — Improved `shared/storage.ts` with simultaneous local and sync writes
  - Prioritizes reading from sync data, auto-recovers from local when sync is cleared
  - Dual-write ensures data safety, preventing data loss from extension uninstall
- **Eisenhower Matrix Migration** — `convert-eisenhower.cjs` migration script
  - Automatically converts four-quadrant tasks to the new format
  - Priority mapping: Urgent-Important → High, Important-Not-Urgent → Medium
- `chrome-extension-sync/` directory with ready-to-load extension
- `release/`, `README.md`, `GITHUB_GUIDE.md`, `LICENSE` — open-source release assets

### Improved

- Simplified installation, build system optimization (esbuild single-file bundles)
- Enhanced import data format validation

---

## [0.6.1] - 2026-04-18

### Improved

- UI rendering and interaction refinements
- Business logic polish

## [0.6.0] - 2026-04-18

### Improved

- UI and business logic iteration
- Data storage layer stability improvements

## [0.5.3] - 2026-04-18

### Improved

- Continued iterative improvements, business logic adjustments

## [0.5.2] - 2026-04-18

### Improved

- Continued iterative improvements, UI detail adjustments

## [0.5.1] - 2026-04-18

### Added

- `scripts/package-for-store.sh` Chrome Web Store packaging script

## [0.5.0] - 2026-04-18

### Added

- `shared/background.ts` + `background.js` — Chrome Service Worker
- `shared/chrome.d.ts` — Chrome API TypeScript type declarations
- UI preview image

## [0.4.1] - 2026-04-18

### Added

- `shared/chrome.d.ts` Chrome API TypeScript type declarations

## [0.4.0] - 2026-04-18

### Added

- UI preview image

---

## [0.3.1] - 2026-04-17

### Added

- `shared/entry.ts` bundle entry point
- `.npmrc.json` configuration

### Changed

- Migrated from pnpm to npm

## [0.3.0] - 2026-04-17

### Changed (Major Refactor)

- **Architecture overhaul**: dropped Vite + Node.js server in favor of a pure Chrome extension
- Removed `server/`, `src/`, `vite.config.ts`
- Flattened project directory structure

### Added

- AI Agent collaboration files: `PROMPT.md`, `NEXT_AGENT_PROMPT.txt`, `AGENTS.md`
- `PRD.md` product requirements document

---

## [0.2.1] - 2026-04-16

### Added

- `scripts/bundle.mjs` build script

## [0.2.0] - 2026-04-16

### Added

- `chrome-extension-loadable/` directory with build artifacts loadable directly into Chrome

---

## [0.1.3] - 2026-04-16

### Improved

- Minor refinements

## [0.1.2] - 2026-04-16

### Improved

- Removed duplicate HTML/JS files and SVG icon source files

## [0.1.1] - 2026-04-16

### Improved

- Minor adjustments

## [0.1.0] - 2026-04-16

### Added

- Project initialization: Vite + Node.js server architecture
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
v0.6.x      Polish — UI/logic refinements
    ↓
v1.0.0      Release — Data sync + migration tool + open source
```

---

*Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Version numbering follows [Semantic Versioning](https://semver.org/).*