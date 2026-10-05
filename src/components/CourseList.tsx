import { useState } from "react";
import { formatCode } from "../lib/codes";
import { unmetReasons } from "../lib/describe";
import type { CourseEval } from "../lib/evaluate";
import { useLang, useT, type Text } from "../lib/i18n";
import { CATEGORY_LABEL, type Categorizer, type MembershipReason } from "../lib/requirements";
import type { Offering } from "../lib/types";
import { UWFLOW_COURSE_URL } from "../lib/uwflow";
import { useOpenChain, useRetrace } from "./PrereqChain";
import { FlowRating } from "./FlowRating";
import { RequisiteTree } from "./RequisiteTree";
import { AVAILABILITY, Badge, cx } from "./ui";

const KUALI_COURSE_URL = "https://uwaterloo.ca/academic-calendar/undergraduate-studies/catalog#/courses/";

const REASON_SUFFIX: Record<MembershipReason, Text> = {
  listed: { en: "", zh: "" },
  crossListed: { en: " (cross-listed)", zh: "（交叉列名）" },
  subject: { en: " (by subject)", zh: "（按科目代码）" },
};
const REASON_HINT: Record<MembershipReason, Text> = {
  listed: { en: "This course is listed individually on this list", zh: "这门课被单独列在该列表里" },
  crossListed: { en: "A cross-listed version of it (the same course under another code) is on this list", zh: "它的交叉列名课程（同一门课的另一个课号）在这个列表里" },
  subject: {
    en: "Per the BASc Complementary Studies page, any 0.5-unit course with this subject code counts for this list (except those in List D and the Exclusions)",
    zh: "BASc Complementary Studies 页面规定：这个科目代码下的任何 0.5 学分课程都算该列表（List D 和 Exclusions 里的除外）",
  },
};

interface RowProps {
  ev: CourseEval;
  cz: Categorizer;
  offerings?: Offering[];
  planned: boolean;
  onTogglePlan: (code: string) => void;
}

function CourseRow({ ev, cz, offerings, planned, onTogglePlan }: RowProps) {
  const t = useT();
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const openChain = useOpenChain();
  const retrace = useRetrace();
  const { course, availability } = ev;
  const meta = AVAILABILITY[availability];
  const cats = cz.categories.get(course.code) ?? [];
  const reqTerm = cz.requiredTerm.get(course.code);
  const start = availability === "locked" ? retrace(course.code)[0]?.chain[0] : undefined;
  const reasons =
    availability === "restricted" || (availability === "check" && ev.offeringIssue && ev.prereq?.s !== "unk")
      ? [t(`Schedule note: ${ev.offeringIssue?.note}`, `开课备注：${ev.offeringIssue?.note}`)]
      : availability === "locked" || availability === "check"
        ? ev.prereq && unmetReasons(ev.prereq, lang)
        : availability === "needsCoreq"
          ? ev.coreq && unmetReasons(ev.coreq, lang)
          : availability === "antireq"
            ? ev.antireq && unmetReasons(ev.antireq, lang)
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
            <Badge tone={meta.tone} title={t(meta.hint)}>
              {t(meta.label)}
            </Badge>
            {start && (
              <Badge tone="amber" title={t("Top of the unmet required prerequisite chain", "未满足必修先修链的最上面一门")}>
                {t(`Start with ${formatCode(start)}`, `从 ${formatCode(start)} 起`)}
              </Badge>
            )}
            {cats.map((c) => {
              const why = cz.reasons.get(`${course.code}:${c}`) ?? "listed";
              return (
                <Badge key={c} tone={c === "required" ? "gold" : c.startsWith("te") ? "violet" : "stone"} title={t(REASON_HINT[why])}>
                  {c === "required" && reqTerm ? t(`${reqTerm} required`, `${reqTerm} 必修`) : t(CATEGORY_LABEL[c]) + t(REASON_SUFFIX[why])}
                </Badge>
              );
            })}
            <FlowRating code={course.code} />
            {offerings?.some((o) => o.notes) && <Badge tone="blue">{t("Has notes", "有备注")}</Badge>}
            {reasons?.length ? <span className="text-xs text-stone-500">· {reasons.join(t("; ", "；"))}</span> : null}
          </div>
        </button>
        <button
          type="button"
          onClick={() => openChain(course.code)}
          title={t("See this course's full prerequisite and follow-up chain", "查看这门课完整的前置链和后续链")}
          className="shrink-0 rounded-lg border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-600 transition hover:border-stone-400"
        >
          {t("Chain", "课程链")}
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
            {planned ? t("Added", "已加入") : t("+ Plan", "+ 计划")}
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
                  {t("Offered: ", "开课：")}
                  {o.campus}
                  {o.topic && ` · ${o.topic}`}
                  {o.notes && ` · ${o.notes}`}
                </div>
              ))}
            </div>
          )}
          {ev.prereq && (
            <div>
              <div className="mb-1 text-xs font-semibold text-stone-500">{t("Prerequisites", "先修 Prerequisites")}</div>
              <RequisiteTree result={ev.prereq} />
            </div>
          )}
          {ev.coreq && (
            <div>
              <div className="mb-1 text-xs font-semibold text-stone-500">{t("Corequisites", "同修 Corequisites")}</div>
              <RequisiteTree result={ev.coreq} />
            </div>
          )}
          {ev.antireq && (
            <div>
              <div className="mb-1 text-xs font-semibold text-stone-500">{t("Antirequisites", "反修 Antirequisites")}</div>
              <RequisiteTree result={ev.antireq} />
            </div>
          )}
          {!ev.prereq && !ev.coreq && !ev.antireq && <p className="text-xs text-stone-500">{t("No prerequisites, corequisites or antirequisites.", "没有先修/同修/反修要求。")}</p>}
          <div className="flex flex-wrap gap-4">
            <a className="text-xs text-sky-700 hover:underline" href={KUALI_COURSE_URL + course.pid} target="_blank" rel="noreferrer">
              {t("View in Academic Calendar ↗", "在 Academic Calendar 中查看 ↗")}
            </a>
            <a className="text-xs text-sky-700 hover:underline" href={UWFLOW_COURSE_URL + course.code.toLowerCase()} target="_blank" rel="noreferrer">
              {t("Reviews on UWFlow ↗", "在 UWFlow 看评价 ↗")}
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

export function CourseList({ evals, cz, offerings, plan, onTogglePlan, limit = 40, empty }: ListProps) {
  const t = useT();
  const [shown, setShown] = useState(limit);
  if (!evals.length) return <p className="px-3 py-6 text-center text-sm text-stone-400">{empty ?? t("No matching courses", "没有符合条件的课程")}</p>;
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
          {t(`Show ${Math.min(60, evals.length - shown)} more (${evals.length} total)`, `再显示 ${Math.min(60, evals.length - shown)} 门（共 ${evals.length} 门）`)}
        </button>
      )}
    </>
  );
}
