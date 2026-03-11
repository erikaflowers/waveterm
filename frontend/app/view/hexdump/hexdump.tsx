// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import type { BlockNodeModel } from "@/app/block/blocktypes";
import type { TabModel } from "@/app/store/tab-model";
import { WOS } from "@/store/global";
import * as jotai from "jotai";
import * as React from "react";

import { BG_BLACK, PHOSPHOR_CYAN, PHOSPHOR_GREEN, PHOSPHOR_GREEN_DIM, PHOSPHOR_GREEN_MID } from "../vizutil/vizcolors";
import { getConversationTexts, getFleetFragments, subscribeConversations, subscribeFleet } from "../vizutil/vizdata";
import { DrawFunction, useAnimationLoop, useCanvasSetup } from "../vizutil/vizutil";

// --- Hex Dump State ---

class HexDumpState {
    byteBuffer: number[] = [];
    offset: number = 0; // current byte offset for display
    scrollAccum: number = 0;
    rowHighlights: Map<number, number> = new Map(); // row index → brightness (0-1)
    blinkOn: boolean = true;
    lastBlink: number = 0;
    lastDataRefresh: number = 0;
    charWidth: number = 0;
    rowHeight: number = 0;
    initialized: boolean = false;

    init(ctx: CanvasRenderingContext2D): void {
        ctx.font = "13px 'JetBrains Mono', 'Menlo', monospace";
        const metrics = ctx.measureText("W");
        this.charWidth = Math.ceil(metrics.width);
        this.rowHeight = 18;
        this.initialized = true;
        this.refreshData();
    }

    refreshData(): void {
        const newBytes: number[] = [];
        const encoder = new TextEncoder();

        // Mix in fleet log data
        const fragments = getFleetFragments();
        for (const f of fragments) {
            if (f.agentName) {
                newBytes.push(...encoder.encode(`[${f.agentName}] `));
            }
            if (f.commitHash) {
                newBytes.push(...encoder.encode(`${f.commitHash.slice(0, 7)} `));
            }
            if (f.summary) {
                const truncated = f.summary.slice(0, 80);
                newBytes.push(...encoder.encode(truncated + " "));
            }
        }

        // Mix in conversation texts
        const convTexts = getConversationTexts();
        for (const text of convTexts) {
            const truncated = text.slice(0, 120);
            newBytes.push(...encoder.encode(truncated + "\n"));
        }

        // Pad with pseudo-random bytes if we don't have enough
        while (newBytes.length < 2048) {
            // Mix of "interesting" byte patterns
            if (Math.random() < 0.3) {
                // Null padding blocks
                for (let i = 0; i < 4; i++) newBytes.push(0x00);
            } else if (Math.random() < 0.5) {
                // Some recognizable patterns
                newBytes.push(0xde, 0xad, 0xbe, 0xef);
            } else {
                newBytes.push(Math.floor(Math.random() * 256));
            }
        }

        if (this.byteBuffer.length === 0) {
            this.byteBuffer = newBytes;
        } else {
            // Append new data
            this.byteBuffer.push(...newBytes);
            // Keep buffer from growing unbounded
            if (this.byteBuffer.length > 16384) {
                this.byteBuffer = this.byteBuffer.slice(-8192);
                this.offset = Math.max(0, this.offset - 8192);
            }
        }
    }
}

// --- Hex Formatting ---

function toHex(byte: number, pad: number): string {
    return byte.toString(16).toUpperCase().padStart(pad, "0");
}

function toAscii(byte: number): string {
    return byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : ".";
}

// --- Draw ---

