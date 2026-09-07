"use client";

// Small dependency-free SVG charts for the reports and dashboard. Enough
// for bars and a line over time; not a charting library.

import React from "react";

export interface Point {
  label: string;
  value: number;
}

const ACCENT = "var(--accent, #bee304)";

function niceMax(values: number[]) {
  const max = Math.max(0, ...values);
  if (max === 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const step = max / magnitude;
  const nice = step <= 1 ? 1 : step <= 2 ? 2 : step <= 5 ? 5 : 10;
  return nice * magnitude;
}

function format(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (Math.abs(n) >= 10_000) return `${(n / 1000).toFixed(0)}k`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function BarChart({ data, height = 180, color = ACCENT, valueSuffix = "" }: { data: Point[]; height?: number; color?: string; valueSuffix?: string }) {
  if (!data.length) return <p className="text-sm text-neutral-500">No data for this range.</p>;
  const width = 600;
  const padL = 36;
  const padB = 24;
  const padT = 8;
  const innerW = width - padL - 8;
  const innerH = height - padB - padT;
  const max = niceMax(data.map((d) => d.value));
  const barW = innerW / data.length;
  const labelEvery = Math.max(1, Math.ceil(data.length / 10));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Bar chart">
      {[0, 0.5, 1].map((t) => {
        const y = padT + innerH - innerH * t;
        return (
          <g key={t}>
            <line x1={padL} x2={width - 8} y1={y} y2={y} stroke="#e5e5e5" strokeWidth="1" />
            <text x={padL - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#737373">
              {format(max * t)}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const h = max ? (d.value / max) * innerH : 0;
        const x = padL + i * barW + barW * 0.15;
        const y = padT + innerH - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW * 0.7} height={h} rx="2" fill={color}>
              <title>
                {d.label}: {d.value}
                {valueSuffix}
              </title>
            </rect>
            {i % labelEvery === 0 && (
              <text x={x + barW * 0.35} y={height - 8} textAnchor="middle" fontSize="10" fill="#737373">
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function LineChart({ series, height = 180 }: { series: { name: string; color?: string; data: Point[] }[]; height?: number }) {
  const first = series[0];
  if (!first || !first.data.length) return <p className="text-sm text-neutral-500">No data for this range.</p>;
  const width = 600;
  const padL = 36;
  const padB = 24;
  const padT = 8;
  const innerW = width - padL - 8;
  const innerH = height - padB - padT;
  const max = niceMax(series.flatMap((s) => s.data.map((d) => d.value)));
  const n = first.data.length;
  const x = (i: number) => padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => padT + innerH - (max ? (v / max) * innerH : 0);
  const labelEvery = Math.max(1, Math.ceil(n / 10));

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Line chart">
        {[0, 0.5, 1].map((t) => {
          const yy = padT + innerH - innerH * t;
          return (
            <g key={t}>
              <line x1={padL} x2={width - 8} y1={yy} y2={yy} stroke="#e5e5e5" strokeWidth="1" />
              <text x={padL - 6} y={yy + 4} textAnchor="end" fontSize="10" fill="#737373">
                {format(max * t)}
              </text>
            </g>
          );
        })}
        {series.map((s, si) => (
          <g key={si}>
            <polyline fill="none" stroke={s.color || (si === 0 ? "#171717" : ACCENT)} strokeWidth="2" points={s.data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ")} />
            {s.data.map((d, i) => (
              <circle key={i} cx={x(i)} cy={y(d.value)} r="2.5" fill={s.color || (si === 0 ? "#171717" : ACCENT)}>
                <title>
                  {s.name} · {d.label}: {d.value}
                </title>
              </circle>
            ))}
          </g>
        ))}
        {first.data.map((d, i) =>
          i % labelEvery === 0 ? (
            <text key={i} x={x(i)} y={height - 8} textAnchor="middle" fontSize="10" fill="#737373">
              {d.label}
            </text>
          ) : null
        )}
      </svg>
      {series.length > 1 && (
        <div className="mt-1 flex gap-4 text-xs text-neutral-600">
          {series.map((s, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className="inline-block h-2 w-4 rounded" style={{ background: s.color || (i === 0 ? "#171717" : "#bee304") }} /> {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function HBarList({ rows, valueLabel }: { rows: { label: string; value: number; hint?: string }[]; valueLabel?: (v: number) => string }) {
  if (!rows.length) return <p className="text-sm text-neutral-500">Nothing in this range.</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i}>
          <div className="flex justify-between text-xs text-neutral-700">
            <span className="truncate pr-2">{r.label}</span>
            <span className="shrink-0 font-medium">{valueLabel ? valueLabel(r.value) : r.value}{r.hint ? <span className="ml-1 text-neutral-400">{r.hint}</span> : null}</span>
          </div>
          <div className="mt-1 h-2 rounded bg-neutral-100">
            <div className="h-2 rounded" style={{ width: `${(r.value / max) * 100}%`, background: ACCENT }} />
          </div>
        </div>
      ))}
    </div>
  );
}
