import { formatCode } from "../lib/codes";
import { unmetReasons } from "../lib/describe";
import type { CourseEval } from "../lib/evaluate";
import type { Offering } from "../lib/types";
import { AVAILABILITY, Badge, Button, Card } from "./ui";

interface Props {
  plan: string[];
  evals: Map<string, CourseEval>;
  offered: Map<string, Offering[]>;
  onRemove: (code: string) => void;
  onClear: () => void;
}

export function PlanPanel({ plan, evals, offered, onRemove, onClear }: Props) {
  const units = plan.reduce((s, c) => s + (evals.get(c)?.course.units ?? 0), 0);
  return (
    <Card
      title={`下学期计划（${units.toFixed(2)} units）`}
      actions={
        plan.length > 0 && (
          <Button variant="ghost" onClick={onClear}>
            清空
          </Button>
        )
      }
    >
      {plan.length === 0 ? (
        <p className="text-sm text-stone-500">在课程列表里点「+ 计划」把课加进来。计划里的课会被当作“同时修”，用来检查同修和反修冲突。</p>
      ) : (
        <ul className="space-y-2">
          {plan.map((code) => {
            const ev = evals.get(code);
            const meta = ev && AVAILABILITY[ev.availability];
            const problem =
              ev && ev.availability !== "eligible"
                ? unmetReasons((ev.availability === "antireq" ? ev.antireq : ev.availability === "needsCoreq" ? ev.coreq : ev.prereq)!, 2)
                : [];
            return (
              <li key={code} className="group text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold">{formatCode(code)}</span>
                  {meta && <Badge tone={meta.tone}>{meta.label}</Badge>}
                  {!offered.has(code) && <Badge tone="amber">不在开课列表</Badge>}
                  <button type="button" onClick={() => onRemove(code)} className="ml-auto text-stone-400 hover:text-rose-600" aria-label="移除">
                    ×
                  </button>
                </div>
                <div className="truncate text-xs text-stone-500">{ev?.course.title}</div>
                {problem.length > 0 && <div className="text-xs text-amber-700">{problem.join("；")}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
