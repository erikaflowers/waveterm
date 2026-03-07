// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { BlockNodeModel } from "@/app/block/blocktypes";
import { getApi, WOS } from "@/app/store/global";
import type { TabModel } from "@/app/store/tab-model";
import * as jotai from "jotai";
import * as React from "react";

// --- Types ---

type FleetEntry = {
    agent_name: string;
    timestamp: string; // ISO 8601 UTC
    summary: string;
    last_commit_hash: string | null;
    last_commit_msg: string | null;
    project_dir: string | null;
};

// --- Constants ---

const DB_PATH = "~/.claude/hooks/fleet-log.db";
const POLL_INTERVAL = 30000;
const MAX_ENTRIES = 50;
const SUMMARY_LINE_LIMIT = 3;

// Agent colors — mirrored from agents.ts to avoid import dependencies
const AGENT_COLORS: Record<string, string> = {
    julian: "#6366F1",
    heavy: "#22C55E",
    decker: "#F59E0B",
    sellivan: "#8B5CF6",
    qin: "#EF4444",
    lee: "#06B6D4",
    manu: "#F97316",
    eliza: "#EC4899",
    adoni: "#A855F7",
    siddig: "#14B8A6",
    renner: "#84CC16",
    clarke: "#64748B",
    kogan: "#D946EF",
    reed: "#0EA5E9",
    renic: "#78716C",
    samantha: "#FF00FF",
};

const FALLBACK_COLOR = "#94a3b8";

function agentColor(name: string): string {
    return AGENT_COLORS[name.toLowerCase()] || FALLBACK_COLOR;
}

// --- Time Formatting ---

function formatRelativeTime(isoUtc: string): string {
    const then = new Date(isoUtc);
    const now = new Date();
    const diffMs = now.getTime() - then.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin} min ago`;
    if (diffHr < 24) {
        // Show time today: "2:31 PM"
        return then.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    }
    if (diffDay === 1) {
        return "Yesterday " + then.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    }
    if (diffDay < 7) {
        const day = then.toLocaleDateString(undefined, { weekday: "short" });
        const time = then.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
        return `${day} ${time}`;
    }
    return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// --- GitHub Link Derivation ---

function deriveCommitUrl(projectDir: string | null, hash: string): string | null {
    if (!projectDir || !hash) return null;
    // Extract repo name from project_dir
    // "/Users/erikflowers/claude projects/matilda/agent-renner" → "matilda"
    // "/Users/erikflowers/claude projects/fictioneer" → "fictioneer"
    const match = projectDir.match(/\/claude projects\/([^/]+)/);
    if (!match) return null;
    const repo = match[1];
    return `https://github.com/erikaflowers/${repo}/commit/${hash}`;
}

// --- Data Fetching ---

const FLEET_QUERY = `SELECT agent_name, timestamp, summary, last_commit_hash, last_commit_msg, project_dir FROM agent_logs ORDER BY id DESC LIMIT ${MAX_ENTRIES};`;

async function fetchFleetEntries(): Promise<FleetEntry[]> {
    const cmd = `/usr/bin/sqlite3 -json ${DB_PATH} "${FLEET_QUERY}"`;
    const result = await getApi().execCommand(cmd);
    if (!result.stdout || result.stdout.trim() === "") return [];
    try {
        return JSON.parse(result.stdout);
    } catch (e) {
        console.error("[fleetlog] Failed to parse sqlite output:", e, result.stdout?.slice(0, 200));
        return [];
    }
}

// --- ViewModel ---

class FleetLogViewModel implements ViewModel {
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
        this.viewType = "fleetlog";
        this.blockId = blockId;
        this.nodeModel = nodeModel;
        this.tabModel = tabModel;
        this.blockAtom = WOS.getWaveObjectAtom<Block>(`block:${blockId}`);
        this.viewIcon = jotai.atom("satellite-dish");
        this.viewName = jotai.atom("Fleet");
        this.viewComponent = FleetLogView;
        this.endIconButtons = jotai.atom<IconButtonDecl[]>([]);
    }
}

// --- Components ---

