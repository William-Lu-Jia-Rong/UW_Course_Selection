import { useMemo, useState } from "react";
import { CAREER_BY_ID, CAREERS } from "../lib/careers";
import { formatCode } from "../lib/codes";
import type { CourseEval } from "../lib/evaluate";
import { recommend, type Candidate, type Suggestion } from "../lib/recommend";
import { CATEGORY_LABEL, type Categorizer, type DegreeProgress } from "../lib/requirements";
import type { Catalog, Offering } from "../lib/types";
import { FlowRating } from "./FlowRating";
import { useOpenChain } from "./PrereqChain";
import { AVAILABILITY, Badge, Button, Card, cx } from "./ui";

const MAX_CAREERS = 3;

interface Props {
  catalog: Catalog;
  cz: Categorizer;
  evals: CourseEval[];
  offered: Map<string, Offering[]>;
  progress: DegreeProgress;
  level: string;
  careers: string[];
  setCareers: (ids: string[]) => void;
  plan: string[];
  onTogglePlan: (code: string) => void;
  onAddToPlan: (codes: string[]) => void;
}

function CourseCell({ c, catalog, plan, onTogglePlan, showWhy = true }: { c: Candidate; catalog: Catalog; plan: string[]; onTogglePlan: (code: string) => void; showWhy?: boolean }) {
  const openChain = useOpenChain();
  const meta = AVAILABILITY[c.availability];
  const planned = plan.includes(c.code);
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <button type="button" onClick={() => openChain(c.code)} className="font-mono text-sm font-semibold text-sky-800 hover:underline" title="查看课程链">
        {formatCode(c.code)}
      </button>
      <span className="text-sm text-stone-700">{catalog.courses[c.code]?.title}</span>
      <Badge tone={meta.tone} title={meta.hint}>
        {meta.label}
      </Badge>
      {!c.offered && <Badge tone="stone">下学期没开</Badge>}
      {showWhy && c.why.map((w) => (
        <Badge key={w} tone="violet">
          {w}
        </Badge>
      ))}
      <FlowRating code={c.code} />
      <span className="ml-auto flex gap-1.5">
        <button type="button" onClick={() => openChain(c.code)} className="rounded-lg border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-600 hover:border-stone-400">
          课程链
        </button>
        {c.availability !== "taken" && (
          <button
            type="button"
            onClick={() => onTogglePlan(c.code)}
            className={cx(
              "rounded-lg border px-2.5 py-1 text-xs font-medium transition",
              planned ? "border-yellow-400 bg-yellow-100 text-yellow-900" : "border-stone-200 text-stone-600 hover:border-stone-400",
            )}
          >
            {planned ? "已加入" : "+ 计划"}
          </button>
        )}
      </span>
    </div>
  );
}

function SuggestionRow(props: {
  s: Suggestion;
  pick?: Candidate;
  takenElsewhere: Set<string>;
  onSwap: (code: string) => void;
  catalog: Catalog;
  cz: Categorizer;
  plan: string[];
  onTogglePlan: (code: string) => void;
}) {
  const { s, pick, catalog, cz } = props;
  const swapped = pick && pick.code !== s.pick?.code;
  const options = [s.pick, ...s.alternatives].filter((c): c is Candidate => !!c && c.code !== pick?.code);
  const fills = swapped ? (cz.categories.get(pick.code) ?? []).map((c) => CATEGORY_LABEL[c]).join(" / ") : s.fills;
  return (
    <li className="space-y-2 border-b border-stone-100 px-4 py-3 last:border-0">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <Badge tone={s.kind === "elective" ? "stone" : "gold"}>{s.slot}</Badge>
        {fills && <span className="text-stone-500">→ 算作 {fills}</span>}
      </div>
      {pick && <CourseCell c={pick} catalog={catalog} plan={props.plan} onTogglePlan={props.onTogglePlan} showWhy={s.kind !== "required"} />}
      {s.problem && <p className="text-xs text-rose-600">{s.problem}</p>}
      {s.note && !swapped && <p className="text-xs text-amber-700">{s.note}</p>}
      {options.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
          <span>{s.kind === "choose" ? "或者选：" : "其他选择："}</span>
          {options.map((o) => {
            const busy = props.takenElsewhere.has(o.code);
            return (
              <button
                key={o.code}
                type="button"
                disabled={busy}
                onClick={() => props.onSwap(o.code)}
                title={busy ? "已经在别的名额里推荐了" : `${catalog.courses[o.code]?.title ?? ""}${o.why.length ? ` · ${o.why.join("、")}` : ""}`}
                className="rounded-full border border-stone-200 bg-white px-2 py-0.5 font-mono text-stone-700 hover:border-stone-500 disabled:opacity-40"
              >
                {formatCode(o.code)}
              </button>
            );
          })}
        </div>
      )}
    </li>
  );
}

