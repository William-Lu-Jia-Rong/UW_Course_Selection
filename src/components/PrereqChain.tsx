import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { downstreamTree, dependentsIndex, requirements, retraceRequired, upstreamTree, type DependentsIndex, type DownNode, type Link, type Req, type RetracePath } from "../lib/chain";
import { formatCode, normalizeCode } from "../lib/codes";
import { describeNode } from "../lib/describe";
import { blockedByProgram, equivalents, evaluateCourse, type Availability, type CourseEval, type EvalResult, type StudentContext, type Tri } from "../lib/evaluate";
import { buildChainGraph } from "../lib/graph";
import { plural, useLang, useT, type Text, type Translate } from "../lib/i18n";
import { CATEGORY_LABEL, type Categorizer } from "../lib/requirements";
import type { Catalog } from "../lib/types";
import { ChainGraphView, GraphLegend } from "./ChainGraphView";
import { AVAILABILITY, Badge, Toggle, cx } from "./ui";

type View = "overview" | "graph";

interface ChainApi {
  open: (code: string) => void;
  /** Retrace a locked course to the top of each unmet required chain. */
  retrace: (code: string) => RetracePath[];
}

const ChainContext = createContext<ChainApi>({ open: () => {}, retrace: () => [] });

/** Opens the full prerequisite chain dialog for a course. */
export const useOpenChain = () => useContext(ChainContext).open;

/** Retrace unmet required prerequisites to the foundation course(s). */
export const useRetrace = () => useContext(ChainContext).retrace;

interface Env {
  catalog: Catalog;
  cz: Categorizer;
  hasCtx: boolean;
  evalOf: (code: string) => CourseEval | undefined;
  statusOf: (code: string) => Availability | undefined;
  /** Whether finishing `pre` alone would make the currently locked `dep` available. */
  wouldUnlock: (pre: string, dep: string) => boolean;
  navigate: (code: string) => void;
}

export function ChainProvider({ catalog, cz, ctx, children }: { catalog: Catalog; cz: Categorizer; ctx?: StudentContext; children: ReactNode }) {
  const [stack, setStack] = useState<string[]>([]);
  const idx = useMemo(() => dependentsIndex(catalog), [catalog]);
  const evalOf = useMemo(() => {
    const cache = new Map<string, CourseEval>();
    return (code: string) => {
      const course = catalog.courses[code];
      if (!ctx || !course) return undefined;
      let ev = cache.get(code);
      if (!ev) cache.set(code, (ev = evaluateCourse(course, ctx)));
      return ev;
    };
  }, [catalog, ctx]);
  const wouldUnlock = useMemo(() => {
    const withTaken = new Map<string, StudentContext>();
    return (pre: string, dep: string) => {
      const course = catalog.courses[dep];
      if (!ctx || !course || evalOf(dep)?.availability !== "locked") return false;
      let next = withTaken.get(pre);
      if (!next) {
        const taken = new Map(ctx.taken);
        for (const e of equivalents(catalog, pre)) if (!taken.has(e)) taken.set(e, { code: e, title: "", term: "", status: "completed" });
        withTaken.set(pre, (next = { ...ctx, taken }));
      }
      const after = evaluateCourse(course, next).availability;
      return after === "eligible" || after === "needsCoreq";
    };
  }, [catalog, ctx, evalOf]);
  const programOk = useCallback((code: string) => !blockedByProgram(evalOf(code)?.prereq), [evalOf]);
  const close = useCallback(() => setStack([]), []);
  const [view, setView] = useState<View>("overview");
  const [hideBlocked, setHideBlocked] = useState(true);

  const current = stack[stack.length - 1];
  const env: Env = {
    catalog,
    cz,
    hasCtx: !!ctx,
    evalOf,
    statusOf: (code) => evalOf(code)?.availability,
    wouldUnlock,
    navigate: (code) => setStack((s) => (s[s.length - 1] === code ? s : [...s, code])),
  };

  const api = useMemo<ChainApi>(
    () => ({
      open: (code) => {
        setStack([code]);
        setView("overview");
      },
      retrace: (code) => {
        if (!ctx || evalOf(code)?.availability !== "locked") return [];
        return retraceRequired(catalog, code, evalOf, (c) => cz.categories.has(c));
      },
    }),
    [catalog, ctx, cz, evalOf],
  );

  return (
    <ChainContext.Provider value={api}>
      {children}
      {current && (
        <ChainDialog
          key={current}
          stack={stack}
          env={env}
          idx={idx}
          programOk={programOk}
          view={view}
          setView={setView}
          hideBlocked={hideBlocked}
          setHideBlocked={setHideBlocked}
          onCrumb={(i) => setStack((s) => s.slice(0, i + 1))}
          onClose={close}
        />
      )}
    </ChainContext.Provider>
  );
}

/* ---------- shared bits ---------- */

type State = Tri | "none";
const stateOf = (s: Tri | undefined): State => s ?? "none";

