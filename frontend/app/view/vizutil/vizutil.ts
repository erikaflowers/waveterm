// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

// Shared animation and canvas utilities for visualizer panels

import { useCallback, useEffect, useRef, useState } from "react";

// --- Ring Buffer ---

export class DataRingBuffer<T> {
    private buffer: T[];
    private head: number = 0;
    private count: number = 0;
    readonly capacity: number;

    constructor(capacity: number) {
        this.capacity = capacity;
        this.buffer = new Array(capacity);
    }

    push(item: T): void {
        this.buffer[this.head] = item;
        this.head = (this.head + 1) % this.capacity;
        if (this.count < this.capacity) this.count++;
    }

    /** Return items in insertion order (oldest first) */
    toArray(): T[] {
        if (this.count === 0) return [];
        const result: T[] = new Array(this.count);
        const start = this.count < this.capacity ? 0 : this.head;
        for (let i = 0; i < this.count; i++) {
            result[i] = this.buffer[(start + i) % this.capacity];
        }
        return result;
    }

    get length(): number {
        return this.count;
    }

    last(): T | undefined {
        if (this.count === 0) return undefined;
        return this.buffer[(this.head - 1 + this.capacity) % this.capacity];
    }

    clear(): void {
        this.head = 0;
        this.count = 0;
    }
}

// --- Canvas Setup Hook ---

export interface CanvasSetupResult {
    canvasRef: React.RefObject<HTMLCanvasElement>;
    containerRef: React.RefObject<HTMLDivElement>;
    width: number;
    height: number;
}

export function useCanvasSetup(): CanvasSetupResult {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);
    const [height, setHeight] = useState(0);
    const rszRef = useRef<ResizeObserver>(null);

    useEffect(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas) return;

        const updateSize = () => {
            const rect = container.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            const w = Math.floor(rect.width);
            const h = Math.floor(rect.height);
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;
            const ctx = canvas.getContext("2d");
            if (ctx) ctx.scale(dpr, dpr);
            setWidth(w);
            setHeight(h);
        };

        updateSize();
        rszRef.current = new ResizeObserver(updateSize);
        rszRef.current.observe(container);

        return () => {
            rszRef.current?.disconnect();
        };
    }, []);

    return { canvasRef, containerRef, width, height };
}

// --- Animation Loop Hook ---

export type DrawFunction = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    elapsed: number,
    delta: number
) => void;

export function useAnimationLoop(
    canvasRef: React.RefObject<HTMLCanvasElement>,
    width: number,
    height: number,
    drawFn: DrawFunction
): void {
    const drawRef = useRef(drawFn);
    drawRef.current = drawFn;

    const startTimeRef = useRef<number>(0);
    const lastFrameRef = useRef<number>(0);
    const frameIdRef = useRef<number>(0);

    useEffect(() => {
        if (width === 0 || height === 0) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const minFrameInterval = 1000 / 30; // cap at 30fps
        startTimeRef.current = performance.now();
        lastFrameRef.current = startTimeRef.current;

        const tick = (now: number) => {
            const delta = now - lastFrameRef.current;
            if (delta >= minFrameInterval && !document.hidden) {
                const elapsed = now - startTimeRef.current;
                // Reset transform for DPR scaling
                const dpr = window.devicePixelRatio || 1;
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                drawRef.current(ctx, width, height, elapsed, delta);
                lastFrameRef.current = now;
            }
            frameIdRef.current = requestAnimationFrame(tick);
        };

        frameIdRef.current = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(frameIdRef.current);
        };
    }, [canvasRef, width, height]);
}

// --- Visibility Hook ---

export function useVisibility(ref: React.RefObject<HTMLElement>): boolean {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const obs = new IntersectionObserver(
            ([entry]) => {
                setVisible(entry.isIntersecting);
            },
            { threshold: 0.01 }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, [ref]);

    return visible;
}

// --- Utility ---

export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

export function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}

export function randomRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
}
