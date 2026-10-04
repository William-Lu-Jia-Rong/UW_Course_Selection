import { useState } from "react";
import { formatCode } from "../lib/codes";
import { unmetReasons } from "../lib/describe";
import type { CourseEval } from "../lib/evaluate";
import { CATEGORY_LABEL, type Categorizer, type MembershipReason } from "../lib/requirements";
import type { Offering } from "../lib/types";
import { UWFLOW_COURSE_URL } from "../lib/uwflow";
import { FlowRating } from "./FlowRating";
import { RequisiteTree } from "./RequisiteTree";
import { AVAILABILITY, Badge, cx } from "./ui";

const KUALI_COURSE_URL = "https://uwaterloo.ca/academic-calendar/undergraduate-studies/catalog#/courses/";

const REASON_SUFFIX: Record<MembershipReason, string> = { listed: "", crossListed: "（交叉列名）", subject: "（按科目代码）" };
const REASON_HINT: Record<MembershipReason, string> = {
  listed: "这门课被单独列在该列表里",
  crossListed: "它的交叉列名课程（同一门课的另一个课号）在这个列表里",
  subject: "BASc Complementary Studies 页面规定：这个科目代码下的任何 0.5 学分课程都算该列表（List D 和 Exclusions 里的除外）",
};

interface RowProps {
  ev: CourseEval;
  cz: Categorizer;
  offerings?: Offering[];
  planned: boolean;
  onTogglePlan: (code: string) => void;
}

function CourseRow({ ev, cz, offerings, planned, onTogglePlan }: RowProps) {
  const [open, setOpen] = useState(false);
  const { course, availability } = ev;
  const meta = AVAILABILITY[availability];
  const cats = cz.categories.get(course.code) ?? [];
  const reqTerm = cz.requiredTerm.get(course.code);
  const reasons =
    availability === "restricted" || (availability === "check" && ev.offeringIssue && ev.prereq?.s !== "unk")
      ? [`开课备注：${ev.offeringIssue?.note}`]
      : availability === "locked" || availability === "check"
        ? ev.prereq && unmetReasons(ev.prereq)
        : availability === "needsCoreq"
          ? ev.coreq && unmetReasons(ev.coreq)
          : availability === "antireq"
            ? ev.antireq && unmetReasons(ev.antireq)
            : undefined;

  return (
    <li className={cx("border-b border-stone-100 last:border-0", open && "bg-stone-50/60")}>
      <div className="flex items-start gap-3 px-3 py-2.5">
        <button type="button" onClick={() => setOpen((v) => !v)} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-sm font-semibold text-stone-900">{formatCode(course.code)}</span>
            <span className="text-sm text-stone-700">{course.title}</span>
            <span className="text-xs text-stone-400">{course.units.toFixed(2)}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <Badge tone={meta.tone} title={meta.hint}>
              {meta.label}
            </Badge>
            {cats.map((c) => {
              const why = cz.reasons.get(`${course.code}:${c}`) ?? "listed";
              return (
                <Badge key={c} tone={c === "required" ? "gold" : c.startsWith("te") ? "violet" : "stone"} title={REASON_HINT[why]}>
                  {c === "required" && reqTerm ? `${reqTerm} 必修` : CATEGORY_LABEL[c] + REASON_SUFFIX[why]}
                </Badge>
              );
            })}
            <FlowRating code={course.code} />
            {offerings?.some((o) => o.notes) && <Badge tone="blue">有备注</Badge>}
            {reasons?.length ? <span className="text-xs text-stone-500">· {reasons.join("；")}</span> : null}
          </div>
        </button>
        {availability !== "taken" && (
          <button
            type="button"
            onClick={() => onTogglePlan(course.code)}
            className={cx(
              "shrink-0 rounded-lg border px-2.5 py-1 text-xs font-medium transition",
              planned ? "border-yellow-400 bg-yellow-100 text-yellow-900" : "border-stone-200 text-stone-600 hover:border-stone-400",
            )}
          >
            {planned ? "已加入" : "+ 计划"}
          </button>
        )}
      </div>
      {open && (
        <div className="space-y-3 px-3 pb-4 pl-4 text-sm">
          {course.desc && <p className="text-stone-600">{course.desc}</p>}
          {offerings && (
            <div className="space-y-0.5 text-xs text-stone-600">
              {offerings.map((o, i) => (
                <div key={i}>
                  开课：{o.campus}
                  {o.topic && ` · ${o.topic}`}
                  {o.notes && ` · ${o.notes}`}
                </div>
              ))}
            </div>
          )}
          {ev.prereq && (
            <div>
              <div className="mb-1 text-xs font-semibold text-stone-500">先修 Prerequisites</div>
              <RequisiteTree result={ev.prereq} />
            </div>
          )}
          {ev.coreq && (
            <div>
              <div className="mb-1 text-xs font-semibold text-stone-500">同修 Corequisites</div>
              <RequisiteTree result={ev.coreq} />
            </div>
          )}
          {ev.antireq && (
            <div>
              <div className="mb-1 text-xs font-semibold text-stone-500">反修 Antirequisites</div>
              <RequisiteTree result={ev.antireq} />
            </div>
          )}
          {!ev.prereq && !ev.coreq && !ev.antireq && <p className="text-xs text-stone-500">没有先修/同修/反修要求。</p>}
          <div className="flex flex-wrap gap-4">
            <a className="text-xs text-sky-700 hover:underline" href={KUALI_COURSE_URL + course.pid} target="_blank" rel="noreferrer">
              在 Academic Calendar 中查看 ↗
            </a>
            <a className="text-xs text-sky-700 hover:underline" href={UWFLOW_COURSE_URL + course.code.toLowerCase()} target="_blank" rel="noreferrer">
              在 UWFlow 看评价 ↗
            </a>
          </div>
        </div>
      )}
    </li>
  );
}

interface ListProps {
  evals: CourseEval[];
  cz: Categorizer;
  offerings?: Map<string, Offering[]>;
  plan: string[];
  onTogglePlan: (code: string) => void;
  limit?: number;
  empty?: string;
}

export function CourseList({ evals, cz, offerings, plan, onTogglePlan, limit = 40, empty = "没有符合条件的课程" }: ListProps) {
  const [shown, setShown] = useState(limit);
  if (!evals.length) return <p className="px-3 py-6 text-center text-sm text-stone-400">{empty}</p>;
  return (
    <>
      <ul>
        {evals.slice(0, shown).map((ev) => (
          <CourseRow
            key={ev.course.code}
            ev={ev}
            cz={cz}
            offerings={offerings?.get(ev.course.code)}
            planned={plan.includes(ev.course.code)}
            onTogglePlan={onTogglePlan}
          />
        ))}
      </ul>
      {evals.length > shown && (
        <button type="button" onClick={() => setShown((s) => s + 60)} className="w-full border-t border-stone-100 py-2 text-xs font-medium text-stone-500 hover:bg-stone-50">
          再显示 {Math.min(60, evals.length - shown)} 门（共 {evals.length} 门）
        </button>
      )}
    </>
  );
}
