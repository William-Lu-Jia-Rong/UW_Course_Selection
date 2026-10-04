import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Link } from "../lib/chain";
import { formatCode } from "../lib/codes";
import type { Availability } from "../lib/evaluate";
import { ROW_H, type ChainGraph } from "../lib/graph";
import { useT, type Text } from "../lib/i18n";
import { AVAILABILITY, Badge, cx } from "./ui";

const R = 25;
const R_CENTER = 33;

const EDGE: Record<Link, { color: string; dash?: string; width: number; label: Text }> = {
  required: { color: "#57534e", width: 1.75, label: { en: "Required", zh: "必须先修" } },
  option: { color: "#a8a29e", dash: "6 5", width: 1.5, label: { en: "One of several", zh: "几选一" } },
  coreq: { color: "#0d9488", dash: "1.5 4.5", width: 2, label: { en: "Corequisite", zh: "同修" } },
};

type Look = { fill: string; stroke: string; text: string };
const NODE: Record<Availability | "none", Look> = {
  taken: { fill: "#e0f2fe", stroke: "#0284c7", text: "#075985" },
  eligible: { fill: "#ecfdf5", stroke: "#10b981", text: "#065f46" },
  needsCoreq: { fill: "#f0fdfa", stroke: "#14b8a6", text: "#115e59" },
  check: { fill: "#fffbeb", stroke: "#f59e0b", text: "#92400e" },
  locked: { fill: "#ffffff", stroke: "#a8a29e", text: "#44403c" },
  restricted: { fill: "#fff1f2", stroke: "#fda4af", text: "#9f1239" },
  antireq: { fill: "#fff1f2", stroke: "#fda4af", text: "#9f1239" },
  none: { fill: "#ffffff", stroke: "#a8a29e", text: "#44403c" },
};
const CENTER: Look = { fill: "#1c1917", stroke: "#facc15", text: "#ffffff" };

const LEGEND_NODES: { look: Look; label: Text }[] = [
  { look: CENTER, label: { en: "This course", zh: "当前课" } },
  { look: NODE.taken, label: { en: "Taken", zh: "已修" } },
  { look: NODE.eligible, label: { en: "Eligible now", zh: "现在可选" } },
  { look: NODE.locked, label: { en: "Not yet", zh: "还不能选" } },
  { look: NODE.antireq, label: { en: "Antireq / restricted", zh: "反修冲突 / 限制" } },
];

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

function curve(points: [number, number][], r0: number, r1: number): string {
  const pts = points.map(([x, y]) => [x, y]);
  pts[0][1] += r0;
  pts[pts.length - 1][1] -= r1 + 2;
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i - 1];
    const [x2, y2] = pts[i];
    const my = (y1 + y2) / 2;
    d += ` C${x1},${my} ${x2},${my} ${x2},${y2}`;
  }
  return d;
}

export function GraphLegend() {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-stone-500">
      {(Object.keys(EDGE) as Link[]).map((l) => (
        <span key={l} className="flex items-center gap-1.5">
          <svg width="26" height="8" aria-hidden>
            <line x1="1" y1="4" x2="25" y2="4" stroke={EDGE[l].color} strokeWidth={EDGE[l].width} strokeDasharray={EDGE[l].dash} strokeLinecap="round" />
          </svg>
          {t(EDGE[l].label)}
        </span>
      ))}
      <span className="h-3 w-px bg-stone-200" />
      {LEGEND_NODES.map(({ look, label }) => (
        <span key={label.en} className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full border-2" style={{ background: look.fill, borderColor: look.stroke }} />
          {t(label)}
        </span>
      ))}
    </div>
  );
}

interface Props {
  graph: ChainGraph;
  center: string;
  statusOf: (code: string) => Availability | undefined;
  titleOf: (code: string) => string | undefined;
  detail?: (code: string) => ReactNode;
  onPick: (code: string) => void;
}

