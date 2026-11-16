import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { toMermaidSource } from "../lib/formats";
import { parseMermaidToIR } from "../lib/translate";
import {
  ChartContainer,
  ChartLegendRow,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "./ui/chart";

const COVERAGE_DATA = [
  { format: "Mermaid", diagramKinds: 12, targets: 7 },
  { format: "DOT", diagramKinds: 2, targets: 7 },
  { format: "PlantUML", diagramKinds: 3, targets: 7 },
  { format: "D2", diagramKinds: 2, targets: 7 },
  { format: "SQL", diagramKinds: 1, targets: 7 },
  { format: "TS", diagramKinds: 1, targets: 7 },
  { format: "XML", diagramKinds: 4, targets: 7 },
];

const COVERAGE_CONFIG: ChartConfig = {
  diagramKinds: {
    label: "Diagram modes",
    color: "#315158",
  },
  targets: {
    label: "Export & convert targets",
    color: "#ad612e",
  },
};

export function FormatCoverageChart() {
  return (
    <section className="home-chart-card" aria-labelledby="home-chart-title">
      <div className="home-chart-header">
        <div>
          <h2 id="home-chart-title">Format and translation coverage</h2>
          <p>Every input format compiles locally and converts across all 7 supported targets.</p>
        </div>
        <ChartLegendRow config={COVERAGE_CONFIG} />
      </div>
      <ChartContainer config={COVERAGE_CONFIG} className="home-chart-canvas">
        <BarChart data={COVERAGE_DATA} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#d7dfdc" strokeDasharray="3 3" />
          <XAxis
            dataKey="format"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#5a6d6f", fontSize: 11 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            tick={{ fill: "#5a6d6f", fontSize: 11 }}
          />
          <ChartTooltip
            cursor={{ fill: "rgb(28 52 57 / 6%)" }}
            content={<ChartTooltipContent config={COVERAGE_CONFIG} />}
          />
          <Bar dataKey="diagramKinds" fill="var(--color-diagramKinds)" radius={[4, 4, 0, 0]} maxBarSize={26} />
          <Bar dataKey="targets" fill="var(--color-targets)" radius={[4, 4, 0, 0]} maxBarSize={26} />
        </BarChart>
      </ChartContainer>
    </section>
  );
}

const METRICS_CONFIG: ChartConfig = {
  count: {
    label: "Elements",
    color: "#ad612e",
  },
};

export function DiagramMetricsChart({ code }: { code: string }) {
  const data = useMemo(() => {
    try {
      const { mermaid } = toMermaidSource(code);
      const ir = parseMermaidToIR(mermaid);
      const labels = ir.edges.filter((e) => Boolean(e.label)).length;
      const fields = ir.nodes.reduce((sum, n) => sum + (n.fields?.length ?? 0), 0);
      return [
        { metric: "Nodes", count: ir.nodes.length },
        { metric: "Lines", count: ir.edges.length },
        { metric: "Labels", count: labels },
        { metric: "Fields", count: fields },
      ];
    } catch {
      return [
        { metric: "Nodes", count: 0 },
        { metric: "Lines", count: 0 },
        { metric: "Labels", count: 0 },
        { metric: "Fields", count: 0 },
      ];
    }
  }, [code]);

  return (
    <div className="studio-metrics-chart">
      <ChartContainer config={METRICS_CONFIG} className="studio-metrics-canvas">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#d7dfdc" strokeDasharray="3 3" />
          <XAxis
            dataKey="metric"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#5a6d6f", fontSize: 10 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            tick={{ fill: "#5a6d6f", fontSize: 10 }}
          />
          <ChartTooltip
            cursor={{ fill: "rgb(28 52 57 / 6%)" }}
            content={<ChartTooltipContent config={METRICS_CONFIG} />}
          />
          <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
