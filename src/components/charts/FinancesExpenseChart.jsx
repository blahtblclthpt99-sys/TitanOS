import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = ["#00C7D9", "#7C5BFA", "#F59E0B", "#22C55E", "#EF4444", "#EC4899", "#3B82F6", "#F97316"];

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl px-3 py-2 border border-border text-xs">
      <p className="text-muted-foreground capitalize">{payload[0].name}</p>
      <p className="text-titan-cyan font-semibold">${payload[0].value?.toLocaleString()}</p>
    </div>
  );
}

export default function FinancesExpenseChart({ categoryData, expenseCount }) {
  if (!categoryData.length) return null;

  return (
    <div className="glass rounded-2xl p-6">
      <h3 className="text-base font-semibold text-foreground mb-1">Expenses by Category</h3>
      <p className="text-xs text-muted-foreground mb-4">{expenseCount} transactions recorded</p>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={categoryData}
              dataKey="value"
              cx="50%"
              cy="50%"
              outerRadius={68}
              innerRadius={38}
              paddingAngle={3}
            >
              {categoryData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4">
        {categoryData.map((item, i) => (
          <div key={item.name} className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <span className="text-xs text-muted-foreground capitalize">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