export function ChainGraphView({ graph, center, statusOf, titleOf, detail, onPick }: Props) {
  const t = useT();
  const scroller = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [hover, setHover] = useState<string>();
  const centerNode = graph.nodes.find((n) => n.id === center)!;

  const related = useMemo(() => {
    if (!hover) return undefined;
    const s = new Set([hover]);
    for (const e of graph.edges) {
      if (e.from === hover) s.add(e.to);
      if (e.to === hover) s.add(e.from);
    }
    return s;
  }, [hover, graph]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollLeft = centerNode.x * zoom - el.clientWidth / 2;
    el.scrollTop = centerNode.y * zoom - el.clientHeight / 2;
    // Re-centre only when the graph itself changes, not on every zoom step.
  }, [graph]);

  const fit = () => {
    const el = scroller.current;
    if (!el) return;
    setZoom(Math.max(0.35, Math.min(1, (el.clientWidth - 24) / graph.width, (el.clientHeight - 24) / graph.height)));
  };

  const hoverNode = hover ? graph.nodes.find((n) => n.id === hover) : undefined;
  const radius = (id: string) => (id === center ? R_CENTER : R);

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={scroller} className="absolute inset-0 overflow-auto bg-[radial-gradient(circle,#e7e5e4_1px,transparent_1px)] [background-size:18px_18px]">
        <div className="relative mx-auto" style={{ width: graph.width * zoom, height: graph.height * zoom }}>
          <svg width={graph.width * zoom} height={graph.height * zoom} viewBox={`0 0 ${graph.width} ${graph.height}`} className="block select-none">
            <defs>
              {(Object.keys(EDGE) as Link[]).map((l) => (
                <marker key={l} id={`arrow-${l}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto">
                  <path d="M0,1 L9,5 L0,9 z" fill={EDGE[l].color} />
                </marker>
              ))}
            </defs>

            {graph.rows.map(({ row, y }) => (
              <g key={row}>
                {row === 0 && <rect x={8} y={y - ROW_H / 2 + 10} width={graph.width - 16} height={ROW_H - 20} rx={18} fill="#fefce8" stroke="#fde68a" strokeDasharray="4 4" />}
                <text x={18} y={y + 4} fontSize={11} fontWeight={600} fill={row === 0 ? "#a16207" : "#a8a29e"}>
                  {row === 0 ? t("Current", "当前") : row < 0 ? t(`Before ${-row}`, `前置 ${-row}`) : t(`After ${row}`, `后续 ${row}`)}
                </text>
              </g>
            ))}

            {graph.edges.map((e, i) => {
              const style = EDGE[e.link];
              const on = related && (e.from === hover || e.to === hover);
              return (
                <path
                  key={i}
                  d={curve(e.points, radius(e.from), radius(e.to))}
                  fill="none"
                  stroke={style.color}
                  strokeWidth={on ? style.width + 1.25 : style.width}
                  strokeDasharray={style.dash}
                  strokeLinecap="round"
                  markerEnd={`url(#arrow-${e.link})`}
                  opacity={related && !on ? 0.15 : 1}
                />
              );
            })}

            {graph.nodes.map((n) => {
              const isCenter = n.id === center;
              const status = statusOf(n.id);
              const look = isCenter ? CENTER : NODE[status ?? "none"];
              const r = radius(n.id);
              const [subject, number] = formatCode(n.codes[0]).split(" ");
              const faded = !isCenter && (status === "antireq" || status === "restricted");
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x},${n.y})`}
                  className={isCenter ? "" : "cursor-pointer"}
                  opacity={related && !related.has(n.id) ? 0.3 : faded ? 0.65 : 1}
                  onMouseEnter={() => setHover(n.id)}
                  onMouseLeave={() => setHover(undefined)}
                  onClick={() => !isCenter && onPick(n.id)}
                >
                  {isCenter && <circle r={r + 10} fill="#fde047" opacity={0.35} />}
                  <circle r={r} fill={look.fill} stroke={look.stroke} strokeWidth={isCenter ? 3.5 : hover === n.id ? 3 : 2} />
                  <text y={isCenter ? -5 : -4} textAnchor="middle" fontSize={isCenter ? 10 : 8.5} fontWeight={600} fill={look.text} opacity={0.75}>
                    {subject}
                  </text>
                  <text y={isCenter ? 12 : 10} textAnchor="middle" fontSize={isCenter ? 16 : 13} fontWeight={700} fill={look.text} className="font-mono">
                    {number}
                  </text>
                  {status === "taken" && !isCenter && (
                    <g transform={`translate(${r * 0.72},${-r * 0.72})`}>
                      <circle r={7} fill="#0284c7" stroke="#fff" strokeWidth={1.5} />
                      <text y={3} textAnchor="middle" fontSize={9} fontWeight={700} fill="#fff">
                        ✓
                      </text>
                    </g>
                  )}
                  <text y={r + 15} textAnchor="middle" fontSize={10.5} fontWeight={isCenter ? 600 : 400} fill={isCenter ? "#1c1917" : "#78716c"}>
                    {truncate(titleOf(n.id) ?? "", isCenter ? 24 : 18)}
                  </text>
                </g>
              );
            })}
          </svg>

          {hoverNode && (
            <div
              className={cx(
                "pointer-events-none absolute z-10 w-60 -translate-y-1/2 rounded-xl border border-stone-200 bg-white p-3 text-xs shadow-lg",
                hoverNode.x > graph.width / 2 && "-translate-x-full",
              )}
              style={{
                left: (hoverNode.x + (hoverNode.x > graph.width / 2 ? -1 : 1) * (radius(hoverNode.id) + 14)) * zoom,
                top: hoverNode.y * zoom,
              }}
            >
              <div className="font-mono text-sm font-semibold text-stone-900">{hoverNode.codes.map(formatCode).join(" / ")}</div>
              <div className="mt-0.5 text-stone-600">{titleOf(hoverNode.id)}</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {(() => {
                  const s = statusOf(hoverNode.id);
                  return s && <Badge tone={AVAILABILITY[s].tone}>{t(AVAILABILITY[s].label)}</Badge>;
                })()}
                {detail?.(hoverNode.id)}
              </div>
              {hoverNode.id !== center && <div className="mt-2 text-[11px] text-stone-400">{t("Click to centre on this course", "点击以这门课为中心")}</div>}
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-3 right-3 flex items-center overflow-hidden rounded-lg border border-stone-200 bg-white text-sm shadow-sm">
        {[
          { label: "−", title: t("Zoom out", "缩小"), act: () => setZoom((z) => Math.max(0.35, +(z - 0.15).toFixed(2))) },
          { label: `${Math.round(zoom * 100)}%`, title: t("Reset to 100%", "恢复 100%"), act: () => setZoom(1) },
          { label: "+", title: t("Zoom in", "放大"), act: () => setZoom((z) => Math.min(1.8, +(z + 0.15).toFixed(2))) },
          { label: t("Fit", "适应"), title: t("Zoom to fit everything", "缩放到能看到全部"), act: fit },
        ].map((b, i) => (
          <button key={b.title} type="button" title={b.title} onClick={b.act} className={cx("px-2.5 py-1.5 text-stone-600 hover:bg-stone-100", i > 0 && "border-l border-stone-200", i === 1 && "w-14 text-xs tabular-nums")}>
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
