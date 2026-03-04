// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { getApi } from "@/app/store/global";
import { atom, type PrimitiveAtom } from "jotai";
import { globalStore } from "./jotaiStore";

interface AgentInfo {
    name: string;
    dirName: string;
    color: string;
    role: string;
    avatarPath: string;
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

export { agentsAtom, AgentColorTable, getAgentColor, getAgentInfo, loadAvatarDataUrl, MATILDA_BASE };
export type { AgentInfo };
