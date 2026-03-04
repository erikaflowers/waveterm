# Terminus

**A mission control terminal for AI agent crews.** Forked from [Wave Terminal](https://github.com/wavetermdev/waveterm) (v0.14.1-beta.0).

Terminus extends Wave's block-based terminal with first-class support for managing multiple AI agents running in parallel tmux sessions. It's built for workflows where you're orchestrating a crew of specialized agents — each with their own identity, terminal theme, and persistent session — from a single unified interface.

---

## What Terminus Adds

### Agent Pane Headers

Every terminal block can be assigned to an agent. The header shows the agent's name, role, avatar, and a colored accent border. Switching agents is instant — use the header dropdown to pick an agent, and the pane restarts into that agent's tmux session automatically.

- 32px circular avatars loaded via IPC base64 bridge
- Per-agent color accents on block borders
- Typeahead modal for fast agent switching (fuzzy search by name or role)
- "No Agent" option returns to a bare shell

### Agent Session Switching (ForceRestart)

Agent switching uses WaveTerm's `cmd:initscript.zsh` metadata + `ControllerResyncCommand(forcerestart=true)` to reliably swap terminal sessions. The old PTY is killed, a fresh shell spawns, and the initscript auto-attaches to the agent's tmux session. Works regardless of what the terminal is currently running (Claude Code, vim, etc.).

### Agent Themes & Preferences

Each agent can have a custom terminal theme and background color. Preferences persist across switches — when you leave an agent, their current theme/bgcolor is saved; when you return, it's restored.

- Per-agent theme via `term:theme` metadata
- Per-agent background color override via `term:bgcolor`
- Color picker (react-colorful) for live bgcolor adjustment
- Preferences stored in `~/.config/terminus-dev/agent-preferences.json`

### Crew Manager Panel

A sidebar widget showing all agents and their live tmux session status. Accessible from the sidebar like any other Wave widget.

- Real-time tmux session monitoring (auto-refreshes every 15s)
- Active/Inactive sections with green/gray status labels
- Per-agent avatars, roles, colored status dots, and uptime display
- **Attach** — opens a new terminal block already connected to the agent's tmux session
- **Launch** / **Kill** — start or stop individual tmux sessions
- **Launch All** / **Kill All** — batch operations

### Dev Servers Panel

A sidebar widget that monitors active development servers by scanning listening TCP ports (3000-9999).

- Detects node, Python, uvicorn, ruby, php, java, deno, and bun processes
- Resolves project names from open file descriptors
- Color-coded port badges by range (green 3xxx, cyan 4xxx, purple 5xxx, amber 8xxx, red 9xxx)
- **Open** — launches `localhost:{port}` in your default browser
- **Kill** — terminates the process on that port
- **Kill All** — batch kill all detected dev servers
- Auto-refreshes every 30 seconds with manual refresh button

---

## Agent Architecture

Terminus uses a static agent registry defined in `frontend/app/store/agents.ts`. Each agent has:

| Field | Description |
|-------|-------------|
| `name` | Display name (capitalized) |
| `dirName` | Working directory (`agent-{key}`) |
| `color` | Hex color for UI accents |
| `role` | Short role description |
| `avatarPath` | Path to avatar image |
| `defaultTheme` | Terminal theme name |

Agents are mapped to tmux sessions by lowercase name. The Crew Manager shows which sessions are running and lets you manage them without leaving the terminal.

### Key Files

| File | Purpose |
|------|---------|
| `frontend/app/store/agents.ts` | Agent registry, preferences, ForceRestart logic |
| `frontend/app/modals/agenttypeahead.tsx` | Header dropdown agent switcher |
| `frontend/app/view/crew/crew.tsx` | Crew Manager sidebar panel |
| `frontend/app/view/devservers/devservers.tsx` | Dev Servers sidebar panel |
| `frontend/app/block/block.tsx` | Block registry (view type -> ViewModel) |
| `frontend/app/block/blockutil.tsx` | Icon and label mappings |
| `pkg/wconfig/defaultconfig/widgets.json` | Sidebar widget definitions |
| `emain/emain-ipc.ts` | Electron IPC handlers (exec-command) |

---

## Building from Source

See [BUILD.md](BUILD.md). Requires:

- [Go](https://golang.org/) 1.22+
- [Node.js](https://nodejs.org/) 22+
- [go-task](https://taskfile.dev/)
- [Zig](https://ziglang.org/) (for CGo cross-compilation)

```bash
task dev    # Launch in dev mode
```

---

## Upstream

Terminus is forked from [Wave Terminal](https://github.com/wavetermdev/waveterm), an open-source AI-integrated terminal for macOS, Linux, and Windows. All upstream features — SSH sessions, AI chat, file preview, drag-and-drop blocks, `wsh` CLI — are preserved. See the [Wave documentation](https://docs.waveterm.dev) for those features.

Forked at Wave v0.14.1-beta.0 (`e8d6ff5b`, Feb 28, 2026).

---

## License

Terminus is licensed under the Apache-2.0 License, same as upstream Wave Terminal. See [ACKNOWLEDGEMENTS.md](./ACKNOWLEDGEMENTS.md) for dependency information.

---

## Changelog

### 2026-03-04 — `718fb157` — Dev Servers Panel

- New sidebar widget: Dev Servers panel
- Scans listening TCP ports 3000-9999 for dev server processes
- Resolves project names from process file descriptors
- Color-coded port badges by port range
- Open button launches localhost URL in default browser
- Kill button terminates process by port, Kill All for batch
- Auto-refresh every 30 seconds with manual refresh

### 2026-03-04 — `81fae4d9` — Crew Manager + ForceRestart Session Switching

- New sidebar widget: Crew Manager panel with live tmux session monitoring
- Active/Inactive sections with avatars, roles, status dots, uptime
- Attach, Launch, Kill per agent; Launch All / Kill All batch controls
- Replaced keystroke injection (ControllerInputCommand) with ForceRestart pattern
- Agent switching now uses `cmd:initscript.zsh` + `ControllerResyncCommand(forcerestart=true)`
- Works reliably regardless of what the terminal is running
- Added `exec-command` IPC handler for shell command execution from renderer
- Added `agent:name`, `agent:color`, `agent:role` to block MetaType

### 2026-03-04 — `848878fc` — Agent Themes & Preferences

- Per-agent terminal theme switching via `term:theme` metadata
- Per-agent background color override via `term:bgcolor`
- Color picker component (react-colorful) for live bgcolor adjustment
- Agent preferences persist to `agent-preferences.json` — saved on switch-out, restored on switch-in
- Tmux session switching via header dropdown

### 2026-03-04 — `bd466a74` — Terminus Fork + Agent Pane Headers

- Forked Wave Terminal v0.14.1-beta.0 as Terminus
- Renamed all user-facing strings (package.json, electron-builder, menus, Go backend, Taskfile)
- Migrated config/data directories from Wave to Terminus
- Agent pane headers: per-block agent assignment with name, role, avatar, colored border
- Typeahead modal for agent selection with fuzzy search
- 32px circular avatars loaded via IPC base64 bridge
- Static agent registry with 16 crew members
- Agent color table with roles and theme assignments
