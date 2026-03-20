// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import * as child_process from "node:child_process";
import * as fs from "node:fs";
import * as http from "node:http";
import * as net from "node:net";
import * as path from "node:path";
import * as readline from "readline";

const CLARION_PORT = 8080;
const HEALTH_CHECK_INTERVAL_MS = 30_000;
const MAX_RESTARTS = 3;
const RESTART_WINDOW_MS = 60_000;
const SHUTDOWN_GRACE_MS = 3_000;
const READY_TIMEOUT_MS = 15_000;

let clarionProc: child_process.ChildProcessWithoutNullStreams | null = null;
let clarionRunning = false;
let restartTimestamps: number[] = [];
let healthCheckTimer: ReturnType<typeof setInterval> | null = null;
let totalRestartCount = 0;

export interface ClarionStatus {
    running: boolean;
    pid: number | null;
    port: number;
    restartCount: number;
}

export function getClarionStatus(): ClarionStatus {
    return {
        running: clarionRunning,
        pid: clarionProc?.pid ?? null,
        port: CLARION_PORT,
        restartCount: totalRestartCount,
    };
}

/**
 * Parse a .dev.vars or .env file into a key-value record.
 * Handles KEY=VALUE lines, ignores comments and blank lines.
 */
function parseEnvFile(filePath: string): Record<string, string> {
    const vars: Record<string, string> = {};
    if (!fs.existsSync(filePath)) {
        return vars;
    }
    const content = fs.readFileSync(filePath, "utf-8");
    for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
            continue;
        }
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) {
            continue;
        }
        const key = trimmed.slice(0, eqIdx).trim();
        let value = trimmed.slice(eqIdx + 1).trim();
        // Strip surrounding quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        vars[key] = value;
    }
    return vars;
}

/**
 * Resolve the path to the node binary. Checks process.execPath for Electron
 * (which is not a valid node binary), then common locations, then falls back to "node".
 */
function resolveNodePath(): string {
    // In Electron, process.execPath points to Electron, not Node.
    // Try to find a system node.
    const candidates = [
        "/usr/local/bin/node",
        "/opt/homebrew/bin/node",
        "/usr/bin/node",
        path.join(process.env.HOME ?? "", ".nvm/versions/node", "current", "bin", "node"),
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }
    // Check NVM — the current symlink may not exist, but NVM sets a version dir
    const nvmDir = process.env.NVM_DIR || path.join(process.env.HOME ?? "", ".nvm");
    const nvmDefaultPath = path.join(nvmDir, "alias", "default");
    if (fs.existsSync(nvmDefaultPath)) {
        try {
            const version = fs.readFileSync(nvmDefaultPath, "utf-8").trim();
            const nvmNode = path.join(nvmDir, "versions", "node", version, "bin", "node");
            if (fs.existsSync(nvmNode)) {
                return nvmNode;
            }
        } catch {
            // ignore
        }
    }
    // Fall back — let the OS find it via PATH
    return "node";
}

/**
 * Check if a port is already in use.
 */
function isPortInUse(port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once("error", (err: NodeJS.ErrnoException) => {
            if (err.code === "EADDRINUSE") {
                resolve(true);
            } else {
                resolve(false);
            }
        });
        server.once("listening", () => {
            server.close(() => resolve(false));
        });
        server.listen(port, "127.0.0.1");
    });
}

/**
 * Perform a health check against the Clarion server.
 */
function healthCheck(): Promise<boolean> {
    return new Promise((resolve) => {
        const req = http.get(`http://localhost:${CLARION_PORT}/health`, { timeout: 5000 }, (res) => {
            // Any 2xx is fine
            resolve(res.statusCode != null && res.statusCode >= 200 && res.statusCode < 300);
            res.resume(); // drain the response
        });
        req.on("error", () => resolve(false));
        req.on("timeout", () => {
            req.destroy();
            resolve(false);
        });
    });
}

function startHealthCheckLoop() {
    stopHealthCheckLoop();
    healthCheckTimer = setInterval(async () => {
        if (!clarionRunning || clarionProc == null) {
            return;
        }
        const ok = await healthCheck();
        if (!ok && clarionRunning) {
            console.log("[clarion] health check failed, server may be unresponsive");
        }
    }, HEALTH_CHECK_INTERVAL_MS);
}

function stopHealthCheckLoop() {
    if (healthCheckTimer != null) {
        clearInterval(healthCheckTimer);
        healthCheckTimer = null;
    }
}

/**
 * Check whether we've exceeded the restart limit.
 */
function canRestart(): boolean {
    const now = Date.now();
    // Prune timestamps outside the window
    restartTimestamps = restartTimestamps.filter((ts) => now - ts < RESTART_WINDOW_MS);
    return restartTimestamps.length < MAX_RESTARTS;
}

function recordRestart() {
    restartTimestamps.push(Date.now());
    totalRestartCount++;
}

/**
 * Build the environment for the Clarion child process.
 * Reads .dev.vars first, then .env as fallback, then layers on required vars.
 */
