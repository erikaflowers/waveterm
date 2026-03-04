# Terminus — WaveTerm Fork

Fork of [WaveTerm](https://github.com/wavetermdev/waveterm) for internal tool use. Renamed to **Terminus**.

## Build

### Prerequisites
- Go, Node.js 22+, Zig, Task (`brew install go-task go zig`)

### Commands
```bash
task init              # npm install + go mod tidy (first time)
task dev               # Dev mode with HMR
task build:backend     # Compile Go server + wsh
task package           # Production build → make/
task electron:quickdev # Fast arm64 macOS dev (skips docs, wsh, generate)
```

### Logs
- Frontend: Chrome DevTools (Cmd+Option+I)
- Backend: `~/Library/Application Support/terminus-dev/waveapp.log` (dev mode)

## Directory Mapping (macOS)

| What | Production | Dev Mode |
|------|-----------|----------|
| Config | `~/.config/terminus/` | `~/.config/terminus-dev/` |
| Data | `~/Library/Application Support/terminus/` | `~/Library/Application Support/terminus-dev/` |
| Cache | `~/Library/Caches/terminus/` | `~/Library/Caches/terminus-dev/` |
| Temp sockets | `/tmp/terminus-{uid}/` | `/tmp/terminus-{uid}/` |

Original Wave uses `waveterm` in all these paths. Both apps coexist.

## Rename Status

### Changed (user-facing identity)
- `package.json` — name, productName, appId (`dev.matilda.terminus`)
- `electron-builder.config.cjs` — entitlement strings, publish removed
- `emain/emain-platform.ts` — dir prefix, envPaths, app.setName
- `emain/emain-menu.ts` — "About Terminus"
- `emain/emain.ts` — quit dialog, log messages
- `emain/updater.ts` — notification title/body
- `pkg/wavebase/wavebase.go` — appBundle, /tmp socket path
- `cmd/server/main-server.go` — log prefix, version/dir log messages
- `Taskfile.yml` — APP_NAME, dev paths, bucket refs removed

### NOT Changed (intentionally)
- **Go module path** (`github.com/wavetermdev/waveterm`) — 970+ imports, internal only
- **WAVETERM_* env vars** — internal IPC, 15+ files + 6 shell scripts, zero user visibility
- **Remote SSH paths** (`~/.waveterm/`) — breaking change for existing hosts with wsh
- **WAVESRV-ESTART protocol marker** — parsed by both TS and Go, must match
- **Shell integration env vars** — WAVETERM_SWAPTOKEN, _WAVETERM_SI_*, etc.

## Architecture

```
Electron (React + TypeScript + Vite)
    ↕ WebSocket (localhost, random auth key)
Go Backend (wavesrv — SQLite, SSH, terminal emulation)
    ↕ wsh CLI (Wave Shell — RPC to server)
```

## Key Files

| File | Purpose |
|------|---------|
| `emain/emain-platform.ts` | App identity, data/config path resolution |
| `pkg/wavebase/wavebase.go` | Go constants, cache/socket paths |
| `emain/emain.ts` | App lifecycle, quit handling |
| `emain/emain-wavesrv.ts` | Go server process management |
| `pkg/wconfig/` | Config management with file watchers |
| `schema/` | JSON schemas for settings, AI presets, widgets |

## Sprint Info

Working on: Initial fork setup and rename
Branch: main
