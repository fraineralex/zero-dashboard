"use client";

import * as React from "react";
import { Legend, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils";

export type ChartConfig = Record<string, { label?: React.ReactNode; color?: string }>;

const ChartContext = React.createContext<{ config: ChartConfig }>({ config: {} });

export function ChartContainer({ config, className, children, ...props }: React.ComponentProps<"div"> & { config: ChartConfig; children: React.ComponentProps<typeof ResponsiveContainer>["children"] }) {
  const id = React.useId().replace(/:/g, "");
  return (
    <ChartContext.Provider value={{ config }}>
      <div data-chart={id} role="img" className={cn("chart-container", className)} {...props}>
        <style>{Object.entries(config).map(([key, item]) => `[data-chart=${id}] { --color-${key}: ${item.color ?? "#737373"}; }`).join("\n")}</style>
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

export const ChartTooltip = Tooltip;
export const ChartLegend = Legend;

type TooltipEntry = { dataKey?: string | number; name?: string | number; value?: string | number; color?: string; payload?: Record<string, unknown> };

export function ChartTooltipContent({ active, payload, label, formatter }: { active?: boolean; payload?: TooltipEntry[]; label?: string; formatter?: (value: string | number, name: string, item: TooltipEntry) => string }) {
  const { config } = React.useContext(ChartContext);
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      {label ? <p className="chart-tooltip-label">{label}</p> : null}
      {payload.map((item) => {
        const key = String(item.dataKey ?? item.name ?? "value");
        const name = String(config[key]?.label ?? item.name ?? key);
        return (
          <div className="chart-tooltip-row" key={key}>
            <span className="chart-tooltip-dot" style={{ background: item.color ?? config[key]?.color }} />
            <span>{name}</span>
            <strong>{formatter ? formatter(item.value ?? "", name, item) : item.value}</strong>
          </div>
        );
      })}
    </div>
  );
}
