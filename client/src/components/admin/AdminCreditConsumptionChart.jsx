import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

/**
 * ShopFinder — Admin Credit Consumption & Reveal Velocity Chart (Phase 12, Task 12.2)
 *
 * Visualizes daily property owner contact reveal inquiries (1 reveal = 1 credit)
 * and lifetime credit pool utilization metrics across commercial customers.
 *
 * @param {Object} props
 * @param {Array<{date: string, label: string, reveals: number}>} props.data
 * @param {Object} [props.summary={}]
 */
export default function AdminCreditConsumptionChart({
  data = [],
  summary = {},
}) {
  const {
    totalCreditsPurchased = 0,
    totalCreditsConsumed = 0,
    totalCreditsRemaining = 0,
    utilizationRate = 0,
    periodRevealsCount = 0,
    averageDailyReveals = 0,
  } = summary;

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground bg-card rounded-xl border border-border p-6">
        No contact reveal activity recorded for this timeframe.
      </div>
    );
  }

  return (
    <div
      className="bg-card rounded-xl border border-border p-6 shadow-xs space-y-4"
      data-testid="admin-credit-consumption-chart"
    >
      {/* Header & Sub-KPIs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">
              Credit Consumption & Reveal Velocity
            </h3>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-700 border border-amber-500/20">
              1 Reveal = 1 Credit
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Daily verified commercial owner contact unmaskings and platform-wide credit utilization.
          </p>
        </div>

        <div className="flex items-center gap-4 text-right">
          <div>
            <span className="text-[11px] font-medium text-muted-foreground block">
              Period Reveals
            </span>
            <span className="text-lg font-bold text-foreground">
              {periodRevealsCount}
            </span>
          </div>
          <div className="border-l border-border pl-4">
            <span className="text-[11px] font-medium text-muted-foreground block">
              Daily Average
            </span>
            <span className="text-sm font-semibold text-muted-foreground">
              {averageDailyReveals}/day
            </span>
          </div>
        </div>
      </div>

      {/* Credit Pool Summary Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg border border-border/70 bg-muted/20">
          <span className="text-[11px] text-muted-foreground block">
            Credits Purchased
          </span>
          <span className="text-base font-bold text-foreground">
            {totalCreditsPurchased.toLocaleString()}
          </span>
        </div>

        <div className="p-3 rounded-lg border border-border/70 bg-muted/20">
          <span className="text-[11px] text-muted-foreground block">
            Credits Consumed
          </span>
          <span className="text-base font-bold text-amber-600">
            {totalCreditsConsumed.toLocaleString()}
          </span>
        </div>

        <div className="p-3 rounded-lg border border-border/70 bg-muted/20">
          <span className="text-[11px] text-muted-foreground block">
            Remaining Pool
          </span>
          <span className="text-base font-bold text-emerald-600">
            {totalCreditsRemaining.toLocaleString()}
          </span>
        </div>

        <div className="p-3 rounded-lg border border-border/70 bg-muted/20">
          <span className="text-[11px] text-muted-foreground block">
            Platform Utilization
          </span>
          <span className="text-base font-bold text-foreground">
            {utilizationRate}%
          </span>
        </div>
      </div>

      {/* Chart Visualization */}
      <div
        className="w-full h-72 sm:h-80"
        role="region"
        aria-label="Daily Contact Reveal Velocity Chart"
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="revealsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="currentColor"
              className="text-border/40"
            />

            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: 'currentColor' }}
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
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                const point = payload[0]?.payload || {};

                return (
                  <div className="bg-popover text-popover-foreground rounded-lg border border-border p-3 shadow-lg text-xs space-y-1.5 min-w-[150px]">
                    <p className="font-semibold text-foreground border-b border-border/60 pb-1">
                      {label}
                    </p>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Contact Reveals:</span>
                      <span className="font-bold text-amber-600">
                        {point.reveals || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                      <span>Credits Deducted:</span>
                      <span className="font-semibold text-foreground">
                        {point.reveals || 0} cr
                      </span>
                    </div>
                  </div>
                );
              }}
            />

            <Area
              type="monotone"
              dataKey="reveals"
              name="Contact Reveals"
              stroke="#f59e0b"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#revealsGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Screen-reader accessible data table */}
      <table className="sr-only">
        <caption>Daily contact reveals and credit consumption</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Reveals</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.date}>
              <td>{row.label || row.date}</td>
              <td>{row.reveals}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