function Mark({ s, size = "md" }: { s: State; size?: "md" | "lg" }) {
  const cls = {
    ok: "bg-emerald-500 text-white",
    no: "border-2 border-stone-300 bg-white",
    unk: "bg-amber-400 text-white",
    none: "border-2 border-stone-200 bg-stone-100",
  }[s];
  return (
    <span className={cx("grid shrink-0 place-items-center rounded-full font-bold leading-none", size === "lg" ? "h-5 w-5 text-[11px]" : "h-4 w-4 text-[10px]", cls)}>
      {s === "ok" ? "✓" : s === "unk" ? "?" : ""}
    </span>
  );
}

function Chevron({ open }: { open: boolean }) {
  return <span className={cx("inline-block text-[9px] transition-transform", open && "rotate-90")}>▶</span>;
}

function CodeButton({ code, env, className }: { code: string; env: Env; className?: string }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={() => env.navigate(code)}
      className={cx("shrink-0 rounded font-mono text-xs font-semibold text-sky-800 hover:bg-sky-50 hover:underline", className)}
      title={t("View the chain centred on this course", "以这门课为中心查看课程链")}
    >
      {formatCode(code)}
    </button>
  );
}

function CategoryBadge({ code, env }: { code: string; env: Env }) {
  const t = useT();
  const cat = env.cz.categories.get(code)?.[0];
  if (!cat) return null;
  return <Badge tone={cat === "required" ? "gold" : cat.startsWith("te") ? "violet" : "stone"}>{t(CATEGORY_LABEL[cat])}</Badge>;
}

function combine(items: Req[]): Tri | undefined {
  if (items.some((r) => r.s === undefined)) return undefined;
  if (items.every((r) => r.s === "ok")) return "ok";
  return items.some((r) => r.s === "no") ? "no" : "unk";
}

const groupLabel = (g: Extract<Req, { k: "group" }>, t: Translate) =>
  g.n === "all"
    ? g.kids.length === 1
      ? t("Must satisfy", "必须满足")
      : t("All of the following", "以下全部都要")
    : t(`${g.n} of ${g.kids.length}`, `${g.kids.length} 选 ${g.n}`);

const RANK: Record<Availability, number> = { eligible: 1, needsCoreq: 1, taken: 2, check: 2, locked: 3, restricted: 5, antireq: 6 };

function rank(r: Req, env: Env): number {
  if (r.s === "ok") return 0;
  if (r.k === "course") return RANK[env.statusOf(r.code) ?? "locked"];
  return r.s === "unk" ? 2 : 3;
}

/* ---------- upstream: what you need ---------- */

function CourseRow({
  req,
  env,
  depth,
  trail,
  autoOpen,
  openPath,
}: {
  req: Extract<Req, { k: "course" }>;
  env: Env;
  depth: number;
  trail: string[];
  autoOpen: boolean;
  openPath: Set<string>;
}) {
  const t = useT();
  const { code } = req;
  const course = env.catalog.courses[code];
  const status = env.statusOf(code);
  const hasReqs = !!(course?.prereq || course?.coreq) && !trail.includes(code);
  const unmet = useMemo(() => (hasReqs && course ? requirements(course, env.evalOf(code)).filter((r) => r.s !== "ok").length : 0), [hasReqs, course, env, code]);
  const onPath = openPath.has(code);
  const [open, setOpen] = useState((autoOpen || onPath) && hasReqs);
  const showStatus = status && !(req.s === "ok" && status === "taken");

  let toggleLabel = t("Its prerequisites", "它的先修");
  let toggleTone = "text-stone-500";
  if (env.hasCtx && status !== "taken") {
    toggleLabel = unmet ? t(`${plural(unmet, "prerequisite")} missing`, `还差 ${unmet} 项先修`) : t("Prerequisites met", "先修已满足");
    toggleTone = unmet ? "text-amber-700" : "text-emerald-700";
  }

  return (
    <li>
      <div
        className={cx(
          "group flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1",
          req.s === "ok" ? "bg-emerald-50/60" : onPath ? "bg-amber-50 ring-1 ring-inset ring-amber-200" : "hover:bg-stone-50",
        )}
      >
        <Mark s={stateOf(req.s)} />
        <CodeButton code={code} env={env} />
        <span className={cx("min-w-0 flex-1 truncate text-xs", req.s === "ok" ? "text-stone-700" : "text-stone-600")} title={course?.title}>
          {course?.title ?? t("(not in the calendar)", "（日历中没有这门课）")}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {onPath && req.s !== "ok" && <Badge tone="amber">{t("On your path", "规划路径上")}</Badge>}
          {req.coreq && <Badge tone="teal">{t("Coreq", "同修")}</Badge>}
          {req.conc && !req.coreq && <Badge tone="teal">{t("Can be concurrent", "可同时修")}</Badge>}
          {req.minGrade !== undefined && <Badge tone="amber">≥ {req.minGrade}%</Badge>}
          {showStatus && (
            <Badge tone={AVAILABILITY[status].tone} title={t(AVAILABILITY[status].hint)}>
              {t(AVAILABILITY[status].label)}
            </Badge>
          )}
          <CategoryBadge code={code} env={env} />
          {hasReqs && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className={cx("ml-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium hover:bg-stone-100", toggleTone)}
              aria-expanded={open}
            >
              <Chevron open={open} />
              {toggleLabel}
            </button>
          )}
        </span>
      </div>
      {open && (
        <div className={cx("mb-2 ml-[13px] mt-1 border-l-2 border-dashed pl-3", onPath ? "border-amber-300" : "border-stone-200")}>
          <ReqList code={code} env={env} depth={depth + 1} trail={[...trail, code]} openPath={openPath} />
        </div>
      )}
    </li>
  );
}