const CommitBadge = React.memo(
    ({ hash, commitMsg, projectDir }: { hash: string; commitMsg: string | null; projectDir: string | null }) => {
        const url = deriveCommitUrl(projectDir, hash);
        const shortHash = hash.slice(0, 7);

        const badge = (
            <span
                className="text-[10px] font-mono"
                style={{
                    padding: "1px 6px",
                    borderRadius: 3,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "var(--secondary-text-color)",
                    cursor: url ? "pointer" : "default",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                }}
                title={commitMsg || shortHash}
            >
                {shortHash}
                {commitMsg && (
                    <span style={{ fontFamily: "inherit", opacity: 0.7, maxWidth: 200 }} className="truncate">
                        {commitMsg}
                    </span>
                )}
                {url && (
                    <i className="fa-sharp fa-solid fa-arrow-up-right-from-square" style={{ fontSize: 8, opacity: 0.5 }} />
                )}
            </span>
        );

        if (url) {
            return (
                <span onClick={() => getApi().openExternal(url)} style={{ cursor: "pointer" }}>
                    {badge}
                </span>
            );
        }
        return badge;
    }
);
CommitBadge.displayName = "CommitBadge";

const FleetEntryCard = React.memo(({ entry }: { entry: FleetEntry }) => {
    const [expanded, setExpanded] = React.useState(false);
    const color = agentColor(entry.agent_name);

    // Determine if summary needs truncation
    const lines = entry.summary.split("\n");
    const needsTruncation = lines.length > SUMMARY_LINE_LIMIT;
    const displayText = expanded ? entry.summary : lines.slice(0, SUMMARY_LINE_LIMIT).join("\n");
    const hasMore = needsTruncation && !expanded;

    return (
        <div
            style={{
                padding: "10px 12px",
                borderRadius: 6,
                background: "rgba(255,255,255,0.02)",
                borderLeft: `3px solid ${color}`,
                display: "flex",
                flexDirection: "column",
                gap: 6,
            }}
        >
            {/* Header: agent name + timestamp */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                        style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: color,
                            display: "inline-block",
                            flexShrink: 0,
                        }}
                    />
                    <span
                        className="text-[11px] font-bold uppercase tracking-wide"
                        style={{ color }}
                    >
                        {entry.agent_name}
                    </span>
                </div>
                <span className="text-[10px]" style={{ color: "var(--secondary-text-color)", flexShrink: 0 }}>
                    {formatRelativeTime(entry.timestamp)}
                </span>
            </div>

            {/* Summary */}
            <div
                className="text-[11px]"
                style={{
                    color: "var(--main-text-color)",
                    opacity: 0.85,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    lineHeight: 1.5,
                }}
            >
                {displayText}
                {hasMore && (
                    <span
                        onClick={() => setExpanded(true)}
                        className="text-[10px]"
                        style={{
                            color: "var(--secondary-text-color)",
                            cursor: "pointer",
                            marginLeft: 4,
                            opacity: 0.7,
                        }}
                    >
                        ...show more
                    </span>
                )}
                {expanded && needsTruncation && (
                    <span
                        onClick={() => setExpanded(false)}
                        className="text-[10px]"
                        style={{
                            color: "var(--secondary-text-color)",
                            cursor: "pointer",
                            display: "inline-block",
                            marginLeft: 4,
                            opacity: 0.7,
                        }}
                    >
                        show less
                    </span>
                )}
            </div>

            {/* Commit badge */}
            {entry.last_commit_hash && (
                <div>
                    <CommitBadge
                        hash={entry.last_commit_hash}
                        commitMsg={entry.last_commit_msg}
                        projectDir={entry.project_dir}
                    />
                </div>
            )}
        </div>
    );
});
FleetEntryCard.displayName = "FleetEntryCard";

const AgentFilterChip = React.memo(
    ({
        name,
        active,
        count,
        onToggle,
    }: {
        name: string;
        active: boolean;
        count: number;
        onToggle: () => void;
    }) => {
        const color = agentColor(name);
        return (
            <button
                onClick={onToggle}
                className="text-[10px] font-semibold uppercase"
                style={{
                    padding: "2px 8px",
                    borderRadius: 10,
                    background: active ? `${color}20` : "rgba(255,255,255,0.04)",
                    color: active ? color : "var(--secondary-text-color)",
                    border: active ? `1px solid ${color}40` : "1px solid transparent",
                    cursor: "pointer",
                    opacity: active ? 1 : 0.5,
                    transition: "all 0.15s",
                }}
            >
                {name} <span style={{ opacity: 0.6 }}>{count}</span>
            </button>
        );
    }
);
AgentFilterChip.displayName = "AgentFilterChip";

