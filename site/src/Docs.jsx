import './Docs.css';
import cubeImg from './assets/terminus-cube.png';

function Docs() {
  return (
    <div className="docs">
      {/* Nav */}
      <nav className="nav">
        <div className="nav-inner">
          <a href="#/" className="nav-logo">
            <img src={cubeImg} alt="" className="nav-cube" />
            <span className="nav-wordmark">TERMINUS</span>
          </a>
          <div className="nav-links">
            <a href="#/" className="nav-link">Home</a>
            <a href="#/docs" className="nav-link nav-link-active">Docs</a>
            <a href="https://github.com/erikaflowers/terminus" className="nav-cta" target="_blank" rel="noopener noreferrer">
              View on GitHub
            </a>
          </div>
        </div>
      </nav>

      <div className="docs-layout">
        {/* Sidebar TOC */}
        <aside className="docs-sidebar">
          <div className="docs-sidebar-inner">
            <h4 className="docs-sidebar-title">Documentation</h4>
            <ul className="docs-toc">
              <li><a href="#/docs#prerequisites">Prerequisites</a></li>
              <li><a href="#/docs#install">Installation</a></li>
              <li><a href="#/docs#first-launch">First Launch</a></li>
              <li><a href="#/docs#macos-gatekeeper">macOS Gatekeeper</a></li>
              <li><a href="#/docs#settings">Settings & Preferences</a></li>
              <li><a href="#/docs#agents">Configuring Agents</a></li>
              <li><a href="#/docs#avatars">Agent Avatars</a></li>
              <li><a href="#/docs#tmux">tmux Setup</a></li>
              <li><a href="#/docs#git">Git Integration</a></li>
              <li><a href="#/docs#fleet-log">Fleet Activity Log</a></li>
              <li><a href="#/docs#hopper">Hopper & Relay Chains</a></li>
              <li><a href="#/docs#remote">Remote Agents (SSH)</a></li>
              <li><a href="#/docs#cloud-sync">Cloud Sync</a></li>
              <li><a href="#/docs#build-from-source">Build from Source</a></li>
              <li><a href="#/docs#troubleshooting">Troubleshooting</a></li>
            </ul>
          </div>
        </aside>

        {/* Main content */}
        <main className="docs-main">
          <div className="docs-header">
            <div className="docs-badge">Setup Guide</div>
            <h1>Terminus Documentation</h1>
            <p className="docs-intro">
              Everything you need to install, configure, and run Terminus as your AI agent command center.
              This guide assumes you're comfortable with the terminal. If terms like <code>tmux</code>,
              <code>ssh</code>, and <code>CLAUDE.md</code> are unfamiliar, you may want to start with the
              linked resources below.
            </p>
          </div>

          {/* ── Prerequisites ── */}
          <section id="prerequisites" className="docs-section">
            <h2>Prerequisites</h2>
            <p>Before installing Terminus, make sure you have the following:</p>
            <div className="req-grid">
              <div className="req-card">
                <div className="req-name">macOS</div>
                <div className="req-detail">Ventura 13.0+ recommended. ARM64 (Apple Silicon) and Intel x64 supported.</div>
              </div>
              <div className="req-card">
                <div className="req-name">tmux</div>
                <div className="req-detail">
                  Terminal multiplexer that powers agent sessions. Install with{' '}
                  <code>brew install tmux</code>.{' '}
                  <a href="https://github.com/tmux/tmux/wiki" target="_blank" rel="noopener noreferrer">tmux docs</a>
                </div>
              </div>
              <div className="req-card">
                <div className="req-name">Git</div>
                <div className="req-detail">
                  Required for the Git Dashboard panel. Ships with macOS Xcode CLI tools:{' '}
                  <code>xcode-select --install</code>.{' '}
                  <a href="https://git-scm.com/doc" target="_blank" rel="noopener noreferrer">Git docs</a>
                </div>
              </div>
              <div className="req-card">
                <div className="req-name">Claude Code <span className="req-optional">(optional)</span></div>
                <div className="req-detail">
                  If your agents run Claude Code, install it globally:{' '}
                  <code>npm install -g @anthropic-ai/claude-code</code>.{' '}
                  <a href="https://docs.anthropic.com/en/docs/claude-code" target="_blank" rel="noopener noreferrer">Claude Code docs</a>
                </div>
              </div>
            </div>
          </section>

          {/* ── Installation ── */}
          <section id="install" className="docs-section">
            <h2>Installation</h2>
            <h3>Download the DMG</h3>
            <p>
              Go to <a href="https://github.com/erikaflowers/terminus/releases" target="_blank" rel="noopener noreferrer">GitHub Releases</a> and download the DMG for your architecture:
            </p>
            <div className="code-block">
              <div className="code-header">Downloads</div>
              <pre>{`Terminus-darwin-arm64-0.14.1.dmg   # Apple Silicon (M1/M2/M3/M4)
Terminus-darwin-x64-0.14.1.dmg     # Intel Macs`}</pre>
            </div>
            <p>Open the DMG and drag Terminus to your Applications folder.</p>
          </section>

          {/* ── First Launch ── */}
          <section id="first-launch" className="docs-section">
            <h2>First Launch</h2>
            <p>
              On first launch, Terminus creates its config directory at <code>~/.config/terminus/</code>.
              This is where agent preferences, connections, and settings live.
            </p>
            <p>You'll see an empty terminal. The first thing to do is configure your paths in Settings.</p>
          </section>

          {/* ── macOS Gatekeeper ── */}
          <section id="macos-gatekeeper" className="docs-section">
            <h2>macOS Gatekeeper</h2>
            <div className="callout callout-warning">
              <div className="callout-icon">!</div>
              <div>
                <strong>Terminus is not code-signed with an Apple Developer certificate.</strong> macOS will
                block it on first launch. This is normal for open-source apps distributed outside the App Store.
              </div>
            </div>
            <h3>To allow Terminus to run:</h3>
            <ol>
              <li>Try to open Terminus — macOS will say it "can't be opened"</li>
              <li>Go to <strong>System Settings &gt; Privacy & Security</strong></li>
              <li>Scroll down — you'll see "Terminus was blocked from use." Click <strong>Open Anyway</strong></li>
              <li>Authenticate with your password or Touch ID</li>
            </ol>
            <p>Alternatively, for CLI users:</p>
            <div className="code-block">
              <div className="code-header">Terminal</div>
              <pre>{`xattr -cr /Applications/Terminus.app`}</pre>
            </div>
            <p>This strips the quarantine attribute. You only need to do this once.</p>
          </section>

          {/* ── Settings ── */}
          <section id="settings" className="docs-section">
            <h2>Settings & Preferences</h2>
            <p>
              Open Settings (gear icon or <code>Cmd+,</code>). The <strong>Terminus</strong> section has five fields:
            </p>
            <div className="settings-table">
              <div className="settings-row">
                <div className="settings-key">Repo Base Path</div>
                <div className="settings-val">Root directory containing your project repos. The Git Dashboard scans this folder. <em>Example: <code>/Users/you/projects</code></em></div>
              </div>
              <div className="settings-row">
                <div className="settings-key">Agents Path</div>
                <div className="settings-val">Directory containing your agent folders (each agent gets a subdirectory with its CLAUDE.md). Also where Terminus looks for the <code>portraits/</code> avatar folder. <em>Example: <code>/Users/you/agents</code></em></div>
              </div>
              <div className="settings-row">
                <div className="settings-key">GitHub Org/User</div>
                <div className="settings-val">Your GitHub username or organization. Used to build commit URLs in the Fleet Activity Log. <em>Example: <code>myusername</code></em></div>
              </div>
              <div className="settings-row">
                <div className="settings-key">Plausible Site ID</div>
                <div className="settings-val">Your domain in Plausible Analytics. Enables the Web Stats panel. <em>Example: <code>example.com</code></em></div>
              </div>
              <div className="settings-row">
                <div className="settings-key">Plausible API Key</div>
                <div className="settings-val">Your Plausible API key for the Web Stats panel. Get one from your Plausible account settings.</div>
              </div>
            </div>
            <p>
              All settings are stored in <code>~/.config/terminus/agent-preferences.json</code> under the
              <code>_global</code> key. You can also edit this file directly.
            </p>
          </section>

          {/* ── Agents ── */}
          <section id="agents" className="docs-section">
            <h2>Configuring Agents</h2>
            <p>
              Agents are defined in an <code>agents.json</code> file inside your config directory.
              Each agent has a name, role, color, and optional configuration.
            </p>
            <h3>Agent folder structure</h3>
            <p>
              Your Agents Path should contain one subdirectory per agent. Each agent directory should have
              a <code>CLAUDE.md</code> file that defines the agent's personality, role, and instructions:
            </p>
            <div className="code-block">
              <div className="code-header">File structure</div>
              <pre>{`agents/
├── agent-atlas/
│   └── CLAUDE.md          # Atlas's personality, role, instructions
├── agent-nova/
│   └── CLAUDE.md          # Nova's personality, role, instructions
├── agent-cipher/
│   └── CLAUDE.md          # Cipher's personality, role, instructions
└── portraits/
    ├── Atlas.jpg           # Avatar image (100x100px minimum)
    ├── Nova.jpg
    └── Cipher.jpg`}</pre>
            </div>
            <h3>CLAUDE.md structure</h3>
            <p>
              Each agent's <code>CLAUDE.md</code> should define at minimum:
            </p>
            <div className="code-block">
              <div className="code-header">CLAUDE.md</div>
              <pre>{`# Agent Atlas — Orchestrator

**YOUR NAME:** Atlas
**Pronouns:** They/them

## Role
You are Atlas, the orchestrator for the project.
Your domain: Strategy, planning, cross-agent coordination.

## Voice
[How this agent speaks, their personality, patterns...]

## Working Style
[Technical patterns, preferences, guardrails...]`}</pre>
            </div>
            <p>
              The agent name in the CLAUDE.md header determines the display name and tmux session binding.
              Terminus reads the first heading and uses it for the Crew Manager panel.
            </p>
          </section>

          {/* ── Avatars ── */}
          <section id="avatars" className="docs-section">
            <h2>Agent Avatars</h2>
            <p>
              Terminus displays agent avatars in the Crew Manager panel and terminal pane headers.
              To add avatars:
            </p>
            <ol>
              <li>Create a <code>portraits/</code> folder inside your Agents Path</li>
              <li>Add a JPG or PNG image for each agent, named exactly as the agent name with capital first letter</li>
              <li>Images should be at least <strong>100 x 100 pixels</strong> (square recommended)</li>
            </ol>
            <div className="code-block">
              <div className="code-header">Example</div>
              <pre>{`agents/portraits/
├── Atlas.jpg       # matches agent name "Atlas"
├── Nova.jpg        # matches agent name "Nova"
└── Cipher.png      # PNG works too`}</pre>
            </div>
            <div className="callout callout-info">
              <div className="callout-icon">i</div>
              <div>
                If an avatar file isn't found, Terminus shows the agent's first initial on a colored background instead.
                Avatars are purely cosmetic — agents work fine without them.
              </div>
            </div>
          </section>

          {/* ── tmux ── */}
          <section id="tmux" className="docs-section">
            <h2>tmux Setup</h2>
            <p>
              Terminus uses tmux sessions to persist agent work across disconnects and app restarts.
              Each agent gets its own named tmux session.
            </p>
            <h3>Install tmux</h3>
            <div className="code-block">
              <div className="code-header">Terminal</div>
              <pre>{`brew install tmux`}</pre>
            </div>
            <h3>How it works</h3>
            <ol>
              <li>When you assign an agent to a terminal pane, Terminus creates (or attaches to) a tmux session named after the agent</li>
              <li>The session persists even if you close the pane or quit Terminus</li>
              <li>Reopening the pane reconnects to the existing session — your work is still there</li>
              <li>The Crew Manager panel shows all active tmux sessions and their status</li>
            </ol>
            <h3>tmux path</h3>
            <p>
              Terminus looks for tmux in standard locations (<code>/opt/homebrew/bin/tmux</code>,
              <code>/usr/local/bin/tmux</code>, <code>/usr/bin/tmux</code>). If your tmux is installed
              elsewhere, set the path in the Crew Manager panel's remote config section.
            </p>
            <p>
              <a href="https://github.com/tmux/tmux/wiki/Getting-Started" target="_blank" rel="noopener noreferrer">tmux Getting Started guide</a> |{' '}
              <a href="https://tmuxcheatsheet.com/" target="_blank" rel="noopener noreferrer">tmux Cheat Sheet</a>
            </p>
          </section>

          {/* ── Git ── */}
          <section id="git" className="docs-section">
            <h2>Git Integration</h2>
            <p>
              The Git Dashboard panel scans your Repo Base Path for git repositories and displays:
            </p>
            <ul>
              <li>Current branch and status (clean, dirty, ahead/behind)</li>
              <li>Recent commits</li>
              <li>Fetch and pull actions</li>
            </ul>
            <h3>Requirements</h3>
            <ul>
              <li>Git installed and in PATH (<code>git --version</code> to check)</li>
              <li>Repo Base Path set in Settings (the directory that <em>contains</em> your repos)</li>
              <li>GitHub Org/User set in Settings (for commit URL links in Fleet Log)</li>
            </ul>
            <p>
              If you use GitHub CLI, Terminus can link commits directly to your GitHub repo.
              Install with <code>brew install gh</code>.{' '}
              <a href="https://cli.github.com/manual/" target="_blank" rel="noopener noreferrer">GitHub CLI docs</a>
            </p>
          </section>

          {/* ── Fleet Log ── */}
          <section id="fleet-log" className="docs-section">
            <h2>Fleet Activity Log</h2>
            <div className="callout callout-experimental">
              <div className="callout-icon">*</div>
              <div>
                <strong>Experimental.</strong> The Fleet Activity Log requires manual setup of a Claude Code hook
                and a SQLite database. This feature is powerful but not yet streamlined — expect to get your hands dirty.
              </div>
            </div>
            <p>
              The Fleet Log records every agent conversation summary, git commits, and session metadata
              into a local SQLite database. Terminus reads from this database and displays a searchable,
              filterable activity feed.
            </p>
            <h3>Database setup</h3>
            <div className="code-block">
              <div className="code-header">Terminal</div>
              <pre>{`# Create the database
mkdir -p ~/.claude/hooks
sqlite3 ~/.claude/hooks/fleet-log.db "CREATE TABLE IF NOT EXISTS agent_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_name TEXT,
  session_id TEXT,
  timestamp TEXT DEFAULT (datetime('now')),
  summary TEXT,
  last_commit_hash TEXT,
  last_commit_msg TEXT,
  project_dir TEXT
);"`}</pre>
            </div>
            <h3>Hook setup</h3>
            <p>
              You need a Claude Code hook that fires on session stop, reads the final assistant message,
              and inserts it into the database. This hook should:
            </p>
            <ol>
              <li>Detect the current agent name from the tmux session</li>
              <li>Extract the final assistant message from the Claude Code session JSON (passed via stdin)</li>
              <li>Check for recent git commits (within 5 minutes)</li>
              <li>Insert a row into the <code>agent_logs</code> table</li>
            </ol>
            <p>
              A sample hook script is available in the Terminus repository at{' '}
              <code>docs/hooks/log-agent-summary.py</code>. Configure it in your Claude Code
              settings as a <code>stop</code> hook.
            </p>
            <div className="callout callout-info">
              <div className="callout-icon">i</div>
              <div>
                We're working on making Fleet Log setup automatic. For now, it requires manual database
                creation and hook configuration.
              </div>
            </div>
          </section>

          {/* ── Hopper ── */}
          <section id="hopper" className="docs-section">
            <h2>Hopper & Relay Chains</h2>
            <p>
              Hopper is the multi-agent dispatch panel. It lets you send prompts to any agent
              and build relay chains — sequential prompt handoffs where one agent's output becomes
              the next agent's input.
            </p>
            <h3>Sending a prompt</h3>
            <ol>
              <li>Open the Hopper panel</li>
              <li>Select a target agent from the dropdown</li>
              <li>Type your prompt</li>
              <li>Hit Send — the prompt is dispatched to the agent's tmux session</li>
            </ol>
            <h3>Relay chains</h3>
            <p>
              A relay chain queues prompts for multiple agents in sequence. When agent A finishes,
              its output is injected into agent B's prompt, and so on. This enables multi-agent
              workflows like:
            </p>
            <ul>
              <li>Agent 1 researches a topic → Agent 2 writes code based on findings → Agent 3 reviews it</li>
              <li>Agent 1 audits architecture → Agent 2 implements fixes → Agent 3 runs tests</li>
            </ul>
            <h3>Macros</h3>
            <p>
              Save frequently-used prompts or relay chains as macros. Macros appear in a quick-select
              list in the Hopper panel for one-click dispatch.
            </p>
          </section>

          {/* ── Remote ── */}
          <section id="remote" className="docs-section">
            <h2>Remote Agents (SSH)</h2>
            <p>
              Terminus supports running agents on remote machines via SSH. Each agent's terminal pane
              can connect to a remote tmux session instead of a local one.
            </p>
            <h3>Requirements</h3>
            <ul>
              <li>SSH access to the remote machine (key-based auth recommended)</li>
              <li>tmux installed on the remote machine</li>
              <li>Claude Code installed on the remote machine (if agents run Claude)</li>
            </ul>
            <h3>Configuration</h3>
            <p>
              In the Crew Manager panel, set the remote host and (optionally) the remote tmux path
              for each agent that should run remotely. Terminus will SSH into the host and attach
              to the agent's tmux session there.
            </p>
            <h3>Tailscale for remote access</h3>
            <p>
              If your remote machines are behind NAT or on different networks,{' '}
              <a href="https://tailscale.com/" target="_blank" rel="noopener noreferrer">Tailscale</a>{' '}
              is the easiest way to connect them. Install Tailscale on both machines, and use the
              Tailscale hostname as your remote host in Terminus.
            </p>
            <div className="code-block">
              <div className="code-header">Example remote host</div>
              <pre>{`# In Crew Manager → Remote Config
Remote Host: my-server          # Tailscale hostname
Remote tmux Path: /usr/bin/tmux  # Path to tmux on remote`}</pre>
            </div>
          </section>

          {/* ── Cloud Sync ── */}
          <section id="cloud-sync" className="docs-section">
            <h2>Cloud Sync</h2>
            <p>
              Terminus supports syncing your layout, settings, and widget configuration across machines
              via Google sign-in. This is inherited from Wave Terminal's cloud sync system.
            </p>
            <h3>What syncs</h3>
            <ul>
              <li><code>settings.json</code> — app preferences and theme</li>
              <li><code>connections.json</code> — saved SSH connections</li>
              <li><code>widgets.json</code> — sidebar widget configuration</li>
              <li><code>agents.json</code> — agent definitions</li>
            </ul>
            <h3>What does NOT sync</h3>
            <ul>
              <li><code>agent-preferences.json</code> — machine-specific paths (Repo Base Path, Agents Path, etc.)</li>
              <li>Local tmux sessions</li>
              <li>The Fleet Log SQLite database</li>
            </ul>
            <div className="callout callout-warning">
              <div className="callout-icon">!</div>
              <div>
                <strong>Note on cloud sync backend:</strong> Cloud sync currently connects to a hosted backend.
                This feature is functional but may change in future releases as we evaluate self-hosted options.
                Your data is limited to layout and settings — no terminal content or agent conversations are synced.
              </div>
            </div>
          </section>

          {/* ── Build from Source ── */}
          <section id="build-from-source" className="docs-section">
            <h2>Build from Source</h2>
            <p>
              If you want to build Terminus yourself instead of using the DMG:
            </p>
            <h3>Requirements</h3>
            <ul>
              <li><a href="https://golang.org/" target="_blank" rel="noopener noreferrer">Go</a> 1.22+</li>
              <li><a href="https://nodejs.org/" target="_blank" rel="noopener noreferrer">Node.js</a> 22+</li>
              <li><a href="https://taskfile.dev/" target="_blank" rel="noopener noreferrer">go-task</a> (<code>brew install go-task</code>)</li>
            </ul>
            <div className="code-block">
              <div className="code-header">Terminal</div>
              <pre>{`git clone https://github.com/erikaflowers/terminus.git
cd terminus
npm install

# Build the Go backend (force flag is important)
task build:backend --force

# Build the frontend
npm run build:prod

# Package the app
rm -rf make/
npm exec electron-builder -- -c electron-builder.config.cjs -p never`}</pre>
            </div>
            <div className="callout callout-warning">
              <div className="callout-icon">!</div>
              <div>
                <strong>Do NOT use <code>task package</code></strong> — it has a race condition where the clean step
                deletes the dist folder, then the backend build skips because it thinks nothing changed. The result
                is an app that launches but shows no window.
              </div>
            </div>
            <p>
              Output DMGs will be in the <code>make/</code> directory.
            </p>
          </section>

          {/* ── Troubleshooting ── */}
          <section id="troubleshooting" className="docs-section">
            <h2>Troubleshooting</h2>

            <h3>App launches but no window appears</h3>
            <p>
              Another instance of Terminus (or the dev build) may be running. Electron uses a single-instance
              lock. Kill all Terminus processes and try again:
            </p>
            <div className="code-block">
              <div className="code-header">Terminal</div>
              <pre>{`pkill -f Terminus
# Then relaunch`}</pre>
            </div>

            <h3>Avatars not showing</h3>
            <p>
              Check that your Agents Path is set in Settings and that the <code>portraits/</code> folder
              exists inside it with correctly-named image files (capitalized first letter, .jpg or .png).
            </p>

            <h3>Git Dashboard is empty</h3>
            <p>
              Set your Repo Base Path in Settings. This should be the parent directory that contains your
              git repositories (not a repo itself).
            </p>

            <h3>tmux sessions not connecting</h3>
            <p>
              Make sure tmux is installed (<code>which tmux</code>) and that the binary is in a standard
              location. If it's installed via Homebrew on Apple Silicon, the path is typically{' '}
              <code>/opt/homebrew/bin/tmux</code>.
            </p>

            <h3>Backend logs</h3>
            <div className="code-block">
              <div className="code-header">Log locations</div>
              <pre>{`# Production
~/Library/Application Support/Terminus/waveapp.log

# Development
~/Library/Application Support/terminus-dev/waveapp.log`}</pre>
            </div>

            <h3>Config directories</h3>
            <div className="code-block">
              <div className="code-header">Config locations</div>
              <pre>{`# Production
~/.config/terminus/

# Development
~/.config/terminus-dev/`}</pre>
            </div>
          </section>

          {/* ── Footer ── */}
          <div className="docs-footer">
            <p>
              Terminus is a <a href="https://zerovector.design" target="_blank" rel="noopener noreferrer">Zero Vector</a> project.
              Built on <a href="https://waveterm.dev" target="_blank" rel="noopener noreferrer">Wave Terminal</a>.
              Licensed under <a href="https://www.apache.org/licenses/LICENSE-2.0" target="_blank" rel="noopener noreferrer">Apache-2.0</a>.
            </p>
            <p>
              <a href="https://github.com/erikaflowers/terminus" target="_blank" rel="noopener noreferrer">GitHub</a>{' · '}
              <a href="https://github.com/erikaflowers/terminus/issues" target="_blank" rel="noopener noreferrer">Report an Issue</a>{' · '}
              <a href="#/">Back to Home</a>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Docs;