function CondRow({ req }: { req: Extract<Req, { k: "cond" }> }) {
  const t = useT();
  const lang = useLang();
  return (
    <li className="flex items-start gap-2 px-1.5 py-1">
      <span className="mt-px">
        <Mark s={stateOf(req.s)} />
      </span>
      <span className="text-xs text-stone-600">
        {describeNode(req.node, lang)}
        {req.note && <span className="text-stone-400">{t(` (${req.note.en})`, `（${req.note.zh}）`)}</span>}
      </span>
    </li>
  );
}

function Options({ group, env, depth, trail, openPath }: { group: Extract<Req, { k: "group" }>; env: Env; depth: number; trail: string[]; openPath: Set<string> }) {
  const t = useT();
  const [showRest, setShowRest] = useState(false);
  const sorted = group.n === "all" ? group.kids : [...group.kids].sort((a, b) => rank(a, env) - rank(b, env));
  const met = group.s === "ok";
  const rest = group.n === "all" ? [] : met ? sorted.filter((r) => r.s !== "ok") : sorted.filter((r) => rank(r, env) >= 5);
  const shown = sorted.filter((r) => !rest.includes(r));
  const viable = shown.filter((r) => r.s !== "ok").length;

  const row = (r: Req, i: number) =>
    r.k === "course" ? (
      <CourseRow
        key={`${r.code}-${i}`}
        req={r}
        env={env}
        depth={depth}
        trail={trail}
        openPath={openPath}
        autoOpen={depth === 0 && !met && r.s !== "ok" && (openPath.has(r.code) || (viable <= 2 && env.statusOf(r.code) === "locked"))}
      />
    ) : r.k === "cond" ? (
      <CondRow key={i} req={r} />
    ) : (
      <li key={i} className="my-1 rounded-lg border border-stone-200 bg-stone-50/70 px-1.5 py-1">
        <div className="flex items-center gap-2 px-1.5 py-0.5 text-[11px] font-medium text-stone-500">
          <Mark s={stateOf(r.s)} />
          {groupLabel(r, t)}
        </div>
        <Options group={r} env={env} depth={depth} trail={trail} openPath={openPath} />
      </li>
    );

  return (
    <ul className="space-y-0.5">
      {shown.map(row)}
      {rest.length > 0 && (
        <li>
          <button type="button" onClick={() => setShowRest((v) => !v)} className="mt-0.5 inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-[11px] text-stone-400 hover:bg-stone-100 hover:text-stone-700">
            <Chevron open={showRest} />
            {met
              ? t(`${plural(rest.length, "other option")} (no longer needed)`, `其他 ${rest.length} 个选项（已经不需要）`)
              : t(`${plural(rest.length, "option")} you can't take (antireq conflict or restricted)`, `${rest.length} 个选项你选不了（反修冲突或限制开放）`)}
          </button>
          {showRest && <ul className="space-y-0.5 opacity-70">{rest.map(row)}</ul>}
        </li>
      )}
    </ul>
  );
}

const MARK_LABEL: Record<Tri, Text> = {
  ok: { en: "Met", zh: "已满足" },
  no: { en: "Not met yet", zh: "还没满足" },
  unk: { en: "Needs checking", zh: "需要确认" },
};

const CARD_TONE: Record<State, { box: string; head: string; label?: Text }> = {
  ok: { box: "border-emerald-200 bg-white", head: "bg-emerald-50 text-emerald-800", label: MARK_LABEL.ok },
  no: { box: "border-amber-300 bg-white shadow-sm shadow-amber-100", head: "bg-amber-50 text-amber-900", label: MARK_LABEL.no },
  unk: { box: "border-amber-200 bg-white", head: "bg-amber-50/60 text-amber-800", label: MARK_LABEL.unk },
  none: { box: "border-stone-200 bg-white", head: "bg-stone-50 text-stone-700" },
};

