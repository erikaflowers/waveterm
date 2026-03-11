// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { atoms, getApi, WOS } from "@/app/store/global";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { atom, type PrimitiveAtom } from "jotai";
import { globalStore } from "./jotaiStore";

interface AgentInfo {
    name: string;
    dirName: string;
    color: string;
    role: string;
    avatarPath: string;
    defaultTheme: string;
}

interface RemoteConfig {
    remoteHost: string | null;
    remoteTmuxPath: string | null;
    repoBasePath: string | null;
}

const DEFAULT_REPO_BASE = "/Users/erikflowers/claude projects";

const remoteConfigAtom = atom<RemoteConfig>({ remoteHost: null, remoteTmuxPath: null, repoBasePath: null });

// Base path for Matilda agent directories
const MATILDA_BASE = "/Users/erikflowers/claude projects/matilda";

// Agent color table — hardcoded from the Matilda crew manifest
const AgentColorTable: Record<string, { color: string; role: string }> = {
    julian: { color: "#6366F1", role: "Orchestrator" },
    heavy: { color: "#22C55E", role: "Frontend" },
    decker: { color: "#F59E0B", role: "Prose IDE" },
    sellivan: { color: "#8B5CF6", role: "Repo & Docs" },
    qin: { color: "#EF4444", role: "Code Auditor" },
    lee: { color: "#06B6D4", role: "Marketing" },
    manu: { color: "#F97316", role: "Operations" },
    eliza: { color: "#EC4899", role: "Hard Problems" },
    adoni: { color: "#A855F7", role: "Ghostwriter" },
    siddig: { color: "#14B8A6", role: "Backend" },
    renner: { color: "#84CC16", role: "Tool Hacker" },
    clarke: { color: "#64748B", role: "Research" },
    kogan: { color: "#D946EF", role: "Security" },
    reed: { color: "#0EA5E9", role: "Intelligence" },
    renic: { color: "#78716C", role: "DevOps" },
    samantha: { color: "#FF00FF", role: "Systems Auteur" },
};

// Crew themes defined in ~/.config/terminus-dev/termthemes.json
// Convention: "crew-{lowercase_name}"
const CREW_THEME_AGENTS = new Set([
    "julian", "heavy", "decker", "sellivan", "qin",
    "lee", "manu", "eliza", "siddig", "samantha",
]);

function getDefaultTheme(name: string): string {
    const key = name.toLowerCase();
    if (CREW_THEME_AGENTS.has(key)) {
        return `crew-${key}`;
    }
    return "default-dark";
}

function getAvatarPath(name: string): string {
    const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
    return `${MATILDA_BASE}/portraits/${capitalized}.jpg`;
}

function buildStaticAgentList(): AgentInfo[] {
    return Object.entries(AgentColorTable).map(([key, val]) => ({
        name: key.charAt(0).toUpperCase() + key.slice(1),
        dirName: `agent-${key}`,
        color: val.color,
        role: val.role,
        avatarPath: getAvatarPath(key),
        defaultTheme: getDefaultTheme(key),
    }));
}

const agentsAtom: PrimitiveAtom<AgentInfo[]> = atom(buildStaticAgentList()) as PrimitiveAtom<AgentInfo[]>;

// Cache for loaded avatar data URLs
const avatarCache = new Map<string, string | null>();
const avatarLoadingPromises = new Map<string, Promise<string | null>>();

async function loadAvatarDataUrl(filePath: string): Promise<string | null> {
    if (avatarCache.has(filePath)) {
        return avatarCache.get(filePath);
    }
    if (avatarLoadingPromises.has(filePath)) {
        return avatarLoadingPromises.get(filePath);
    }
    const promise = getApi().readFileBase64(filePath).then((dataUrl) => {
        if (!dataUrl) {
            console.warn(`[avatars] readFileBase64 returned null for: ${filePath}`);
        }
        avatarCache.set(filePath, dataUrl);
        avatarLoadingPromises.delete(filePath);
        return dataUrl;
    }).catch((e) => {
        console.warn(`[avatars] failed to load: ${filePath}`, e);
        avatarCache.set(filePath, null);
        avatarLoadingPromises.delete(filePath);
        return null;
    });
    avatarLoadingPromises.set(filePath, promise);
    return promise;
}

