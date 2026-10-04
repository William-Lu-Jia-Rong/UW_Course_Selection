import { formatCode } from "../lib/codes";
import { unmetReasons } from "../lib/describe";
import type { CourseEval } from "../lib/evaluate";
import { useLang, useT } from "../lib/i18n";
import type { Offering } from "../lib/types";
import { FlowRating } from "./FlowRating";
import { AVAILABILITY, Badge, Button, Card } from "./ui";

interface Props {
  plan: string[];
  evals: Map<string, CourseEval>;
  offered: Map<string, Offering[]>;
  onRemove: (code: string) => void;
  onClear: () => void;
}

export function PlanPanel({ plan, evals, offered, onRemove, onClear }: Props) {
  const t = useT();
  const lang = useLang();
  const units = plan.reduce((s, c) => s + (evals.get(c)?.course.units ?? 0), 0);
  return (
    <Card
      title={t(`Next term plan (${units.toFixed(2)} units)`, `下学期计划（${units.toFixed(2)} units）`)}
      actions={
        plan.length > 0 && (
          <Button variant="ghost" onClick={onClear}>
            {t("Clear", "清空")}
          </Button>
        )
      }
    >
      {plan.length === 0 ? (
        <p className="text-sm text-stone-500">
          {t(
            'Click "+ Plan" in a course list to add courses here. Planned courses count as "taken concurrently" when checking corequisites and antirequisite conflicts.',
            "在课程列表里点「+ 计划」把课加进来。计划里的课会被当作“同时修”，用来检查同修和反修冲突。",
          )}
        </p>
      ) : (
        <ul className="space-y-2">
          {plan.map((code) => {
            const ev = evals.get(code);
            const meta = ev && AVAILABILITY[ev.availability];
            const rule = ev && (ev.availability === "antireq" ? ev.antireq : ev.availability === "needsCoreq" ? ev.coreq : ev.prereq);
            const problem =
              !ev || ev.availability === "eligible"
                ? []
                : ev.offeringIssue && (ev.availability === "restricted" || (ev.availability === "check" && ev.prereq?.s !== "unk"))
                  ? [t(`Schedule note: ${ev.offeringIssue.note}`, `开课备注：${ev.offeringIssue.note}`)]
                  : rule
                    ? unmetReasons(rule, lang, 2)
                    : [];
            return (
              <li key={code} className="group text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold">{formatCode(code)}</span>
                  {meta && <Badge tone={meta.tone}>{t(meta.label)}</Badge>}
                  {!offered.has(code) && <Badge tone="amber">{t("Not on offering list", "不在开课列表")}</Badge>}
                  <FlowRating code={code} compact />
                  <button type="button" onClick={() => onRemove(code)} className="ml-auto text-stone-400 hover:text-rose-600" aria-label={t("Remove", "移除")}>
                    ×
                  </button>
                </div>
                <div className="truncate text-xs text-stone-500">{ev?.course.title}</div>
                {problem.length > 0 && <div className="text-xs text-amber-700">{problem.join(t("; ", "；"))}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