function ReqCard({ group, env, depth, trail, openPath }: { group: Extract<Req, { k: "group" }>; env: Env; depth: number; trail: string[]; openPath: Set<string> }) {
  const t = useT();
  const state = stateOf(group.s);
  const tone = CARD_TONE[state];
  const coreqOnly = group.kids.every((k) => k.coreq);
  const via = group.s === "ok" && group.n !== "all" ? group.kids.flatMap((k) => (k.s === "ok" && k.k === "course" ? [formatCode(k.code)] : [])) : [];
  const label = state === "no" && coreqOnly ? t("Can be taken in the same term", "可以同学期一起修") : tone.label && t(tone.label);
  return (
    <div className={cx("overflow-hidden rounded-xl border", tone.box)}>
      <div className={cx("flex items-center gap-2 px-3 py-1.5 text-xs", tone.head)}>
        <Mark s={state} size="lg" />
        <span className="font-semibold">{groupLabel(group, t)}</span>
        {coreqOnly && <Badge tone="teal">{t("Coreq", "同修")}</Badge>}
        <span className="ml-auto truncate text-[11px] font-medium opacity-80">
          {label}
          {via.length > 0 && t(` · via ${via.join(", ")}`, ` · 通过 ${via.join("、")}`)}
        </span>
      </div>
      <div className={cx("px-1.5", depth ? "py-1" : "py-1.5")}>
        <Options group={group} env={env} depth={depth} trail={trail} openPath={openPath} />
      </div>
    </div>
  );
}

function AndDivider() {
  const t = useT();
  return (
    <div className="flex items-center gap-2 py-0.5 text-[10px] font-semibold tracking-widest text-stone-400">
      <span className="h-px flex-1 bg-stone-200" />
      {t("AND", "且")}
      <span className="h-px flex-1 bg-stone-200" />
    </div>
  );
}

function ReqList({ code, env, depth, trail, openPath }: { code: string; env: Env; depth: number; trail: string[]; openPath: Set<string> }) {
  const t = useT();
  const course = env.catalog.courses[code];
  const cards = useMemo(() => {
    if (!course) return [];
    const reqs = requirements(course, env.evalOf(code));
    const singles = reqs.filter((r) => r.k !== "group");
    const groups = reqs.filter((r): r is Extract<Req, { k: "group" }> => r.k === "group");
    const must: Extract<Req, { k: "group" }>[] = singles.length ? [{ k: "group", n: "all", s: combine(singles), coreq: false, kids: singles }] : [];
    return [...must, ...groups];
  }, [course, env, code]);

  if (!cards.length) return <p className="px-1.5 py-1 text-xs text-stone-400">{t("No prerequisites", "没有先修要求")}</p>;
  return (
    <div className="space-y-1.5">
      {cards.map((g, i) => (
        <div key={i}>
          {i > 0 && <AndDivider />}
          <ReqCard group={g} env={env} depth={depth} trail={trail} openPath={openPath} />
        </div>
      ))}
    </div>
  );
}

/* ---------- downstream: what it unlocks ---------- */

const LINK_BADGE: Record<Link, { label: Text; tone: "gold" | "teal" | "stone" }> = {
  required: { label: { en: "Required", zh: "必需" }, tone: "gold" },
  coreq: { label: { en: "Coreq", zh: "同修" }, tone: "teal" },
  option: { label: { en: "One option", zh: "选项之一" }, tone: "stone" },
};

const SECTIONS: { link: Link; title: Text; hint: Text }[] = [
  {
    link: "required",
    title: { en: "Requires this course", zh: "一定要先修它" },
    hint: { en: "Their prerequisites must include it", zh: "这些课的先修条件里必须有它" },
  },
  {
    link: "coreq",
    title: { en: "Corequisite with this course", zh: "要和它同修" },
    hint: { en: "Taken before or in the same term", zh: "之前修过或同一学期一起修" },
  },
  {
    link: "option",
    title: { en: "One of several prerequisite options", zh: "它是先修选项之一" },
    hint: { en: "Any one of a few courses works", zh: "几门里任选，换成别的课也行" },
  },
];

