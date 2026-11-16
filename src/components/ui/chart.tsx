import type { CSSProperties, ReactElement, ReactNode } from "react";
import { ResponsiveContainer, Tooltip } from "recharts";

export type ChartConfig = Record<
  string,
  {
    label: string;
    color: string;
  }
>;

interface ChartContainerProps {
  config: ChartConfig;
  children: ReactElement;
  className?: string;
}

export function ChartContainer({ config, children, className = "" }: ChartContainerProps) {
  const vars = Object.fromEntries(
    Object.entries(config).map(([key, item]) => [`--color-${key}`, item.color]),
  ) as CSSProperties;

  return (
    <div className={`shadcn-chart ${className}`} style={vars}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

export const ChartTooltip = Tooltip;

interface TooltipPayloadItem {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string;
}

interface ChartTooltipContentProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  config?: ChartConfig;
  unit?: string;
}

export function ChartTooltipContent({
  active,
  payload,
  label,
  config,
  unit = "",
}: ChartTooltipContentProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="shadcn-chart-tooltip">
      {label && <div className="shadcn-chart-tooltip-label">{label}</div>}
      <div className="shadcn-chart-tooltip-items">
        {payload.map((entry, idx) => {
          const key = String(entry.dataKey ?? entry.name ?? idx);
          const meta = config?.[key];
          const color = meta?.color ?? entry.color ?? "var(--accent)";
          const name = meta?.label ?? entry.name ?? key;
          return (
            <div key={key} className="shadcn-chart-tooltip-row">
              <span className="shadcn-chart-dot" style={{ backgroundColor: color }} />
              <span className="shadcn-chart-name">{name}</span>
              <span className="shadcn-chart-value">
                {entry.value}
                {unit}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ChartLegendRow({ config }: { config: ChartConfig }): ReactNode {
  return (
    <div className="shadcn-chart-legend">
      {Object.entries(config).map(([key, item]) => (
        <span key={key} className="shadcn-chart-legend-item">
          <span className="shadcn-chart-dot" style={{ backgroundColor: item.color }} />
          <span>{item.label}</span>
        </span>
      ))}
    </div>
  );
}
