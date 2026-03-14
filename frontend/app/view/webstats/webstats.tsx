// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { BlockNodeModel } from "@/app/block/blocktypes";
import { WOS } from "@/app/store/global";
import type { TabModel } from "@/app/store/tab-model";
import * as jotai from "jotai";
import * as React from "react";

// --- Config ---

const PLAUSIBLE_API = "https://plausible.io/api/v2/query";
const PLAUSIBLE_KEY = "Rey87TB1jDYLMuED9KhP4uaLIzNK0NFa2Yq9kZgddKftE3e1q1dn4EO-yBNP7rVc";
const SITE_ID = "zerovector.design";
const POLL_INTERVAL = 60000;

// --- Types ---

type DateRange = "day" | "7d" | "30d" | "12mo";

function getExplicitDateRange(range: DateRange): string | [string, string] {
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().split("T")[0];
    const today = fmt(now);
    switch (range) {
        case "day":
            return "day";
        case "7d": {
            const d = new Date(now);
            d.setDate(d.getDate() - 6);
            return [fmt(d), today];
        }
        case "30d": {
            const d = new Date(now);
            d.setDate(d.getDate() - 29);
            return [fmt(d), today];
        }
        case "12mo": {
            const d = new Date(now);
            d.setFullYear(d.getFullYear() - 1);
            return [fmt(d), today];
        }
    }
}

type AggregateStats = {
    visitors: number;
    visits: number;
    pageviews: number;
    bounceRate: number;
    visitDuration: number;
    viewsPerVisit: number;
};

type BreakdownRow = {
    dimension: string;
    visitors: number;
    pageviews?: number;
};

type StatsData = {
    realtime: number;
    aggregate: AggregateStats | null;
    topPages: BreakdownRow[];
    topSources: BreakdownRow[];
};

// --- API ---

async function plausibleQuery(body: object): Promise<any> {
    const resp = await fetch(PLAUSIBLE_API, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${PLAUSIBLE_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ site_id: SITE_ID, ...body }),
    });
    if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`Plausible ${resp.status}: ${text}`);
    }
    return resp.json();
}

async function fetchRealtime(): Promise<number> {
    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const data = await plausibleQuery({
        date_range: [fiveMinAgo.toISOString(), now.toISOString()],
        metrics: ["visitors"],
    });
    return data?.results?.[0]?.metrics?.[0] ?? 0;
}

async function fetchAggregate(dateRange: DateRange): Promise<AggregateStats> {
    const data = await plausibleQuery({
        date_range: getExplicitDateRange(dateRange),
        metrics: ["visitors", "visits", "pageviews", "bounce_rate", "visit_duration", "views_per_visit"],
    });
    const m = data?.results?.[0]?.metrics ?? [0, 0, 0, 0, 0, 0];
    return {
        visitors: m[0] ?? 0,
        visits: m[1] ?? 0,
        pageviews: m[2] ?? 0,
        bounceRate: m[3] ?? 0,
        visitDuration: m[4] ?? 0,
        viewsPerVisit: m[5] ?? 0,
    };
}

async function fetchTopPages(dateRange: DateRange): Promise<BreakdownRow[]> {
    const data = await plausibleQuery({
        date_range: getExplicitDateRange(dateRange),
        metrics: ["visitors", "pageviews"],
        dimensions: ["event:page"],
        pagination: { limit: 10, offset: 0 },
    });
    return (data?.results ?? []).map((r: any) => ({
        dimension: r.dimensions?.[0] ?? "",
        visitors: r.metrics?.[0] ?? 0,
        pageviews: r.metrics?.[1] ?? 0,
    }));
}

async function fetchTopSources(dateRange: DateRange): Promise<BreakdownRow[]> {
    const data = await plausibleQuery({
        date_range: getExplicitDateRange(dateRange),
        metrics: ["visitors"],
        dimensions: ["visit:source"],
        pagination: { limit: 10, offset: 0 },
    });
    return (data?.results ?? []).map((r: any) => ({
        dimension: r.dimensions?.[0] || "Direct / None",
        visitors: r.metrics?.[0] ?? 0,
    }));
}

// --- ViewModel ---

class WebStatsViewModel implements ViewModel {
    viewType: string;
    nodeModel: BlockNodeModel;
    tabModel: TabModel;
    blockId: string;
    blockAtom: jotai.Atom<Block>;
    viewIcon: jotai.Atom<string>;
    viewName: jotai.Atom<string>;
    viewComponent: ViewComponent;
    endIconButtons: jotai.Atom<IconButtonDecl[]>;