function buildClarionEnv(serverDir: string): Record<string, string> {
    const envCopy: Record<string, string> = { ...(process.env as Record<string, string>) };

    // Load env files — .dev.vars takes priority over .env
    const dotEnvVars = parseEnvFile(path.join(serverDir, ".env"));
    const devVars = parseEnvFile(path.join(serverDir, ".dev.vars"));

    Object.assign(envCopy, dotEnvVars, devVars);

    // Always set PORT explicitly
    envCopy["PORT"] = String(CLARION_PORT);

    return envCopy;
}

/**
 * Spawn the Clarion TTS server as a managed child process.
 * Resolves to true once the server prints its listening message.
 * Rejects if the server fails to start within the timeout.
 */
export async function runClarionServer(): Promise<boolean> {
    // Determine paths
    const serverDir = path.join(import.meta.dirname, "..", "clarion", "server");
    const entryPoint = path.join(serverDir, "src", "node-server.js");

    if (!fs.existsSync(entryPoint)) {
        console.log("[clarion] server entry point not found:", entryPoint);
        return false;
    }

    // Check if port is already in use (someone else is running it)
    const portBusy = await isPortInUse(CLARION_PORT);
    if (portBusy) {
        console.log(`[clarion] port ${CLARION_PORT} already in use, skipping spawn`);
        return false;
    }

    const nodePath = resolveNodePath();
    const env = buildClarionEnv(serverDir);

    console.log("[clarion] starting server:", nodePath, entryPoint);

    return new Promise<boolean>((resolve, reject) => {
        const proc = child_process.spawn(nodePath, [entryPoint], {
            cwd: serverDir,
            env,
            stdio: ["ignore", "pipe", "pipe"],
        });

        let settled = false;

        const readyTimeout = setTimeout(() => {
            if (!settled) {
                settled = true;
                console.log("[clarion] server did not become ready within timeout");
                reject(new Error("Clarion server startup timed out"));
            }
        }, READY_TIMEOUT_MS);

        proc.on("spawn", () => {
            console.log("[clarion] process spawned, pid:", proc.pid);
            clarionProc = proc;
        });

        proc.on("error", (err) => {
            console.log("[clarion] spawn error:", err);
            if (!settled) {
                settled = true;
                clearTimeout(readyTimeout);
                reject(err);
            }
        });

        proc.on("exit", (code, signal) => {
            console.log(`[clarion] process exited, code=${code} signal=${signal}`);
            clarionRunning = false;
            clarionProc = null;
            stopHealthCheckLoop();

            if (!settled) {
                settled = true;
                clearTimeout(readyTimeout);
                reject(new Error(`Clarion server exited prematurely (code=${code})`));
                return;
            }

            // Auto-restart on unexpected exit
            if (canRestart()) {
                recordRestart();
                console.log(`[clarion] restarting (attempt ${totalRestartCount})`);
                runClarionServer().catch((e) => {
                    console.log("[clarion] restart failed:", e);
                });
            } else {
                console.log("[clarion] max restarts exceeded, giving up");
            }
        });

        // Monitor stdout for the ready signal
        const rlStdout = readline.createInterface({ input: proc.stdout, terminal: false });
        rlStdout.on("line", (line) => {
            console.log("[clarion:stdout]", line);
            // The server prints: [clarion] Server running on http://localhost:PORT
            if (line.includes("Server running on") && !settled) {
                settled = true;
                clearTimeout(readyTimeout);
                clarionRunning = true;
                startHealthCheckLoop();
                resolve(true);
            }
        });

        const rlStderr = readline.createInterface({ input: proc.stderr, terminal: false });
        rlStderr.on("line", (line) => {
            console.log("[clarion:stderr]", line);
        });
    });
}

/**
 * Gracefully stop the Clarion server.
 * Sends SIGTERM, then SIGKILL after a grace period.
 */
export function stopClarionServer(): Promise<void> {
    return new Promise((resolve) => {
        stopHealthCheckLoop();

        if (clarionProc == null || !clarionRunning) {
            clarionRunning = false;
            clarionProc = null;
            resolve();
            return;
        }

        const proc = clarionProc;
        let forceKillTimer: ReturnType<typeof setTimeout> | null = null;

        const onExit = () => {
            if (forceKillTimer != null) {
                clearTimeout(forceKillTimer);
                forceKillTimer = null;
            }
            clarionRunning = false;
            clarionProc = null;
            resolve();
        };

        proc.once("exit", onExit);

        console.log("[clarion] sending SIGTERM to pid:", proc.pid);
        proc.kill("SIGTERM");

        forceKillTimer = setTimeout(() => {
            if (clarionProc != null && clarionProc === proc) {
                console.log("[clarion] SIGTERM timed out, sending SIGKILL");
                try {
                    proc.kill("SIGKILL");
                } catch {
                    // process may already be dead
                }
            }
        }, SHUTDOWN_GRACE_MS);
    });
}
