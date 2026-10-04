**English** | [中文](README.md)

# TaskMaster - Chrome Task Manager Extension

A full-featured Chrome browser task management extension with four views, category management, dark mode, and cross-device sync.

## Features

- **Four Views** — Switch freely between List / Day / Week / Month views
- **Task Management** — Add, edit, delete, and complete tasks
- **Rich Attributes** — Priority (High/Medium/Low), category, due date, estimated duration, recurring tasks
- **Category Management** — Preset categories (Work/Life/Study) + custom categories with color support
- **Filtering** — Filter by priority/category, hide completed or overdue tasks
- **Drag & Drop** — Drag tasks to different dates
- **Dark Mode** — One-click light/dark theme toggle
- **Data Sync** — Offline-first cross-device incremental sync via Cloudflare Worker and D1, with local storage as the primary copy
- **Sync Management Panel** — Manual upload to cloud, download from cloud, export file, import file
- **Conflict Merge** — Multi-device offline edits auto-merge by timestamp, no data lost
- **Import & Export** — JSON format backup and restore
- **Dual Mode** — Popup for quick access + full-screen management page

## Installation

### Option 1: Load Directly (Recommended)

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked**
5. Select the `chrome-extension-sync` folder from this project
6. Click the extension icon in the toolbar to start using

### Option 2: Build from Source

Requires Node.js 18+.

```bash
git clone https://github.com/Kairos-931/task-manager-chrome.git
cd task-manager-chrome
npm install
npm run build
```

After building, load the `chrome-extension-sync` folder into Chrome.

## Usage

- **Popup Mode**: Click the extension icon in the toolbar for a quick overview
- **Full-screen Mode**: Click "Open in new tab" button in the popup to enter the full management interface

## Tech Stack

| Technology | Purpose |
|------------|---------|
| TypeScript | Primary language |
| Chrome Extension MV3 | Extension framework |
| Tailwind CSS | Styling |
| esbuild | IIFE bundling |
| chrome.storage.sync | Cross-device data sync |
| chrome.storage.local | Local data backup |

## Project Structure

```
├── manifest.json              # Chrome extension config
├── package.json               # Dependencies & build scripts
├── tsconfig.json              # TypeScript config
├── tailwind.config.js         # Tailwind CSS config
├── shared/                    # TypeScript source code
│   ├── types.ts               # Type definitions
│   ├── storage.ts             # Storage layer (chunked sync + local backup)
│   ├── sync.ts                # Sync monitoring & status
│   ├── task.ts                # State management & business logic
│   ├── render.ts              # UI rendering
│   ├── events.ts              # Event handling
│   ├── entry.ts               # Bundle entry point
│   ├── background.ts          # Service Worker
│   └── chrome.d.ts            # Chrome API type declarations
├── chrome-extension-sync/     # Pre-built extension (recommended for loading)
├── popup/                     # Popup entry HTML
├── newtab/                    # Full-screen page entry HTML
├── styles/                    # Tailwind CSS source
├── icons/                     # Extension icons (16/48/128px)
└── scripts/                   # Build scripts
```

## Data Sync

The current 3.16.0 release saves tasks locally first and syncs through Cloudflare Worker and D1 when the API URL and token are configured. Task data does not use `chrome.storage.sync`; signing in to Chrome alone does not configure TaskMaster sync.

**Google account sync is still in development and is not deployed to the production Worker.** Guests will retain full local use, while signed-in users will sync through the TaskMaster Worker with D1 data isolated by Google account. The current release still uses the API URL and token steps below. OAuth clients, D1 migrations, and ownership checks for legacy data remain release prerequisites. See the [current requirement](docs/requirements/REQ-20260930-google-account-sync.md) and [configuration and data-boundary notes](docs/google-account-sync.md).

Exporting task data periodically remains a useful independent backup.

## FAQ

### Cross-device sync is not working in the current release

**Troubleshooting steps:**

1. Check that the API URL and token in TaskMaster's sync settings match the deployed Worker.
2. Check that the Worker is reachable from this browser and has its D1 binding configured.
3. A network failure such as `Failed to fetch` means the request did not receive a response; an HTTP 401 indicates an authentication problem.
4. Confirm the original device reports a successful cloud sync before expecting a second device to pull its tasks.

## Development

```bash
# Install dependencies
npm install

# Type check
npx tsc

# Full build (TypeScript → CSS → esbuild bundle → copy assets)
npm run build

# Individual build steps
npm run build:css    # CSS only
npm run icons        # Icons only
npm run bundle       # JS bundle only
npm run copy         # Copy assets only
```

## Version History

See [CHANGELOG.md](CHANGELOG.md) for the full development history.

This project went through 20+ iterations, evolving from a Vite full-stack architecture to a pure Chrome extension, with unified storage, sync management panel, and multi-device conflict merge in v1.2.0.

## License

[MIT](LICENSE)
