// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { BlockNodeModel } from "@/app/block/blocktypes";
import { createBlock, getApi, WOS } from "@/app/store/global";
import type { TabModel } from "@/app/store/tab-model";
import * as jotai from "jotai";
import * as React from "react";

// --- Types ---

type HealthFlag = "dirty" | "unpushed" | "behind" | "stale" | "detached" | "not-main";

type RepoInfo = {
    name: string;
    path: string;
    branch: string;
    isDetached: boolean;
    dirtyCount: number;
    lastCommitMsg: string;
    lastCommitAgo: string;
    lastCommitTs: number;
    lastCommitHash: string;
    remoteUrl: string;
    unpushedCount: number;
    behindCount: number;
    staleDays: number;
    health: HealthFlag[];
};

type SortKey = "name" | "branch" | "status" | "commit" | "ago" | "health";
type SortDir = "asc" | "desc";

// --- Constants ---

const SCAN_DIR = "/Users/erikflowers/claude projects";
const POLL_INTERVAL = 60000;
const STALE_THRESHOLD_DAYS = 7;

// --- Shell Command ---

const GIT_SCAN_COMMAND = `find "${SCAN_DIR}" -maxdepth 2 -type d -name ".git" 2>/dev/null | while IFS= read -r gitdir; do repo="$(dirname "$gitdir")"; echo "---REPO:$repo"; echo "BRANCH:$(git -C "$repo" symbolic-ref --short HEAD 2>/dev/null || echo DETACHED)"; echo "DIRTY:$(git -C "$repo" status --porcelain 2>/dev/null | wc -l | tr -d ' ')"; echo "MSG:$(git -C "$repo" log -1 --pretty=format:'%s' 2>/dev/null)"; echo "AGO:$(git -C "$repo" log -1 --pretty=format:'%ar' 2>/dev/null)"; echo "TS:$(git -C "$repo" log -1 --pretty=format:'%ct' 2>/dev/null)"; echo "HASH:$(git -C "$repo" log -1 --pretty=format:'%H' 2>/dev/null)"; echo "REMOTE:$(git -C "$repo" remote get-url origin 2>/dev/null)"; echo "UNPUSHED:$(git -C "$repo" log @{u}.. --oneline 2>/dev/null | wc -l | tr -d ' ')"; echo "BEHIND:$(git -C "$repo" rev-list HEAD..@{u} --count 2>/dev/null || echo 0)"; done`;

const GIT_FETCH_COMMAND = `find "${SCAN_DIR}" -maxdepth 2 -type d -name ".git" 2>/dev/null | while IFS= read -r gitdir; do repo="$(dirname "$gitdir")"; git -C "$repo" fetch --all --quiet 2>/dev/null; done`;
const FETCH_INTERVAL = 60 * 60 * 1000; // 1 hour

// --- Helpers ---

function remoteToCommitUrl(remoteUrl: string, hash: string): string | null {
    if (!remoteUrl || !hash) return null;
    // git@github.com:user/repo.git → https://github.com/user/repo/commit/HASH
    const sshMatch = remoteUrl.match(/git@github\.com:(.+?)(?:\.git)?$/);
    if (sshMatch) return `https://github.com/${sshMatch[1]}/commit/${hash}`;
    // https://github.com/user/repo.git → https://github.com/user/repo/commit/HASH
    const httpsMatch = remoteUrl.match(/https:\/\/github\.com\/(.+?)(?:\.git)?$/);
    if (httpsMatch) return `https://github.com/${httpsMatch[1]}/commit/${hash}`;
    return null;
}

// --- Parsing ---

