// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { getApi } from "@/app/store/global";
import { getAtoms } from "@/app/store/global-atoms";
import type { WaveConfigViewModel } from "@/app/view/waveconfig/waveconfig-model";
import { useAtom, useAtomValue } from "jotai";
import { memo, useCallback, useEffect, useState } from "react";

interface SettingsSectionProps {
    title: string;
    children: React.ReactNode;
}

const SettingsSection = memo(({ title, children }: SettingsSectionProps) => {
    return (
        <div className="flex flex-col gap-1 mb-6">
            <h3 className="text-sm font-semibold text-secondary uppercase tracking-wider mb-2 px-1">{title}</h3>
            <div className="flex flex-col gap-3">{children}</div>
        </div>
    );
});
SettingsSection.displayName = "SettingsSection";

interface NumberSettingProps {
    label: string;
    description?: string;
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    suffix?: string;
}

const NumberSetting = memo(({ label, description, value, onChange, min, max, suffix }: NumberSettingProps) => {
    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const raw = e.target.value;
            if (raw === "") return;
            const num = parseInt(raw, 10);
            if (isNaN(num)) return;
            if (min != null && num < min) return;
            if (max != null && num > max) return;
            onChange(num);
        },
        [onChange, min, max]
    );

    return (
        <div className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-secondary/20 transition-colors">
            <div className="flex flex-col">
                <span className="text-sm font-medium">{label}</span>
                {description && <span className="text-xs text-muted mt-0.5">{description}</span>}
            </div>
            <div className="flex items-center gap-1.5">
                <input
                    type="number"
                    value={value}
                    onChange={handleChange}
                    min={min}
                    max={max}
                    className="w-16 px-2 py-1 text-sm text-right bg-background border border-border rounded focus:outline-none focus:border-accent"
                />
                {suffix && <span className="text-xs text-muted">{suffix}</span>}
            </div>
        </div>
    );
});
NumberSetting.displayName = "NumberSetting";

interface ColorSettingProps {
    label: string;
    description?: string;
    value: string;
    onChange: (value: string) => void;
}

const ColorSetting = memo(({ label, description, value, onChange }: ColorSettingProps) => {
    const handleTextChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            onChange(e.target.value);
        },
        [onChange]
    );

    return (
        <div className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-secondary/20 transition-colors">
            <div className="flex flex-col">
                <span className="text-sm font-medium">{label}</span>
                {description && <span className="text-xs text-muted mt-0.5">{description}</span>}
            </div>
            <div className="flex items-center gap-2">
                <div
                    className="w-6 h-6 rounded border border-border shrink-0"
                    style={{ backgroundColor: value || "transparent" }}
                />
                <input
                    type="text"
                    value={value}
                    onChange={handleTextChange}
                    placeholder="e.g. fuchsia, #ff00ff"
                    className="w-32 px-2 py-1 text-sm bg-background border border-border rounded focus:outline-none focus:border-accent"
                />
            </div>
        </div>
    );
});
ColorSetting.displayName = "ColorSetting";

type CloudAuthStatus = {
    loggedIn: boolean;
    email?: string;
    name?: string;
    picture?: string;
    syncEnabled?: boolean;
};

type DeviceInfo = {
    machine_id: string;
    device_name: string;
    os: string;
    last_sync_at: string;
    created_at: string;
};

