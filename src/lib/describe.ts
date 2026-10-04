import { formatCode } from "./codes";
import type { EvalResult } from "./evaluate";
import { translator, type Lang } from "./i18n";
import type { ReqNode } from "./types";

const list = (codes: string[]) => codes.map(formatCode).join(", ");

/** Text that precedes the course codes of a course-list rule. */
export function courseRulePrefix(node: Extract<ReqNode, { t: "courses" | "notCourses" }>, lang: Lang): string {
  const t = translator(lang);
  if (node.t === "notCourses") return node.conc ? t("Not taken and not taking concurrently:", "未修过且不同时修") : t("Not taken:", "未修过");
  const verb = node.conc ? t("Taken or taking concurrently", "已修或同时修") : t("Taken", "已修");
  const grade = node.minGrade !== undefined ? t(` (grade ≥ ${node.minGrade}%)`, `（成绩 ≥ ${node.minGrade}%）`) : "";
  if (node.n === "all" || node.n === node.courses.length) return t(`${verb}${grade}:`, `${verb}${grade}`);
  return t(`${verb} ${node.n} of${grade}:`, `${verb}以下 ${node.n} 门${grade}：`);
}

export function describeNode(node: ReqNode, lang: Lang): string {
  const t = translator(lang);
  switch (node.t) {
    case "all":
      return t("All of the following", "以下全部满足");
    case "some":
      return node.n === 1 ? t("One of the following", "以下满足其一") : t(`${node.n} of the following`, `以下满足其中 ${node.n} 项`);
    case "courses":
    case "notCourses":
      return `${courseRulePrefix(node, lang)} ${list(node.courses)}`;
    case "level":
      return node.exact ? t(`Level ${node.level}`, `年级为 ${node.level}`) : t(`Level ≥ ${node.level}`, `年级 ≥ ${node.level}`);
    case "program":
      return node.programs.length ? t(`Enrolled in ${node.programs.join(" / ")}`, `专业为 ${node.programs.join(" / ")}`) : node.generic ?? node.text;
    case "notProgram":
      return node.programs.length ? t(`Not open to ${node.programs.join(" / ")}`, `不对 ${node.programs.join(" / ")} 开放`) : node.text;
    case "avg":
      return t(`Cumulative average ≥ ${node.min}`, `累计均分 ≥ ${node.min}`);
    case "milestone":
      return t(`Milestone required: ${node.names.join(", ")}`, `需要 milestone：${node.names.join("、")}`);
    case "hs":
      return t(`${node.text} (high school requirement)`, `${node.text}（高中要求）`);
    case "text":
      return node.text;
  }
}

const MAX_REASON = 140;

/** One-line summary of what is still needed for an unmet (or unknown) result. */
function summarize(r: EvalResult, nested: boolean, lang: Lang): string {
  const t = translator(lang);
  const withNote = (s: string) => (r.note ? t(`${s} (${r.note.en})`, `${s}（${r.note.zh}）`) : s);
  if (!r.kids) return withNote(describeNode(r.node, lang));
  const unmet = r.kids.filter((k) => k.s !== "ok");
  const parts = r.node.t === "some" ? r.kids.map((k) => summarize(k, true, lang)) : unmet.map((k) => summarize(k, true, lang));
  const joined = parts.join(r.node.t === "some" ? t(" or ", " 或 ") : t(", and ", "，且 "));
  return nested && parts.length > 1 ? t(`(${joined})`, `（${joined}）`) : joined;
}

/** Short reasons for a failing/unknown result, one per unmet top-level requirement. */
export function unmetReasons(r: EvalResult, lang: Lang, max = 3): string[] {
  const top = r.node.t === "all" && r.kids ? r.kids.filter((k) => k.s !== "ok") : [r];
  return top.slice(0, max).map((k) => {
    const s = summarize(k, false, lang);
    return s.length > MAX_REASON ? s.slice(0, MAX_REASON) + "…" : s;
  });
}
