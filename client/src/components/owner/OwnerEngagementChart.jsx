import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

/**
 * ShopFinder — Owner Daily Engagement Chart (Phase 12, Task 12.1)
 *
 * Visualizes daily trends for listing views, customer favorites, and contact reveals
 * over 7-day or 30-day timeframes using Recharts.
 *
 * @param {Object} props
 * @param {Array<{date: string, label: string, views: number, favorites: number, reveals: number}>} props.data
 */
export default function OwnerEngagementChart({ data = [] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
        No engagement activity recorded for this period.
      </div>
    );
  }

  return (
    <div className="w-full">
      <div
        className="w-full h-72 sm:h-80"
        role="region"
        aria-label="Daily Engagement Chart"
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="revealsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="favoritesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border/40" />

            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: 'currentColor' }}
              className="text-muted-foreground"
            />

            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: 'currentColor' }}
              className="text-muted-foreground"
            />

            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;

                return (
                  <div className="bg-popover text-popover-foreground rounded-lg border border-border p-3 shadow-lg text-xs space-y-1.5">
                    <p className="font-semibold text-foreground border-b border-border/60 pb-1">
                      {label}
                    </p>
                    {payload.map((entry, index) => (
                      <div key={`tooltip-${index}`} className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-1.5 capitalize">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: entry.color }}
                          />
                          {entry.name}:
                        </span>
                        <span className="font-bold">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />

            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }}
            />

            <Area
              type="monotone"
              dataKey="views"
              name="Views"
              stroke="#3b82f6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#viewsGradient)"
            />

            <Area
              type="monotone"
              dataKey="reveals"
              name="Inquiries (Reveals)"
              stroke="#10b981"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#revealsGradient)"
            />

            <Area
              type="monotone"
              dataKey="favorites"
              name="Favorites"
              stroke="#f59e0b"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#favoritesGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Screen-reader accessible data table */}
      <table className="sr-only">
        <caption>Daily engagement metrics over the selected period</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Views</th>
            <th scope="col">Inquiries</th>
            <th scope="col">Favorites</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.date}>
              <td>{row.label || row.date}</td>
              <td>{row.views}</td>
              <td>{row.reveals}</td>
              <td>{row.favorites}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

