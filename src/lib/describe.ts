import { formatCode } from "./codes";
import type { EvalResult } from "./evaluate";
import type { ReqNode } from "./types";

const list = (codes: string[]) => codes.map(formatCode).join(", ");

/** Text that precedes the course codes of a course-list rule. */
export function courseRulePrefix(node: Extract<ReqNode, { t: "courses" | "notCourses" }>): string {
  if (node.t === "notCourses") return node.conc ? "未修过且不同时修" : "未修过";
  const verb = node.conc ? "已修或同时修" : "已修";
  const grade = node.minGrade !== undefined ? `（成绩 ≥ ${node.minGrade}%）` : "";
  if (node.n === "all" || node.n === node.courses.length) return `${verb}${grade}`;
  return `${verb}以下 ${node.n} 门${grade}：`;
}

export function describeNode(node: ReqNode): string {
  switch (node.t) {
    case "all":
      return "以下全部满足";
    case "some":
      return node.n === 1 ? "以下满足其一" : `以下满足其中 ${node.n} 项`;
    case "courses":
    case "notCourses":
      return `${courseRulePrefix(node)} ${list(node.courses)}`;
    case "level":
      return node.exact ? `年级为 ${node.level}` : `年级 ≥ ${node.level}`;
    case "program":
      return node.programs.length ? `专业为 ${node.programs.join(" / ")}` : node.generic ?? node.text;
    case "notProgram":
      return node.programs.length ? `不对 ${node.programs.join(" / ")} 开放` : node.text;
    case "avg":
      return `累计均分 ≥ ${node.min}`;
    case "milestone":
      return `需要 milestone：${node.names.join("、")}`;
    case "hs":
      return `${node.text}（高中要求）`;
    case "text":
      return node.text;
  }
}

const MAX_REASON = 140;

/** One-line summary of what is still needed for an unmet (or unknown) result. */
function summarize(r: EvalResult, nested: boolean): string {
  const withNote = (s: string) => (r.note ? `${s}（${r.note}）` : s);
  if (!r.kids) return withNote(describeNode(r.node));
  const unmet = r.kids.filter((k) => k.s !== "ok");
  const parts = r.node.t === "some" ? r.kids.map((k) => summarize(k, true)) : unmet.map((k) => summarize(k, true));
  const joined = parts.join(r.node.t === "some" ? " 或 " : "，且 ");
  return nested && parts.length > 1 ? `（${joined}）` : joined;
}

/** Short reasons for a failing/unknown result, one per unmet top-level requirement. */
export function unmetReasons(r: EvalResult, max = 3): string[] {
  const top = r.node.t === "all" && r.kids ? r.kids.filter((k) => k.s !== "ok") : [r];
  return top.slice(0, max).map((k) => {
    const s = summarize(k, false);
    return s.length > MAX_REASON ? s.slice(0, MAX_REASON) + "…" : s;
  });
}
