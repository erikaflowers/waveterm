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
    art: { color: "#FBBF24", role: "Art Direction" },
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
    return `${MATILDA_BASE}/agent-art/${capitalized}.jpg`;
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
        avatarCache.set(filePath, dataUrl);
        avatarLoadingPromises.delete(filePath);
        return dataUrl;
    }).catch(() => {
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

// Load prefs on module init
loadAgentPreferences();

// --- Tmux Session Switching via ForceRestart ---

async function forceRestartWithAgent(blockId: string, agentName: string | null): Promise<void> {
    const tabId = globalStore.get(atoms.staticTabId);
    const tmux = "/opt/homebrew/bin/tmux";

    // Set initscript: tmux attach for agents, null for bare shell
    const initScript = agentName
        ? `${tmux} attach -t ${agentName.toLowerCase()}\n`
        : null;

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
    forceRestartWithAgent,
    getAgentColor,
    getAgentInfo,
    getAgentPrefs,
    loadAgentPreferences,
    loadAvatarDataUrl,
    MATILDA_BASE,
    setAgentPref,
};
export type { AgentInfo };
