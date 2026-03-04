// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { Popover, PopoverButton, PopoverContent } from "@/element/popover";
import * as React from "react";
import { HexColorInput, HexColorPicker } from "react-colorful";

interface ColorPickerPopoverProps {
    currentColor: string;
    onColorChange: (hex: string) => void;
    onReset: () => void;
}

export const ColorPickerPopover = React.memo(({ currentColor, onColorChange, onReset }: ColorPickerPopoverProps) => {
    const [tempColor, setTempColor] = React.useState(currentColor);

    React.useEffect(() => {
        setTempColor(currentColor);
    }, [currentColor]);

    const handleApply = React.useCallback(() => {
        onColorChange(tempColor);
    }, [tempColor, onColorChange]);

    const handleReset = React.useCallback(() => {
        onReset();
    }, [onReset]);

    return (
        <Popover placement="bottom-start">
            <PopoverButton
                className="color-picker-trigger"
                style={{ padding: 0, border: "none", background: "none", minWidth: 0 }}
            >
                <span
                    className="inline-block rounded-full flex-shrink-0 cursor-pointer"
                    style={{
                        width: 16,
                        height: 16,
                        backgroundColor: currentColor,
                        border: "2px solid rgba(255,255,255,0.3)",
                    }}
                    title="Change background color"
                />
            </PopoverButton>
            <PopoverContent className="color-picker-popover">
                <div
                    style={{
                        padding: 12,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        background: "var(--block-bg-color)",
                        borderRadius: 6,
                        border: "1px solid rgba(255,255,255,0.1)",
                    }}
                >
                    <HexColorPicker color={tempColor} onChange={setTempColor} style={{ width: 200, height: 160 }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ color: "var(--grey-text-color)", fontSize: 12 }}>#</span>
                        <HexColorInput
                            color={tempColor}
                            onChange={setTempColor}
                            style={{
                                flex: 1,
                                background: "rgba(255,255,255,0.08)",
                                border: "1px solid rgba(255,255,255,0.15)",
                                borderRadius: 4,
                                color: "var(--main-text-color)",
                                padding: "4px 6px",
                                fontSize: 12,
                                fontFamily: "monospace",
                            }}
                        />
                        <span
                            className="rounded"
                            style={{
                                width: 24,
                                height: 24,
                                backgroundColor: tempColor,
                                border: "1px solid rgba(255,255,255,0.2)",
                                flexShrink: 0,
                            }}
                        />
                    </div>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button
                            onClick={handleReset}
                            style={{
                                background: "rgba(255,255,255,0.08)",
                                border: "1px solid rgba(255,255,255,0.15)",
                                borderRadius: 4,
                                color: "var(--grey-text-color)",
                                padding: "4px 10px",
                                fontSize: 12,
                                cursor: "pointer",
                            }}
                        >
                            Reset
                        </button>
                        <button
                            onClick={handleApply}
                            style={{
                                background: "var(--accent-color)",
                                border: "none",
                                borderRadius: 4,
                                color: "white",
                                padding: "4px 10px",
                                fontSize: 12,
                                cursor: "pointer",
                            }}
                        >
                            Apply
                        </button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
});
ColorPickerPopover.displayName = "ColorPickerPopover";
