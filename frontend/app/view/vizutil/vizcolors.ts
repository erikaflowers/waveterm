// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

// Shared phosphor color palette for hacker-aesthetic visualizer panels

export const PHOSPHOR_GREEN = "#00ff41";
export const PHOSPHOR_GREEN_DIM = "#003b00";
export const PHOSPHOR_GREEN_MID = "#00aa2a";
export const PHOSPHOR_AMBER = "#ffb000";
export const PHOSPHOR_AMBER_DIM = "#3b2800";
export const PHOSPHOR_CYAN = "#00ffff";
export const PHOSPHOR_CYAN_DIM = "#003b3b";
export const PHOSPHOR_RED = "#ff3333";
export const BG_BLACK = "#000000";
export const BG_DARK = "#0a0a0a";
export const GRID_DIM = "#1a3a1a";
export const GRID_BRIGHT = "#2a5a2a";
export const TEXT_DIM = "#666666";

export function applyGlow(ctx: CanvasRenderingContext2D, color: string, blur: number): void {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
}

export function clearGlow(ctx: CanvasRenderingContext2D): void {
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
}
