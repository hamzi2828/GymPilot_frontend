"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// The two charts the accounts screen needs, and nothing else.
//
// Colours are the first two categorical slots, validated against this panel's
// white surface (CVD ΔE 24.7, normal-vision ΔE 33.6, both above the floor).
// They are assigned to the ENTITY, not to rank: money-in is always blue and
// money-out is always orange, so filtering never repaints them.
//
// Deliberately not status red for expenses: status colours are reserved for
// good/warning/critical, and an expense is not an error.
// ---------------------------------------------------------------------------

export const SERIES_IN = "#2a78d6";
export const SERIES_OUT = "#eb6834";

const INK_MUTED = "#898781";
const GRID = "#e1e0d9";
const AXIS = "#c3c2b7";

// Measures the container so text renders at real pixel size. A fixed viewBox
// scaled with CSS would stretch the labels along with the plot.
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    const update = () => setWidth(node.clientWidth);
    update();

    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

export interface TrendPoint {
  key: string;
  label: string;
  revenue: number;
  expense: number;
  net: number;
}

// ---------------------------------------------------------------------------
// Money in vs money out over time.
//
// One axis, two series of the SAME measure -- never a second y-scale, which is
// the mistake that makes two unrelated lines look correlated.
// ---------------------------------------------------------------------------
export function TrendChart({
  points,
  currency,
  format,
}: {
  points: TrendPoint[];
  currency: string;
  format: (value: number, currency?: string) => string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);

  const padding = { top: 16, right: 64, bottom: 28, left: 56 };
  const height = 240;
  const plotWidth = Math.max(0, width - padding.left - padding.right);
  const plotHeight = height - padding.top - padding.bottom;

  const max = Math.max(1, ...points.map((point) => Math.max(point.revenue, point.expense)));
  // Rounded up to a readable tick rather than the raw maximum, so the axis
  // reads 0 / 400 / 800 instead of 0 / 373 / 746.
  const step = niceStep(max / 3);
  const top = Math.ceil(max / step) * step;

  const x = (index: number) =>
    padding.left + (points.length <= 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const y = (value: number) => padding.top + plotHeight - (value / top) * plotHeight;

  const line = (pick: (point: TrendPoint) => number) =>
    points.map((point, index) => `${index ? "L" : "M"}${x(index)},${y(pick(point))}`).join(" ");

  const onMove = useCallback(
    (event: React.MouseEvent<SVGRectElement>) => {
      if (!points.length || plotWidth <= 0) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      const ratio = (event.clientX - bounds.left) / bounds.width;
      setHover(Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1)))));
    },
    [points.length, plotWidth]
  );

  const ticks = [0, 1, 2, 3].map((i) => (top / 3) * i);
  const last = points[points.length - 1];
  const active = hover !== null ? points[hover] : null;

  // Every label is thinned to fit rather than overlapping: a dense daily range
  // would otherwise print 60 dates on top of each other.
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(plotWidth / 64))));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          {/* Legend: always present for two series, and each line is also
              labelled at its endpoint, so identity never rests on colour. */}
          <Legend color={SERIES_IN} label="Money in" />
          <Legend color={SERIES_OUT} label="Money out" />
        </div>
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          className="text-[12px] font-medium text-neutral-500 hover:text-neutral-900"
        >
          {asTable ? "Show chart" : "Show table"}
        </button>
      </div>

      {asTable ? (
        <div className="max-h-[240px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-neutral-200">
                {["Period", "Money in", "Money out", "Net"].map((column) => (
                  <th
                    key={column}
                    className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-500"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {points.map((point) => (
                <tr key={point.key} className="border-b border-neutral-100 last:border-b-0">
                  <td className="px-3 py-1.5 text-neutral-700">{point.label}</td>
                  <td className="px-3 py-1.5 text-neutral-700">{format(point.revenue, currency)}</td>
                  <td className="px-3 py-1.5 text-neutral-700">{format(point.expense, currency)}</td>
                  <td className={`px-3 py-1.5 ${point.net < 0 ? "text-rose-600" : "text-neutral-900"}`}>
                    {format(point.net, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={ref} className="relative">
          {width > 0 && (
            <svg width={width} height={height} role="img" aria-label="Money in and money out over time">
              {/* Hairline grid, solid -- dashed rules read as a threshold. */}
              {ticks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={padding.left}
                    x2={width - padding.right}
                    y1={y(tick)}
                    y2={y(tick)}
                    stroke={tick === 0 ? AXIS : GRID}
                    strokeWidth="1"
                  />
                  <text
                    x={padding.left - 8}
                    y={y(tick) + 4}
                    textAnchor="end"
                    fontSize="11"
                    fill={INK_MUTED}
                    className="tabular-nums"
                  >
                    {compact(tick)}
                  </text>
                </g>
              ))}

              {points.map((point, index) =>
                index % labelEvery === 0 || index === points.length - 1 ? (
                  <text
                    key={point.key}
                    x={x(index)}
                    y={height - 8}
                    textAnchor="middle"
                    fontSize="11"
                    fill={INK_MUTED}
                  >
                    {point.label}
                  </text>
                ) : null
              )}

              <path d={line((point) => point.revenue)} fill="none" stroke={SERIES_IN} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              <path d={line((point) => point.expense)} fill="none" stroke={SERIES_OUT} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

              {/* Direct labels at the endpoint only -- a value on every point
                  is noise nobody reads. */}
              {last && points.length > 1 && (() => {
                // Both series end near zero on a quiet day, which stacks the two
                // labels on top of each other. Nudge them apart when they would
                // collide rather than letting them overprint.
                const inY = y(last.revenue);
                const outY = y(last.expense);
                const collides = Math.abs(inY - outY) < 14;
                const offset = collides ? 7 : 0;

                return (
                  <>
                    <EndLabel
                      x={x(points.length - 1)}
                      y={inY - (last.revenue >= last.expense ? offset : -offset)}
                      color={SERIES_IN}
                      text="in"
                    />
                    <EndLabel
                      x={x(points.length - 1)}
                      y={outY + (last.revenue >= last.expense ? offset : -offset)}
                      color={SERIES_OUT}
                      text="out"
                    />
                  </>
                );
              })()}

              {active && hover !== null && (
                <g>
                  <line
                    x1={x(hover)}
                    x2={x(hover)}
                    y1={padding.top}
                    y2={padding.top + plotHeight}
                    stroke={AXIS}
                    strokeWidth="1"
                  />
                  {/* 2px surface ring so the marker reads on top of the line. */}
                  <circle cx={x(hover)} cy={y(active.revenue)} r="5" fill={SERIES_IN} stroke="#ffffff" strokeWidth="2" />
                  <circle cx={x(hover)} cy={y(active.expense)} r="5" fill={SERIES_OUT} stroke="#ffffff" strokeWidth="2" />
                </g>
              )}

              {/* One overlay rather than per-point hit targets: anywhere in the
                  plot selects the nearest period. */}
              <rect
                x={padding.left}
                y={padding.top}
                width={Math.max(0, plotWidth)}
                height={plotHeight}
                fill="transparent"
                onMouseMove={onMove}
                onMouseLeave={() => setHover(null)}
              />
            </svg>
          )}

          {active && hover !== null && width > 0 && (
            <div
              className="pointer-events-none absolute z-10 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[12px] shadow-lg"
              style={{
                left: Math.min(Math.max(x(hover) - 70, 0), Math.max(0, width - 150)),
                top: 4,
                minWidth: 140,
              }}
            >
              <p className="mb-1 font-semibold text-neutral-900">{active.label}</p>
              <TooltipRow color={SERIES_IN} label="In" value={format(active.revenue, currency)} />
              <TooltipRow color={SERIES_OUT} label="Out" value={format(active.expense, currency)} />
              <div className="mt-1 border-t border-neutral-100 pt-1 text-neutral-700">
                Net{" "}
                <span className={`font-semibold tabular-nums ${active.net < 0 ? "text-rose-600" : "text-neutral-900"}`}>
                  {format(active.net, currency)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[12px] text-neutral-600">
      <span className="h-0.5 w-4 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function EndLabel({ x, y, color, text }: { x: number; y: number; color: string; text: string }) {
  return (
    <text x={x + 8} y={y + 4} fontSize="11" fill={color} fontWeight="600">
      {text}
    </text>
  );
}

function TooltipRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-neutral-600">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        {label}
      </span>
      <span className="font-medium tabular-nums text-neutral-900">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Magnitude across categories: one series, so one hue and no legend -- the
// heading names it. Bars are horizontal because the labels are words.
// ---------------------------------------------------------------------------
export function CategoryBars({
  rows,
  color = SERIES_OUT,
  format,
  emptyLabel = "Nothing recorded",
}: {
  rows: { key: string; label: string; value: number; count?: number; currency: string }[];
  color?: string;
  format: (value: number, currency?: string) => string;
  emptyLabel?: string;
}) {
  if (!rows.length) {
    return <p className="py-8 text-center text-[13px] text-neutral-400">{emptyLabel}</p>;
  }

  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <div className="space-y-2.5">
      {rows.map((row) => (
        <div key={row.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="truncate text-[13px] text-neutral-700">
              {row.label}
              {row.count !== undefined && <span className="ml-1.5 text-[11px] text-neutral-400">×{row.count}</span>}
            </span>
            <span className="shrink-0 text-[13px] font-medium tabular-nums text-neutral-900">
              {format(row.value, row.currency)}
            </span>
          </div>
          {/* Thin mark, rounded data-end, anchored to a zero baseline. */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(2, (row.value / max) * 100)}%`, background: color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// 1 / 2 / 5 x 10^n -- the steps people read an axis in.
function niceStep(rough: number) {
  if (rough <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const scaled = rough / magnitude;
  const nice = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return nice * magnitude;
}

function compact(value: number) {
  if (Math.abs(value) >= 1000000) return `${Math.round(value / 100000) / 10}M`;
  if (Math.abs(value) >= 1000) return `${Math.round(value / 100) / 10}k`;
  return String(Math.round(value));
}

// Kept here so the page and the charts round money identically.
export function useMoneyFormatter(base: string) {
  const [formatter] = useState(() => new Map<string, Intl.NumberFormat>());

  return useCallback(
    (value: number, currency?: string) => {
      const code = (currency || base || "USD").toUpperCase();
      if (!formatter.has(code)) {
        formatter.set(
          code,
          new Intl.NumberFormat(undefined, {
            style: "currency",
            currency: code,
            maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2,
            minimumFractionDigits: 0,
          })
        );
      }
      try {
        return formatter.get(code)!.format(value || 0);
      } catch {
        return `${code} ${Math.round(value || 0).toLocaleString()}`;
      }
    },
    [base, formatter]
  );
}