function getAgentInfo(name: string): AgentInfo | null {
    if (!name) return null;
    const agents = globalStore.get(agentsAtom);
    return agents.find((a) => a.name.toLowerCase() === name.toLowerCase()) ?? null;
}

function getAgentColor(name: string): string | null {
    const info = getAgentInfo(name);
    return info?.color ?? null;
}

// --- Per-Agent Preference Persistence ---

type AgentPrefs = Record<string, string | null>;
const agentPrefsMap = new Map<string, AgentPrefs>();
let prefsLoaded = false;

function getPrefsFilePath(): string {
    return getApi().getConfigDir() + "/agent-preferences.json";
}

async function loadAgentPreferences(): Promise<void> {
    if (prefsLoaded) return;
    try {
        const content = await getApi().readTextFile(getPrefsFilePath());
        if (content) {
            const parsed = JSON.parse(content) as Record<string, AgentPrefs>;
            for (const [key, prefs] of Object.entries(parsed)) {
                agentPrefsMap.set(key, prefs);
            }
        }
    } catch {
        // File doesn't exist yet or parse error — start with empty prefs
    }
    // Populate remote config from _global key
    const globalPrefs = agentPrefsMap.get("_global") ?? {};
    globalStore.set(remoteConfigAtom, {
        remoteHost: globalPrefs["remoteHost"] ?? null,
        remoteTmuxPath: globalPrefs["remoteTmuxPath"] ?? null,
        repoBasePath: globalPrefs["repoBasePath"] ?? null,
    });
    prefsLoaded = true;
}

async function saveAgentPreferences(): Promise<void> {
    const obj: Record<string, AgentPrefs> = {};
    for (const [key, prefs] of agentPrefsMap.entries()) {
        if (Object.keys(prefs).length > 0) {
            obj[key] = prefs;
        }
    }
    const json = JSON.stringify(obj, null, 2);
    await getApi().writeTextFile(getPrefsFilePath(), json);
}

function getAgentPrefs(agentName: string): AgentPrefs {
    return agentPrefsMap.get(agentName.toLowerCase()) ?? {};
}

async function setAgentPref(agentName: string, key: string, value: string | null): Promise<void> {
    const name = agentName.toLowerCase();
    const prefs = agentPrefsMap.get(name) ?? {};
    if (value == null) {
        delete prefs[key];
    } else {
        prefs[key] = value;
    }
    agentPrefsMap.set(name, prefs);
    await saveAgentPreferences();
}

function getRemoteConfig(): RemoteConfig {
    return globalStore.get(remoteConfigAtom);
}

function getRepoBasePath(): string {
    const config = globalStore.get(remoteConfigAtom);
    return config.repoBasePath ?? DEFAULT_REPO_BASE;
}

async function setRemoteConfig(partial: Partial<RemoteConfig>): Promise<void> {
    const current = globalStore.get(remoteConfigAtom);
    const updated: RemoteConfig = { ...current, ...partial };
    globalStore.set(remoteConfigAtom, updated);
    // Clear remote tmux cache so it re-resolves for new host
    if ("remoteHost" in partial || "remoteTmuxPath" in partial) {
        resolvedRemoteTmuxPath = null;
        if (updated.remoteHost && !updated.remoteTmuxPath) {
            resolveRemoteTmuxPath();
        }
    }
    // Persist to _global key in prefs file
    const globalPrefs = agentPrefsMap.get("_global") ?? {};
    if (updated.remoteHost != null) {
        globalPrefs["remoteHost"] = updated.remoteHost;
    } else {
        delete globalPrefs["remoteHost"];
    }
    if (updated.remoteTmuxPath != null) {
        globalPrefs["remoteTmuxPath"] = updated.remoteTmuxPath;
    } else {
        delete globalPrefs["remoteTmuxPath"];
    }
    if (updated.repoBasePath != null) {
        globalPrefs["repoBasePath"] = updated.repoBasePath;
    } else {
        delete globalPrefs["repoBasePath"];
    }
    agentPrefsMap.set("_global", globalPrefs);
    await saveAgentPreferences();
}

