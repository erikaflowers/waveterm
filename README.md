# Terminus

**A mission control terminal for AI agent crews.** Built on [Wave Terminal](https://github.com/wavetermdev/waveterm) (v0.14.1).

Terminus is an Electron-based terminal multiplexer designed for orchestrating multiple AI agents running in parallel tmux sessions. Each agent gets its own identity, terminal theme, persistent session, and avatar — all managed from a single unified interface.

---

## Features

### Agent System

Every terminal pane can be assigned to an agent. The header shows the agent's name, role, avatar, and a colored accent border. Switching agents is instant via header dropdown — the pane restarts into that agent's tmux session automatically using ForceRestart (kills PTY, spawns fresh shell, auto-attaches tmux).

- 16 pre-defined agents with unique colors, roles, and avatars
- Per-agent terminal themes and background colors
- Per-agent preferences persist across sessions
- Re-selecting the same agent forces reconnect (broken pipe recovery)
- Local and remote (SSH) tmux session support with auto-detected tmux paths

### Panels

Terminus includes several custom sidebar panels beyond the terminal:

| Panel | Description |
|-------|-------------|
| **Crew Manager** | Live agent status, avatars, tmux session control (attach/launch/kill) |
| **Git Dashboard** | Repo scanner with branch, status, commit info, fetch/pull actions |
| **Fleet Activity Log** | Agent session logger with SQLite backend, conversation search |
| **Hopper** | Multi-agent prompt dispatch with relay chains, drafts, macros |
| **Usage Dashboard** | API cost tracking |
| **Web Stats** | Plausible analytics dashboard (configurable API key + site) |
| **Dev Servers** | Active dev server monitor (ports 3000-9999) with kill/open |
| **Node Graph** | Tmux session topology visualizer |

### Layout

- Block-based tiling layout (inherited from Wave)
- Accordion collapse for vertical pane stacking
- Settings opens as a layout panel, not a modal
- Dev and production app can run simultaneously (separate Electron instance locks)

### User Preferences

All user-specific paths and credentials are configurable in Settings (no hardcoded paths):

- **Repo Base Path** — root directory for project scanning (git dashboard, dev servers)
- **Agents Path** — path to agent repo (avatars, crew working directories)
- **GitHub Org** — for commit links in fleet log
- **Plausible API Key / Site ID** — for web stats panel
- **Cloud Sync URL / Devices URL** — for cross-machine sync (BYOE)
- **Cloud OAuth Client ID / Secret** — Google OAuth credentials for cloud sync
- Path fields include native OS folder picker

Preferences are stored in `~/.config/terminus/agent-preferences.json` (prod) or `~/.config/terminus-dev/agent-preferences.json` (dev).

### Cloud Sync (BYOE)

Terminus supports optional cloud sync to keep layout, settings, and widget config in sync across machines. Cloud sync is fully **Bring Your Own Endpoint** — all API URLs and OAuth credentials are user-configurable in Settings. No backend is baked in.

To enable cloud sync:
1. Deploy your own sync backend (or use a hosted one)
2. Set up a Google OAuth 2.0 client (console.cloud.google.com)
3. Fill in the four cloud sync fields in Settings → Terminus:
   - **Cloud Sync URL** — your sync API endpoint
   - **Cloud Devices URL** — your devices API endpoint
   - **Cloud OAuth Client ID** — Google OAuth client ID
   - **Cloud OAuth Client Secret** — Google OAuth client secret
4. Sign in via the Cloud Sync section in Settings

Machine-specific paths (repo base, agents path) are intentionally excluded from sync.

---

## Getting Started

### Prerequisites

- macOS (ARM64 or x64), Linux, or Windows
- [tmux](https://github.com/tmux/tmux) installed and in PATH

### Install

Download the latest DMG from the releases page, or build from source (see [BUILD.md](BUILD.md)).

### First Run

1. Open Terminus
2. Go to **Settings** (gear icon in sidebar)
3. Fill in the **Terminus** section:
   - **Repo Base Path** — where your project repos live
   - **Agents Path** — where agent directories and portraits are
4. Open the **Crew** panel to see agents and manage tmux sessions
5. Click any terminal pane header to assign an agent

---

## Building from Source

See [BUILD.md](BUILD.md) for full instructions. Quick start:

```bash
git clone https://github.com/erikaflowers/terminus.git
cd terminus
npm install
task build:backend --force
npm run build:prod
npm exec electron-builder -- -c electron-builder.config.cjs -p never
```

Output: `make/Terminus-darwin-arm64-0.14.1.dmg` and `make/Terminus-darwin-x64-0.14.1.dmg`

---

## Key Files

| File | Purpose |
|------|---------|
| `frontend/app/store/agents.ts` | Agent registry, global config, preferences, ForceRestart |
| `frontend/app/view/waveconfig/settingsvisual.tsx` | Settings UI with Terminus section |
| `frontend/app/view/crew/crew.tsx` | Crew Manager panel |
| `frontend/app/view/gitdash/gitdash.tsx` | Git Dashboard panel |
| `frontend/app/view/fleetlog/fleetlog.tsx` | Fleet Activity Log panel |
| `frontend/app/view/hopper/hopper.tsx` | Hopper dispatch panel |
| `frontend/app/view/webstats/webstats.tsx` | Plausible analytics panel |
| `frontend/app/block/block.tsx` | Block registry (view type -> ViewModel) |
| `pkg/wconfig/defaultconfig/widgets.json` | Sidebar widget definitions |
| `emain/emain-ipc.ts` | Electron IPC handlers |
| `emain/emain-oauth.ts` | Cloud sync OAuth + BYOE endpoint config |

---

## Upstream

Terminus is forked from [Wave Terminal](https://github.com/wavetermdev/waveterm), an open-source terminal for macOS, Linux, and Windows. All upstream features — SSH sessions, file preview, drag-and-drop blocks, `wsh` CLI — are preserved.

Forked at Wave v0.14.1-beta.0. Last synced: v0.14.1.

---

## Marketing Site

The marketing site and documentation live at [terminus.zerovector.design](https://terminus.zerovector.design). Source is in the `site/` directory.

---

## License

Apache-2.0. See [ACKNOWLEDGEMENTS.md](./ACKNOWLEDGEMENTS.md) for dependency information.
