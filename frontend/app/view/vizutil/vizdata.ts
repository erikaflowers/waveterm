// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

// Shared data fetching for visualizer panels

import { getApi } from "@/app/store/global";

const FLEET_DB = "~/.claude/hooks/fleet-log.db";
const HOPPER_INBOX = "~/.claude/hooks/hopper-inbox.jsonl";
const FLEET_POLL_MS = 30_000;
const HOPPER_POLL_MS = 10_000;

// --- Fleet Log Data ---

export interface FleetFragment {
    agentName: string;
    commitHash?: string;
    summary?: string;
}

let fleetCache: FleetFragment[] = [];
let fleetTimer: ReturnType<typeof setInterval> | null = null;
let fleetListeners = 0;

async function pollFleet(): Promise<void> {
    try {
        const cmd = `/usr/bin/sqlite3 -json '${FLEET_DB}' "SELECT agent_name, last_commit_hash, summary FROM agent_logs ORDER BY id DESC LIMIT 30"`;
        const result = await getApi().execCommand(cmd);
        if (result.stdout) {
            const rows = JSON.parse(result.stdout);
            fleetCache = rows.map((r: any) => ({
                agentName: r.agent_name || "",
                commitHash: r.last_commit_hash || undefined,
                summary: r.summary || undefined,
            }));
        }
    } catch {
        // silent
    }
}

export function subscribeFleet(): () => void {
    fleetListeners++;
    if (fleetListeners === 1) {
        pollFleet();
        fleetTimer = setInterval(pollFleet, FLEET_POLL_MS);
    }
    return () => {
        fleetListeners--;
        if (fleetListeners === 0 && fleetTimer) {
            clearInterval(fleetTimer);
            fleetTimer = null;
        }
    };
}

export function getFleetFragments(): FleetFragment[] {
    return fleetCache;
}

// --- Hopper Inbox Data ---

export interface InboxEntry {
    from: string;
    to?: string;
    signal?: string;
    payload?: string;
    ts: string;
}

let inboxCache: InboxEntry[] = [];
let inboxTimer: ReturnType<typeof setInterval> | null = null;
let inboxListeners = 0;

async function pollInbox(): Promise<void> {
    try {
        const cmd = `tail -50 ${HOPPER_INBOX} 2>/dev/null`;
        const result = await getApi().execCommand(cmd);
        if (result.stdout) {
            const lines = result.stdout.trim().split("\n").filter(Boolean);
            inboxCache = lines
                .map((line) => {
                    try {
                        return JSON.parse(line) as InboxEntry;
                    } catch {
                        return null;
                    }
                })
                .filter(Boolean);
        }
    } catch {
        // silent
    }
}

export function subscribeInbox(): () => void {
    inboxListeners++;
    if (inboxListeners === 1) {
        pollInbox();
        inboxTimer = setInterval(pollInbox, HOPPER_POLL_MS);
    }
    return () => {
        inboxListeners--;
        if (inboxListeners === 0 && inboxTimer) {
            clearInterval(inboxTimer);
            inboxTimer = null;
        }
    };
}

export function getInboxEntries(): InboxEntry[] {
    return inboxCache;
}

// --- Conversation Messages (for hex dump / matrix) ---

let convCache: string[] = [];
let convTimer: ReturnType<typeof setInterval> | null = null;
let convListeners = 0;

async function pollConversations(): Promise<void> {
    try {
        const cmd = `/usr/bin/sqlite3 -json '${FLEET_DB}' "SELECT content FROM conversation_messages ORDER BY timestamp DESC LIMIT 20"`;
        const result = await getApi().execCommand(cmd);
        if (result.stdout) {
            const rows = JSON.parse(result.stdout);
            convCache = rows.map((r: any) => r.content || "").filter(Boolean);
        }
    } catch {
        // silent
    }
}

export function subscribeConversations(): () => void {
    convListeners++;
    if (convListeners === 1) {
        pollConversations();
        convTimer = setInterval(pollConversations, FLEET_POLL_MS);
    }
    return () => {
        convListeners--;
        if (convListeners === 0 && convTimer) {
            clearInterval(convTimer);
            convTimer = null;
        }
    };
}

export function getConversationTexts(): string[] {
    return convCache;
}
