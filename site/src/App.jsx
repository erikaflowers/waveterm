import { useEffect, useRef, useState, useCallback } from 'react';
import './App.css';
import cubeImg from './assets/terminus-cube.png';

/* ─── Intersection Observer hook for scroll reveals ─── */
function useReveal(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.unobserve(el); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

/* ─── Starfield canvas background ─── */
function Starfield() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animId;
    let stars = [];
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight * 6;
      stars = Array.from({ length: 400 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.5 + 0.3,
        speed: Math.random() * 0.3 + 0.05,
        opacity: Math.random() * 0.8 + 0.2,
        pulse: Math.random() * Math.PI * 2,
      }));
    };
    resize();
    window.addEventListener('resize', resize);
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const t = Date.now() * 0.001;
      for (const s of stars) {
        const o = s.opacity * (0.5 + 0.5 * Math.sin(t * s.speed * 2 + s.pulse));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 180, 255, ${o})`;
        ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} className="starfield" />;
}

/* ─── Floating particles around a section ─── */
function Particles({ count = 30 }) {
  const els = Array.from({ length: count }, (_, i) => {
    const size = Math.random() * 4 + 1;
    const duration = Math.random() * 20 + 10;
    const delay = Math.random() * -20;
    const left = Math.random() * 100;
    const startY = Math.random() * 100;
    return (
      <span
        key={i}
        className="particle"
        style={{
          width: size,
          height: size,
          left: `${left}%`,
          top: `${startY}%`,
          animationDuration: `${duration}s`,
          animationDelay: `${delay}s`,
          opacity: Math.random() * 0.6 + 0.1,
        }}
      />
    );
  });
  return <div className="particles-container">{els}</div>;
}

/* ─── Glitch text ─── */
function GlitchText({ children, className = '' }) {
  return (
    <span className={`glitch ${className}`} data-text={children}>
      {children}
    </span>
  );
}

/* ─── Typed text effect ─── */
function TypedText({ text, speed = 40, delay = 0 }) {
  const [displayed, setDisplayed] = useState('');
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);
  useEffect(() => {
    if (!started) return;
    let i = 0;
    const interval = setInterval(() => {
      if (i <= text.length) {
        setDisplayed(text.slice(0, i));
        i++;
      } else {
        clearInterval(interval);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [started, text, speed]);
  return <span className="typed-text">{displayed}<span className="cursor">_</span></span>;
}

/* ─── Orbiting ring around the cube ─── */
function OrbitRing({ radius, duration, color, delay = 0, dotCount = 6, reverse = false }) {
  return (
    <div
      className="orbit-ring"
      style={{
        width: radius * 2,
        height: radius * 2,
        animationDuration: `${duration}s`,
        animationDelay: `${delay}s`,
        animationDirection: reverse ? 'reverse' : 'normal',
      }}
    >
      {Array.from({ length: dotCount }, (_, i) => (
        <span
          key={i}
          className="orbit-dot"
          style={{
            background: color,
            boxShadow: `0 0 12px ${color}`,
            transform: `rotate(${(360 / dotCount) * i}deg) translateX(${radius}px)`,
          }}
        />
      ))}
    </div>
  );
}

/* ─── Feature card ─── */
function FeatureCard({ icon, title, description, accent, delay = 0, badge }) {
  const [ref, visible] = useReveal();
  return (
    <div
      ref={ref}
      className={`feature-card ${visible ? 'revealed' : ''}`}
      style={{ transitionDelay: `${delay}ms`, '--card-accent': accent }}
    >
      {badge && <span className="feature-badge">{badge}</span>}
      <div className="feature-icon">{icon}</div>
      <h3 className="feature-title">{title}</h3>
      <p className="feature-desc">{description}</p>
      <div className="feature-glow" />
    </div>
  );
}

/* ─── Agent avatar in the crew grid ─── */
function AgentCard({ name, role, color, delay = 0 }) {
  const [ref, visible] = useReveal();
  const initial = name.charAt(0).toUpperCase();
  return (
    <div
      ref={ref}
      className={`agent-card ${visible ? 'revealed' : ''}`}
      style={{ transitionDelay: `${delay}ms`, '--agent-color': color }}
    >
      <div className="agent-avatar">{initial}</div>
      <div className="agent-name">{name}</div>
      <div className="agent-role">{role}</div>
      <div className="agent-pulse" />
    </div>
  );
}

/* ─── Stat counter ─── */
function StatBlock({ value, label, delay = 0 }) {
  const [ref, visible] = useReveal();
  return (
    <div ref={ref} className={`stat-block ${visible ? 'revealed' : ''}`} style={{ transitionDelay: `${delay}ms` }}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

/* ─── Terminal mockup ─── */
function TerminalWindow({ children, title = 'terminus' }) {
  return (
    <div className="terminal-window">
      <div className="terminal-header">
        <div className="terminal-dots">
          <span className="dot dot-red" />
          <span className="dot dot-yellow" />
          <span className="dot dot-green" />
        </div>
        <span className="terminal-title">{title}</span>
      </div>
      <div className="terminal-body">
        {children}
      </div>
    </div>
  );
}

/* ─── Horizontal scrolling feature ticker ─── */
function FeatureTicker() {
  const items = [
    'MULTI-AGENT DISPATCH',
    'RELAY CHAINS',
    'FLEET MONITORING',
    'TMUX SESSIONS',
    'GIT DASHBOARD',
    'DEV SERVERS',
    'USAGE TRACKING',
    'CLOUD SYNC',
    'SSH REMOTE',
    'CREW MANAGER',
    'NODE GRAPH',
    'PROMPT MACROS',
  ];
  const doubled = [...items, ...items];
  return (
    <div className="ticker-wrap">
      <div className="ticker-track">
        {doubled.map((item, i) => (
          <span key={i} className="ticker-item">
            {item}<span className="ticker-dot" />
          </span>
        ))}
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   MAIN APP
   ══════════════════════════════════════════════════════════════ */
function App() {
  const [heroRef, heroVisible] = useReveal(0.05);
  const [panelsRef, panelsVisible] = useReveal();
  const [crewRef, crewVisible] = useReveal();
  const [termRef, termVisible] = useReveal();
  const [ctaRef, ctaVisible] = useReveal();

  /* Parallax on cube */
  const cubeContainerRef = useRef(null);
  const handleMouseMove = useCallback((e) => {
    if (!cubeContainerRef.current) return;
    const rect = cubeContainerRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / rect.width;
    const dy = (e.clientY - cy) / rect.height;
    cubeContainerRef.current.style.setProperty('--rx', `${dy * -12}deg`);
    cubeContainerRef.current.style.setProperty('--ry', `${dx * 12}deg`);
  }, []);

  const agents = [
    { name: 'Atlas', role: 'Orchestrator', color: '#8b5cf6' },
    { name: 'Nova', role: 'Frontend', color: '#f472b6' },
    { name: 'Cipher', role: 'Security', color: '#22d3ee' },
    { name: 'Beacon', role: 'DevOps', color: '#34d399' },
    { name: 'Prism', role: 'Code Review', color: '#f59e0b' },
    { name: 'Flux', role: 'Full Stack', color: '#ef4444' },
    { name: 'Vector', role: 'Data Pipeline', color: '#6366f1' },
    { name: 'Echo', role: 'Testing', color: '#ec4899' },
  ];

  return (
    <div className="app" onMouseMove={handleMouseMove}>
      <Starfield />

      {/* ─── NAV ─── */}
      <nav className="nav">
        <div className="nav-inner">
          <div className="nav-logo">
            <img src={cubeImg} alt="" className="nav-cube" />
            <span className="nav-wordmark">TERMINUS</span>
          </div>
          <div className="nav-links">
            <a href="#features" className="nav-link">Features</a>
            <a href="#crew" className="nav-link">Crew</a>
            <a href="#how-it-works" className="nav-link">How It Works</a>
            <a href="#/docs" className="nav-link">Docs</a>
            <a href="https://github.com/erikaflowers/terminus" className="nav-cta" target="_blank" rel="noopener noreferrer">
              View on GitHub
            </a>
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section ref={heroRef} className={`hero ${heroVisible ? 'revealed' : ''}`}>
        <Particles count={50} />
        <div className="hero-content">
          <div className="hero-badge">
            <span className="badge-dot" />
            Beta 1 is live — March 2026
          </div>
          <h1 className="hero-title">
            <GlitchText>TERMINUS</GlitchText>
          </h1>
          <p className="hero-subtitle">
            The Agent Mothership
          </p>
          <p className="hero-desc">
            Mission control for your AI agent crew. Monitor, dispatch, and coordinate
            multiple AI agents running in parallel — all from one unified terminal interface.
          </p>
          <div className="hero-actions">
            <a href="https://github.com/erikaflowers/terminus" className="btn btn-primary" target="_blank" rel="noopener noreferrer">
              <span className="btn-glow" />
              Download Beta
            </a>
            <a href="#features" className="btn btn-ghost">
              See What It Does
            </a>
          </div>
        </div>

        <div className="hero-visual" ref={cubeContainerRef}>
          <div className="cube-stage">
            <OrbitRing radius={180} duration={20} color="#8b5cf6" dotCount={8} />
            <OrbitRing radius={240} duration={30} color="#e879f9" delay={-5} dotCount={5} reverse />
            <OrbitRing radius={300} duration={40} color="#22d3ee" delay={-10} dotCount={4} />
            <img src={cubeImg} alt="Terminus" className="hero-cube" />
            <div className="cube-glow" />
          </div>
        </div>

        <div className="hero-scroll-hint">
          <div className="scroll-line" />
        </div>
      </section>

      {/* ─── TICKER ─── */}
      <FeatureTicker />

      {/* ─── STATS BAR ─── */}
      <section className="stats-bar">
        <StatBlock value="Your" label="Agents, Your Names" delay={0} />
        <StatBlock value="8" label="Custom Panels" delay={100} />
        <StatBlock value="1" label="Interface" delay={200} />
        <StatBlock value="0" label="Context Switching" delay={300} />
      </section>

      {/* ─── WHAT IS IT ─── */}
      <section className="section section-what">
        <div className="section-inner">
          <div className="section-label">What is Terminus?</div>
          <h2 className="section-title">
            One terminal to <span className="gradient-text">rule them all</span>
          </h2>
          <p className="section-desc section-desc-wide">
            Terminus is an open-source Electron terminal built on <a href="https://waveterm.dev" target="_blank" rel="noopener noreferrer" className="inline-link">Wave Terminal</a>.
            It extends the block-based tiling layout with a complete agent identity system — every terminal pane
            gets a named AI agent with its own avatar, color accent, and persistent tmux session.
            Switch between agents instantly. Monitor your entire fleet in real-time.
            Dispatch prompts to one agent and watch them relay to the next.
          </p>
          <div className="what-grid">
            <div className="what-card">
              <div className="what-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0-4v0m18 0v0" /></svg>
              </div>
              <h3>Block Layout</h3>
              <p>Tile terminals, dashboards, and monitors side by side. Collapse panes accordion-style to focus on what matters.</p>
            </div>
            <div className="what-card">
              <div className="what-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 1 0-16 0" /><path d="M12 12v9" /></svg>
              </div>
              <h3>Agent Identity</h3>
              <p>Each agent gets a name, role, avatar, and color. The terminal knows who is working in each pane at all times.</p>
            </div>
            <div className="what-card">
              <div className="what-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <h3>Relay Chains</h3>
              <p>Send a prompt to one agent, have it pass results to the next. Multi-agent workflows that execute like dominoes.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CLOUD SYNC ─── */}
      <section className="section section-sync">
        <div className="section-inner sync-inner">
          <div className="sync-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z" /></svg>
          </div>
          <div className="sync-content">
            <h3 className="sync-title">Cloud sync across machines</h3>
            <p className="sync-desc">
              Sign in with Google and sync your layout, settings, and widget configuration across every Mac you work on.
              Machine-specific paths stay local — everything else follows you.
            </p>
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" ref={panelsRef} className={`section section-features ${panelsVisible ? 'revealed' : ''}`}>
        <Particles count={25} />
        <div className="section-inner">
          <div className="section-label">Panels</div>
          <h2 className="section-title">
            Eight panels. <span className="gradient-text">Zero tab switching.</span>
          </h2>
          <p className="section-desc">
            Every panel you need to command an AI fleet, built directly into your terminal.
          </p>
          <div className="features-grid">
            <FeatureCard
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>}
              title="Crew Manager"
              description="See every agent, their tmux session status, avatars, and remote SSH config. Launch, attach, or kill sessions with one click."
              accent="var(--color-purple-500)"
              delay={0}
            />
            <FeatureCard
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65S8.93 17.38 9 18v4" /><path d="M9 18c-4.51 2-5-2-7-2" /></svg>}
              title="Git Dashboard"
              description="Scan all repos in your workspace. See branches, uncommitted changes, and recent commits. Fetch and pull without leaving Terminus."
              accent="var(--color-emerald)"
              delay={100}
            />
            <FeatureCard
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>}
              title="Fleet Activity Log"
              description="SQLite-backed session logger. Every conversation summary, commit, and handoff — searchable, filterable, with GitHub links."
              accent="var(--color-cyan)"
              delay={200}
              badge="Experimental"
            />
            <FeatureCard
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>}
              title="Hopper"
              description="The dispatch console. Send prompts to any agent, build relay chains for multi-agent workflows, save macros for repeat jobs."
              accent="var(--color-magenta)"
              delay={300}
            />
            <FeatureCard
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" /></svg>}
              title="Dev Servers"
              description="Live monitor for every dev server on your machine. See ports, PIDs, project names. Open or kill servers instantly."
              accent="var(--color-pink)"
              delay={400}
            />
            <FeatureCard
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" /></svg>}
              title="Usage Dashboard"
              description="Track API costs across all your agents. See spend by model, by agent, by day. Know exactly what your fleet is costing you."
              accent="var(--color-purple-400)"
              delay={500}
            />
            <FeatureCard
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></svg>}
              title="Web Stats"
              description="Plausible analytics right in your terminal. Pageviews, visitors, referrers, top pages — all configurable per user."
              accent="var(--color-emerald)"
              delay={600}
            />
            <FeatureCard
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3" /><circle cx="19" cy="5" r="2" /><circle cx="5" cy="19" r="2" /><path d="M14.5 9.5L17 7" /><path d="M9.5 14.5L7 17" /><circle cx="5" cy="5" r="2" /><path d="M9.5 9.5L7 7" /></svg>}
              title="Node Graph"
              description="Visualize your tmux session topology. See which agents are connected, which sessions are active, and how they relate."
              accent="var(--color-cyan)"
              delay={700}
            />
          </div>
        </div>
      </section>

      {/* ─── CREW ─── */}
      <section id="crew" ref={crewRef} className={`section section-crew ${crewVisible ? 'revealed' : ''}`}>
        <div className="section-inner">
          <div className="section-label">The Crew</div>
          <h2 className="section-title">
            Name them. <span className="gradient-text">Give them purpose.</span>
          </h2>
          <p className="section-desc">
            Your agents aren't disposable threads — they're crew members. Give each one a name,
            a role, an avatar, and a color. Terminus keeps their identity persistent across sessions.
            Define as many as you need.
          </p>
          <div className="crew-grid">
            {agents.map((a, i) => (
              <AgentCard key={a.name} {...a} delay={i * 60} />
            ))}
          </div>
          <p className="crew-footnote">
            These are examples — define your own agents with any name, role, and color.
            <a href="#/docs" className="inline-link crew-docs-link">See the setup guide</a> for agent configuration.
          </p>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="how-it-works" ref={termRef} className={`section section-terminal ${termVisible ? 'revealed' : ''}`}>
        <div className="section-inner">
          <div className="section-label">How It Works</div>
          <h2 className="section-title">
            From <span className="gradient-text">zero to fleet</span> in minutes
          </h2>
          <div className="terminal-demo">
            <TerminalWindow title="zsh — terminus">
              <div className="term-line"><span className="term-prompt">$</span> <TypedText text="open Terminus-darwin-arm64.dmg" delay={800} speed={35} /></div>
              <div className="term-line term-fade-1"><span className="term-muted"># Download from GitHub Releases → drag to /Applications</span></div>
              <div className="term-line term-fade-2"><span className="term-prompt">$</span> <span className="term-cmd">terminus</span></div>
              <div className="term-line term-fade-3"><span className="term-output">Terminus v1.0.0-beta.1</span></div>
              <div className="term-line term-fade-4"><span className="term-output">Loading crew manifest... agents ready</span></div>
              <div className="term-line term-fade-5"><span className="term-output">Fleet ready. <span className="term-accent">All systems nominal.</span></span></div>
            </TerminalWindow>
            <div className="terminal-steps">
              <div className="step">
                <div className="step-number">01</div>
                <div className="step-content">
                  <h3>Install</h3>
                  <p>Download the macOS DMG or build from source. ARM64 and x64 supported.</p>
                </div>
              </div>
              <div className="step">
                <div className="step-number">02</div>
                <div className="step-content">
                  <h3>Configure</h3>
                  <p>Set your workspace path, GitHub org, and optional integrations in Settings.</p>
                </div>
              </div>
              <div className="step">
                <div className="step-number">03</div>
                <div className="step-content">
                  <h3>Deploy Agents</h3>
                  <p>Assign agents to panes. Each one gets its own tmux session, color, and identity.</p>
                </div>
              </div>
              <div className="step">
                <div className="step-number">04</div>
                <div className="step-content">
                  <h3>Command the Fleet</h3>
                  <p>Dispatch prompts via Hopper, monitor with Fleet Log, and track costs on the Usage Dashboard.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── TECH SPEC ─── */}
      <section className="section section-tech">
        <div className="section-inner">
          <div className="section-label">Under the Hood</div>
          <h2 className="section-title">
            Built on <span className="gradient-text">battle-tested</span> foundations
          </h2>
          <div className="tech-grid">
            <div className="tech-card">
              <div className="tech-name">Electron</div>
              <div className="tech-desc">Native macOS app with real terminal emulation</div>
            </div>
            <div className="tech-card">
              <div className="tech-name">React + TypeScript</div>
              <div className="tech-desc">Block-based tiling UI with Jotai state management</div>
            </div>
            <div className="tech-card">
              <div className="tech-name">Go Backend</div>
              <div className="tech-desc">High-performance wavesrv process handles all IPC</div>
            </div>
            <div className="tech-card">
              <div className="tech-name">tmux</div>
              <div className="tech-desc">Agent sessions persist through disconnects and restarts</div>
            </div>
            <div className="tech-card">
              <div className="tech-name">SQLite</div>
              <div className="tech-desc">Fleet activity log with full-text search</div>
            </div>
            <div className="tech-card">
              <div className="tech-name">SSH Native</div>
              <div className="tech-desc">Remote agent sessions with auto-detected tmux paths</div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section ref={ctaRef} className={`section section-cta ${ctaVisible ? 'revealed' : ''}`}>
        <Particles count={40} />
        <div className="cta-inner">
          <img src={cubeImg} alt="" className="cta-cube" />
          <h2 className="cta-title">Ready to command the fleet?</h2>
          <p className="cta-desc">
            Terminus is free, open-source, and built for people who run AI agents
            like they mean it. macOS. Beta 1. Right now.
          </p>
          <div className="cta-actions">
            <a href="https://github.com/erikaflowers/terminus" className="btn btn-primary btn-lg" target="_blank" rel="noopener noreferrer">
              <span className="btn-glow" />
              Get Terminus
            </a>
            <a href="https://github.com/erikaflowers/terminus" className="btn btn-ghost btn-lg" target="_blank" rel="noopener noreferrer">
              Star on GitHub
            </a>
          </div>
          <div className="cta-docs-note">
            <p>
              Terminus is built for developers comfortable with the terminal, tmux, and AI agent workflows.
              New to this? <a href="#/docs" className="inline-link">Read the detailed setup guide</a> before you dive in.
            </p>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <img src={cubeImg} alt="" className="footer-cube" />
            <span>Terminus</span>
          </div>
          <div className="footer-links">
            <a href="#/docs">Documentation</a>
            <a href="https://github.com/erikaflowers/terminus" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="https://zerovector.design" target="_blank" rel="noopener noreferrer">Zero Vector</a>
          </div>
          <div className="footer-copy">
            A Zero Vector project. Apache-2.0 License.
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
