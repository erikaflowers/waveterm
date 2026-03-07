// Terminus Cloud Sync — Google OAuth for Electron
// Handles Google OAuth login via BrowserWindow popup + loopback redirect

import * as electron from "electron";
import * as http from "http";
import * as https from "https";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import * as os from "os";
import { getWaveConfigDir } from "./emain-platform";
import { focusedWaveWindow } from "./emain-window";

// Desktop OAuth Client credentials loaded from local config (not committed)
function loadOAuthCredentials(): { clientId: string; clientSecret: string } {
    const credPath = path.join(getWaveConfigDir(), "oauth-credentials.json");
    try {
        const raw = fs.readFileSync(credPath, "utf-8");
        const creds = JSON.parse(raw);
        return { clientId: creds.client_id, clientSecret: creds.client_secret };
    } catch {
        throw new Error(`OAuth credentials not found. Create ${credPath} with client_id and client_secret.`);
    }
}
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const KESTRIS_SYNC_URL = "https://kestris.ai/api/terminus/sync";
const KESTRIS_DEVICES_URL = "https://kestris.ai/api/terminus/devices";

export type AuthState = {
    email: string;
    name: string;
    picture: string;
    id_token: string;
    access_token: string;
    refresh_token?: string;
    token_expiry: number;
    sync_enabled: boolean;
};

function getAuthFilePath(): string {
    return path.join(getWaveConfigDir(), "auth.json");
}

export function readAuthState(): AuthState | null {
    try {
        const raw = fs.readFileSync(getAuthFilePath(), "utf-8");
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

export function writeAuthState(state: AuthState): void {
    fs.writeFileSync(getAuthFilePath(), JSON.stringify(state, null, 2), "utf-8");
}

export function clearAuthState(): void {
    try {
        fs.unlinkSync(getAuthFilePath());
    } catch {
        // file didn't exist, that's fine
    }
}

function decodeJwtPayload(token: string): any {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("Invalid JWT");
    const payload = parts[1];
    // Base64url decode
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = Buffer.from(padded, "base64").toString("utf-8");
    return JSON.parse(decoded);
}

/**
 * Exchange authorization code for tokens via Google's token endpoint.
 * Uses Node's built-in https module to avoid adding dependencies.
 */
function exchangeCodeForTokens(
    code: string,
    redirectUri: string
): Promise<{ id_token: string; access_token: string; refresh_token?: string; expires_in: number }> {
    return new Promise((resolve, reject) => {
        const creds = loadOAuthCredentials();
        const postData = new URLSearchParams({
            code,
            client_id: creds.clientId,
            client_secret: creds.clientSecret,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
        }).toString();

        const url = new URL(GOOGLE_TOKEN_URL);
        const options: https.RequestOptions = {
            hostname: url.hostname,
            path: url.pathname,
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Content-Length": Buffer.byteLength(postData),
            },
        };

        const req = https.request(options, (res) => {
            let body = "";
            res.on("data", (chunk) => (body += chunk));
            res.on("end", () => {
                if (res.statusCode !== 200) {
                    reject(new Error(`Token exchange failed (${res.statusCode}): ${body}`));
                    return;
                }
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    reject(new Error(`Failed to parse token response: ${body}`));
                }
            });
        });
        req.on("error", reject);
        req.write(postData);
        req.end();
    });
}

/**
 * Start Google OAuth flow:
 * 1. Spin up a temporary HTTP server on an ephemeral port
 * 2. Open a BrowserWindow with Google's consent screen
 * 3. Catch the redirect with the authorization code
 * 4. Exchange code for tokens
 * 5. Store auth state in auth.json
 */