function createDrawFn(state: HexDumpState): DrawFunction {
    return (ctx, width, height, elapsed, delta) => {
        if (!state.initialized) {
            state.init(ctx);
        }

        // Refresh data periodically
        if (elapsed - state.lastDataRefresh > 30000) {
            state.lastDataRefresh = elapsed;
            state.refreshData();
        }

        // Blink cursor
        if (elapsed - state.lastBlink > 500) {
            state.lastBlink = elapsed;
            state.blinkOn = !state.blinkOn;
        }

        // Scroll: advance ~1 row per second
        state.scrollAccum += (delta / 1000) * 1.2;
        if (state.scrollAccum >= 1) {
            const rowsToAdvance = Math.floor(state.scrollAccum);
            state.offset += rowsToAdvance * 16;
            state.scrollAccum -= rowsToAdvance;

            // Mark new rows as highlighted
            const visibleRows = Math.ceil(height / state.rowHeight);
            for (let i = 0; i < rowsToAdvance; i++) {
                state.rowHighlights.set(state.offset / 16 + visibleRows - 1 - i, 1.0);
            }

            // Loop buffer
            if (state.offset >= state.byteBuffer.length) {
                state.offset = 0;
            }
        }

        // Clear
        ctx.fillStyle = BG_BLACK;
        ctx.fillRect(0, 0, width, height);

        ctx.font = "13px 'JetBrains Mono', 'Menlo', monospace";
        const cw = state.charWidth;
        const rh = state.rowHeight;

        const visibleRows = Math.ceil(height / rh);
        const bytesPerRow = 16;

        // Layout columns
        const addrWidth = cw * 10; // "XXXXXXXX  "
        const hexWidth = cw * (bytesPerRow * 3 + 1); // "XX " * 16 + gap
        const asciiStart = addrWidth + hexWidth + cw;

        for (let row = 0; row < visibleRows; row++) {
            const byteOffset = state.offset + row * bytesPerRow;
            const rowIdx = byteOffset / bytesPerRow;
            const y = row * rh + rh;

            // Row highlight fade
            const highlight = state.rowHighlights.get(Math.floor(rowIdx)) || 0;
            if (highlight > 0) {
                ctx.fillStyle = `rgba(0, 255, 65, ${highlight * 0.08})`;
                ctx.fillRect(0, y - rh + 3, width, rh);
                state.rowHighlights.set(Math.floor(rowIdx), Math.max(0, highlight - delta / 2000));
            }

            // Address column (cyan, dimmer)
            ctx.fillStyle = `rgba(0, 255, 255, 0.4)`;
            const addr = toHex(byteOffset % 0x100000000, 8);
            ctx.fillText(addr, 6, y);

            // Hex bytes
            let hexX = addrWidth;
            for (let col = 0; col < bytesPerRow; col++) {
                const idx = (byteOffset + col) % state.byteBuffer.length;
                const byte = state.byteBuffer[idx];

                // Color: bright for printable, dimmer for others
                if (byte >= 0x20 && byte <= 0x7e) {
                    ctx.fillStyle = PHOSPHOR_GREEN;
                } else if (byte === 0) {
                    ctx.fillStyle = PHOSPHOR_GREEN_DIM;
                } else {
                    ctx.fillStyle = PHOSPHOR_GREEN_MID;
                }

                ctx.fillText(toHex(byte, 2), hexX, y);
                hexX += cw * 3;

                // Extra gap between byte 7 and 8
                if (col === 7) hexX += cw;
            }

            // ASCII column
            ctx.fillText("|", asciiStart - cw, y);
            let ascX = asciiStart;
            for (let col = 0; col < bytesPerRow; col++) {
                const idx = (byteOffset + col) % state.byteBuffer.length;
                const byte = state.byteBuffer[idx];
                const ch = toAscii(byte);

                if (byte >= 0x20 && byte <= 0x7e) {
                    ctx.fillStyle = PHOSPHOR_GREEN;
                } else {
                    ctx.fillStyle = PHOSPHOR_GREEN_DIM;
                }

                ctx.fillText(ch, ascX, y);
                ascX += cw;
            }
            ctx.fillStyle = PHOSPHOR_GREEN_DIM;
            ctx.fillText("|", ascX, y);
        }

        // Blinking cursor at bottom right
        if (state.blinkOn) {
            ctx.fillStyle = PHOSPHOR_GREEN;
            const cursorY = visibleRows * rh;
            ctx.fillText("_", 6, cursorY);
        }

        // Subtle scanline effect
        ctx.fillStyle = "rgba(0, 0, 0, 0.04)";
        for (let y = 0; y < height; y += 2) {
            ctx.fillRect(0, y, width, 1);
        }
    };
}

// --- ViewModel ---

class HexDumpViewModel implements ViewModel {
    viewType: string;
    blockId: string;
    nodeModel: BlockNodeModel;
    tabModel: TabModel;
    blockAtom: jotai.Atom<Block>;
    viewIcon: jotai.Atom<string>;
    viewName: jotai.Atom<string>;
    viewComponent: ViewComponent;
    noPadding: jotai.Atom<boolean>;

    constructor(blockId: string, nodeModel: BlockNodeModel, tabModel: TabModel) {
        this.viewType = "hexdump";
        this.blockId = blockId;
        this.nodeModel = nodeModel;
        this.tabModel = tabModel;
        this.blockAtom = WOS.getWaveObjectAtom<Block>(`block:${blockId}`);
        this.viewIcon = jotai.atom("microchip");
        this.viewName = jotai.atom("Hex Dump");
        this.viewComponent = HexDumpView;
        this.noPadding = jotai.atom(true);
    }
}

// --- View Component ---

const HexDumpView: React.FC<ViewComponentProps<HexDumpViewModel>> = React.memo(({ model }) => {
    const { canvasRef, containerRef, width, height } = useCanvasSetup();
    const stateRef = React.useRef(new HexDumpState());

    // Subscribe to data sources
    React.useEffect(() => {
        const unsub1 = subscribeFleet();
        const unsub2 = subscribeConversations();
        return () => {
            unsub1();
            unsub2();
        };
    }, []);

    const drawFn = React.useMemo(() => createDrawFn(stateRef.current), []);

    useAnimationLoop(canvasRef, width, height, drawFn);

    return (
        <div
            ref={containerRef}
            style={{
                width: "100%",
                height: "100%",
                background: BG_BLACK,
                overflow: "hidden",
            }}
        >
            <canvas ref={canvasRef} style={{ display: "block" }} />
        </div>
    );
});
HexDumpView.displayName = "HexDumpView";

export { HexDumpViewModel };
