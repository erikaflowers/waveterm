// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import type { WaveConfigViewModel } from "@/app/view/waveconfig/waveconfig-model";
import { useAtom } from "jotai";
import { memo, useCallback, useMemo } from "react";

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

const SettingsVisualContent = memo(({ model }: { model: WaveConfigViewModel }) => {
    const [fileContent, setFileContent] = useAtom(model.fileContentAtom);

    const settings = useMemo(() => {
        try {
            return JSON.parse(fileContent || "{}");
        } catch {
            return {};
        }
    }, [fileContent]);

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
            <SettingsSection title="Layout">
                <NumberSetting
                    label="Pane Gap Size"
                    description="Space between panes (total gap in pixels)"
                    value={settings["window:tilegapsize"] ?? 16}
                    onChange={(v) => updateSetting("window:tilegapsize", v)}
                    min={0}
                    max={64}
                    suffix="px"
                />
                <NumberSetting
                    label="Active Pane Border Width"
                    description="Thickness of the focused pane highlight"
                    value={settings["window:activeborderwidth"] ?? 4}
                    onChange={(v) => updateSetting("window:activeborderwidth", v)}
                    min={0}
                    max={16}
                    suffix="px"
                />
                <ColorSetting
                    label="Active Pane Border Color"
                    description="Color of the focused pane highlight"
                    value={settings["window:activebordercolor"] ?? "fuchsia"}
                    onChange={(v) => updateSetting("window:activebordercolor", v)}
                />
            </SettingsSection>
            <SettingsSection title="Terminal">
                <NumberSetting
                    label="Default Font Size"
                    description="Global default for all terminal panes (per-pane overrides still apply)"
                    value={settings["term:fontsize"] ?? 12}
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