function DownRow({ node, env, center, depth }: { node: DownNode; env: Env; center: string; depth: number }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const course = env.catalog.courses[node.code];
  const status = env.statusOf(node.code);
  const unlock = depth === 0 && env.wouldUnlock(center, node.code);
  return (
    <li>
      <div className={cx("flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 hover:bg-stone-50", node.seen && "opacity-60")}>
        {depth > 0 && (
          <Badge tone={LINK_BADGE[node.link].tone} title={t("Relationship to the course above", "和上一门课的关系")}>
            {t(LINK_BADGE[node.link].label)}
          </Badge>
        )}
        <CodeButton code={node.code} env={env} />
        <span className="min-w-0 flex-1 truncate text-xs text-stone-600" title={course?.title}>
          {course?.title}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {unlock && (
            <Badge tone="green" title={t("Your other prerequisites are met; finishing the current course unlocks it", "你的其他先修都已满足，修完当前这门就能选")}>
              {t("Unlocked after this", "修完即可选")}
            </Badge>
          )}
          {status && !unlock && (
            <Badge tone={AVAILABILITY[status].tone} title={t(AVAILABILITY[status].hint)}>
              {t(AVAILABILITY[status].label)}
            </Badge>
          )}
          <CategoryBadge code={node.code} env={env} />
          {node.kids.length > 0 && (
            <button type="button" onClick={() => setOpen((v) => !v)} className="ml-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-stone-500 hover:bg-stone-100" aria-expanded={open}>
              <Chevron open={open} />
              {t(`Unlocks ${node.kids.length} more`, `再解锁 ${node.kids.length} 门`)}
            </button>
          )}
          {node.seen && <span className="text-[11px] text-stone-400">{t("Listed elsewhere", "已在别处列出")}</span>}
        </span>
      </div>
      {open && (
        <ul className="mb-1 ml-[13px] border-l-2 border-dashed border-stone-200 pl-3">
          {node.kids.map((k) => (
            <DownRow key={k.code} node={k} env={env} center={center} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

/* ---------- layout ---------- */

function Column({ step, title, subtitle, actions, children }: { step: string; title: string; subtitle: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex min-h-0 flex-col">
      <header className="flex items-end justify-between gap-2 px-1 pb-2.5">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold tracking-wide text-stone-400">{step}</div>
          <h3 className="text-sm font-semibold text-stone-800">{title}</h3>
          <p className="text-xs text-stone-500">{subtitle}</p>
        </div>
        {actions}
      </header>
      <div className="min-h-0 flex-1 pb-2 pr-1 md:overflow-auto">{children}</div>
    </section>
  );
}

function antireqHits(r: EvalResult | undefined): string[] {
  if (!r) return [];
  return r.node.t === "notCourses" ? (r.have ?? []) : (r.kids ?? []).flatMap(antireqHits);
}

const VERDICT: Record<Availability, { box: string; icon: string }> = {
  taken: { box: "bg-sky-50 text-sky-900 ring-sky-200", icon: "✓" },
  eligible: { box: "bg-emerald-50 text-emerald-900 ring-emerald-200", icon: "✓" },
  needsCoreq: { box: "bg-teal-50 text-teal-900 ring-teal-200", icon: "✓" },
  check: { box: "bg-amber-50 text-amber-900 ring-amber-200", icon: "?" },
  restricted: { box: "bg-rose-50 text-rose-900 ring-rose-200", icon: "!" },
  locked: { box: "bg-stone-100 text-stone-800 ring-stone-200", icon: "…" },
  antireq: { box: "bg-rose-50 text-rose-900 ring-rose-200", icon: "✕" },
};

function RetraceBanner({ paths, target, env }: { paths: RetracePath[]; target: string; env: Env }) {
  const t = useT();
  if (!paths.length) return null;
  const primary = paths[0];
  const start = primary.chain[0];
  const startTitle = env.catalog.courses[start]?.title;
  const startStatus = env.statusOf(start);
  const trail = [...primary.chain.map(formatCode), formatCode(target)].join(" → ");
  const extras = paths.slice(1).map((p) => formatCode(p.chain[0]));

  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/80 p-2.5 text-xs text-amber-950">
      <div className="font-semibold">{t("Start from the top of the required chain", "从必修链最上面一门开始")}</div>
      <div className="mt-1 leading-relaxed text-amber-900/90">
        {t("Take ", "先修 ")}
        <button type="button" onClick={() => env.navigate(start)} className="font-mono font-semibold text-sky-800 hover:underline">
          {formatCode(start)}
        </button>
        {startTitle ? ` ${startTitle}` : ""}
        {startStatus && startStatus !== "locked" && (
          <span className="text-amber-800/80">
            {t(` (${AVAILABILITY[startStatus].label.en.toLowerCase()})`, `（${AVAILABILITY[startStatus].label.zh}）`)}
          </span>
        )}
        {t(" first, then work forward:", "，再按这条链往下修：")}
      </div>
      <div className="mt-1.5 font-mono text-[11px] leading-relaxed text-amber-900/80">{trail}</div>
      {extras.length > 0 && (
        <div className="mt-1.5 text-[11px] text-amber-800/80">
          {t("Also still needed in parallel: ", "另外还要并行补上：")}
          {extras.map((c, i) => (
            <span key={c}>
              {i > 0 && t(", ", "、")}
              <button type="button" onClick={() => env.navigate(paths[i + 1].chain[0])} className="font-mono font-semibold text-sky-800 hover:underline">
                {c}
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Hub({
  code,
  env,
  upCount,
  downCount,
  paths,
  onGraph,
}: {
  code: string;
  env: Env;
  upCount: number;
  downCount: number;
  paths: RetracePath[];
  onGraph: () => void;
}) {
  const t = useT();
  const course = env.catalog.courses[code];
  const ev = env.evalOf(code);
  const status = ev?.availability;
  const unmet = useMemo(() => (course ? requirements(course, ev).filter((r) => r.s !== "ok").length : 0), [course, ev]);

  let text = t("Upload your transcript to see whether you can take this course and what's still missing.", "上传成绩单后，这里会显示你能不能选、还差哪些条件。");
  if (status === "taken") text = t("You've already taken this course.", "你已经修过这门课。");
  else if (status === "eligible") text = t("All prerequisites are met. You can take it.", "先修条件全部满足，可以选。");
  else if (status === "needsCoreq") text = t("Prerequisites are met; its corequisite must be taken in the same term.", "先修已满足，同修课需要同一学期一起选。");
  else if (status === "check") text = t("Some conditions can't be checked automatically; please confirm manually.", "有条件无法自动判断，请人工确认。");
  else if (status === "restricted") text = t(AVAILABILITY.restricted.hint);
  else if (status === "locked")
    text = paths.length
      ? t(
          `${plural(unmet, "prerequisite")} still missing. Retraced to ${formatCode(paths[0].chain[0])} at the top of the required chain.`,
          `还差 ${unmet} 项先修。已追溯到必修链最上面的 ${formatCode(paths[0].chain[0])}。`,
        )
      : t(`${plural(unmet, "prerequisite")} still missing; see the highlighted cards on the left.`, `还差 ${unmet} 项先修条件，见左侧标黄的卡片。`);
  else if (status === "antireq") {
    const hits = antireqHits(ev?.antireq).map(formatCode);
    text = t(
      `Antirequisite conflict with ${hits.join(", ") || "a course"} you've taken, so you can't take it.`,
      `和你修过的 ${hits.join("、") || "课程"} 反修冲突，不能再选。`,
    );
  }

  return (
    <div className="relative rounded-2xl border border-stone-300 bg-white p-4 shadow-md">
      <span className="absolute -left-3 top-8 hidden h-6 w-6 place-items-center rounded-full border border-stone-200 bg-white text-xs text-stone-400 shadow-sm xl:grid">→</span>
      <span className="absolute -right-3 top-8 hidden h-6 w-6 place-items-center rounded-full border border-stone-200 bg-white text-xs text-stone-400 shadow-sm xl:grid">→</span>
      <div className="text-[11px] font-semibold tracking-wide text-stone-400">{t("Current course", "当前课程")}</div>
      <div className="mt-0.5 font-mono text-2xl font-bold tracking-tight text-stone-900">{formatCode(code)}</div>
      <div className="text-sm leading-snug text-stone-700">{course?.title ?? t("(not in the calendar)", "（日历中没有这门课）")}</div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {course && <Badge>{t(`${course.units} units`, `${course.units} 学分`)}</Badge>}
        <CategoryBadge code={code} env={env} />
      </div>

      <div className={cx("mt-3 flex gap-2 rounded-xl p-2.5 text-xs ring-1 ring-inset", status ? VERDICT[status].box : "bg-stone-50 text-stone-600 ring-stone-200")}>
        {status && <span className="font-bold">{VERDICT[status].icon}</span>}
        <div>
          {status && <div className="font-semibold">{t(AVAILABILITY[status].label)}</div>}
          <div className="leading-relaxed">{text}</div>
        </div>
      </div>

      {status === "locked" && <RetraceBanner paths={paths} target={code} env={env} />}

      <dl className="mt-3 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg bg-stone-50 py-1.5">
          <dt className="text-[11px] text-stone-500">{t("Full prerequisite chain", "整条先修链")}</dt>
          <dd className="text-base font-semibold tabular-nums">{t(plural(upCount, "course"), `${upCount} 门`)}</dd>
        </div>
        <div className="rounded-lg bg-stone-50 py-1.5">
          <dt className="text-[11px] text-stone-500">{t("Unlocks later", "往后能解锁")}</dt>
          <dd className="text-base font-semibold tabular-nums">{t(plural(downCount, "course"), `${downCount} 门`)}</dd>
        </div>
      </dl>
      <button
        type="button"
        onClick={onGraph}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-stone-200 py-1.5 text-xs font-medium text-stone-700 transition hover:border-stone-400 hover:bg-stone-50"
      >
        {t("View full chain graph →", "查看完整链路图 →")}
      </button>

      {course?.desc && <p className="mt-3 line-clamp-3 text-xs xl:line-clamp-6 leading-relaxed text-stone-500">{course.desc}</p>}
    </div>
  );
}

interface GraphPanelProps {
  code: string;
  env: Env;
  idx: DependentsIndex;
  programOk: (code: string) => boolean;
  hideBlocked: boolean;
  setHideBlocked: (v: boolean) => void;
}

function GraphPanel({ code, env, idx, programOk, hideBlocked, setHideBlocked }: GraphPanelProps) {
  const t = useT();
  const { catalog, cz, evalOf } = env;
  const graph = useMemo(
    () =>
      buildChainGraph(catalog, idx, code, {
        includeUp: (c, link) => {
          if (!hideBlocked || link !== "option") return true;
          const s = evalOf(c)?.availability;
          return s === "taken" || (s !== "antireq" && s !== "restricted" && programOk(c));
        },
        includeDown: hideBlocked ? programOk : undefined,
        prefer: (c) => cz.categories.has(c),
      }),
    [catalog, cz, evalOf, idx, code, hideBlocked, programOk],
  );
  const shownDown = graph.downCount - graph.downOmitted;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-stone-200 bg-white px-5 py-2.5">
        <div className="text-xs text-stone-600">
          <span className="font-semibold text-stone-800">{t(plural(graph.nodes.length, "course"), `${graph.nodes.length} 门课`)}</span>
          {t(` · ${graph.upCount} before · ${graph.downCount} after`, ` · 先修 ${graph.upCount} 门 · 后续 ${graph.downCount} 门`)}
          {graph.downOmitted > 0 && (
            <span className="text-amber-700">
              {t(` (too many follow-ups; showing only the ${shownDown} directly unlocked)`, `（后续太多，只画直接解锁的 ${shownDown} 门）`)}
            </span>
          )}
        </div>
        <GraphLegend />
        <div className="ml-auto">
          <Toggle checked={hideBlocked} onChange={setHideBlocked} label={<span className="text-xs">{t("Hide options I can't take", "隐藏我选不了的选项")}</span>} />
        </div>
      </div>
      <ChainGraphView
        graph={graph}
        center={code}
        statusOf={env.statusOf}
        titleOf={(c) => catalog.courses[c]?.title}
        detail={(c) => <CategoryBadge code={c} env={env} />}
        onPick={env.navigate}
      />
    </div>
  );
}

interface DialogProps {
  stack: string[];
  env: Env;
  idx: DependentsIndex;
  programOk: (code: string) => boolean;
  view: View;
  setView: (v: View) => void;
  hideBlocked: boolean;
  setHideBlocked: (v: boolean) => void;
  onCrumb: (i: number) => void;
  onClose: () => void;
}

function ChainDialog({ stack, env, idx, programOk, view, setView, hideBlocked, setHideBlocked, onCrumb, onClose }: DialogProps) {
  const t = useT();
  const code = stack[stack.length - 1];
  const { catalog } = env;
  const course = catalog.courses[code];
  const [jump, setJump] = useState("");

  const upCount = useMemo(() => upstreamTree(catalog, code).courses.size, [catalog, code]);
  const down = useMemo(() => downstreamTree(catalog, idx, code, hideBlocked ? programOk : undefined), [catalog, idx, code, hideBlocked, programOk]);
  const top = useMemo(() => (course ? requirements(course, env.evalOf(code)) : []), [course, env, code]);
  const paths = useMemo(() => {
    if (!env.hasCtx || env.statusOf(code) !== "locked") return [];
    return retraceRequired(catalog, code, env.evalOf, (c) => env.cz.categories.has(c));
  }, [catalog, code, env]);
  const openPath = useMemo(() => new Set(paths.flatMap((p) => p.chain)), [paths]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const target = normalizeCode(jump);
  const jumpOk = !!catalog.courses[target];
  const hiddenNote =
    hideBlocked && down.hidden.size
      ? t(`${down.hidden.size} more only open to other programs, hidden`, `另有 ${down.hidden.size} 门只对其他专业开放，已隐藏`)
      : "";

  const upSubtitle = !top.length
    ? t("This course has no prerequisites or corequisites", "这门课没有先修或同修要求")
    : env.hasCtx
      ? paths[0]
        ? t(
            `${top.filter((r) => r.s === "ok").length} / ${top.length} met · start from ${formatCode(paths[0].chain[0])}`,
            `${top.filter((r) => r.s === "ok").length} / ${top.length} 项已满足 · 从 ${formatCode(paths[0].chain[0])} 开始`,
          )
        : t(`${top.filter((r) => r.s === "ok").length} / ${top.length} met · every card must be satisfied`, `${top.filter((r) => r.s === "ok").length} / ${top.length} 项已满足 · 每张卡片都要满足`)
      : t("Every card must be satisfied · upload a transcript to mark what you've met", "每张卡片都要满足 · 上传成绩单后会标出已满足的条件");

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-stone-900/40 p-3 sm:p-6" onClick={onClose}>
      <div className="flex w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-stone-50 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex flex-wrap items-center gap-3 border-b border-stone-200 bg-white px-5 py-3">
          <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-sm" aria-label={t("Breadcrumb", "浏览路径")}>
            <span className="mr-1 font-semibold text-stone-800">{t("Course chain", "课程链")}</span>
            {stack.map((c, i) => (
              <span key={`${c}-${i}`} className="flex items-center gap-1">
                <span className="text-stone-300">›</span>
                {i === stack.length - 1 ? (
                  <span className="rounded-md bg-stone-900 px-2 py-0.5 font-mono text-xs font-semibold text-white">{formatCode(c)}</span>
                ) : (
                  <button type="button" onClick={() => onCrumb(i)} className="rounded-md px-1.5 py-0.5 font-mono text-xs text-stone-500 hover:bg-stone-100 hover:text-stone-800">
                    {formatCode(c)}
                  </button>
                )}
              </span>
            ))}
          </nav>
          <div className="flex rounded-lg bg-stone-100 p-0.5 text-sm" role="tablist">
            {(["overview", "graph"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={cx("rounded-md px-3 py-1 font-medium transition", view === v ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800")}
              >
                {v === "overview" ? t("Overview", "概览") : t("Full chain", "完整链路")}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!jumpOk) return;
              env.navigate(target);
              setJump("");
            }}
            className="flex items-center gap-1.5"
          >
            <input
              value={jump}
              onChange={(e) => setJump(e.target.value)}
              placeholder={t("Jump to a course, e.g. ECE 222", "跳到其他课，如 ECE 222")}
              className={cx("w-56 rounded-lg border px-2.5 py-1.5 text-sm outline-none focus:border-stone-500", jump && !jumpOk ? "border-rose-300" : "border-stone-200")}
            />
            <button type="submit" disabled={!jumpOk} className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:border-stone-400 disabled:opacity-50">
              {t("Go", "查看")}
            </button>
          </form>
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-800">
            {t("Close ✕", "关闭 ✕")}
          </button>
        </header>

        {view === "graph" ? (
          <GraphPanel code={code} env={env} idx={idx} programOk={programOk} hideBlocked={hideBlocked} setHideBlocked={setHideBlocked} />
        ) : (
          <div className="grid min-h-0 flex-1 gap-5 overflow-auto p-5 md:grid-cols-[minmax(0,1.4fr)_minmax(300px,1fr)] md:grid-rows-[auto_minmax(0,1fr)] md:overflow-hidden xl:grid-cols-[minmax(0,1.35fr)_280px_minmax(0,1fr)] xl:grid-rows-1">
            <div className="md:col-start-2 md:row-start-1">
              <Hub code={code} env={env} upCount={upCount} downCount={down.courses.size} paths={paths} onGraph={() => setView("graph")} />
            </div>

            <div className="flex min-h-0 flex-col md:col-start-1 md:row-span-2 md:row-start-1 xl:row-span-1">
              <Column step={t("Prerequisites · where it comes from", "先修 · 从哪来")} title={t(`To take ${formatCode(code)}, you need`, `要修 ${formatCode(code)}，需要`)} subtitle={upSubtitle}>
                {top.length ? (
                  <ReqList code={code} env={env} depth={0} trail={[code]} openPath={openPath} />
                ) : (
                  <div className="rounded-xl border border-dashed border-stone-300 bg-white px-4 py-8 text-center text-xs text-stone-400">
                    {t("This is the start of the chain; no other courses are required first", "这是链条的起点，不需要先修其他课")}
                  </div>
                )}
              </Column>
            </div>

            <div className="flex min-h-0 flex-col md:col-start-2 md:row-start-2 xl:col-start-3 xl:row-start-1">
              <Column
                step={t("Unlocks · where it leads", "解锁 · 到哪去")}
                title={t(`After ${formatCode(code)}, you can take`, `修完 ${formatCode(code)}，可以选`)}
                subtitle={
                  down.courses.size
                    ? t(`Directly unlocks ${down.roots.length}`, `直接解锁 ${down.roots.length} 门`) + (hiddenNote ? ` · ${hiddenNote}` : "")
                    : hiddenNote || t("No course lists it as a prerequisite or corequisite", "没有课程把它列为先修或同修")
                }
                actions={<Toggle checked={hideBlocked} onChange={setHideBlocked} label={<span className="text-xs">{t("My program only", "只看我专业")}</span>} />}
              >
                {down.roots.length ? (
                  <div className="space-y-3">
                    {SECTIONS.map(({ link, title, hint }) => {
                      const nodes = down.roots.filter((n) => n.link === link);
                      if (!nodes.length) return null;
                      return (
                        <div key={link} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                          <div className="flex items-baseline gap-2 bg-stone-50 px-3 py-1.5 text-xs">
                            <span className="font-semibold text-stone-800">{t(title)}</span>
                            <span className="tabular-nums text-stone-400">{nodes.length}</span>
                            <span className="ml-auto truncate text-[11px] text-stone-400">{t(hint)}</span>
                          </div>
                          <ul className="space-y-0.5 p-1.5">
                            {nodes.map((n) => (
                              <DownRow key={n.code} node={n} env={env} center={code} depth={0} />
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-stone-300 bg-white px-4 py-8 text-center text-xs text-stone-400">
                    {t("This is the end of the chain; no follow-up courses for now", "这是链条的终点，暂时没有后续课程")}
                  </div>
                )}
              </Column>
            </div>
          </div>
        )}

        <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-stone-200 bg-white px-5 py-2 text-[11px] text-stone-500">
          {view === "graph" ? (
            <span>
              {t(
                "Higher means more foundational, lower means later. Solid lines are required prerequisites; dashed lines are one-of-several. Hover a node to highlight its links; click to centre on it.",
                "越往上越基础，越往下越后面。实线是必须先修，虚线是几门里选一门。悬停圆球会高亮它的连线，点击以它为中心。",
              )}
            </span>
          ) : (
            <>
              {(["ok", "no", "unk"] as const).map((s) => (
                <span key={s} className="flex items-center gap-1.5">
                  <Mark s={s} /> {t(MARK_LABEL[s])}
                </span>
              ))}
              <span className="text-stone-400">
                {t("Click any course code to centre on that course; use the breadcrumb at the top to go back.", "点任意课号会以那门课为中心继续查看，顶部路径可以返回。")}
              </span>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
