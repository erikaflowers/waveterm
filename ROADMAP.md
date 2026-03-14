# Terminus Roadmap

Internal roadmap for Terminus (WaveTerm fork), the multi-agent CLI multiplexer.

Legend: ✅ Done | 🔧 In Progress | 🔷 Planned

---

## v1.0 Beta (2026-03-12)

### Agent System
- ✅ Crew panel — agent list, remote config, avatar display
- ✅ Agent switcher dropdown with tmux session attach
- ✅ Agent color accents on pane headers
- ✅ Agent preferences persistence (theme, bgcolor per agent)
- ✅ ForceRestart pattern for reliable session switching
- ✅ Re-select same agent to force reconnect (broken pipe recovery)

### Remote / SSH
- ✅ Local vs remote tmux path resolution
- ✅ Auto-detect remote tmux path via SSH
- ✅ `getTmuxCmd()` centralized helper
- ✅ Remote tmux path override in crew panel UI

### Layout & UX
- ✅ Accordion collapse for panes (vertical stacking only)
- ✅ Settings opens as layout panel, not ephemeral modal
- ✅ Dev/prod app coexistence (separate Electron instance lock)

### Custom Panels
- ✅ Fleet Activity Log — agent session logger with SQLite backend
- ✅ Git Dashboard — repo scanner with fetch/pull/status
- ✅ Node Graph — tmux session topology visualizer
- ✅ Usage Dashboard — cost tracking
- ✅ Hopper — multi-agent prompt dispatch with relay chains

### Custom Panels (cont.)
- ✅ Web Stats — Plausible analytics dashboard (configurable)

### Settings & Preferences
- ✅ All user-specific paths elevated to configurable preferences
- ✅ Terminus section in Settings panel (repo path, agents path, GitHub org, Plausible)
- ✅ Native OS folder picker for path fields
- ✅ AI section hidden until in-app AI plan exists
- ✅ Cloud sync for layout/settings (machine-specific paths excluded)

### Build & Infra
- ✅ Packaged app builds (ARM64 + x64 DMG)
- ✅ Terminus cube icon (dock, app bundle, DMG)
- ✅ wcloud endpoint warning instead of crash in dev mode
- ✅ README, BUILD, CONTRIBUTING rewritten for Terminus

---

## v1.1 — Post-Beta Polish

### Pane Status Indicators
- 🔷 3-dot status in pane header: SSH / tmux / Claude Code
- 🔷 Detect agent mismatch (metadata vs actual tmux session)
- 🔷 Comment out unused ConnectionButton

### Accordion Collapse Refinements
- 🔷 Minimum collapsed height = header bar height (pixel-aware)
- 🔷 Collapse animation transition

### Upstream Merge
- 🔷 Cherry-pick Wave v0.14.2 bug fixes (zoom notifications, focus tracking)
- 🔷 Evaluate v0.14.2 badge system for agent status integration
- 🔷 Full upstream merge when conflict surface is manageable

### Agent Workflow
- 🔷 Hopper payload relay — clean end-to-end test
- 🔷 Relay instruction tuning (agent refusal edge cases)
- 🔷 Agent session auto-restart on disconnect

---

## v1.2 — Fleet Intelligence

### Status & Monitoring
- 🔷 Agent heartbeat / liveness detection
- 🔷 Fleet-wide git status summary
- 🔷 Session duration and idle tracking

### Automation
- 🔷 Scheduled relay chains (cron-style prompt dispatch)
- 🔷 Agent task queue with priority
- 🔷 Batch operations across agents

### UX
- 🔷 Tab badges for agent activity (upstream badge system)
- 🔷 Keyboard shortcuts for agent switching
- 🔷 Layout templates (save/restore pane arrangements)

---

## Ideas / Backlog

- Import/export tab layouts
- Command palette for agent operations
- Agent-specific keybindings
- Mobile companion for fleet monitoring
- Webhook integrations for relay chains