    constructor(blockId: string, nodeModel: BlockNodeModel, tabModel: TabModel) {
        this.viewType = "webstats";
        this.blockId = blockId;
        this.nodeModel = nodeModel;
        this.tabModel = tabModel;
        this.blockAtom = WOS.getWaveObjectAtom<Block>(`block:${blockId}`);
        this.viewIcon = jotai.atom("chart-line");
        this.viewName = jotai.atom("Web Stats");
        this.viewComponent = WebStatsView;
        this.endIconButtons = jotai.atom<IconButtonDecl[]>([]);
    }
}

// --- Components ---

const MetricCard = React.memo(({ value, label, format }: { value: number; label: string; format?: "percent" | "duration" | "decimal" }) => {
    let display: string;
    if (format === "percent") {
        display = `${Math.round(value)}%`;
    } else if (format === "duration") {
        const mins = Math.floor(value / 60);
        const secs = Math.round(value % 60);
        display = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    } else if (format === "decimal") {
        display = value.toFixed(1);
    } else {
        display = value.toLocaleString();
    }

    return (
        <div
            style={{
                flex: "1 1 0",
                minWidth: 70,
                padding: "8px 10px",
                background: "rgba(255,255,255,0.03)",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.06)",
            }}
        >
            <div className="text-[18px] font-bold font-mono" style={{ color: "var(--main-text-color)" }}>
                {display}
            </div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--secondary-text-color)", marginTop: 2 }}>
                {label}
            </div>
        </div>
    );
});
MetricCard.displayName = "MetricCard";

