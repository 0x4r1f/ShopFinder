import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

/**
 * Format category label nicely (e.g. "retail" -> "Retail").
 *
 * @param {string} cat
 * @returns {string}
 */
function formatCategoryLabel(cat) {
  if (!cat) return 'Other';
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

/**
 * ShopFinder — Admin Listing Volume & Inventory Distribution Charts (Phase 12, Task 12.2)
 *
 * Visualizes active approved commercial property inventory across:
 * 1. Geographic distribution: Top 5 cities + Other (D-020).
 * 2. Commercial category distribution (retail, office, warehouse, etc.).
 * 3. Listing type (Rent vs. Sale).
 * 4. Overall moderation queue status.
 *
 * CRITICAL SEMANTIC INVARIANT:
 * Inventory distribution reflects current active approved properties (`status === 'approved'`),
 * NOT historical creation or approval velocity.
 *
 * @param {Object} props
 * @param {Object} props.listingVolume
 */
export default function AdminDistributionCharts({ listingVolume = {} }) {
  const {
    totalActive = 0,
    byCity = [],
    byCategory = [],
    byType = { rent: { count: 0, percentage: 0 }, sale: { count: 0, percentage: 0 } },
    moderationStatus = { approved: 0, pending: 0, rejected: 0, archived: 0, total: 0 },
  } = listingVolume;

  const rentCount = byType?.rent?.count || 0;
  const rentPct = byType?.rent?.percentage || 0;
  const saleCount = byType?.sale?.count || 0;
  const salePct = byType?.sale?.percentage || 0;

  return (
    <div
      className="space-y-6"
      data-testid="admin-distribution-charts"
    >
      {/* 2-Column Responsive Grid: Geographic & Category Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Top 5 Cities + Other (D-020) */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Inventory by Metropolitan City
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Top 5 cities + Other based on total approved properties ({totalActive} listings).
              </p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
              Top 5 + Other
            </span>
          </div>

          {(!byCity || byCity.length === 0) ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No approved listings recorded yet.
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              {byCity.map((item, idx) => (
                <div key={item.city} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground flex items-center gap-1.5">
                      <span className="w-5 text-[11px] font-mono text-muted-foreground">
                        #{idx + 1}
                      </span>
                      {item.city}
                    </span>
                    <span className="text-muted-foreground">
                      <strong className="text-foreground font-semibold">{item.count}</strong> listings ({item.percentage}%)
                    </span>
                  </div>
                  {/* Visual percentage progress bar */}
                  <div className="w-full h-2 rounded-full bg-muted/40 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        item.city === 'Other' ? 'bg-muted-foreground/60' : 'bg-primary'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(2, item.percentage))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card 2: Commercial Category Distribution */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Commercial Category Breakdown
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Active approved inventory distribution across 7 commercial property types.
              </p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
              {byCategory.length} Types
            </span>
          </div>

          <div
            className="w-full h-64"
            role="region"
            aria-label="Commercial Category Distribution Chart"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={byCategory.map((c) => ({ ...c, displayName: formatCategoryLabel(c.category) }))}
                margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="currentColor"
                  className="text-border/40"
                />
                <XAxis
                  dataKey="displayName"
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  tick={{ fontSize: 10, fill: 'currentColor' }}
                  className="text-muted-foreground"
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  className="text-muted-foreground"
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const point = payload[0]?.payload || {};
                    return (
                      <div className="bg-popover text-popover-foreground rounded-lg border border-border p-2.5 shadow-lg text-xs space-y-1">
                        <p className="font-semibold">{point.displayName}</p>
                        <p className="text-muted-foreground">
                          Approved: <strong className="text-foreground">{point.count}</strong> ({point.percentage}%)
                        </p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Screen-reader accessible data table */}
          <table className="sr-only">
            <caption>Commercial category inventory distribution</caption>
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Count</th>
                <th scope="col">Percentage</th>
              </tr>
            </thead>
            <tbody>
              {byCategory.map((c) => (
                <tr key={c.category}>
                  <td>{formatCategoryLabel(c.category)}</td>
                  <td>{c.count}</td>
                  <td>{c.percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 2: Rent vs Sale Ratio & Moderation Queue Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Rent vs Sale Commercial Ratio */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              Commercial Listing Type Ratio
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Active commercial spaces for rent vs commercial real estate for purchase.
            </p>
          </div>

          <div className="space-y-2.5 pt-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">
                For Rent: {rentCount} ({rentPct}%)
              </span>
              <span className="font-medium text-foreground">
                For Sale: {saleCount} ({salePct}%)
              </span>
            </div>

            <div className="w-full h-3 rounded-full bg-muted overflow-hidden flex">
              <div
                className="bg-blue-600 h-full transition-all duration-300"
                style={{ width: `${rentPct}%` }}
                title={`Rent: ${rentPct}%`}
              />
              <div
                className="bg-amber-500 h-full transition-all duration-300"
                style={{ width: `${salePct}%` }}
                title={`Sale: ${salePct}%`}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-600" /> Rent ({rentCount})
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> Sale ({saleCount})
              </span>
            </div>
          </div>
        </div>

        {/* Platform Moderation Queue Health */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              Listing Moderation Distribution
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Platform-wide moderation review status across all {moderationStatus.total} property submissions.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3">
            <div className="p-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-center">
              <span className="text-[10px] font-bold text-emerald-700 block uppercase tracking-wider">
                Approved
              </span>
              <span className="text-base font-extrabold text-foreground">
                {moderationStatus.approved}
              </span>
            </div>

            <div className="p-2.5 rounded-lg border border-amber-500/20 bg-amber-500/10 text-center">
              <span className="text-[10px] font-bold text-amber-700 block uppercase tracking-wider">
                Pending
              </span>
              <span className="text-base font-extrabold text-foreground">
                {moderationStatus.pending}
              </span>
            </div>

            <div className="p-2.5 rounded-lg border border-rose-500/20 bg-rose-500/10 text-center">
              <span className="text-[10px] font-bold text-rose-700 block uppercase tracking-wider">
                Rejected
              </span>
              <span className="text-base font-extrabold text-foreground">
                {moderationStatus.rejected}
              </span>
            </div>

            <div className="p-2.5 rounded-lg border border-border bg-muted/40 text-center">
              <span className="text-[10px] font-bold text-muted-foreground block uppercase tracking-wider">
                Archived
              </span>
              <span className="text-base font-extrabold text-foreground">
                {moderationStatus.archived}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