export async function startOAuthLogin(): Promise<AuthState> {
    return new Promise((resolve, reject) => {
        let authWindow: electron.BrowserWindow | null = null;
        let server: http.Server | null = null;
        let settled = false;

        function cleanup() {
            if (authWindow && !authWindow.isDestroyed()) {
                authWindow.close();
            }
            authWindow = null;
            if (server) {
                server.close();
                server = null;
            }
        }

        function settle(err: Error | null, result?: AuthState) {
            if (settled) return;
            settled = true;
            cleanup();
            if (err) {
                reject(err);
            } else {
                resolve(result!);
            }
        }

        // Create a temporary HTTP server to catch the OAuth redirect
        server = http.createServer(async (req, res) => {
            const reqUrl = new URL(req.url!, `http://127.0.0.1`);
            if (reqUrl.pathname !== "/callback") {
                res.writeHead(404);
                res.end("Not found");
                return;
            }

            const code = reqUrl.searchParams.get("code");
            const error = reqUrl.searchParams.get("error");

            if (error) {
                res.writeHead(200, { "Content-Type": "text/html" });
                res.end("<html><body><h2>Login cancelled</h2><p>You can close this window.</p><script>window.close()</script></body></html>");
                settle(new Error(`OAuth error: ${error}`));
                return;
            }

            if (!code) {
                res.writeHead(400, { "Content-Type": "text/html" });
                res.end("<html><body><h2>Missing authorization code</h2></body></html>");
                settle(new Error("No authorization code received"));
                return;
            }

            // Show a nice success page immediately
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(`<html><body style="font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #1a1a2e; color: #e0e0e0;">
                <div style="text-align: center;">
                    <h2 style="color: #ff00ff;">Signed in to Terminus</h2>
                    <p>You can close this window.</p>
                </div>
                <script>setTimeout(() => window.close(), 1500)</script>
            </body></html>`);

            try {
                const port = (server!.address() as any).port;
                const redirectUri = `http://127.0.0.1:${port}/callback`;
                const tokens = await exchangeCodeForTokens(code, redirectUri);
                const jwt = decodeJwtPayload(tokens.id_token);

                const authState: AuthState = {
                    email: jwt.email,
                    name: jwt.name || jwt.email,
                    picture: jwt.picture || "",
                    id_token: tokens.id_token,
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    token_expiry: Date.now() + tokens.expires_in * 1000,
                    sync_enabled: true,
                };

                writeAuthState(authState);
                settle(null, authState);
            } catch (e) {
                settle(e as Error);
            }
        });

        server.listen(0, "127.0.0.1", () => {
            const port = (server!.address() as any).port;
            const redirectUri = `http://127.0.0.1:${port}/callback`;

            // Build Google OAuth URL
            const state = crypto.randomBytes(16).toString("hex");
            const oauthCreds = loadOAuthCredentials();
            const params = new URLSearchParams({
                client_id: oauthCreds.clientId,
                redirect_uri: redirectUri,
                response_type: "code",
                scope: "email profile",
                access_type: "offline",
                prompt: "consent",
                state,
            });

            const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;

            // Create the popup window
            const parentWindow = focusedWaveWindow;
            authWindow = new electron.BrowserWindow({
                width: 500,
                height: 700,
                parent: parentWindow || undefined,
                modal: false,
                show: true,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                },
                title: "Sign in — Terminus",
                backgroundColor: "#1a1a2e",
            });

            authWindow.loadURL(authUrl);

            // If user closes the window before completing auth
            authWindow.on("closed", () => {
                authWindow = null;
                settle(new Error("Login window closed by user"));
            });
        });

        server.on("error", (err) => {
            settle(err);
        });
    });
}

/**
 * Make an authenticated request to the Kestris sync API.
 */
function kestrisRequest(
    url: string,
    method: string,
    token: string,
    body?: any
): Promise<any> {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const postData = body ? JSON.stringify(body) : null;

        const options: https.RequestOptions = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            method,
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                ...(postData ? { "Content-Length": Buffer.byteLength(postData) } : {}),
            },
        };

        const req = https.request(options, (res) => {
            let responseBody = "";
            res.on("data", (chunk) => (responseBody += chunk));
            res.on("end", () => {
                if (res.statusCode! < 200 || res.statusCode! >= 300) {
                    reject(new Error(`Kestris API error (${res.statusCode}): ${responseBody}`));
                    return;
                }
                try {
                    resolve(JSON.parse(responseBody));
                } catch {
                    resolve(responseBody);
                }
            });
        });
        req.on("error", reject);
        if (postData) req.write(postData);
        req.end();
    });
}

/**
 * Pull all synced configs from Kestris cloud.
 */
export async function pullConfigs(auth: AuthState, machineId: string): Promise<{
    configs: Record<string, any>;
    devices: any[];
    updated_at: string | null;
}> {
    const hostname = os.hostname();
    const platform = process.platform;
    const params = new URLSearchParams({
        machine_id: machineId,
        device_name: hostname,
        os: platform,
    });
    const url = `${KESTRIS_SYNC_URL}?${params.toString()}`;
    return kestrisRequest(url, "GET", auth.id_token);
}

/**
 * Push local configs to Kestris cloud.
 */
export async function pushConfigs(
    auth: AuthState,
    machineId: string,
    configs: Record<string, any>
): Promise<{ ok: boolean; updated_at: string }> {
    const hostname = os.hostname();
    const platform = process.platform;
    return kestrisRequest(KESTRIS_SYNC_URL, "POST", auth.id_token, {
        configs,
        machine_id: machineId,
        device_name: hostname,
        os: platform,
    });
}

/**
 * Get list of registered devices from Kestris cloud.
 */
export async function getDevices(auth: AuthState): Promise<{ devices: any[] }> {
    return kestrisRequest(KESTRIS_DEVICES_URL, "GET", auth.id_token);
}
