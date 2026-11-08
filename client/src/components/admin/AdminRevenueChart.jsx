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
 * Formats numeric amount to BDT currency string (e.g. "৳12,500").
 *
 * @param {number} amount
 * @returns {string}
 */
function formatBdt(amount) {
  const val = Number(amount) || 0;
  return `৳${val.toLocaleString()}`;
}

/**
 * ShopFinder — Admin Revenue & Financial Performance Chart (Phase 12, Task 12.2)
 *
 * Visualizes daily gross BDT revenue and successful transaction volume over 7d/30d/90d.
 * STRICT INVARIANT: Only successful BDT payments are included; pending/failed are excluded.
 *
 * @param {Object} props
 * @param {Array<{date: string, label: string, revenueBdt: number, transactions: number}>} props.data
 * @param {number} [props.periodRevenueBdt=0]
 * @param {number} [props.lifetimeRevenueBdt=0]
 * @param {Array<{planId: string, name: string, price: number, count: number, revenueBdt: number, revenuePercentage: number}>} [props.byPlan=[]]
 */
export default function AdminRevenueChart({
  data = [],
  periodRevenueBdt = 0,
  lifetimeRevenueBdt = 0,
  byPlan = [],
}) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground bg-card rounded-xl border border-border p-6">
        No financial transaction data recorded for this timeframe.
      </div>
    );
  }

  return (
    <div
      className="bg-card rounded-xl border border-border p-6 shadow-xs space-y-4"
      data-testid="admin-revenue-chart"
    >
      {/* Header & Sub-KPIs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">
              Gross Platform Revenue (BDT)
            </h3>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              Successful Only
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Daily gross revenue in Bangladeshi Taka from verified successful customer credit purchases.
          </p>
        </div>

        <div className="flex items-center gap-4 text-right">
          <div>
            <span className="text-[11px] font-medium text-muted-foreground block">
              Period Revenue
            </span>
            <span className="text-lg font-bold text-foreground">
              {formatBdt(periodRevenueBdt)}
            </span>
          </div>
          <div className="border-l border-border pl-4">
            <span className="text-[11px] font-medium text-muted-foreground block">
              Lifetime Revenue
            </span>
            <span className="text-sm font-semibold text-muted-foreground">
              {formatBdt(lifetimeRevenueBdt)}
            </span>
          </div>
        </div>
      </div>

      {/* Chart Visualization */}
      <div
        className="w-full h-72 sm:h-80"
        role="region"
        aria-label="Gross Platform Revenue Chart"
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
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
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => `৳${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
              tick={{ fontSize: 11, fill: 'currentColor' }}
              className="text-muted-foreground"
            />

            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                const point = payload[0]?.payload || {};

                return (
                  <div className="bg-popover text-popover-foreground rounded-lg border border-border p-3 shadow-lg text-xs space-y-1.5 min-w-[160px]">
                    <p className="font-semibold text-foreground border-b border-border/60 pb-1">
                      {label}
                    </p>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Revenue:</span>
                      <span className="font-bold text-emerald-600">
                        {formatBdt(point.revenueBdt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Transactions:</span>
                      <span className="font-semibold text-foreground">
                        {point.transactions || 0}
                      </span>
                    </div>
                  </div>
                );
              }}
            />

            <Area
              type="monotone"
              dataKey="revenueBdt"
              name="Gross Revenue"
              stroke="#10b981"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#revenueGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Screen-reader accessible data table */}
      <table className="sr-only">
        <caption>Daily gross revenue and transaction volume</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Revenue BDT</th>
            <th scope="col">Transactions</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.date}>
              <td>{row.label || row.date}</td>
              <td>{row.revenueBdt}</td>
              <td>{row.transactions}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Package Breakdown Cards */}
      {byPlan && byPlan.length > 0 && (
        <div className="pt-2 border-t border-border/50">
          <span className="text-xs font-semibold text-foreground block mb-2">
            Package Sales Contribution (Lifetime)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {byPlan.map((plan) => (
              <div
                key={plan.planId || plan.name}
                className="p-3 rounded-lg border border-border/70 bg-muted/20 flex items-center justify-between"
              >
                <div>
                  <span className="text-xs font-bold text-foreground block">
                    {plan.name} Package
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {plan.count} sold • {plan.revenuePercentage}% of gross
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-emerald-600">
                    {formatBdt(plan.revenueBdt)}
                  </span>
                  <span className="text-[10px] text-muted-foreground block">
                    @{formatBdt(plan.price)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
