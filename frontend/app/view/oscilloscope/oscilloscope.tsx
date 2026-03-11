// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import type { BlockNodeModel } from "@/app/block/blocktypes";
import type { TabModel } from "@/app/store/tab-model";
import { waveEventSubscribeSingle } from "@/app/store/wps";
import { globalStore, WOS } from "@/store/global";
import * as jotai from "jotai";
import * as React from "react";

import {
    applyGlow,
    BG_DARK,
    clearGlow,
    GRID_BRIGHT,
    GRID_DIM,
    PHOSPHOR_AMBER,
    PHOSPHOR_CYAN,
    PHOSPHOR_GREEN,
    PHOSPHOR_RED,
} from "../vizutil/vizcolors";
import { DataRingBuffer, DrawFunction, clamp, lerp, useAnimationLoop, useCanvasSetup } from "../vizutil/vizutil";

// --- Types ---

interface ScopeChannel {
    label: string;
    color: string;
    buffer: DataRingBuffer<number>;
    currentValue: number;
    prevValue: number;
    lastUpdateTime: number;
}

// --- Scope State ---

class ScopeState {
    channels: Map<string, ScopeChannel> = new Map();
    triggerLevel: number = 80;
    triggerFlash: number = 0;
    sweepOffset: number = 0;

    constructor() {
        this.channels.set("cpu", {
            label: "CPU",
            color: PHOSPHOR_GREEN,
            buffer: new DataRingBuffer<number>(240),
            currentValue: 0,
            prevValue: 0,
            lastUpdateTime: 0,
        });
        this.channels.set("mem", {
            label: "MEM",
            color: PHOSPHOR_AMBER,
            buffer: new DataRingBuffer<number>(240),
            currentValue: 0,
            prevValue: 0,
            lastUpdateTime: 0,
        });
    }

    pushData(cpu: number, memPct: number, now: number): void {
        const cpuCh = this.channels.get("cpu");
        const memCh = this.channels.get("mem");

        cpuCh.prevValue = cpuCh.currentValue;
        cpuCh.currentValue = cpu;
        cpuCh.lastUpdateTime = now;
        cpuCh.buffer.push(cpu);

        memCh.prevValue = memCh.currentValue;
        memCh.currentValue = memPct;
        memCh.lastUpdateTime = now;
        memCh.buffer.push(memPct);

        // Trigger flash when CPU crosses threshold
        if (cpu > this.triggerLevel && cpuCh.prevValue <= this.triggerLevel) {
            this.triggerFlash = 1.0;
        }
    }
}

// --- Draw ---

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, margin: number): void {
    const plotW = w - margin * 2;
    const plotH = h - margin * 2;

    // Major grid
    ctx.strokeStyle = GRID_DIM;
    ctx.lineWidth = 0.5;
    const majorDivs = 8;
    for (let i = 0; i <= majorDivs; i++) {
        const x = margin + (plotW / majorDivs) * i;
        ctx.beginPath();
        ctx.moveTo(x, margin);
        ctx.lineTo(x, margin + plotH);
        ctx.stroke();

        const y = margin + (plotH / majorDivs) * i;
        ctx.beginPath();
        ctx.moveTo(margin, y);
        ctx.lineTo(margin + plotW, y);
        ctx.stroke();
    }

    // Minor grid (dashed, dimmer)
    ctx.strokeStyle = "rgba(26, 58, 26, 0.3)";
    ctx.lineWidth = 0.3;
    const minorDivs = majorDivs * 4;
    for (let i = 0; i <= minorDivs; i++) {
        const x = margin + (plotW / minorDivs) * i;
        ctx.beginPath();
        ctx.moveTo(x, margin);
        ctx.lineTo(x, margin + plotH);
        ctx.stroke();

        const y = margin + (plotH / minorDivs) * i;
        ctx.beginPath();
        ctx.moveTo(margin, y);
        ctx.lineTo(margin + plotW, y);
        ctx.stroke();
    }

    // Border
    ctx.strokeStyle = GRID_BRIGHT;
    ctx.lineWidth = 1;
    ctx.strokeRect(margin, margin, plotW, plotH);
}

