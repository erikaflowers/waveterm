// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { BlockNodeModel } from "@/app/block/blocktypes";
import { getRepoBasePath } from "@/app/store/agents";
import { getApi, WOS } from "@/app/store/global";
import type { TabModel } from "@/app/store/tab-model";
import * as jotai from "jotai";
import * as React from "react";

// --- Types ---

type DevServer = {
    pid: number;
    process: string;
    port: number;
    project: string;
};

// --- Parsing ---

function parseLsofOutput(stdout: string): { pid: number; process: string; port: number }[] {
    const results: { pid: number; process: string; port: number }[] = [];
    const seen = new Set<string>();
    const lines = stdout.split("\n");

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(/\s+/);
        if (parts.length < 9) continue;

        const cmd = parts[0];
        const pid = parseInt(parts[1]);
        const addrPort = parts[8];
        const portStr = addrPort.split(":").pop();
        const port = parseInt(portStr);

        if (isNaN(port) || port < 3000 || port > 9999) continue;
        if (!/node|Python|uvicorn|ruby|php|java|deno|bun/i.test(cmd)) continue;

        const key = `${pid}:${port}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push({ pid, process: cmd, port });
    }

    results.sort((a, b) => a.port - b.port);
    return results;
}

async function resolveProject(pid: number): Promise<string> {
    const basePath = getRepoBasePath();
    if (!basePath) return "(unknown)";
    try {
        const escaped = basePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const result = await getApi().execCommand(`/usr/sbin/lsof -p ${pid} -Fn 2>/dev/null | grep '^n.*${basePath}/' | head -1`);
        const line = result.stdout.trim();
        if (!line) return "(unknown)";
        const regex = new RegExp(escaped + "/([^/]+(?:/[^/]+)?)");
        const match = line.match(regex);
        if (match) {
            return match[1].replace(/\/node_modules\/.*/, "");
        }
        return "(unknown)";
    } catch {
        return "(unknown)";
    }
}

function portColor(port: number): string {
    // Give common port ranges distinct colors
    if (port >= 3000 && port < 4000) return "#22c55e"; // green — Vite, Next, React
    if (port >= 4000 && port < 5000) return "#06b6d4"; // cyan — custom
    if (port >= 5000 && port < 6000) return "#a855f7"; // purple — Flask, etc
    if (port >= 8000 && port < 9000) return "#f59e0b"; // amber — FastAPI, Django
    if (port >= 9000 && port < 10000) return "#ef4444"; // red — misc
    return "#64748b";
}

// --- ViewModel ---

class DevServersViewModel implements ViewModel {
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
        this.viewType = "devservers";
        this.blockId = blockId;
        this.nodeModel = nodeModel;
        this.tabModel = tabModel;
        this.blockAtom = WOS.getWaveObjectAtom<Block>(`block:${blockId}`);
        this.viewIcon = jotai.atom("server");
        this.viewName = jotai.atom("Servers");
        this.viewComponent = DevServersView;
        this.endIconButtons = jotai.atom<IconButtonDecl[]>([]);
    }
}

// --- React Components ---

const ServerCard = React.memo(
    ({
        server,
        onKill,
        onOpen,
    }: {
        server: DevServer;
        onKill: (port: number) => void;
        onOpen: (port: number) => void;
    }) => {
        const color = portColor(server.port);

        return (
            <div
                className="flex items-center gap-3 px-3 py-2 rounded-md"
                style={{ background: "rgba(255,255,255,0.03)", width: "100%" }}
            >
                <div
                    className="flex items-center justify-center flex-shrink-0 rounded font-mono text-[11px] font-bold"
                    style={{
                        width: 48,
                        height: 28,
                        backgroundColor: `${color}18`,
                        color,
                        border: `1px solid ${color}40`,
                    }}
                >
                    :{server.port}
                </div>
                <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold truncate" style={{ color: "var(--main-text-color)" }}>
                            {server.project}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px]">
                        <span
                            className="inline-block rounded-full"
                            style={{
                                width: 6,
                                height: 6,
                                backgroundColor: "#22c55e",
                                flexShrink: 0,
                            }}
                        />
                        <span className="text-muted">
                            {server.process} · pid {server.pid}
                        </span>
                    </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                    <button
                        onClick={() => onOpen(server.port)}
                        className="px-2 py-1 text-[11px] rounded"
                        style={{
                            background: "rgba(255,255,255,0.08)",
                            color: "var(--main-text-color)",
                            border: "1px solid rgba(255,255,255,0.15)",
                            cursor: "pointer",
                        }}
                        title={`Open localhost:${server.port} in browser`}
                    >
                        Open
                    </button>
                    <button
                        onClick={() => onKill(server.port)}
                        className="px-2 py-1 text-[11px] rounded"
                        style={{
                            background: "rgba(255,0,0,0.1)",
                            color: "#f87171",
                            border: "1px solid rgba(255,0,0,0.2)",
                            cursor: "pointer",
                        }}
                    >
                        Kill
                    </button>
                </div>
            </div>
        );
    }
);
ServerCard.displayName = "ServerCard";

const DevServersView: React.FC<ViewComponentProps<DevServersViewModel>> = ({ model }) => {
    const [servers, setServers] = React.useState<DevServer[]>([]);
    const [loading, setLoading] = React.useState(false);

    const refreshServers = React.useCallback(async () => {
        setLoading(true);
        try {
            const result = await getApi().execCommand("/usr/sbin/lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null");
            const parsed = parseLsofOutput(result.stdout);

            // Resolve project names in parallel
            const withProjects = await Promise.all(
                parsed.map(async (s) => {
                    const project = await resolveProject(s.pid);
                    return { ...s, project };
                })
            );

            setServers(withProjects);
        } catch (e) {
            console.error("Failed to refresh dev servers:", e);
        }
        setLoading(false);
    }, []);

    // Initial load + polling every 30s
    React.useEffect(() => {
        refreshServers();
        const interval = setInterval(refreshServers, 30000);
        return () => clearInterval(interval);
    }, [refreshServers]);

    const handleKill = React.useCallback(
        async (port: number) => {
            await getApi().execCommand(`/usr/sbin/lsof -ti TCP:${port} -sTCP:LISTEN 2>/dev/null | xargs kill -9`);
            // Brief delay for process cleanup, then refresh
            setTimeout(() => refreshServers(), 500);
        },
        [refreshServers]
    );

    const handleKillAll = React.useCallback(async () => {
        for (const server of servers) {
            await getApi().execCommand(`/usr/sbin/lsof -ti TCP:${server.port} -sTCP:LISTEN 2>/dev/null | xargs kill -9`);
        }
        setTimeout(() => refreshServers(), 500);
    }, [servers, refreshServers]);

    const handleOpen = React.useCallback((port: number) => {
        getApi().openExternal(`http://localhost:${port}`);
    }, []);

    return (
        <div
            className="flex flex-col h-full overflow-hidden"
            style={{ background: "var(--block-bg-color)", width: "100%" }}
        >
            <div
                className="flex items-center justify-between px-3 py-2 border-b border-white/10"
                style={{ width: "100%" }}
            >
                <div className="flex items-center gap-2">
                    <span className="text-[12px] font-semibold text-muted uppercase tracking-wider">Servers</span>
                    <span className="text-[11px] text-muted">
                        {servers.length} running
                    </span>
                </div>
                <button
                    onClick={refreshServers}
                    className="text-[11px] text-muted hover:text-white px-1.5 py-0.5 rounded"
                    style={{ background: "rgba(255,255,255,0.05)", cursor: "pointer", border: "none" }}
                    title="Refresh"
                >
                    <i className={`fa-sharp fa-solid fa-arrows-rotate ${loading ? "fa-spin" : ""}`} />
                </button>
            </div>
            <div
                className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-1"
                style={{ width: "100%", minWidth: 0 }}
            >
                {servers.length === 0 && !loading && (
                    <div className="flex items-center justify-center py-8">
                        <span className="text-[12px] text-muted">No dev servers running.</span>
                    </div>
                )}
                {servers.map((server) => (
                    <ServerCard
                        key={`${server.pid}:${server.port}`}
                        server={server}
                        onKill={handleKill}
                        onOpen={handleOpen}
                    />
                ))}
            </div>
            {servers.length > 0 && (
                <div className="flex gap-2 px-3 py-2 border-t border-white/10" style={{ width: "100%" }}>
                    <button
                        onClick={handleKillAll}
                        className="flex-1 px-2 py-1.5 text-[11px] rounded"
                        style={{
                            background: "rgba(255,0,0,0.08)",
                            color: "#f87171",
                            border: "1px solid rgba(255,0,0,0.15)",
                            cursor: "pointer",
                        }}
                    >
                        Kill All
                    </button>
                </div>
            )}
        </div>
    );
};

export { DevServersViewModel };
