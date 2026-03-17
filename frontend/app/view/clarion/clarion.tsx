// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { BlockNodeModel } from "@/app/block/blocktypes";
import { getApi, WOS } from "@/app/store/global";
import type { TabModel } from "@/app/store/tab-model";
import * as jotai from "jotai";
import * as React from "react";

// --- Types ---

type ClarionAgent = {
    id: string;
    name: string;
    backend: string;
    voice: string;
    speed: number;
};

type AgentState = {
    [agentId: string]: { muted?: boolean };
};

type SessionMap = {
    [sessionId: string]: string;
};

type BackendHealth = {
    [backend: string]: "up" | "down" | "unconfigured";
};

// --- Config ---

const CONFIG_DIR = "$HOME/.config/clarion";
const AGENTS_FILE = `${CONFIG_DIR}/agents.json`;
const STATE_FILE = `${CONFIG_DIR}/agents.state.json`;
const SESSIONS_FILE = `${CONFIG_DIR}/sessions.json`;
const CONFIG_FILE = `${CONFIG_DIR}/config.json`;

// --- Helpers ---

async function expandPath(path: string): Promise<string> {
    const result = await getApi().execCommand(`echo ${path}`);
    return result.stdout.trim();
}

async function readJsonFile<T>(path: string, fallback: T): Promise<T> {
    try {
        const expanded = await expandPath(path);
        const raw = await getApi().readTextFile(expanded);
        if (!raw) return fallback;
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

async function writeJsonFile(path: string, data: unknown): Promise<void> {
    const expanded = await expandPath(path);
    const configDir = await expandPath(CONFIG_DIR);
    await getApi().execCommand(`mkdir -p ${configDir}`);
    await getApi().writeTextFile(expanded, JSON.stringify(data, null, 2) + "\n");
}

async function getClarionServer(): Promise<string> {
    const config = await readJsonFile<{ server?: string }>(CONFIG_FILE, {});
    return config.server || "http://localhost:8080";
}

function backendColor(status: string): string {
    if (status === "up") return "#22c55e";
    if (status === "down") return "#ef4444";
    return "#64748b";
}

function backendLabel(backend: string): string {
    const labels: Record<string, string> = {
        edge: "Edge TTS",
        kokoro: "Kokoro",
        piper: "Piper",
        elevenlabs: "ElevenLabs",
        google: "Chirp 3 HD",
    };
    return labels[backend] || backend;
}

// --- ViewModel ---

class ClarionViewModel implements ViewModel {
    viewType: string;
    nodeModel: BlockNodeModel;
    tabModel: TabModel;
    blockId: string;
    blockAtom: jotai.Atom<Block>;
    viewIcon: jotai.Atom<string>;
    viewName: jotai.Atom<string>;
    viewComponent: ViewComponent;
    endIconButtons: jotai.Atom<IconButtonDecl[]>;

    constructor(blockId: string, nodeModel: BlockNodeModel, tabModel: TabModel) {
        this.viewType = "clarion";
        this.blockId = blockId;
        this.nodeModel = nodeModel;
        this.tabModel = tabModel;
        this.blockAtom = WOS.getWaveObjectAtom<Block>(`block:${blockId}`);
        this.viewIcon = jotai.atom("waveform-lines");
        this.viewName = jotai.atom("Clarion");
        this.viewComponent = ClarionView;
        this.endIconButtons = jotai.atom<IconButtonDecl[]>([]);
    }
}

// --- Components ---

const BackendDot = React.memo(({ status }: { status: string }) => (
    <span
        className="inline-block rounded-full"
        style={{
            width: 6,
            height: 6,
            backgroundColor: backendColor(status),
            flexShrink: 0,
        }}
    />
));
BackendDot.displayName = "BackendDot";

const AgentCard = React.memo(
    ({
        agent,
        muted,
        sessionCount,
        health,
        onToggleMute,
        onTest,
    }: {
        agent: ClarionAgent;
        muted: boolean;
        sessionCount: number;
        health: BackendHealth;
        onToggleMute: (id: string) => void;
        onTest: (id: string) => void;
    }) => {
        const backendStatus = health[agent.backend] || "unconfigured";

        return (
            <div
                className="flex items-center gap-3 px-3 py-2 rounded-md"
                style={{
                    background: muted ? "rgba(255,255,255,0.01)" : "rgba(255,255,255,0.03)",
                    opacity: muted ? 0.5 : 1,
                    width: "100%",
                }}
            >
                <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-2">
                        <span
                            className="text-[13px] font-semibold truncate"
                            style={{ color: "var(--main-text-color)" }}
                        >
                            {agent.name}
                        </span>
                        {sessionCount > 0 && (
                            <span
                                className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                                style={{
                                    background: "rgba(34,197,94,0.15)",
                                    color: "#22c55e",
                                    border: "1px solid rgba(34,197,94,0.3)",
                                }}
                            >
                                live
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px]">
                        <BackendDot status={backendStatus} />
                        <span className="text-muted">
                            {backendLabel(agent.backend)} &middot; {agent.voice} &middot; {agent.speed}x
                        </span>
                    </div>
                </div>

                <div className="flex gap-1 flex-shrink-0">
                    <button
                        onClick={() => onTest(agent.id)}
                        className="px-2 py-1 text-[11px] rounded"
                        style={{
                            background: "rgba(255,255,255,0.08)",
                            color: "var(--main-text-color)",
                            border: "1px solid rgba(255,255,255,0.15)",
                            cursor: "pointer",
                        }}
                        title={`Test ${agent.name}'s voice`}
                    >
                        <i className="fa-sharp fa-solid fa-play" style={{ fontSize: 9 }} />
                    </button>
                    <button
                        onClick={() => onToggleMute(agent.id)}
                        className="px-2 py-1 text-[11px] rounded"
                        style={{
                            background: muted ? "rgba(255,0,0,0.1)" : "rgba(255,255,255,0.08)",
                            color: muted ? "#f87171" : "var(--main-text-color)",
                            border: `1px solid ${muted ? "rgba(255,0,0,0.2)" : "rgba(255,255,255,0.15)"}`,
                            cursor: "pointer",
                        }}
                        title={muted ? `Unmute ${agent.name}` : `Mute ${agent.name}`}
                    >
                        <i
                            className={`fa-sharp fa-solid ${muted ? "fa-volume-xmark" : "fa-volume-high"}`}
                            style={{ fontSize: 9 }}
                        />
                    </button>
                </div>
            </div>
        );
    }
);
AgentCard.displayName = "AgentCard";

const HealthBar = React.memo(({ health }: { health: BackendHealth }) => {
    const backends = Object.entries(health);
    if (backends.length === 0) return null;

    return (
        <div
            className="flex items-center gap-3 px-3 py-1.5"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}
        >
            {backends.map(([backend, status]) => (
                <div key={backend} className="flex items-center gap-1.5 text-[10px] text-muted">
                    <BackendDot status={status} />
                    <span>{backendLabel(backend)}</span>
                </div>
            ))}
        </div>
    );
});
HealthBar.displayName = "HealthBar";

// --- Main View ---

const ClarionView: React.FC<ViewComponentProps<ClarionViewModel>> = ({ model }) => {
    const [agents, setAgents] = React.useState<ClarionAgent[]>([]);
    const [agentState, setAgentState] = React.useState<AgentState>({});
    const [sessions, setSessions] = React.useState<SessionMap>({});
    const [health, setHealth] = React.useState<BackendHealth>({});
    const [loading, setLoading] = React.useState(false);
    const [serverUrl, setServerUrl] = React.useState<string>("");

    const refresh = React.useCallback(async () => {
        setLoading(true);
        try {
            const [agentData, stateData, sessionData, server] = await Promise.all([
                readJsonFile<ClarionAgent[]>(AGENTS_FILE, []),
                readJsonFile<AgentState>(STATE_FILE, {}),
                readJsonFile<SessionMap>(SESSIONS_FILE, {}),
                getClarionServer(),
            ]);
            setAgents(agentData);
            setAgentState(stateData);
            setSessions(sessionData);
            setServerUrl(server);

            // Fetch backend health from Clarion server
            try {
                const result = await getApi().execCommand(`curl -s ${server}/health 2>/dev/null`);
                if (result.stdout?.trim()) {
                    setHealth(JSON.parse(result.stdout));
                }
            } catch {
                setHealth({});
            }
        } catch (e) {
            console.error("[clarion] Failed to refresh:", e);
        }
        setLoading(false);
    }, []);

    React.useEffect(() => {
        refresh();
        const interval = setInterval(refresh, 10000);
        return () => clearInterval(interval);
    }, [refresh]);

    const handleToggleMute = React.useCallback(
        async (agentId: string) => {
            const newState = { ...agentState };
            if (!newState[agentId]) newState[agentId] = {};
            newState[agentId].muted = !newState[agentId].muted;
            setAgentState(newState);
            await writeJsonFile(STATE_FILE, newState);
        },
        [agentState]
    );

    const handleTest = React.useCallback(
        async (agentId: string) => {
            const agent = agents.find((a) => a.id === agentId);
            if (!agent) return;
            await getApi().execCommand(
                `echo "Hello, I am ${agent.name}." | clarion-stream --agent ${agentId} 2>/dev/null &`
            );
        },
        [agents]
    );

    // Count active sessions per agent
    const sessionCounts = React.useMemo(() => {
        const counts: Record<string, number> = {};
        for (const agentId of Object.values(sessions)) {
            counts[agentId] = (counts[agentId] || 0) + 1;
        }
        return counts;
    }, [sessions]);

    const activeCount = Object.keys(sessions).length;

    return (
        <div
            className="flex flex-col h-full overflow-hidden"
            style={{ background: "var(--block-bg-color)", width: "100%" }}
        >
            {/* Header */}
            <div
                className="flex items-center justify-between px-3 py-2 border-b border-white/10"
                style={{ width: "100%" }}
            >
                <div className="flex items-center gap-2">
                    <span className="text-[12px] font-semibold text-muted uppercase tracking-wider">
                        Clarion
                    </span>
                    <span className="text-[11px] text-muted">
                        {agents.length} agent{agents.length !== 1 ? "s" : ""}
                        {activeCount > 0 && ` \u00b7 ${activeCount} live`}
                    </span>
                </div>
                <button
                    onClick={refresh}
                    className="text-[11px] text-muted hover:text-white px-1.5 py-0.5 rounded"
                    style={{ background: "rgba(255,255,255,0.05)", cursor: "pointer", border: "none" }}
                    title="Refresh"
                >
                    <i className={`fa-sharp fa-solid fa-arrows-rotate ${loading ? "fa-spin" : ""}`} />
                </button>
            </div>

            {/* Backend health */}
            <HealthBar health={health} />

            {/* Agent list */}
            <div
                className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-1"
                style={{ width: "100%", minWidth: 0 }}
            >
                {agents.length === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center py-8 gap-2">
                        <span className="text-[12px] text-muted">No agents configured.</span>
                        <span className="text-[11px] text-muted">
                            Run <code style={{ color: "var(--main-text-color)" }}>clarion-init</code> or
                            add agents to ~/.config/clarion/agents.json
                        </span>
                    </div>
                )}
                {agents.map((agent) => (
                    <AgentCard
                        key={agent.id}
                        agent={agent}
                        muted={!!agentState[agent.id]?.muted}
                        sessionCount={sessionCounts[agent.id] || 0}
                        health={health}
                        onToggleMute={handleToggleMute}
                        onTest={handleTest}
                    />
                ))}
            </div>

            {/* Footer */}
            {serverUrl && (
                <div
                    className="flex items-center px-3 py-1.5 text-[10px] text-muted border-t border-white/10"
                    style={{ width: "100%" }}
                >
                    <span>Server: {serverUrl}</span>
                </div>
            )}
        </div>
    );
};

export { ClarionViewModel };