function parseRepoOutput(stdout: string): RepoInfo[] {
    const blocks = stdout.split("---REPO:").filter((b) => b.trim());
    const repos: RepoInfo[] = [];

    for (const block of blocks) {
        const lines = block.split("\n");
        const repoPath = lines[0].trim();
        if (!repoPath) continue;

        const get = (prefix: string): string => {
            const line = lines.find((l) => l.startsWith(prefix));
            return line ? line.slice(prefix.length).trim() : "";
        };

        const branch = get("BRANCH:");
        const isDetached = branch === "DETACHED";
        const dirtyCount = parseInt(get("DIRTY:")) || 0;
        const lastCommitMsg = get("MSG:");
        const lastCommitAgo = get("AGO:");
        const lastCommitTs = parseInt(get("TS:")) || 0;
        const lastCommitHash = get("HASH:");
        const remoteUrl = get("REMOTE:");
        const unpushedCount = parseInt(get("UNPUSHED:")) || 0;
        const behindCount = parseInt(get("BEHIND:")) || 0;

        const now = Math.floor(Date.now() / 1000);
        const staleDays = lastCommitTs > 0 ? Math.floor((now - lastCommitTs) / 86400) : 0;

        const health: HealthFlag[] = [];
        if (dirtyCount > 0) health.push("dirty");
        if (unpushedCount > 0) health.push("unpushed");
        if (behindCount > 0) health.push("behind");
        if (staleDays >= STALE_THRESHOLD_DAYS) health.push("stale");
        if (isDetached) health.push("detached");
        if (!isDetached && branch !== "main") health.push("not-main");

        const name = repoPath.split("/").pop() || repoPath;

        repos.push({
            name,
            path: repoPath,
            branch: isDetached ? "HEAD detached" : branch,
            isDetached,
            dirtyCount,
            lastCommitMsg,
            lastCommitAgo,
            lastCommitTs,
            lastCommitHash,
            remoteUrl,
            unpushedCount,
            behindCount,
            staleDays,
            health,
        });
    }

    return repos;
}

// --- Sorting ---

function sortRepos(repos: RepoInfo[], key: SortKey, dir: SortDir): RepoInfo[] {
    const sorted = [...repos];
    const mult = dir === "asc" ? 1 : -1;

    sorted.sort((a, b) => {
        switch (key) {
            case "name":
                return mult * a.name.localeCompare(b.name);
            case "branch":
                return mult * a.branch.localeCompare(b.branch);
            case "status":
                return mult * (b.dirtyCount - a.dirtyCount);
            case "commit":
                return mult * (a.lastCommitMsg || "").localeCompare(b.lastCommitMsg || "");
            case "ago":
                return mult * (b.lastCommitTs - a.lastCommitTs);
            case "health":
                return mult * (b.health.length - a.health.length);
            default:
                return 0;
        }
    });

    return sorted;
}

// --- Colors ---

const healthColors: Record<HealthFlag, string> = {
    dirty: "#ef4444",
    unpushed: "#eab308",
    behind: "#a855f7",
    stale: "#f97316",
    detached: "#ef4444",
    "not-main": "#06b6d4",
};

function branchColor(branch: string, isDetached: boolean): string {
    if (isDetached) return "#ef4444";
    if (branch === "main") return "#22c55e";
    return "#06b6d4";
}

// --- ViewModel ---

class GitDashViewModel implements ViewModel {
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
        this.viewType = "gitdash";
        this.blockId = blockId;
        this.nodeModel = nodeModel;
        this.tabModel = tabModel;
        this.blockAtom = WOS.getWaveObjectAtom<Block>(`block:${blockId}`);
        this.viewIcon = jotai.atom("code-branch");
        this.viewName = jotai.atom("Git");
        this.viewComponent = GitDashView;
        this.endIconButtons = jotai.atom<IconButtonDecl[]>([]);
    }
}

// --- Components ---

const HealthBadge = React.memo(({ flag }: { flag: HealthFlag }) => {
    const color = healthColors[flag];
    return (
        <span
            style={{
                fontSize: 9,
                padding: "1px 5px",
                borderRadius: 3,
                backgroundColor: `${color}18`,
                color,
                border: `1px solid ${color}40`,
                whiteSpace: "nowrap",
            }}
        >
            {flag}
        </span>
    );
});
HealthBadge.displayName = "HealthBadge";

const SortHeader = React.memo(
    ({
        label,
        sortKey,
        currentKey,
        currentDir,
        onSort,
        style,
    }: {
        label: string;
        sortKey: SortKey;
        currentKey: SortKey;
        currentDir: SortDir;
        onSort: (key: SortKey) => void;
        style?: React.CSSProperties;
    }) => {
        const isActive = currentKey === sortKey;
        return (
            <span
                onClick={() => onSort(sortKey)}
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{
                    color: isActive ? "var(--main-text-color)" : "var(--secondary-text-color)",
                    cursor: "pointer",
                    userSelect: "none",
                    ...style,
                }}
            >
                {label} {isActive ? (currentDir === "asc" ? "\u25B2" : "\u25BC") : ""}
            </span>
        );
    }
);
SortHeader.displayName = "SortHeader";