// --- Main View ---

const FleetLogView: React.FC<ViewComponentProps<FleetLogViewModel>> = ({ model }) => {
    const [entries, setEntries] = React.useState<FleetEntry[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [activeAgents, setActiveAgents] = React.useState<Set<string> | null>(null); // null = show all

    const refresh = React.useCallback(async () => {
        setLoading(true);
        const data = await fetchFleetEntries();
        setEntries(data);
        setLoading(false);
    }, []);

    React.useEffect(() => {
        refresh();
        const interval = setInterval(refresh, POLL_INTERVAL);
        return () => clearInterval(interval);
    }, [refresh]);

    // Compute agent counts
    const agentCounts = React.useMemo(() => {
        const counts = new Map<string, number>();
        for (const e of entries) {
            counts.set(e.agent_name, (counts.get(e.agent_name) || 0) + 1);
        }
        // Sort by count descending
        return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    }, [entries]);

    // Filter entries
    const filteredEntries = React.useMemo(() => {
        if (!activeAgents) return entries;
        return entries.filter((e) => activeAgents.has(e.agent_name));
    }, [entries, activeAgents]);

    const handleToggleAgent = React.useCallback(
        (name: string) => {
            setActiveAgents((prev) => {
                if (prev === null) {
                    // Currently showing all — switch to showing only this agent
                    return new Set([name]);
                }
                const next = new Set(prev);
                if (next.has(name)) {
                    next.delete(name);
                    // If nothing selected, show all
                    return next.size === 0 ? null : next;
                } else {
                    next.add(name);
                    return next;
                }
            });
        },
        []
    );

    const handleShowAll = React.useCallback(() => {
        setActiveAgents(null);
    }, []);

    return (
        <div
            className="flex flex-col overflow-hidden"
            style={{ background: "var(--block-bg-color)", flex: "1 1 0", minWidth: 0, height: "100%" }}
        >
            {/* Header */}
            <div
                className="flex items-center justify-between px-3 py-2 border-b border-white/10"
                style={{ width: "100%" }}
            >
                <div className="flex items-center gap-2">
                    <span className="text-[12px] font-semibold text-muted uppercase tracking-wider">Fleet</span>
                    <span className="text-[11px] text-muted">{filteredEntries.length} entries</span>
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

            {/* Agent filter chips */}
            {agentCounts.length > 1 && (
                <div
                    className="flex items-center gap-1.5 px-3 py-2 border-b border-white/5 flex-wrap"
                    style={{ width: "100%" }}
                >
                    <button
                        onClick={handleShowAll}
                        className="text-[10px] font-semibold"
                        style={{
                            padding: "2px 8px",
                            borderRadius: 10,
                            background: activeAgents === null ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)",
                            color: activeAgents === null ? "var(--main-text-color)" : "var(--secondary-text-color)",
                            border: "1px solid transparent",
                            cursor: "pointer",
                            opacity: activeAgents === null ? 1 : 0.5,
                        }}
                    >
                        ALL
                    </button>
                    {agentCounts.map(([name, count]) => (
                        <AgentFilterChip
                            key={name}
                            name={name}
                            count={count}
                            active={activeAgents === null || activeAgents.has(name)}
                            onToggle={() => handleToggleAgent(name)}
                        />
                    ))}
                </div>
            )}

            {/* Scrollable entry list */}
            <div
                className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-2"
                style={{ width: "100%", minWidth: 0 }}
            >
                {filteredEntries.length === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center py-12" style={{ gap: 8 }}>
                        <i
                            className="fa-sharp fa-solid fa-satellite-dish"
                            style={{ fontSize: 20, color: "var(--secondary-text-color)", opacity: 0.4 }}
                        />
                        <span className="text-[12px] text-muted">No fleet activity recorded yet.</span>
                    </div>
                )}
                {filteredEntries.map((entry, i) => (
                    <FleetEntryCard key={`${entry.timestamp}-${entry.agent_name}-${i}`} entry={entry} />
                ))}
            </div>
        </div>
    );
};

export { FleetLogViewModel };