export function CareerView(p: Props) {
  const selected = useMemo(() => p.careers.map((id) => CAREER_BY_ID.get(id)).filter((c) => !!c), [p.careers]);
  const offeredSet = useMemo(() => new Set(p.offered.keys()), [p.offered]);
  const rec = useMemo(
    () => recommend({ catalog: p.catalog, cz: p.cz, evals: p.evals, offered: offeredSet, progress: p.progress, level: p.level, careers: selected }),
    [p.catalog, p.cz, p.evals, offeredSet, p.progress, p.level, selected],
  );
  const recKey = `${p.level}|${p.careers.join()}|${rec.suggestions.map((s) => s.pick?.code).join()}`;
  const [swaps, setSwaps] = useState<{ key: string; picks: Record<number, string> }>({ key: "", picks: {} });
  const picks = swaps.key === recKey ? swaps.picks : {};

  const pickOf = (i: number, s: Suggestion): Candidate | undefined => {
    const code = picks[i];
    return code ? [s.pick, ...s.alternatives].find((c) => c?.code === code) : s.pick;
  };
  const chosen = rec.suggestions.map((s, i) => pickOf(i, s));
  const chosenCodes = chosen.flatMap((c) => (c ? [c.code] : []));
  const units = chosenCodes.reduce((sum, c) => sum + (p.catalog.courses[c]?.units ?? 0), 0);

  const toggleCareer = (id: string) => {
    if (p.careers.includes(id)) p.setCareers(p.careers.filter((c) => c !== id));
    else if (p.careers.length < MAX_CAREERS) p.setCareers([...p.careers, id]);
  };

  return (
    <div className="space-y-5">
      <Card title={`选择职业方向（最多 ${MAX_CAREERS} 个）`}>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {CAREERS.map((c) => {
            const on = p.careers.includes(c.id);
            const full = !on && p.careers.length >= MAX_CAREERS;
            return (
              <button
                key={c.id}
                type="button"
                disabled={full}
                onClick={() => toggleCareer(c.id)}
                className={cx(
                  "rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50",
                  on ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 bg-white hover:border-stone-400",
                )}
              >
                <div className="text-sm font-semibold">{c.label}</div>
                <div className={cx("mt-0.5 text-xs", on ? "text-stone-300" : "text-stone-500")}>{c.blurb}</div>
              </button>
            );
          })}
        </div>
      </Card>

      <Card
        title={`${rec.term} 学期建议选课`}
        actions={
          chosenCodes.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-stone-500">
                共 {chosenCodes.length} 门 · {units.toFixed(2)} units
              </span>
              <Button variant="primary" onClick={() => p.onAddToPlan(chosenCodes)}>
                全部加入计划
              </Button>
            </div>
          )
        }
      >
        <p className="mb-3 text-xs text-stone-500">
          {selected.length
            ? `按「${selected.map((c) => c.label).join("」「")}」从下学期开、你现在能选的课里挑。每门选修都对应一个你还没满足的毕业要求（TE / NS / CSE / Ethics），并且会给后面学期指定 List 1 / List 2 的名额留好位置。`
            : "先在上面选一个职业方向。没选方向时只按毕业要求排序。"}
        </p>
        {rec.suggestions.length ? (
          <ul className="-mx-4 border-t border-stone-100">
            {rec.suggestions.map((s, i) => (
              <SuggestionRow
                key={i}
                s={s}
                pick={chosen[i]}
                takenElsewhere={new Set(chosenCodes.filter((c) => c !== chosen[i]?.code))}
                onSwap={(code) => setSwaps({ key: recKey, picks: { ...picks, [i]: code } })}
                catalog={p.catalog}
                cz={p.cz}
                plan={p.plan}
                onTogglePlan={p.onTogglePlan}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-stone-500">{rec.term} 学期的必修和选修名额都已经满足了。</p>
        )}
      </Card>

      {selected.length > 0 && rec.later.length > 0 && (
        <Card title="这个方向以后要修的核心课">
          <p className="mb-3 text-xs text-stone-500">下学期没开或者现在还不能选。点「课程链」看还差哪些先修，可以提前规划。</p>
          <ul className="-mx-4 border-t border-stone-100">
            {rec.later.map((c) => (
              <li key={c.code} className="border-b border-stone-100 px-4 py-2.5 last:border-0">
                <CourseCell c={c} catalog={p.catalog} plan={p.plan} onTogglePlan={p.onTogglePlan} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
