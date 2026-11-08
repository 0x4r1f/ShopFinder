import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

/**
 * ShopFinder — Admin User Growth Dynamics Chart (Phase 12, Task 12.2)
 *
 * Visualizes daily platform account registrations segmented by user role
 * (Customers, Property Owners, System Administrators) over 7d/30d/90d.
 *
 * @param {Object} props
 * @param {Array<{date: string, label: string, customer: number, owner: number, admin: number, total: number}>} props.data
 * @param {Object} [props.totals={}]
 * @param {number} [props.periodNewUsers=0]
 */
export default function AdminUserGrowthChart({
  data = [],
  totals = {},
  periodNewUsers = 0,
}) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground bg-card rounded-xl border border-border p-6">
        No user registration data recorded for this timeframe.
      </div>
    );
  }

  return (
    <div
      className="bg-card rounded-xl border border-border p-6 shadow-xs space-y-4"
      data-testid="admin-user-growth-chart"
    >
      {/* Header & Sub-KPIs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            User Registration & Growth Dynamics
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Daily platform onboarding volume segmented across Customers, Property Owners, and Admins.
          </p>
        </div>

        <div className="flex items-center gap-4 text-right">
          <div>
            <span className="text-[11px] font-medium text-muted-foreground block">
              Period Signups
            </span>
            <span className="text-lg font-bold text-foreground">
              +{periodNewUsers}
            </span>
          </div>
          <div className="border-l border-border pl-4">
            <span className="text-[11px] font-medium text-muted-foreground block">
              Total Accounts
            </span>
            <span className="text-sm font-semibold text-muted-foreground">
              {totals.all || 0}
            </span>
          </div>
        </div>
      </div>

      {/* Role Distribution Chips */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-600 border border-blue-500/20">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          Customers: <strong className="font-bold">{totals.customers || 0}</strong>
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Owners: <strong className="font-bold">{totals.owners || 0}</strong>
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500/10 text-purple-600 border border-purple-500/20">
          <span className="w-2 h-2 rounded-full bg-purple-500" />
          Admins: <strong className="font-bold">{totals.admins || 0}</strong>
        </span>
      </div>

      {/* Chart Visualization */}
      <div
        className="w-full h-72 sm:h-80"
        role="region"
        aria-label="User Registration Growth Chart"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
          >
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
                      <span className="flex items-center gap-1.5 text-blue-600">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        Customers:
                      </span>
                      <span className="font-bold text-foreground">
                        {point.customer || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 text-emerald-600">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Owners:
                      </span>
                      <span className="font-bold text-foreground">
                        {point.owner || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 text-purple-600">
                        <span className="w-2 h-2 rounded-full bg-purple-500" />
                        Admins:
                      </span>
                      <span className="font-bold text-foreground">
                        {point.admin || 0}
                      </span>
                    </div>
                    <div className="pt-1 border-t border-border/50 flex items-center justify-between gap-3 font-bold">
                      <span>Total New Users:</span>
                      <span>{point.total || 0}</span>
                    </div>
                  </div>
                );
              }}
            />

            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ paddingBottom: '10px', fontSize: '12px' }}
            />

            <Bar dataKey="customer" name="Customers" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
            <Bar dataKey="owner" name="Owners" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
            <Bar dataKey="admin" name="Admins" stackId="a" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Screen-reader accessible data table */}
      <table className="sr-only">
        <caption>Daily user registrations by role</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Customers</th>
            <th scope="col">Owners</th>
            <th scope="col">Admins</th>
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.date}>
              <td>{row.label || row.date}</td>
              <td>{row.customer}</td>
              <td>{row.owner}</td>
              <td>{row.admin}</td>
              <td>{row.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
