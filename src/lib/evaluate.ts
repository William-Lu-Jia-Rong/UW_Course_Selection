import { levelIndex } from "./codes";
import type { OfferingIssue } from "./offerings";
import type { Catalog, Course, ReqNode, Transcript, TranscriptCourse } from "./types";
import { numericGrade } from "./transcript";

export type Tri = "ok" | "no" | "unk";

export interface EvalResult {
  s: Tri;
  node: ReqNode;
  kids?: EvalResult[];
  /** Courses in a course rule that are satisfied. */
  have?: string[];
  note?: string;
}

export interface StudentContext {
  /** Every course that counts as taken (code -> transcript row), including cross-listed equivalents. */
  taken: Map<string, TranscriptCourse>;
  /** Courses planned for the target term (count for corequisites / "concurrently enrolled"). */
  concurrent: Set<string>;
  level: string;
  programs: string[];
  cumulativeAvg?: number;
  milestones: string;
}

const STUDENT_FACULTY_RE = /Engineering|BASc|Applied Science|co-operative|\ban Honours (program|plan)\b/i;

export interface ContextOptions {
  includeInProgress: boolean;
  level: string;
  programs: string[];
  concurrent?: Iterable<string>;
}

export function buildContext(catalog: Catalog, transcript: Transcript, opts: ContextOptions): StudentContext {
  const taken = new Map<string, TranscriptCourse>();
  for (const c of transcript.courses) {
    if (c.status === "completed" || (opts.includeInProgress && c.status === "inProgress")) {
      for (const code of equivalents(catalog, c.code)) {
        const prev = taken.get(code);
        if (!prev || (numericGrade(c) ?? 0) > (numericGrade(prev) ?? 0)) taken.set(code, c);
      }
    }
  }
  const concurrent = new Set<string>();
  for (const code of opts.concurrent ?? []) for (const e of equivalents(catalog, code)) concurrent.add(e);
  return {
    taken,
    concurrent,
    level: opts.level,
    programs: opts.programs,
    cumulativeAvg: transcript.cumulativeAvg,
    milestones: transcript.milestones,
  };
}

export function equivalents(catalog: Catalog, code: string): string[] {
  return [code, ...(catalog.courses[code]?.cross ?? [])];
}

function programMatches(node: { programs: string[]; generic?: string }, ctx: StudentContext): boolean {
  if (node.programs.length) {
    const mine = ctx.programs.map((p) => p.toLowerCase());
    return node.programs.some((p) => mine.includes(p.toLowerCase()));
  }
  return STUDENT_FACULTY_RE.test(node.generic ?? "");
}

function combine(kids: EvalResult[], need: number): Tri {
  const ok = kids.filter((k) => k.s === "ok").length;
  const unk = kids.filter((k) => k.s === "unk").length;
  if (ok >= need) return "ok";
  if (ok + unk >= need) return "unk";
  return "no";
}

export function evaluate(node: ReqNode, ctx: StudentContext): EvalResult {
  switch (node.t) {
    case "all": {
      const kids = node.c.map((c) => evaluate(c, ctx));
      return { s: combine(kids, kids.length), node, kids };
    }
    case "some": {
      const kids = node.c.map((c) => evaluate(c, ctx));
      return { s: combine(kids, node.n), node, kids };
    }
    case "courses": {
      const need = node.n === "all" ? node.courses.length : node.n;
      const have: string[] = [];
      let pendingGrade = 0;
      for (const code of node.courses) {
        const row = ctx.taken.get(code);
        if (row) {
          if (node.minGrade !== undefined) {
            const g = numericGrade(row);
            if (g === undefined) pendingGrade++;
            else if (g >= node.minGrade) have.push(code);
          } else have.push(code);
        } else if (node.conc && ctx.concurrent.has(code)) have.push(code);
      }
      const s: Tri = have.length >= need ? "ok" : have.length + pendingGrade >= need ? "unk" : "no";
      return { s, node, have, note: s === "unk" ? "成绩尚未出来" : undefined };
    }
    case "level": {
      const mine = levelIndex(ctx.level);
      const req = levelIndex(node.level);
      if (mine < req) return { s: "no", node };
      // Many "level 4A" rules omit "or higher" even though later terms are allowed in practice.
      if (node.exact && mine > req) return { s: "unk", node, note: `日历写的是恰好 ${node.level}，请确认高年级能否选` };
      return { s: "ok", node };
    }
    case "program":
      return { s: programMatches(node, ctx) ? "ok" : "no", node };
    case "notProgram":
      if (!node.programs.length && !/program|plan|Faculty/i.test(node.generic ?? "")) return { s: "unk", node };
      return { s: programMatches(node, ctx) ? "no" : "ok", node };
    case "notCourses": {
      const hit = node.courses.filter((c) => ctx.taken.has(c) || (node.conc && ctx.concurrent.has(c)));
      if (!hit.length) return { s: "ok", node };
      // Topic-specific antirequisites (e.g. one ECE 493 topic) can't be matched from course codes alone.
      if (/\bTopic\b/i.test(node.text)) return { s: "unk", node, have: hit, note: "只限特定 Topic，请核对" };
      return { s: "no", node, have: hit };
    }
    case "avg":
      if (ctx.cumulativeAvg === undefined) return { s: "unk", node };
      return { s: ctx.cumulativeAvg >= node.min ? "ok" : "no", node };
    case "milestone": {
      const text = ctx.milestones.toLowerCase();
      const ok = node.names.every((n) => text.includes(n.toLowerCase()));
      return { s: ok ? "ok" : "unk", node };
    }
    case "hs":
      return { s: "ok", node, note: "高中课程要求，默认已满足" };
    case "text":
      return { s: "unk", node };
  }
}

export type Availability = "taken" | "eligible" | "needsCoreq" | "check" | "restricted" | "locked" | "antireq";

export interface CourseEval {
  course: Course;
  availability: Availability;
  prereq?: EvalResult;
  coreq?: EvalResult;
  antireq?: EvalResult;
  offeringIssue?: OfferingIssue;
}

/** Downgrades an otherwise-available course when its schedule notes restrict enrolment. */
export function applyOfferingIssue(ev: CourseEval, issue: OfferingIssue | undefined): CourseEval {
  if (!issue || !["eligible", "needsCoreq", "check"].includes(ev.availability)) return issue ? { ...ev, offeringIssue: issue } : ev;
  return { ...ev, offeringIssue: issue, availability: issue.kind === "restricted" ? "restricted" : "check" };
}

export function evaluateCourse(course: Course, ctx: StudentContext): CourseEval {
  const prereq = course.prereq && evaluate(course.prereq, ctx);
  const coreq = course.coreq && evaluate(course.coreq, ctx);
  const antireq = course.antireq && evaluate(course.antireq, ctx);
  let availability: Availability;
  if (ctx.taken.has(course.code) && !course.repeatable) availability = "taken";
  else if (antireq?.s === "no") availability = "antireq";
  else if (prereq?.s === "no") availability = "locked";
  else if (prereq?.s === "unk") availability = "check";
  else if (coreq && coreq.s !== "ok") availability = "needsCoreq";
  else availability = "eligible";
  return { course, availability, prereq, coreq, antireq };
}
