# Changelog

All notable changes to this project are documented in this file.

This project was iteratively developed using AI coding assistants (Coze / Claude), with each version preserved as a snapshot archive.

---

## [1.0.0] - 2026-04-18

### Final Release (Snapshot 18)

Restructured from `task-manager` to `task-manager-fixed`, adding cross-device data sync, Eisenhower matrix migration, and GitHub open-source release.

#### Added

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

#### Improved

- Simplified installation: load the `chrome-extension-sync/` folder directly
- Build system optimization with esbuild producing single JS bundles
- Enhanced import data format validation

---

## Development History

### Phase 1: Initial Development (Snapshots 01–07)

Chrome extension development based on Vite + Node.js full-stack architecture.

| Version | Changes |
|---------|---------|
| **Snapshot 01** | Project initialization: Vite + Node.js server architecture, TypeScript + Tailwind CSS + pnpm; includes popup, newtab, shared modules, server-side (server/) and web frontend (src/) |
| **Snapshot 02** | Minor adjustments |
| **Snapshot 04** | Cleanup: removed duplicate HTML/JS files and SVG icon source files from root |
| **Snapshot 05** | Continued minor refinements |
| **Snapshot 06** | Added `chrome-extension-loadable/` directory with build artifacts loadable directly into Chrome |
| **Snapshot 07** | Added `scripts/bundle.mjs` build script, removed legacy `generate-icons.mjs` |

### Phase 2: Architecture Refactor (Snapshots 08–09)

Abandoned Vite server-side architecture in favor of a pure Chrome extension project.

| Version | Changes |
|---------|---------|
| **Snapshot 08** | **Major refactor**: removed server/, src/, vite.config.ts; flattened project directory; introduced AI Agent collaboration files (PROMPT.md, NEXT_AGENT_PROMPT.txt, AGENTS.md); added PRD.md |
| **Snapshot 09** | Added `shared/entry.ts` bundle entry; migrated from pnpm to npm; added `.npmrc.json` |

### Phase 3: Feature Development (Snapshots 10–17)

Progressively added core features; file structure stabilized.

| Version | Changes |
|---------|---------|
| **Snapshot 10** | Added UI preview image (image.png) |
| **Snapshot 11** | Added `shared/chrome.d.ts` Chrome API TypeScript type declarations |
| **Snapshot 12** | **Added background script** `background.js` + `shared/background.ts` (Chrome Service Worker) |
| **Snapshot 13** | Added `scripts/package-for-store.sh` Chrome Web Store packaging script |
| **Snapshots 14–17** | Continued iterative improvements, mainly business logic and UI refinements |

### Phase 4: Final Release (Snapshot 18)

Restructured from `task-manager` to `task-manager-fixed`, resolving data sync and safety issues, preparing for open-source release.

---

## Feature Evolution Overview

```
Snapshots 01–07  Foundation → Vite full-stack → Chrome extension → Buildable output
       ↓
Snapshots 08–09  Refactor  → Drop server   → Pure extension   → npm migration
       ↓
Snapshots 10–12  Core      → Type declarations → Service Worker
       ↓
Snapshots 13–17  Polish    → Store packaging → UI/logic refinements
       ↓
Snapshot 18      Release   → Data sync → Migration tool → Open source
```

---

*Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Version numbering follows [Semantic Versioning](https://semver.org/).*