const AccountSection = memo(() => {
    const [authStatus, setAuthStatus] = useState<CloudAuthStatus | null>(null);
    const [devices, setDevices] = useState<DeviceInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [showDevices, setShowDevices] = useState(false);
    const [lastSynced, setLastSynced] = useState<string | null>(null);

    const refreshStatus = useCallback(async () => {
        const status = await getApi().terminusAuthStatus();
        setAuthStatus(status);
        if (status.loggedIn) {
            const devResult = await getApi().terminusDevices();
            if (devResult.ok && devResult.devices) {
                setDevices(devResult.devices);
            }
        }
    }, []);

    useEffect(() => {
        refreshStatus();
    }, [refreshStatus]);

    const handleLogin = useCallback(async () => {
        setLoading(true);
        try {
            const result = await getApi().terminusAuthLogin();
            if (result.ok) {
                await refreshStatus();
                // After login: pull cloud configs (writes to disk via IPC handler)
                // If cloud is empty, seed it with local configs
                const pullResult = await getApi().terminusSyncPull();
                if (pullResult.ok) {
                    if (pullResult.updated_at) {
                        setLastSynced(pullResult.updated_at);
                    } else {
                        // Cloud is empty — push local configs to seed it
                        const configDir = getApi().getConfigDir();
                        const syncKeys = ["settings", "connections", "widgets", "agents"];
                        const configs: Record<string, any> = {};
                        for (const key of syncKeys) {
                            try {
                                const raw = await getApi().readTextFile(configDir + "/" + key + ".json");
                                if (raw) configs[key] = JSON.parse(raw);
                            } catch {
                                // skip missing files
                            }
                        }
                        if (Object.keys(configs).length > 0) {
                            const pushResult = await getApi().terminusSyncPush(configs);
                            if (pushResult.ok) setLastSynced(pushResult.updated_at);
                        }
                    }
                }
            }
        } finally {
            setLoading(false);
        }
    }, [refreshStatus]);

    const handleLogout = useCallback(async () => {
        await getApi().terminusAuthLogout();
        setAuthStatus({ loggedIn: false });
        setDevices([]);
    }, []);

    const handleSyncToggle = useCallback(async () => {
        if (!authStatus) return;
        const newVal = !authStatus.syncEnabled;
        await getApi().terminusSyncToggle(newVal);
        setAuthStatus((prev) => (prev ? { ...prev, syncEnabled: newVal } : prev));
    }, [authStatus]);

    const handlePull = useCallback(async () => {
        setLoading(true);
        try {
            const result = await getApi().terminusSyncPull();
            if (result.ok && result.updated_at) {
                setLastSynced(result.updated_at);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    const handlePush = useCallback(async () => {
        setLoading(true);
        try {
            const configDir = getApi().getConfigDir();
            const syncKeys = ["settings", "connections", "widgets", "agents"];
            const configs: Record<string, any> = {};
            for (const key of syncKeys) {
                try {
                    const raw = await getApi().readTextFile(configDir + "/" + key + ".json");
                    if (raw) configs[key] = JSON.parse(raw);
                } catch {}
            }
            if (Object.keys(configs).length > 0) {
                const result = await getApi().terminusSyncPush(configs);
                if (result.ok) setLastSynced(result.updated_at);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    if (authStatus === null) {
        return (
            <SettingsSection title="Account">
                <div className="px-3 py-2 text-sm text-muted">Loading...</div>
            </SettingsSection>
        );
    }

    if (!authStatus.loggedIn) {
        return (
            <SettingsSection title="Account">
                <div className="px-3 py-3 flex flex-col gap-2">
                    <span className="text-sm text-muted">Sync preferences across your machines</span>
                    <button
                        onClick={handleLogin}
                        disabled={loading}
                        className="self-start px-4 py-2 text-sm font-medium rounded-md transition-colors"
                        style={{
                            backgroundColor: loading ? "#555" : "#ff00ff",
                            color: "white",
                            border: "none",
                            cursor: loading ? "wait" : "pointer",
                            opacity: loading ? 0.7 : 1,
                        }}
                    >
                        {loading ? "Signing in..." : "Sign in with Google"}
                    </button>
                </div>
            </SettingsSection>
        );
    }

    return (
        <SettingsSection title="Account">
            <div className="px-3 py-2 flex items-center gap-3">
                {authStatus.picture && (
                    <img
                        src={authStatus.picture}
                        alt=""
                        className="w-8 h-8 rounded-full"
                        referrerPolicy="no-referrer"
                    />
                )}
                <div className="flex flex-col">
                    <span className="text-sm font-medium">{authStatus.name || authStatus.email}</span>
                    {authStatus.name && (
                        <span className="text-xs text-muted">{authStatus.email}</span>
                    )}
                </div>
            </div>
            <div className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-secondary/20 transition-colors">
                <div className="flex flex-col">
                    <span className="text-sm font-medium">Sync Preferences</span>
                    <span className="text-xs text-muted">Auto-sync settings across machines</span>
                </div>
                <button
                    onClick={handleSyncToggle}
                    className="relative w-10 h-5 rounded-full transition-colors"
                    style={{
                        backgroundColor: authStatus.syncEnabled ? "#ff00ff" : "#555",
                        border: "none",
                        cursor: "pointer",
                    }}
                >
                    <span
                        className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                        style={{
                            left: authStatus.syncEnabled ? "calc(100% - 18px)" : "2px",
                        }}
                    />
                </button>
            </div>
            <div className="flex items-center gap-2 px-3 py-1">
                <button
                    onClick={handlePull}
                    disabled={loading}
                    className="px-3 py-1 text-xs rounded transition-colors"
                    style={{
                        backgroundColor: "#333",
                        color: "#ccc",
                        border: "1px solid #555",
                        cursor: loading ? "wait" : "pointer",
                    }}
                >
                    {loading ? "Pulling..." : "↓ Pull from Cloud"}
                </button>
                <button
                    onClick={handlePush}
                    disabled={loading}
                    className="px-3 py-1 text-xs rounded transition-colors"
                    style={{
                        backgroundColor: "#333",
                        color: "#ccc",
                        border: "1px solid #555",
                        cursor: loading ? "wait" : "pointer",
                    }}
                >
                    {loading ? "Pushing..." : "↑ Push to Cloud"}
                </button>
                {lastSynced && (
                    <span className="text-xs text-muted">
                        Last synced: {new Date(lastSynced).toLocaleTimeString()}
                    </span>
                )}
            </div>
            {devices.length > 0 && (
                <div className="px-3 py-1">
                    <button
                        onClick={() => setShowDevices(!showDevices)}
                        className="text-xs text-muted hover:text-foreground transition-colors"
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                    >
                        {showDevices ? "Hide" : "Show"} Connected Devices ({devices.length})
                    </button>
                    {showDevices && (
                        <div className="flex flex-col gap-1 mt-2">
                            {devices.map((d) => (
                                <div
                                    key={d.machine_id}
                                    className="flex items-center justify-between text-xs px-2 py-1 rounded"
                                    style={{ backgroundColor: "rgba(255,255,255,0.03)" }}
                                >
                                    <span>{d.device_name || d.machine_id.slice(0, 8)}</span>
                                    <span className="text-muted">
                                        {d.os} &middot;{" "}
                                        {d.last_sync_at
                                            ? new Date(d.last_sync_at).toLocaleDateString()
                                            : "never synced"}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            <div className="px-3 py-1">
                <button
                    onClick={handleLogout}
                    className="text-xs text-muted hover:text-red-400 transition-colors"
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                    Sign Out
                </button>
            </div>
        </SettingsSection>
    );
});
AccountSection.displayName = "AccountSection";

const SettingsVisualContent = memo(({ model }: { model: WaveConfigViewModel }) => {
    const [fileContent, setFileContent] = useAtom(model.fileContentAtom);
    const liveSettings = useAtomValue(getAtoms().settingsAtom);

    const updateSetting = useCallback(
        (key: string, value: any) => {
            const current = (() => {
                try {
                    return JSON.parse(fileContent || "{}");
                } catch {
                    return {};
                }
            })();
            current[key] = value;
            const updated = JSON.stringify(current, null, 2);
            setFileContent(updated);
            model.markAsEdited();
            model.saveFile();
        },
        [fileContent, setFileContent, model]
    );

    return (
        <div className="flex flex-col p-6 overflow-y-auto h-full">
            <AccountSection />
            <SettingsSection title="Layout">
                <NumberSetting
                    label="Pane Gap Size"
                    description="Space between panes (total gap in pixels)"
                    value={liveSettings["window:tilegapsize"] ?? 16}
                    onChange={(v) => updateSetting("window:tilegapsize", v)}
                    min={0}
                    max={64}
                    suffix="px"
                />
                <NumberSetting
                    label="Active Pane Border Width"
                    description="Thickness of the focused pane highlight"
                    value={liveSettings["window:activeborderwidth"] ?? 4}
                    onChange={(v) => updateSetting("window:activeborderwidth", v)}
                    min={0}
                    max={16}
                    suffix="px"
                />
                <ColorSetting
                    label="Active Pane Border Color"
                    description="Color of the focused pane highlight"
                    value={liveSettings["window:activebordercolor"] ?? "fuchsia"}
                    onChange={(v) => updateSetting("window:activebordercolor", v)}
                />
            </SettingsSection>
            <SettingsSection title="Terminal">
                <NumberSetting
                    label="Default Font Size"
                    description="Global default for all terminal panes (per-pane overrides still apply)"
                    value={liveSettings["term:fontsize"] ?? 12}
                    onChange={(v) => updateSetting("term:fontsize", v)}
                    min={4}
                    max={64}
                    suffix="px"
                />
            </SettingsSection>
        </div>
    );
});
SettingsVisualContent.displayName = "SettingsVisualContent";

export { SettingsVisualContent };
