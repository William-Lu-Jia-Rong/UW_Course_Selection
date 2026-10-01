import { formatCode } from "../lib/codes";
import { courseRulePrefix, describeNode } from "../lib/describe";
import type { EvalResult } from "../lib/evaluate";
import { cx } from "./ui";

const ICON = {
  ok: { char: "✓", cls: "text-emerald-600" },
  no: { char: "✗", cls: "text-rose-600" },
  unk: { char: "?", cls: "text-amber-600" },
};

/** For antirequisites "ok" means "no conflict", so the same icons apply. */
export function RequisiteTree({ result }: { result: EvalResult }) {
  const icon = ICON[result.s];
  const node = result.node;
  return (
    <div className="text-xs leading-relaxed">
      <div className="flex gap-1.5">
        <span className={cx("w-3 shrink-0 text-center font-bold", icon.cls)}>{icon.char}</span>
        <span className="text-stone-700">
          {(node.t === "courses" || node.t === "notCourses") && /\bTopic\b/.test(node.text) ? (
            node.text
          ) : node.t === "courses" || node.t === "notCourses" ? (
            <>
              {courseRulePrefix(node)}{" "}
              {node.courses.map((c, i) => (
                <span key={c}>
                  {i > 0 && ", "}
                  <span className={cx("font-mono", result.have?.includes(c) && (node.t === "notCourses" ? "font-semibold text-rose-600" : "font-semibold text-emerald-700"))}>
                    {formatCode(c)}
                  </span>
                </span>
              ))}
            </>
          ) : (
            describeNode(node)
          )}
          {result.note && <span className="ml-1 text-stone-400">（{result.note}）</span>}
        </span>
      </div>
      {result.kids && (
        <div className="ml-1.5 border-l border-stone-200 pl-3">
          {result.kids.map((k, i) => (
            <RequisiteTree key={i} result={k} />
          ))}
        </div>
      )}
    </div>
  );
}
