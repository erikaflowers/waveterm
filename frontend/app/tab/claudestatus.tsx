// Claude Status indicator — polls status.claude.com and shows stoplight dots in the tab bar

import { getApi } from "@/store/global";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import "./claudestatus.scss";

interface ComponentStatus {
    id: string;
    name: string;
    status: string; // operational | degraded_performance | partial_outage | major_outage
}

interface StatusState {
    api: string;
    code: string;
    web: string;
    overall: string; // none | minor | major | critical
    lastUpdated: number;
    incident?: string; // active incident name if any
}

const STATUS_URL = "https://status.claude.com/api/v2/summary.json";
const POLL_INTERVAL = 60_000; // 60 seconds

// Map component names to our shorthand keys
function mapComponents(components: ComponentStatus[]): Pick<StatusState, "api" | "code" | "web"> {
    const result = { api: "operational", code: "operational", web: "operational" };
    for (const c of components) {
        if (c.name === "Claude API (api.anthropic.com)") result.api = c.status;
        else if (c.name === "Claude Code") result.code = c.status;
        else if (c.name === "claude.ai") result.web = c.status;
    }
    return result;
}

function statusToColor(status: string): string {
    switch (status) {
        case "operational":
            return "green";
        case "degraded_performance":
            return "yellow";
        case "partial_outage":
            return "yellow";
        case "major_outage":
            return "red";
        default:
            return "gray";
    }
}

function overallToColor(indicator: string): string {
    switch (indicator) {
        case "none":
            return "green";
        case "minor":
            return "yellow";
        case "major":
            return "red";
        case "critical":
            return "red";
        default:
            return "gray";
    }
}

function statusLabel(status: string): string {
    switch (status) {
        case "operational":
            return "Operational";
        case "degraded_performance":
            return "Degraded";
        case "partial_outage":
            return "Partial Outage";
        case "major_outage":
            return "Major Outage";
        default:
            return "Unknown";
    }
}

const ClaudeStatus = memo(
    ({ divRef }: { divRef?: React.RefObject<HTMLDivElement> }) => {
        const [status, setStatus] = useState<StatusState>({
            api: "operational",
            code: "operational",
            web: "operational",
            overall: "none",
            lastUpdated: 0,
        });
        const [error, setError] = useState(false);
        const mountedRef = useRef(true);

        const fetchStatus = useCallback(async () => {
            try {
                const resp = await fetch(STATUS_URL);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const data = await resp.json();
                if (!mountedRef.current) return;

                const mapped = mapComponents(data.components ?? []);
                const incident = data.incidents?.[0]?.name ?? undefined;
                setStatus({
                    ...mapped,
                    overall: data.status?.indicator ?? "none",
                    lastUpdated: Date.now(),
                    incident,
                });
                setError(false);
            } catch (e) {
                console.warn("[claude-status] fetch failed:", e);
                if (mountedRef.current) setError(true);
            }
        }, []);

        useEffect(() => {
            mountedRef.current = true;
            fetchStatus();
            const id = setInterval(fetchStatus, POLL_INTERVAL);
            return () => {
                mountedRef.current = false;
                clearInterval(id);
            };
        }, [fetchStatus]);

        const handleClick = useCallback(() => {
            getApi().openExternal("https://status.claude.com");
        }, []);

        // Build tooltip text
        const lines = [
            `API: ${statusLabel(status.api)}`,
            `Code: ${statusLabel(status.code)}`,
            `Web: ${statusLabel(status.web)}`,
        ];
        if (status.incident) {
            lines.push(`\nActive: ${status.incident}`);
        }
        if (error) {
            lines.push("\n(Status check failed)");
        }
        const tooltip = lines.join("\n");

        const overallColor = error ? "gray" : overallToColor(status.overall);

        return (
            <div
                ref={divRef}
                className="claude-status"
                onClick={handleClick}
                title={tooltip}
                style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            >
                <div className={`claude-status-dot dot-${statusToColor(status.api)}`} />
                <div className={`claude-status-dot dot-${statusToColor(status.code)}`} />
                <div className={`claude-status-dot dot-${statusToColor(status.web)}`} />
                <span className={`claude-status-label label-${overallColor}`}>
                    {error ? "—" : overallColor === "green" ? "Claude" : "Claude"}
                </span>
            </div>
        );
    }
);
ClaudeStatus.displayName = "ClaudeStatus";

export { ClaudeStatus };