const RepoRow = React.memo(
    ({
        repo,
        onTerminal,
        onOpen,
    }: {
        repo: RepoInfo;
        onTerminal: (path: string) => void;
        onOpen: (path: string) => void;
    }) => {
        const [hovered, setHovered] = React.useState(false);

        return (
            <div
                className="flex flex-col px-2 py-1.5 rounded-md"
                style={{
                    background: hovered ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
                    width: "100%",
                }}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
            >
                {/* Top row: repo / branch / status / ago / health / actions */}
                <div className="flex items-center gap-2" style={{ width: "100%" }}>
                    {/* Repo name */}
                    <div style={{ flex: "2.2 1 0", minWidth: 0 }} className="flex items-center gap-1.5">
                        {repo.behindCount > 0 && (
                            <span
                                className="text-[9px] font-bold flex-shrink-0"
                                style={{
                                    color: "#a855f7",
                                    backgroundColor: "#a855f718",
                                    border: "1px solid #a855f740",
                                    borderRadius: 8,
                                    padding: "0 5px",
                                    lineHeight: "16px",
                                    minWidth: 18,
                                    textAlign: "center",
                                }}
                            >
                                {repo.behindCount}
                            </span>
                        )}
                        <span
                            className="text-[12px] font-semibold truncate"
                            style={{ display: "block", color: "var(--main-text-color)" }}
                        >
                            {repo.name}
                        </span>
                    </div>

                    {/* Branch */}
                    <div style={{ flex: "1.8 1 0", minWidth: 0 }}>
                        <span
                            className="text-[11px] truncate font-mono"
                            style={{ display: "block", color: branchColor(repo.branch, repo.isDetached) }}
                        >
                            {repo.branch}
                        </span>
                    </div>

                    {/* Status */}
                    <div style={{ flex: "1.2 1 0", minWidth: 0 }}>
                        {repo.dirtyCount > 0 ? (
                            <span className="text-[11px]" style={{ color: "#ef4444" }}>
                                dirty {repo.dirtyCount}
                            </span>
                        ) : (
                            <span className="text-[11px]" style={{ color: "#22c55e" }}>
                                clean
                            </span>
                        )}
                    </div>

                    {/* Ago */}
                    <div style={{ flex: "1.2 1 0", minWidth: 0 }}>
                        <span className="text-[11px] text-muted">
                            {repo.lastCommitAgo ? repo.lastCommitAgo.replace(" ago", "") : ""}
                        </span>
                    </div>

                    {/* Health */}
                    <div
                        style={{ flex: "1.5 1 0", minWidth: 0 }}
                        className="flex items-center gap-1 flex-wrap"
                    >
                        {repo.health.length === 0 ? (
                            <span className="text-[11px]" style={{ color: "#22c55e" }}>
                                ok
                            </span>
                        ) : (
                            repo.health.map((flag) => <HealthBadge key={flag} flag={flag} />)
                        )}
                    </div>

                    {/* Actions (visible on hover) */}
                    <div
                        className="flex gap-1 flex-shrink-0"
                        style={{ width: 56, opacity: hovered ? 1 : 0, transition: "opacity 0.15s" }}
                    >
                        <button
                            onClick={() => onTerminal(repo.path)}
                            className="px-1.5 py-0.5 text-[10px] rounded"
                            style={{
                                background: "rgba(255,255,255,0.08)",
                                color: "var(--main-text-color)",
                                border: "1px solid rgba(255,255,255,0.15)",
                                cursor: "pointer",
                            }}
                            title={`Open terminal in ${repo.name}`}
                        >
                            <i className="fa-sharp fa-solid fa-terminal" />
                        </button>
                        <button
                            onClick={() => onOpen(repo.path)}
                            className="px-1.5 py-0.5 text-[10px] rounded"
                            style={{
                                background: "rgba(255,255,255,0.08)",
                                color: "var(--main-text-color)",
                                border: "1px solid rgba(255,255,255,0.15)",
                                cursor: "pointer",
                            }}
                            title={`Open ${repo.name} in Finder`}
                        >
                            <i className="fa-sharp fa-solid fa-folder-open" />
                        </button>
                    </div>
                </div>

                {/* Bottom row: last commit message */}
                <div
                    className="flex items-center gap-1.5"
                    style={{ width: "100%", marginTop: 1, minWidth: 0 }}
                >
                    <span
                        className="text-[10px] text-muted truncate"
                        style={{ opacity: 0.6, flex: 1, minWidth: 0 }}
                    >
                        {repo.lastCommitMsg || "no commits"}
                    </span>
                    {(() => {
                        const commitUrl = remoteToCommitUrl(repo.remoteUrl, repo.lastCommitHash);
                        if (!commitUrl) return null;
                        return (
                            <button
                                onClick={() => getApi().openExternal(commitUrl)}
                                className="flex-shrink-0"
                                style={{
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    padding: 0,
                                    color: "var(--secondary-text-color)",
                                    opacity: hovered ? 0.7 : 0,
                                    transition: "opacity 0.15s",
                                    fontSize: 10,
                                    lineHeight: 1,
                                }}
                                title="View commit on GitHub"
                            >
                                <i className="fa-sharp fa-solid fa-arrow-up-right-from-square" />
                            </button>
                        );
                    })()}
                </div>
            </div>
        );
    }
);
RepoRow.displayName = "RepoRow";

