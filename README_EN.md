**English** | [中文](README.md)

# TaskMaster - Chrome Task Manager Extension

A local-first Chrome task manager with four views, category management, dark mode, and optional Google account sync. The current code baseline is 3.17.0 (in development, not released); the production Worker still requires OAuth configuration, a D1 migration, and a safety rehearsal before sign-in can be enabled.

## Features

- **Four Views** — Switch freely between List / Day / Week / Month views
- **Task Management** — Add, edit, delete, and complete tasks
- **Rich Attributes** — Priority (High/Medium/Low), category, due date, estimated duration, recurring tasks
- **Category Management** — Preset categories (Work/Life/Study) + custom categories with color support
- **Filtering** — Filter by priority/category, hide completed or overdue tasks
- **Drag & Drop** — Drag tasks to different dates
- **Dark Mode** — One-click light/dark theme toggle
- **Guest Mode** — Use TaskMaster immediately; tasks remain on this device without sign-in
- **Google Account Sync** — Opt in to account-isolated incremental sync through Cloudflare Worker + D1
- **Safe Account Switching** — Explicitly merge local data into another account or back it up before replacing it with that account's cloud copy
- **Mobile Quick Add** — Sign in with the same Google account to read and add only that account's tasks
- **Sync and Backup Panel** — Review account/sync status and import or export local JSON backups
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
| Google Identity + Cloudflare Worker + D1 | Optional login and account-isolated sync |
| chrome.storage.local | Local-first task storage and backup |

## Project Structure

```
├── manifest.json              # Chrome extension config
├── package.json               # Dependencies & build scripts
├── tsconfig.json              # TypeScript config
├── tailwind.config.js         # Tailwind CSS config
├── shared/                    # TypeScript source code
│   ├── types.ts               # Type definitions
│   ├── storage.ts             # Local-first storage and Google account sync
│   ├── sync.ts                # Sync monitoring & status
│   ├── task.ts                # State management & business logic
│   ├── render.ts              # UI rendering
│   ├── events.ts              # Event handling
│   ├── entry.ts               # Bundle entry point
│   ├── background.ts          # Service Worker and Google OAuth flow
│   └── chrome.d.ts            # Chrome API type declarations
├── chrome-extension-sync/     # Pre-built extension (recommended for loading)
├── popup/                     # Popup entry HTML
├── newtab/                    # Full-screen page entry HTML
├── styles/                    # Tailwind CSS source
├── icons/                     # Extension icons (16/48/128px)
└── scripts/                   # Build scripts
```

## Data Sync

Guest mode stores tasks, categories, and settings in `chrome.storage.local`; it works offline and does not require an API key. After the user explicitly signs in with Google from the new-tab page, the extension syncs through the TaskMaster Worker. The Worker verifies Google's identity token and uses the verified `sub` claim—not a client-supplied user ID—to select an isolated D1 account namespace. The mobile page uses the same account.

Initial sign-in safely merges local-only and cloud-only records. Switching accounts requires an explicit choice: merge this device's local data into the new account, or back it up and replace it with the new account's cloud data. Signing out stops cloud sync and preserves local tasks.

### 3.17.0 rollout prerequisites (not released)

The production Worker is still on the legacy version. Before releasing this extension:

1. Back up production D1 and rehearse `backend/migrations/0002-google-account-sync.sql` on a non-production database.
2. Configure a Google OAuth Web Client. Its authorized redirect URI must exactly match this extension ID's `chrome.identity.getRedirectURL()`; authorize the Worker page origin for Google Identity on mobile.
3. Configure Worker values `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_EXTENSION_REDIRECT_URI`. Set `LEGACY_CLAIM_GOOGLE_SUB` only after an administrator verifies the legacy data owner. Never commit real values.
4. Deploy and verify Google token validation, A/B account isolation, mobile same-account access, and the legacy Telegram boundary before releasing the extension.
5. After the old data is backed up, claimed, and checked, administrators may set `LEGACY_API_DISABLED=true` to retire the old global `/api/*` task/sync endpoints.

The account tables are separate from legacy `sync_records`, `user_data`, and `pending_tasks`. The claim tool does not import the Telegram pending queue because its ownership may be ambiguous. Telegram remains a separate legacy administrator channel; before upgrade, administrators must disable its webhook or complete a separately approved migration. Otherwise queued Telegram items remain in the legacy table and are not automatically imported by the new extension.

End users do not enter a Worker URL or API token. In the extension, open “Data Sync” in the new-tab page and choose “Sign in with Google.” On mobile, copy the link from “Mobile Sync” and use the same account. Until the Worker rollout is complete, guest mode continues to work and Google sign-in remains unavailable.

## FAQ

### Google sign-in or sync is unavailable

**Troubleshooting steps:**

1. **Guest mode still works** — Tasks remain on this device. A missing Worker rollout or OAuth configuration does not fall back to API-token sync.
2. **Verify the Worker rollout and D1 migration** — Building the in-development 3.17.0 extension alone does not enable Google sign-in.
3. **If authorization fails repeatedly**, verify the OAuth Client ID, this extension ID's exact redirect URI, and the Worker `GOOGLE_EXTENSION_REDIRECT_URI` match.
4. **Distinguish network errors from expired sessions** — `TypeError: Failed to fetch` means the browser received no HTTP response; an expired sign-in should be resolved by signing in again.
5. **For users in China, ensure the network can reach Google Identity and the TaskMaster Worker**, for example by routing the Worker host through the configured proxy group.

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
