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

/** Short reasons for a failing/unknown result: the unmet leaves (or unmet "one of" groups). */
export function unmetReasons(r: EvalResult, max = 3): string[] {
  const out: string[] = [];
  const walk = (x: EvalResult) => {
    if (x.s === "ok" || out.length >= max) return;
    if (x.node.t === "all") x.kids?.forEach(walk);
    else if (x.node.t === "some") {
      const leaves = x.kids?.every((k) => !k.kids) ?? false;
      if (leaves && x.kids && x.kids.length <= 3) out.push(x.kids.map((k) => describeNode(k.node)).join(" 或 "));
      else out.push(describeNode(x.node) + "…");
    } else out.push(describeNode(x.node));
  };
  walk(r);
  return out;
}
