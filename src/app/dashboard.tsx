"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { BpPoint, CaloriePoint, WeightPoint } from "@/lib/readings";

const KG_TO_LB = 2.2046226218;
const DAY = 864e5;

type Metric = "bp" | "wt" | "kcal";
type Range = 1 | 3 | 6 | 12 | 0;
const RANGES: { value: Range; label: string }[] = [
  { value: 1, label: "1M" },
  { value: 3, label: "3M" },
  { value: 6, label: "6M" },
  { value: 12, label: "1Y" },
  { value: 0, label: "All" },
];

type Props = { bp: BpPoint[]; weight: WeightPoint[]; calories: CaloriePoint[]; lastSync: string | null; connected: boolean; now: number };

export default function Dashboard({ bp, weight, calories, lastSync, connected, now }: Props) {
  const [metric, setMetric] = useStored<Metric>("vitals.metric", "bp", (v) => v === "bp" || v === "wt" || v === "kcal");
  const [range, setRange] = useStored<Range>("vitals.range", 6, (v) => RANGES.some((r) => r.value === v));
  const lastReading = Math.max(bp.at(-1)?.t ?? 0, weight.at(-1)?.t ?? 0);

  return (
    <div className="wrap">
      <header>
        <h1>Vitals</h1>
        <div className="sync">
          <span className={connected ? "dot" : "dot off"} aria-hidden="true" />
          <span>
            {!connected ? "Gmail not connected" : lastReading ? `Last reading ${fmtDate(lastReading)}` : "No readings yet"}
          </span>
          <SyncButton lastSync={lastSync} />
          <form action="/api/auth/logout" method="post">
            <button className="link" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <Summary bp={bp} weight={weight} calories={calories} now={now} />

      <section className="panel" aria-label="Trend">
        <div className="controls">
          <div className="seg" role="group" aria-label="Metric">
            <button aria-pressed={metric === "bp"} onClick={() => setMetric("bp")}>
              Blood pressure
            </button>
            <button aria-pressed={metric === "wt"} onClick={() => setMetric("wt")}>
              Weight
            </button>
            <button aria-pressed={metric === "kcal"} onClick={() => setMetric("kcal")}>
              Calories
            </button>
          </div>
          <div className="seg" role="group" aria-label="Time range">
            {RANGES.map((r) => (
              <button key={r.value} aria-pressed={range === r.value} onClick={() => setRange(r.value)}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <TrendChart metric={metric} range={range} bp={bp} weight={weight} calories={calories} now={now} />
      </section>

      <Log bp={bp} weight={weight} />

      <footer>
        New readings appear when a results email arrives. Categories follow the American Heart Association adult ranges.
      </footer>
    </div>
  );
}

/* ---------- Summary ---------- */

function Summary({ bp, weight, calories, now }: { bp: BpPoint[]; weight: WeightPoint[]; calories: CaloriePoint[]; now: number }) {
  const lastBp = bp.at(-1);
  const lastWt = weight.at(-1);
  const monthAgo = weight.filter((w) => w.t <= now - 30 * DAY).at(-1);
  const dw = lastWt && monthAgo ? round1((lastWt.weightKg - monthAgo.weightKg) * KG_TO_LB) : null;
  const recent = bp.filter((r) => r.t >= now - 90 * DAY);
  const avgSys = recent.length ? Math.round(recent.reduce((a, r) => a + r.systolic, 0) / recent.length) : null;
  const avgDia = recent.length ? Math.round(recent.reduce((a, r) => a + r.diastolic, 0) / recent.length) : null;
  // Last 7 complete days; today is still being logged.
  const today = localDay(now);
  const week = calories.filter((c) => c.day < today && c.day >= localDay(now - 7 * DAY));
  const avgKcal = week.length ? Math.round(week.reduce((a, c) => a + c.kcal, 0) / week.length) : null;
  const todayKcal = calories.find((c) => c.day === today)?.kcal;

  return (
    <section className={calories.length ? "summary four" : "summary"} aria-label="Latest readings">
      <div className="stat">
        <span className="label">Blood pressure</span>
        <span className="value">
          {lastBp ? `${lastBp.systolic}/${lastBp.diastolic}` : "–"}
          {lastBp && <small>mmHg</small>}
        </span>
        {lastBp && (
          <span className="sub">
            <CategoryChip sys={lastBp.systolic} dia={lastBp.diastolic} />
            {fmtDate(lastBp.t)}
          </span>
        )}
      </div>
      <div className="stat">
        <span className="label">Weight</span>
        <span className="value">
          {lastWt ? lb(lastWt.weightKg).toFixed(1) : "–"}
          {lastWt && <small>lb</small>}
        </span>
        {lastWt && (
          <span className="sub">
            {dw === null ? fmtDate(lastWt.t) : `${dw <= 0 ? "↓" : "↑"} ${Math.abs(dw).toFixed(1)} lb in 30 days`}
          </span>
        )}
      </div>
      <div className="stat">
        <span className="label">90-day average</span>
        <span className="value">
          {avgSys !== null ? `${avgSys}/${avgDia}` : "–"}
          {avgSys !== null && <small>mmHg</small>}
        </span>
        {avgSys !== null && (
          <span className="sub">
            <CategoryChip sys={avgSys} dia={avgDia!} />
            {recent.length} {recent.length === 1 ? "reading" : "readings"}
          </span>
        )}
      </div>
      {calories.length > 0 && (
        <div className="stat">
          <span className="label">Calories, 7-day avg</span>
          <span className="value">
            {avgKcal !== null ? fmtKcal(avgKcal) : "–"}
            {avgKcal !== null && <small>kcal</small>}
          </span>
          <span className="sub">{todayKcal !== undefined ? `${fmtKcal(todayKcal)} so far today` : `${week.length} days logged`}</span>
        </div>
      )}
    </section>
  );
}

/* ---------- Chart ---------- */

type Series = { key: string; name: string; color: string; value: (i: number) => number };
type Row = { t: number; source: string; bp?: BpPoint; wt?: WeightPoint; kc?: CaloriePoint };

function TrendChart({
  metric,
  range,
  bp,
  weight,
  calories,
  now,
}: {
  metric: Metric;
  range: Range;
  bp: BpPoint[];
  weight: WeightPoint[];
  calories: CaloriePoint[];
  now: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const width = useWidth(box);
  const [hover, setHover] = useState<number | null>(null);

  const from = range ? new Date(new Date(now).setMonth(new Date(now).getMonth() - range)).getTime() : -Infinity;
  const rows: Row[] = useMemo(
    () =>
      metric === "bp"
        ? bp.filter((r) => r.t >= from).map((r) => ({ t: r.t, source: r.source, bp: r }))
        : metric === "wt"
          ? weight.filter((r) => r.t >= from).map((r) => ({ t: r.t, source: r.source, wt: r }))
          : calories.filter((r) => r.t >= from).map((r) => ({ t: r.t, source: r.source, kc: r })),
    [metric, bp, weight, calories, from],
  );
  useEffect(() => setHover(null), [metric, range]);

  const series: Series[] =
    metric === "bp"
      ? [
          { key: "sys", name: "Systolic", color: "--sys", value: (i) => rows[i].bp!.systolic },
          { key: "dia", name: "Diastolic", color: "--dia", value: (i) => rows[i].bp!.diastolic },
        ]
      : metric === "wt"
        ? [{ key: "wt", name: "Weight", color: "--wt", value: (i) => round1(lb(rows[i].wt!.weightKg)) }]
        : [{ key: "kcal", name: "Calories", color: "--kcal", value: (i) => Math.round(rows[i].kc!.kcal) }];

  const title = metric === "bp" ? "Blood pressure, mmHg" : metric === "wt" ? "Weight, lb" : "Calories eaten per day, kcal";
  const W = Math.max(300, width || 880);
  const H = W < 560 ? 220 : 300;
  const P = { l: 36, r: 12, t: 12, b: 28 };

  const head = (
    <div className="chart-head">
      <h2>{title}</h2>
      {series.length > 1 && (
        <div className="legend">
          {series.map((s) => (
            <span key={s.key}>
              <b style={{ background: `var(${s.color})` }} />
              {s.name}
            </span>
          ))}
          <span>
            <b className="ref" />
            Normal limit
          </span>
        </div>
      )}
    </div>
  );

  if (!rows.length) {
    return (
      <>
        {head}
        <div className="chart" ref={box}>
          <div className="empty">
            {metric === "kcal" && !calories.length
              ? "No calories yet. They arrive from MyFitnessPal through Apple Health and Health Auto Export."
              : `No ${metric === "bp" ? "blood pressure" : metric === "wt" ? "weight" : "calorie"} readings in this range.`}
          </div>
        </div>
      </>
    );
  }

  const vals = rows.flatMap((_, i) => series.map((s) => s.value(i)));
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (metric === "bp") {
    lo = Math.min(lo, 80) - 6;
    hi = Math.max(hi, 120) + 6;
  } else if (metric === "wt") {
    lo -= 1.5;
    hi += 1.5;
  } else {
    lo = Math.max(0, lo - 200);
    hi += 200;
  }
  const ticks = niceTicks(lo, hi);
  const y0 = ticks[0];
  const y1 = ticks.at(-1)!;
  const t0 = rows[0].t;
  const t1 = rows.at(-1)!.t;
  const single = t1 === t0;
  const X = (t: number) => (single ? (P.l + W - P.r) / 2 : P.l + ((t - t0) / (t1 - t0)) * (W - P.l - P.r));
  const Y = (v: number) => P.t + (1 - (v - y0) / (y1 - y0)) * (H - P.t - P.b);

  const xLabels = timeLabels(t0, t1, range).map((t) => ({ t, x: X(t), text: labelFor(t, range) }));

  const scale = () => (box.current?.clientWidth ?? W) / W;
  const nearest = (clientX: number) => {
    const left = box.current!.getBoundingClientRect().left;
    const cx = clientX - left;
    let best = 0;
    let bestD = Infinity;
    rows.forEach((r, i) => {
      const d = Math.abs(X(r.t) * scale() - cx);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  };

  const h = hover !== null && hover < rows.length ? rows[hover] : null;
  const hx = h ? X(h.t) : 0;

  return (
    <>
      {head}
      <div
        className="chart"
        ref={box}
        tabIndex={0}
        aria-label="Chart. Use left and right arrow keys to step through readings."
        onPointerMove={(e) => setHover(nearest(e.clientX))}
        onPointerLeave={() => setHover(null)}
        onBlur={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          const cur = hover ?? rows.length;
          setHover(Math.max(0, Math.min(rows.length - 1, cur + (e.key === "ArrowRight" ? 1 : -1))));
        }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}, ${rows.length} readings`}>
          <defs>
            {["wt", "kcal"].map((k) => (
              <linearGradient key={k} id={`g-${k}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={`var(--${k})`} stopOpacity={0.16} />
                <stop offset="1" stopColor={`var(--${k})`} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={P.l} x2={W - P.r} y1={Y(v)} y2={Y(v)} stroke="var(--line)" strokeWidth={1} />
              <text x={P.l - 8} y={Y(v) + 4} textAnchor="end" fill="var(--muted)" fontSize={11} fontFamily="var(--f-num)">
                {v}
              </text>
            </g>
          ))}
          {xLabels.map((l) => (
            <text key={l.t} x={l.x} y={H - 8} textAnchor="middle" fill="var(--muted)" fontSize={11} fontFamily="var(--f-ui)">
              {l.text}
            </text>
          ))}
          {metric === "bp" &&
            [120, 80].map((v) => (
              <line key={v} x1={P.l} x2={W - P.r} y1={Y(v)} y2={Y(v)} stroke="var(--muted)" strokeWidth={1} strokeDasharray="3 4" />
            ))}
          {series.map((s) => {
            const pts = rows.map((r, i) => [X(r.t), Y(s.value(i))] as const);
            const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("");
            const end = pts.at(-1)!;
            return (
              <g key={s.key}>
                {series.length === 1 && pts.length > 1 && (
                  <path d={`${d}L${end[0]},${Y(y0)}L${pts[0][0]},${Y(y0)}Z`} fill={`url(#g-${s.key})`} />
                )}
                <path d={d} fill="none" stroke={`var(${s.color})`} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                <circle cx={end[0]} cy={end[1]} r={4} fill={`var(${s.color})`} stroke="var(--bg)" strokeWidth={2} />
              </g>
            );
          })}
          <line x1={P.l} x2={W - P.r} y1={Y(y0)} y2={Y(y0)} stroke="var(--axis)" strokeWidth={1} />
          {h && (
            <g>
              <line x1={hx} x2={hx} y1={P.t} y2={H - P.b} stroke="var(--axis)" strokeWidth={1} />
              {series.map((s) => (
                <circle key={s.key} cx={hx} cy={Y(s.value(hover!))} r={4.5} fill={`var(${s.color})`} stroke="var(--bg)" strokeWidth={2} />
              ))}
            </g>
          )}
        </svg>
        {h && <Tooltip row={h} series={series} index={hover!} x={hx * scale()} containerWidth={box.current?.clientWidth ?? W} />}
      </div>
    </>
  );
}

function Tooltip({ row, series, index, x, containerWidth }: { row: Row; series: Series[]; index: number; x: number; containerWidth: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [left, setLeft] = useState(x + 12);
  useEffect(() => {
    const tw = ref.current?.offsetWidth ?? 140;
    setLeft(Math.min(Math.max(0, x + 12 + tw > containerWidth ? x - tw - 12 : x + 12), containerWidth - tw));
  }, [x, containerWidth]);

  return (
    <div className="tip" ref={ref} style={{ left }}>
      <div className="d">
        {new Date(row.t).toLocaleString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
          ...(row.kc ? {} : { hour: "numeric", minute: "2-digit" }),
        })}
      </div>
      {series.map((s) => (
        <div className="r" key={s.key}>
          <b style={{ background: `var(${s.color})` }} />
          <strong>{s.key === "wt" ? `${s.value(index).toFixed(1)} lb` : s.key === "kcal" ? `${fmtKcal(s.value(index))} kcal` : s.value(index)}</strong>
          <span>{s.name}</span>
        </div>
      ))}
      {row.bp && (
        <>
          {row.bp.pulse !== null && (
            <div className="r">
              <strong>{row.bp.pulse}</strong>
              <span>Pulse</span>
            </div>
          )}
          <div className="r">
            <CategoryChip sys={row.bp.systolic} dia={row.bp.diastolic} />
          </div>
        </>
      )}
      <div className="d">{row.source}</div>
    </div>
  );
}

/* ---------- Log ---------- */

type Visit = { t: number; source: string; bp?: BpPoint; wt?: WeightPoint };

/** One row per kiosk visit: a weight taken within 30 minutes of a BP reading shares its row. */
export function groupVisits(bp: BpPoint[], weight: WeightPoint[]): Visit[] {
  const visits: Visit[] = bp.map((b) => ({ t: b.t, source: b.source, bp: b }));
  for (const w of weight) {
    const match = visits.find((v) => v.bp && !v.wt && Math.abs(v.t - w.t) <= 30 * 60_000);
    if (match) match.wt = w;
    else visits.push({ t: w.t, source: w.source, wt: w });
  }
  return visits.sort((a, b) => b.t - a.t);
}

function Log({ bp, weight }: { bp: BpPoint[]; weight: WeightPoint[] }) {
  const [showAll, setShowAll] = useState(false);
  const visits = useMemo(() => groupVisits(bp, weight), [bp, weight]);
  const shown = showAll ? visits : visits.slice(0, 8);

  return (
    <section className="log">
      <h2>Readings</h2>
      {visits.length === 0 ? (
        <div className="empty">Readings will show up here after your next kiosk visit.</div>
      ) : (
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Blood pressure</th>
                <th>Category</th>
                <th className="r">Weight</th>
                <th className="hide-sm">From</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((v) => (
                <tr key={v.t}>
                  <td>{fmtDate(v.t, true)}</td>
                  <td className="n">{v.bp ? `${v.bp.systolic}/${v.bp.diastolic}` : "–"}</td>
                  <td>{v.bp ? <CategoryChip sys={v.bp.systolic} dia={v.bp.diastolic} /> : ""}</td>
                  <td className="n r">{v.wt ? `${lb(v.wt.weightKg).toFixed(1)} lb` : "–"}</td>
                  <td className="src hide-sm">{v.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {visits.length > 8 && (
        <button className="link more" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Show recent only" : `Show all ${visits.length} readings`}
        </button>
      )}
    </section>
  );
}

/* ---------- Bits ---------- */

function SyncButton({ lastSync }: { lastSync: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <>
      <button
        className="link"
        disabled={busy}
        title={lastSync ? `Last checked ${new Date(lastSync).toLocaleString()}` : undefined}
        onClick={async () => {
          setBusy(true);
          setMsg(null);
          const res = await fetch("/api/sync", { method: "POST" });
          const body = await res.json().catch(() => ({}));
          setBusy(false);
          if (!res.ok) return setMsg(body.error ?? "Sync failed");
          const added = (body.bpAdded ?? 0) + (body.weightAdded ?? 0);
          const skipped = body.untrusted ? ` · ${body.untrusted} from an unverified sender skipped` : "";
          setMsg((added ? `${added} new` : "Up to date") + skipped);
          router.refresh();
        }}
      >
        {busy ? "Syncing…" : "Sync"}
      </button>
      {msg && <span>{msg}</span>}
    </>
  );
}

export function category(sys: number, dia: number): [string, string] {
  if (sys >= 180 || dia >= 120) return ["Crisis", "--critical"];
  if (sys >= 140 || dia >= 90) return ["Stage 2", "--critical"];
  if (sys >= 130 || dia >= 80) return ["Stage 1", "--serious"];
  if (sys >= 120) return ["Elevated", "--warn"];
  return ["Normal", "--good"];
}

function CategoryChip({ sys, dia }: { sys: number; dia: number }) {
  const [label, token] = category(sys, dia);
  return (
    <span className="chip">
      <i style={{ background: `var(${token})` }} />
      {label}
    </span>
  );
}

function niceTicks(lo: number, hi: number, n = 4): number[] {
  const step0 = (hi - lo) / n;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((v) => v >= step0)!;
  const out: number[] = [];
  for (let v = Math.floor(lo / step) * step; v <= Math.ceil(hi / step) * step + 1e-9; v += step) out.push(Math.round(v * 10) / 10);
  return out;
}

/** Month starts for longer ranges; individual reading days for 1M. */
function timeLabels(t0: number, t1: number, range: Range): number[] {
  if (t0 === t1) return [t0];
  if (range === 1) {
    const days: number[] = [];
    const step = Math.max(DAY, Math.ceil((t1 - t0) / 6 / DAY) * DAY);
    for (let t = t0; t <= t1; t += step) days.push(t);
    return days;
  }
  const months: number[] = [];
  const first = new Date(t0);
  for (const m = new Date(first.getFullYear(), first.getMonth() + 1, 1); m.getTime() <= t1; m.setMonth(m.getMonth() + 1)) months.push(m.getTime());
  const every = Math.ceil(months.length / 7);
  return months.filter((_, i) => i % every === 0);
}

function labelFor(t: number, range: Range) {
  const d = new Date(t);
  if (range === 1) return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return d.getMonth() === 0 ? String(d.getFullYear()) : d.toLocaleDateString("en-US", { month: "short" });
}

function fmtDate(t: number, withYear = false) {
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) });
}

const lb = (kg: number) => kg * KG_TO_LB;
const fmtKcal = (n: number) => Math.round(n).toLocaleString("en-US");
/** YYYY-MM-DD in the viewer's time zone, to compare with the phone's calendar days. */
const localDay = (t: number) => new Date(t).toLocaleDateString("en-CA");
const round1 = (n: number) => Math.round(n * 10) / 10;

function useWidth(ref: React.RefObject<HTMLDivElement | null>) {
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

/** Remembered per browser; the page still works when storage is blocked. */
function useStored<T extends string | number>(key: string, initial: T, valid: (v: unknown) => boolean): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return;
      const parsed = typeof initial === "number" ? Number(raw) : raw;
      if (valid(parsed)) setValue(parsed as T);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return [
    value,
    (v: T) => {
      setValue(v);
      try {
        localStorage.setItem(key, String(v));
      } catch {}
    },
  ];
}