// --- Main View ---

const GitDashView: React.FC<ViewComponentProps<GitDashViewModel>> = ({ model }) => {
    const [repos, setRepos] = React.useState<RepoInfo[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [fetching, setFetching] = React.useState(false);
    const [lastFetchTime, setLastFetchTime] = React.useState<number | null>(null);
    const [sortKey, setSortKey] = React.useState<SortKey>("ago");
    const [sortDir, setSortDir] = React.useState<SortDir>("desc");

    const refreshRepos = React.useCallback(async () => {
        setLoading(true);
        try {
            const result = await getApi().execCommand(GIT_SCAN_COMMAND);
            const parsed = parseRepoOutput(result.stdout);
            setRepos(parsed);
        } catch (e) {
            console.error("Failed to refresh git repos:", e);
        }
        setLoading(false);
    }, []);

    const fetchAndRefresh = React.useCallback(async () => {
        setFetching(true);
        try {
            await getApi().execCommand(GIT_FETCH_COMMAND);
            setLastFetchTime(Date.now());
        } catch (e) {
            console.error("Failed to fetch repos:", e);
        }
        await refreshRepos();
        setFetching(false);
    }, [refreshRepos]);

    // Quick scan on mount + poll every 60s
    React.useEffect(() => {
        refreshRepos();
        const interval = setInterval(refreshRepos, POLL_INTERVAL);
        return () => clearInterval(interval);
    }, [refreshRepos]);

    // Fetch on mount + hourly
    React.useEffect(() => {
        fetchAndRefresh();
        const interval = setInterval(fetchAndRefresh, FETCH_INTERVAL);
        return () => clearInterval(interval);
    }, [fetchAndRefresh]);

    const handleSort = React.useCallback(
        (key: SortKey) => {
            if (key === sortKey) {
                setSortDir((d) => (d === "asc" ? "desc" : "asc"));
            } else {
                setSortKey(key);
                setSortDir("asc");
            }
        },
        [sortKey]
    );

    const sortedRepos = React.useMemo(() => sortRepos(repos, sortKey, sortDir), [repos, sortKey, sortDir]);

    const handleTerminal = React.useCallback(async (repoPath: string) => {
        const blockDef: BlockDef = {
            meta: {
                view: "term",
                controller: "shell",
                "cmd:cwd": repoPath,
            },
        };
        await createBlock(blockDef);
    }, []);

    const handleOpen = React.useCallback(async (repoPath: string) => {
        await getApi().execCommand(`open "${repoPath}"`);
    }, []);

    // Summary stats
    const dirtyCount = repos.filter((r) => r.dirtyCount > 0).length;
    const unpushedCount = repos.filter((r) => r.unpushedCount > 0).length;
    const behindCount = repos.filter((r) => r.behindCount > 0).length;
    const staleCount = repos.filter((r) => r.staleDays >= STALE_THRESHOLD_DAYS).length;

    return (
        <div
            className="flex flex-col overflow-hidden"
            style={{ background: "var(--block-bg-color)", flex: "1 1 0", minWidth: 0, height: "100%", alignSelf: "stretch" }}
        >
            {/* Header */}
            <div
                className="flex items-center justify-between px-3 py-2 border-b border-white/10"
                style={{ width: "100%" }}
            >
                <div className="flex items-center gap-2">
                    <span className="text-[12px] font-semibold text-muted uppercase tracking-wider">Git</span>
                    <span className="text-[11px] text-muted">{repos.length} tracked</span>
                </div>
                <div className="flex items-center gap-1.5">
                    {lastFetchTime && (
                        <span className="text-[10px] text-muted" style={{ opacity: 0.5 }}>
                            fetched {Math.round((Date.now() - lastFetchTime) / 60000)}m ago
                        </span>
                    )}
                    <button
                        onClick={fetchAndRefresh}
                        className="text-[11px] text-muted hover:text-white px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(255,255,255,0.05)", cursor: "pointer", border: "none" }}
                        title="Fetch all remotes"
                    >
                        <i className={`fa-sharp fa-solid fa-cloud-arrow-down ${fetching ? "fa-spin" : ""}`} />
                    </button>
                    <button
                        onClick={refreshRepos}
                        className="text-[11px] text-muted hover:text-white px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(255,255,255,0.05)", cursor: "pointer", border: "none" }}
                        title="Refresh"
                    >
                        <i className={`fa-sharp fa-solid fa-arrows-rotate ${loading ? "fa-spin" : ""}`} />
                    </button>
                </div>
            </div>

            {/* Column headers */}
            <div
                className="flex items-center gap-2 px-2 py-1.5 border-b border-white/5"
                style={{ width: "100%" }}
            >
                <div style={{ flex: "2.2 1 0", minWidth: 0 }}>
                    <SortHeader label="Repo" sortKey="name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                </div>
                <div style={{ flex: "1.8 1 0", minWidth: 0 }}>
                    <SortHeader label="Branch" sortKey="branch" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                </div>
                <div style={{ flex: "1.2 1 0", minWidth: 0 }}>
                    <SortHeader label="Status" sortKey="status" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                </div>
                <div style={{ flex: "1.2 1 0", minWidth: 0 }}>
                    <SortHeader label="Ago" sortKey="ago" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                </div>
                <div style={{ flex: "1.5 1 0", minWidth: 0 }}>
                    <SortHeader label="Health" sortKey="health" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                </div>
                <div style={{ width: 56 }} />
            </div>

            {/* Scrollable repo list */}
            <div
                className="flex-1 overflow-y-auto px-2 py-1 flex flex-col gap-0.5"
                style={{ width: "100%", minWidth: 0 }}
            >
                {repos.length === 0 && !loading && (
                    <div className="flex items-center justify-center py-8">
                        <span className="text-[12px] text-muted">No git repos found.</span>
                    </div>
                )}
                {sortedRepos.map((repo) => (
                    <RepoRow
                        key={repo.path}
                        repo={repo}
                        onTerminal={handleTerminal}
                        onOpen={handleOpen}
                    />
                ))}
            </div>

            {/* Footer summary */}
            {repos.length > 0 && (
                <div
                    className="flex items-center gap-3 px-3 py-2 border-t border-white/10"
                    style={{ width: "100%" }}
                >
                    {dirtyCount > 0 && (
                        <span className="text-[11px]" style={{ color: "#ef4444" }}>
                            {dirtyCount} dirty
                        </span>
                    )}
                    {unpushedCount > 0 && (
                        <span className="text-[11px]" style={{ color: "#eab308" }}>
                            {unpushedCount} unpushed
                        </span>
                    )}
                    {behindCount > 0 && (
                        <span className="text-[11px]" style={{ color: "#a855f7" }}>
                            {behindCount} behind
                        </span>
                    )}
                    {staleCount > 0 && (
                        <span className="text-[11px]" style={{ color: "#f97316" }}>
                            {staleCount} stale
                        </span>
                    )}
                    <span className="text-[11px] text-muted" style={{ marginLeft: "auto" }}>
                        {repos.length} repos
                    </span>
                </div>
            )}
        </div>
    );
};

export { GitDashViewModel };