const BreakdownList = React.memo(({ title, rows, showPageviews }: { title: string; rows: BreakdownRow[]; showPageviews?: boolean }) => {
    if (rows.length === 0) {
        return (
            <div style={{ flex: "1 1 0", minWidth: 0 }}>
                <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--secondary-text-color)", marginBottom: 6 }}>
                    {title}
                </div>
                <div className="text-[11px]" style={{ color: "var(--secondary-text-color)", opacity: 0.5 }}>
                    No data
                </div>
            </div>
        );
    }

    const maxVisitors = Math.max(...rows.map((r) => r.visitors), 1);

    return (
        <div style={{ flex: "1 1 0", minWidth: 0 }}>
            <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--secondary-text-color)", marginBottom: 6 }}>
                {title}
            </div>
            <div className="flex flex-col gap-0.5">
                {rows.map((row, i) => (
                    <div key={i} className="flex items-center gap-2" style={{ position: "relative", padding: "3px 6px", borderRadius: 3 }}>
                        <div
                            style={{
                                position: "absolute",
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: `${(row.visitors / maxVisitors) * 100}%`,
                                background: "rgba(59, 130, 246, 0.08)",
                                borderRadius: 3,
                            }}
                        />
                        <span
                            className="text-[11px] truncate"
                            style={{ flex: 1, minWidth: 0, color: "var(--main-text-color)", position: "relative" }}
                        >
                            {row.dimension}
                        </span>
                        <span className="text-[11px] font-mono flex-shrink-0" style={{ color: "var(--secondary-text-color)", position: "relative" }}>
                            {row.visitors}
                        </span>
                        {showPageviews && row.pageviews != null && (
                            <span
                                className="text-[10px] font-mono flex-shrink-0"
                                style={{ color: "var(--secondary-text-color)", opacity: 0.5, position: "relative", minWidth: 30, textAlign: "right" }}
                            >
                                {row.pageviews}pv
                            </span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
});
BreakdownList.displayName = "BreakdownList";

// --- Main View ---

const WebStatsView: React.FC<ViewComponentProps<WebStatsViewModel>> = ({ model }) => {
    const [stats, setStats] = React.useState<StatsData>({ realtime: 0, aggregate: null, topPages: [], topSources: [] });
    const [dateRange, setDateRange] = React.useState<DateRange>("7d");
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const refresh = React.useCallback(
        async (range?: DateRange) => {
            const dr = range ?? dateRange;
            setLoading(true);
            setError(null);
            try {
                const [realtime, aggregate, topPages, topSources] = await Promise.all([
                    fetchRealtime(),
                    fetchAggregate(dr),
                    fetchTopPages(dr),
                    fetchTopSources(dr),
                ]);
                setStats({ realtime, aggregate, topPages, topSources });
            } catch (e: any) {
                console.error("[webstats] fetch error:", e);
                setError(e.message || "Failed to load stats");
            }
            setLoading(false);
        },
        [dateRange]
    );

    const handleRangeChange = React.useCallback(
        (range: DateRange) => {
            setDateRange(range);
            refresh(range);
        },
        [refresh]
    );

    // Poll on mount + interval
    React.useEffect(() => {
        refresh();
        const interval = setInterval(() => refresh(), POLL_INTERVAL);
        return () => clearInterval(interval);
    }, [refresh]);

    const agg = stats.aggregate;
    const ranges: { label: string; value: DateRange }[] = [
        { label: "Today", value: "day" },
        { label: "7d", value: "7d" },
        { label: "30d", value: "30d" },
        { label: "12mo", value: "12mo" },
    ];

    return (
        <div
            className="flex flex-col overflow-hidden"
            style={{ background: "var(--block-bg-color)", flex: "1 1 0", minWidth: 0, height: "100%", alignSelf: "stretch" }}
        >
            {/* Header bar */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10" style={{ width: "100%" }}>
                <div className="flex items-center gap-2">
                    <span className="text-[12px] font-semibold text-muted uppercase tracking-wider">Zero Vector</span>
                    <span className="flex items-center gap-1">
                        <span
                            style={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                background: stats.realtime > 0 ? "#22c55e" : "#6b7280",
                                display: "inline-block",
                            }}
                        />
                        <span className="text-[11px] font-mono" style={{ color: stats.realtime > 0 ? "#22c55e" : "var(--secondary-text-color)" }}>
                            {stats.realtime} now
                        </span>
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    {ranges.map((r) => (
                        <button
                            key={r.value}
                            onClick={() => handleRangeChange(r.value)}
                            className="px-2 py-0.5 text-[10px] rounded"
                            style={{
                                background: dateRange === r.value ? "rgba(59, 130, 246, 0.2)" : "rgba(255,255,255,0.05)",
                                color: dateRange === r.value ? "#60a5fa" : "var(--secondary-text-color)",
                                border: dateRange === r.value ? "1px solid rgba(59, 130, 246, 0.3)" : "1px solid transparent",
                                cursor: "pointer",
                                fontWeight: dateRange === r.value ? 600 : 400,
                            }}
                        >
                            {r.label}
                        </button>
                    ))}
                    <button
                        onClick={() => refresh()}
                        className="text-[11px] text-muted hover:text-white px-1.5 py-0.5 rounded ml-1"
                        style={{ background: "rgba(255,255,255,0.05)", cursor: "pointer", border: "none" }}
                        title="Refresh"
                    >
                        <i className={`fa-sharp fa-solid fa-arrows-rotate ${loading ? "fa-spin" : ""}`} />
                    </button>
                </div>
            </div>

            {/* Error banner */}
            {error && (
                <div className="px-3 py-2 text-[11px]" style={{ color: "#ef4444", background: "rgba(239,68,68,0.08)", borderBottom: "1px solid rgba(239,68,68,0.15)" }}>
                    {error}
                </div>
            )}

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-4" style={{ width: "100%", minWidth: 0 }}>
                {/* Metric cards */}
                {agg && (
                    <div className="flex gap-2 flex-wrap">
                        <MetricCard value={agg.visitors} label="Visitors" />
                        <MetricCard value={agg.visits} label="Visits" />
                        <MetricCard value={agg.pageviews} label="Pageviews" />
                        <MetricCard value={agg.bounceRate} label="Bounce" format="percent" />
                        <MetricCard value={agg.visitDuration} label="Duration" format="duration" />
                        <MetricCard value={agg.viewsPerVisit} label="Views/Visit" format="decimal" />
                    </div>
                )}

                {/* Loading placeholder */}
                {!agg && !error && (
                    <div className="flex items-center justify-center py-8">
                        <span className="text-[12px] text-muted">Loading stats...</span>
                    </div>
                )}

                {/* Breakdowns */}
                {(stats.topPages.length > 0 || stats.topSources.length > 0) && (
                    <div className="flex gap-4" style={{ width: "100%" }}>
                        <BreakdownList title="Top Pages" rows={stats.topPages} showPageviews />
                        <BreakdownList title="Top Sources" rows={stats.topSources} />
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="flex items-center px-3 py-1.5 border-t border-white/10" style={{ width: "100%" }}>
                <span className="text-[10px] text-muted" style={{ opacity: 0.5 }}>
                    plausible · {SITE_ID}
                </span>
            </div>
        </div>
    );
};

export { WebStatsViewModel };