function drawWaveform(
    ctx: CanvasRenderingContext2D,
    channel: ScopeChannel,
    w: number,
    h: number,
    margin: number,
    now: number,
    elapsed: number
): void {
    const data = channel.buffer.toArray();
    if (data.length < 2) return;

    const plotW = w - margin * 2;
    const plotH = h - margin * 2;

    const timeSinceUpdate = now - channel.lastUpdateTime;
    const interpT = clamp(timeSinceUpdate / 1000, 0, 1);
    const interpValue = lerp(channel.prevValue, channel.currentValue, Math.min(interpT * 2, 1));

    // Ghost trace (previous sweep, very dim)
    ctx.beginPath();
    ctx.strokeStyle = `rgba(${channel.color === PHOSPHOR_GREEN ? "0, 255, 65" : channel.color === PHOSPHOR_AMBER ? "255, 176, 0" : "0, 255, 255"}, 0.06)`;
    ctx.lineWidth = 1;
    const totalPoints = data.length;
    for (let i = 0; i < totalPoints; i++) {
        const x = margin + (i / (totalPoints - 1)) * plotW;
        const val = data[i] + Math.sin(elapsed / 300 + i * 0.5) * 3;
        const y = margin + plotH - (clamp(val, 0, 100) / 100) * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Main waveform with high-frequency noise overlay
    ctx.beginPath();
    ctx.strokeStyle = channel.color;
    ctx.lineWidth = 1.8;
    applyGlow(ctx, channel.color, 8);

    for (let i = 0; i < totalPoints; i++) {
        const x = margin + (i / (totalPoints - 1)) * plotW;
        const baseVal = i === totalPoints - 1 ? interpValue : data[i];
        // Add high-freq jitter + medium noise
        const hfNoise = (Math.random() - 0.5) * 4;
        const mfNoise = Math.sin(elapsed / 150 + i * 2.3) * 2;
        const val = baseVal + hfNoise + mfNoise;
        const y = margin + plotH - (clamp(val, 0, 100) / 100) * plotH;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
    clearGlow(ctx);

    // Current value readout with blinking decimal
    ctx.font = "11px 'JetBrains Mono', monospace";
    ctx.fillStyle = channel.color;
    const decimal = (interpValue % 1).toFixed(1).slice(1);
    const valStr = `${channel.label}: ${Math.round(interpValue)}${Math.floor(elapsed / 500) % 2 === 0 ? decimal : " "}%`;
    ctx.fillText(valStr, margin + 6, margin + 14 + (channel.label === "MEM" ? 16 : 0) + (channel.label === "NOISE" ? 32 : 0));
}

function createDrawFn(state: ScopeState): DrawFunction {
    // Interference noise channel — pure visual chaos
    let noisePhase = 0;
    let spikeTimer = 0;
    let spikeActive = false;
    let spikeValue = 0;
    let glitchTimer = 0;
    let glitchBand = 0;

    return (ctx, width, height, elapsed, delta) => {
        const margin = 30;
        const plotW = width - margin * 2;
        const plotH = height - margin * 2;
        noisePhase += delta / 16;
        spikeTimer += delta;
        glitchTimer += delta;

        // Random spikes every 2-5 seconds
        if (spikeTimer > 2000 + Math.random() * 3000) {
            spikeTimer = 0;
            spikeActive = true;
            spikeValue = 60 + Math.random() * 40;
        }
        if (spikeActive) {
            spikeValue *= 0.9;
            if (spikeValue < 2) spikeActive = false;
        }

        // Horizontal glitch band
        if (glitchTimer > 3000 + Math.random() * 4000) {
            glitchTimer = 0;
            glitchBand = margin + Math.random() * plotH;
        }

        // Clear with dark background
        ctx.fillStyle = BG_DARK;
        ctx.fillRect(0, 0, width, height);

        // CRT vignette
        const grad = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width * 0.7);
        grad.addColorStop(0, "rgba(0,0,0,0)");
        grad.addColorStop(1, "rgba(0,0,0,0.5)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        drawGrid(ctx, width, height, margin);

        const now = performance.now();

        // Draw noise floor — faint random static across the whole plot area
        ctx.fillStyle = "rgba(0, 255, 65, 0.02)";
        for (let i = 0; i < 60; i++) {
            const nx = margin + Math.random() * plotW;
            const ny = margin + Math.random() * plotH;
            ctx.fillRect(nx, ny, 1, 1);
        }

        // Horizontal glitch band (CRT interference)
        if (glitchBand > 0) {
            const bandHeight = 2 + Math.random() * 4;
            ctx.fillStyle = `rgba(0, 255, 65, ${0.04 + Math.random() * 0.06})`;
            ctx.fillRect(margin, glitchBand, plotW, bandHeight);
            glitchBand += (Math.random() - 0.5) * 3;
            if (Math.random() < 0.02) glitchBand = 0;
        }

        // Trigger level line
        const triggerY = margin + plotH - (state.triggerLevel / 100) * plotH;
        if (state.triggerFlash > 0) {
            ctx.strokeStyle = `rgba(255, 51, 51, ${state.triggerFlash * 0.8})`;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(margin, triggerY);
            ctx.lineTo(width - margin, triggerY);
            ctx.stroke();
            ctx.setLineDash([]);
            state.triggerFlash = Math.max(0, state.triggerFlash - delta / 1500);
        } else {
            ctx.strokeStyle = "rgba(255, 51, 51, 0.12)";
            ctx.lineWidth = 0.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(margin, triggerY);
            ctx.lineTo(width - margin, triggerY);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        ctx.font = "8px 'JetBrains Mono', monospace";
        ctx.fillStyle = "rgba(255, 51, 51, 0.35)";
        ctx.fillText(`TRIG ${state.triggerLevel}%`, width - margin - 50, triggerY - 3);

        // Draw main waveforms (CPU + MEM)
        for (const channel of state.channels.values()) {
            drawWaveform(ctx, channel, width, height, margin, now, elapsed);
        }

        // Draw interference/noise channel (CH3) — wild oscillating signal
        ctx.beginPath();
        ctx.strokeStyle = `rgba(0, 255, 255, 0.25)`;
        ctx.lineWidth = 0.8;
        for (let i = 0; i < plotW; i += 2) {
            const x = margin + i;
            const base = 50 + Math.sin(noisePhase * 0.03 + i * 0.05) * 20
                + Math.sin(noisePhase * 0.07 + i * 0.13) * 15
                + Math.sin(noisePhase * 0.13 + i * 0.02) * 10;
            const noise = (Math.random() - 0.5) * 12;
            const spike = spikeActive ? Math.sin(i * 0.3) * spikeValue : 0;
            const val = base + noise + spike;
            const y = margin + plotH - (clamp(val, 0, 100) / 100) * plotH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Draw a fast sawtooth wave (CH4) — really erratic
        ctx.beginPath();
        ctx.strokeStyle = `rgba(255, 100, 100, 0.15)`;
        ctx.lineWidth = 0.6;
        for (let i = 0; i < plotW; i += 2) {
            const x = margin + i;
            const saw = ((noisePhase * 0.5 + i * 0.8) % 40) / 40 * 100;
            const jitter = (Math.random() - 0.5) * 20;
            const val = saw + jitter;
            const y = margin + plotH - (clamp(val, 0, 100) / 100) * plotH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Random voltage spike flash
        if (spikeActive && spikeValue > 20) {
            ctx.strokeStyle = `rgba(255, 255, 255, ${spikeValue / 100 * 0.5})`;
            ctx.lineWidth = 2;
            applyGlow(ctx, "#ffffff", 10);
            const spikeX = margin + Math.random() * plotW;
            ctx.beginPath();
            ctx.moveTo(spikeX, margin);
            ctx.lineTo(spikeX + (Math.random() - 0.5) * 20, margin + plotH);
            ctx.stroke();
            clearGlow(ctx);
        }

        // Scope HUD labels
        ctx.font = "8px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#333";
        ctx.fillText("CH1: CPU    CH2: MEM    CH3: RF NOISE    CH4: SAW", margin + 6, height - margin + 12);
        ctx.fillText(`SWEEP: 1s/div  VERT: 25%/div  TRIG: ${state.triggerLevel}%`, margin + 6, height - margin + 22);

        // Time readout (top right)
        ctx.fillStyle = "#2a2a2a";
        const timeStr = new Date().toLocaleTimeString("en-US", { hour12: false });
        ctx.font = "9px 'JetBrains Mono', monospace";
        ctx.textAlign = "right";
        ctx.fillText(timeStr, width - margin - 4, margin - 6);
        ctx.fillText(`Δt: ${Math.round(delta)}ms`, width - margin - 4, margin - 16);
        ctx.textAlign = "left";

        // Scanline effect (heavier)
        ctx.fillStyle = "rgba(0, 0, 0, 0.04)";
        for (let y = 0; y < height; y += 2) {
            ctx.fillRect(0, y, width, 1);
        }

        // CRT flicker
        if (Math.random() < 0.03) {
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.02})`;
            ctx.fillRect(0, 0, width, height);
        }
    };
}

// --- ViewModel ---

class OscilloscopeViewModel implements ViewModel {
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
        this.viewType = "oscilloscope";
        this.blockId = blockId;
        this.nodeModel = nodeModel;
        this.tabModel = tabModel;
        this.blockAtom = WOS.getWaveObjectAtom<Block>(`block:${blockId}`);
        this.viewIcon = jotai.atom("wave-square");
        this.viewName = jotai.atom("Scope");
        this.viewComponent = OscilloscopeView;
        this.noPadding = jotai.atom(true);
    }
}

// --- View Component ---

const OscilloscopeView: React.FC<ViewComponentProps<OscilloscopeViewModel>> = React.memo(({ model }) => {
    const { canvasRef, containerRef, width, height } = useCanvasSetup();
    const stateRef = React.useRef(new ScopeState());

    // Subscribe to sysinfo events
    React.useEffect(() => {
        const unsubFn = waveEventSubscribeSingle({
            eventType: "sysinfo",
            scope: "",
            handler: (event: any) => {
                const data = event?.data;
                if (!data?.values) return;
                const cpu = data.values.cpu ?? 0;
                const memUsed = data.values["mem:used"] ?? 0;
                const memTotal = data.values["mem:total"] ?? 1;
                const memPct = (memUsed / memTotal) * 100;
                stateRef.current.pushData(cpu, memPct, performance.now());
            },
        });
        return () => unsubFn();
    }, []);

    const drawFn = React.useMemo(() => createDrawFn(stateRef.current), []);

    useAnimationLoop(canvasRef, width, height, drawFn);

    return (
        <div
            ref={containerRef}
            style={{
                width: "100%",
                height: "100%",
                background: BG_DARK,
                overflow: "hidden",
            }}
        >
            <canvas ref={canvasRef} style={{ display: "block" }} />
        </div>
    );
});
OscilloscopeView.displayName = "OscilloscopeView";

export { OscilloscopeViewModel };
