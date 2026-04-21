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
- **Data Sync** — Cross-device sync via chrome.storage.sync, with chrome.storage.local fallback to prevent data loss
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

The extension uses `chrome.storage.sync` for cross-device data sync, with `chrome.storage.local` as a local backup:

- **Auto Sync**: Tasks are automatically synced to other devices on the same Chrome account after any change
- **Local Backup**: Every save writes to both local and sync storage, preventing data loss from uninstalling on other devices
- **Auto Recovery**: Automatically restores from local backup when sync data is cleared

**Notes**:
- All users share the same Extension ID (ensured by the `"key"` field in manifest), no manual check needed
- Requires signing in to the same Chrome account with sync enabled
- Users in China need a VPN with Google sync domains routed through the proxy (see FAQ below)
- `chrome.storage.sync` has a total limit of 100KB; task data uses chunked storage to bypass the 8KB per-item limit
- It's recommended to periodically use the "Export Data" feature to back up important data

## FAQ

### Cross-device sync not working (console shows "local and sync both empty")

**Troubleshooting steps:**

1. **Verify Chrome sync is enabled** — Go to `chrome://settings/syncSetup` and confirm you're signed in to the same Google account with sync turned on
2. **Check sync engine status** — Open `chrome://sync-internals/` and check the Summary section:
   - `Server Connection` should show no errors (an `auth error` means sync authentication failed)
   - `Updates Downloaded` / `Successful Commits` should be greater than 0
3. **For users in China: ensure VPN covers Google sync domains** — Chrome sync uses `clients4.google.com`, which may not be included in default VPN rules. Solutions:
   - **Recommended**: Enable Clash TUN mode to route all traffic through the proxy
   - Or add a rule in Clash Merge config: `DOMAIN-SUFFIX,google.com,your-proxy-group-name`
4. **Wait after changes** — Sync typically takes 1-3 minutes to propagate after data changes

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

This project went through 18 iterations — evolving from a Vite full-stack architecture to a pure Chrome extension, with cross-device sync, Eisenhower matrix migration, and open-source release in the final version.

## License

[MIT](LICENSE)