"use client";
import { useTranslations } from "next-intl";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Legend, Tooltip } from "recharts";
import type { DimensionId } from "@/lib/dimensions";

export const SERIES_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

export interface RadarSeries {
  name: string;
  scores: Partial<Record<DimensionId, number | null>>;
}

/** Radar of 0–100 dimension scores. A visually hidden table carries the same data for screen readers. */
export function ScoreRadar({ dims, series, caption }: { dims: DimensionId[]; series: RadarSeries[]; caption: string }) {
  const td = useTranslations("dims");
  const data = dims.map((d) => {
    const row: Record<string, string | number | null> = { dim: td(`${d}.name`) };
    series.forEach((s, i) => (row[`s${i}`] = s.scores[d] ?? null));
    return row;
  });
  return (
    <figure>
      <div className="h-80 w-full" aria-hidden>
        <ResponsiveContainer>
          <RadarChart data={data} outerRadius="70%">
            <PolarGrid stroke="var(--border)" />
            <PolarAngleAxis dataKey="dim" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            {series.map((s, i) => (
              <Radar
                key={s.name}
                name={s.name}
                dataKey={`s${i}`}
                stroke={SERIES_COLORS[i]}
                fill={SERIES_COLORS[i]}
                fillOpacity={series.length > 1 ? 0.08 : 0.25}
                strokeWidth={2}
                isAnimationActive={false}
              />
            ))}
            {series.length > 1 ? <Legend wrapperStyle={{ fontSize: 12 }} /> : null}
            <Tooltip
              contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
              formatter={(v) => (typeof v === "number" ? v.toFixed(0) : "—")}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="text-xs text-muted-foreground">{caption}</figcaption>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{"Dimension"}</th>
            {series.map((s) => (
              <th key={s.name} scope="col">
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dims.map((d) => (
            <tr key={d}>
              <th scope="row">{td(`${d}.name`)}</th>
              {series.map((s) => (
                <td key={s.name}>{s.scores[d] === null || s.scores[d] === undefined ? "—" : Math.round(s.scores[d]!)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