// Load prefs on module init
loadAgentPreferences();

// --- Tmux Path Resolution (Local + Remote) ---

// Local tmux path — resolved once on the machine running Terminus
let resolvedLocalTmuxPath: string | null = null;

async function resolveLocalTmuxPath(): Promise<string> {
    if (resolvedLocalTmuxPath) return resolvedLocalTmuxPath;
    const candidates = ["/opt/homebrew/bin/tmux", "/usr/local/bin/tmux", "/usr/bin/tmux"];
    for (const p of candidates) {
        try {
            const result = await getApi().execCommand(`test -x ${p} && echo ok`);
            if (result.stdout?.trim() === "ok") {
                resolvedLocalTmuxPath = p;
                return p;
            }
        } catch {
            // continue
        }
    }
    try {
        const result = await getApi().execCommand("which tmux");
        const path = result.stdout?.trim();
        if (path) {
            resolvedLocalTmuxPath = path;
            return path;
        }
    } catch {
        // continue
    }
    resolvedLocalTmuxPath = "tmux";
    return "tmux";
}

function getTmuxPath(): string {
    return resolvedLocalTmuxPath ?? "tmux";
}

// Remote tmux path — resolved via SSH when remoteHost is configured
let resolvedRemoteTmuxPath: string | null = null;
const REMOTE_TMUX_FALLBACK = "/opt/homebrew/bin/tmux";

async function resolveRemoteTmuxPath(): Promise<string> {
    const remote = getRemoteConfig();
    if (!remote?.remoteHost) {
        resolvedRemoteTmuxPath = null;
        return REMOTE_TMUX_FALLBACK;
    }
    try {
        const result = await getApi().execCommand(`ssh ${remote.remoteHost} "which tmux"`);
        const path = result.stdout?.trim();
        if (path) {
            resolvedRemoteTmuxPath = path;
            return path;
        }
    } catch {
        // SSH failed or tmux not found
    }
    resolvedRemoteTmuxPath = REMOTE_TMUX_FALLBACK;
    return REMOTE_TMUX_FALLBACK;
}

function getRemoteTmuxPath(): string {
    const remote = getRemoteConfig();
    // User override > auto-detected > fallback
    return remote?.remoteTmuxPath ?? resolvedRemoteTmuxPath ?? REMOTE_TMUX_FALLBACK;
}

// Single helper: returns the correct tmux path for the current mode
function getTmuxCmd(): string {
    const remote = getRemoteConfig();
    if (remote?.remoteHost) {
        return getRemoteTmuxPath();
    }
    return getTmuxPath();
}

// Resolve local on module load
resolveLocalTmuxPath();

// --- Tmux Session Switching via ForceRestart ---

async function forceRestartWithAgent(blockId: string, agentName: string | null): Promise<void> {
    const tabId = globalStore.get(atoms.staticTabId);
    const remote = getRemoteConfig();
    const tmux = getTmuxCmd();

    let initScript: string | null = null;
    if (agentName) {
        const session = agentName.toLowerCase();
        if (remote?.remoteHost) {
            initScript = `ssh ${remote.remoteHost} -t "${tmux} attach -t ${session}"\n`;
        } else {
            initScript = `${tmux} attach -t ${session}\n`;
        }
    }

    await RpcApi.SetMetaCommand(TabRpcClient, {
        oref: WOS.makeORef("block", blockId),
        meta: { "cmd:initscript.zsh": initScript },
    });

    await RpcApi.ControllerResyncCommand(TabRpcClient, {
        tabid: tabId,
        blockid: blockId,
        forcerestart: true,
    });
}

export {
    agentsAtom,
    AgentColorTable,
    DEFAULT_REPO_BASE,
    forceRestartWithAgent,
    getAgentColor,
    getAgentInfo,
    getAgentPrefs,
    getRemoteConfig,
    getRemoteTmuxPath,
    getRepoBasePath,
    getTmuxCmd,
    getTmuxPath,
    loadAgentPreferences,
    loadAvatarDataUrl,
    MATILDA_BASE,
    remoteConfigAtom,
    resolveRemoteTmuxPath,
    setAgentPref,
    setRemoteConfig,
};
export type { AgentInfo, RemoteConfig };
