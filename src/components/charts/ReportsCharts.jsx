import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";

const COLORS = ["#00C7D9","#7C5BFA","#F59E0B","#22C55E","#EF4444","#EC4899","#3B82F6","#F97316"];

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl px-3 py-2 border border-border text-xs">
      <p className="text-muted-foreground">{label}</p>
      <p className="text-titan-cyan font-semibold">${payload[0].value?.toLocaleString()}</p>
    </div>
  );
}

export default function ReportsCharts({
  monthlyData,
  serviceData,
  expCatData,
  hasMonthly,
  hasService,
  hasExpCat,
}) {
  return (
    <>
      <div className="glass rounded-2xl p-6 mb-6">
        <h3 className="text-base font-semibold text-foreground mb-1">Revenue vs Expenses</h3>
        <p className="text-xs text-muted-foreground mb-6">Last 6 months</p>
        {!hasMonthly ? (
          <div className="h-48 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">No data yet</p>
          </div>
        ) : (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} barCategoryGap="30%">
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 12 }} />
                <YAxis hide />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }} />
                <Bar dataKey="revenue" name="Revenue" fill="#00C7D9" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass rounded-2xl p-6">
          <h3 className="text-base font-semibold text-foreground mb-1">Revenue by Service</h3>
          <p className="text-xs text-muted-foreground mb-4">Where the money comes from</p>
          {!hasService ? (
            <div className="h-40 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">No job data yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {serviceData.map((item, i) => {
                const pct = serviceData[0].value > 0 ? Math.round((item.value / serviceData[0].value) * 100) : 0;
                return (
                  <div key={item.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground capitalize">{item.name}</span>
                      <span className="text-foreground font-semibold tabular-nums">${item.value.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="glass rounded-2xl p-6">
          <h3 className="text-base font-semibold text-foreground mb-1">Expenses by Category</h3>
          <p className="text-xs text-muted-foreground mb-4">Where money goes</p>
          {!hasExpCat ? (
            <div className="h-40 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">No expense data yet</p>
            </div>
          ) : (
            <>
              <div className="h-36 mb-3">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={expCatData} dataKey="value" cx="50%" cy="50%" outerRadius={60} innerRadius={32} paddingAngle={3}>
                      {expCatData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                {expCatData.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-xs text-muted-foreground capitalize">{item.name}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
