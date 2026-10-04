import { equivalents, type Availability, type CourseEval, type EvalResult, type Tri } from "./evaluate";
import type { Text } from "./i18n";
import type { Catalog, Course, ReqNode } from "./types";

/** A requirement annotated with whether the student meets it (`s` is undefined without a transcript). */
export type Req =
  | { k: "course"; code: string; s?: Tri; coreq: boolean; conc?: boolean; minGrade?: number }
  | { k: "group"; n: number | "all"; s?: Tri; coreq: boolean; kids: Req[] }
  | { k: "cond"; node: ReqNode; s?: Tri; coreq: boolean; note?: Text };

function reqGroup(n: number | "all", kids: Req[], s: Tri | undefined, coreq: boolean): Req | undefined {
  if (n !== "all" && n >= kids.length) n = "all";
  const flat = kids.flatMap((k) => (k.k === "group" && (n === "all" || n === 1) && k.n === n ? k.kids : [k]));
  if (!flat.length) return undefined;
  if (flat.length === 1 && (n === "all" || n === 1)) return flat[0];
  return { k: "group", n, s, coreq, kids: flat };
}

function toReq(node: ReqNode, r: EvalResult | undefined, coreq: boolean): Req | undefined {
  switch (node.t) {
    case "all":
    case "some": {
      const kids = node.c.flatMap((c, i) => toReq(c, r?.kids?.[i], coreq) ?? []);
      return reqGroup(node.t === "all" ? "all" : node.n, kids, r?.s, coreq);
    }
    case "courses": {
      if (node.courses.length === 1) return { k: "course", code: node.courses[0], s: r?.s, coreq, conc: node.conc, minGrade: node.minGrade };
      const kids: Req[] = node.courses.map((code) => ({ k: "course", code, s: r && (r.have?.includes(code) ? "ok" : "no"), coreq, conc: node.conc, minGrade: node.minGrade }));
      return reqGroup(node.n, kids, r?.s, coreq);
    }
    default:
      return { k: "cond", node, s: r?.s, coreq, note: r?.note };
  }
}

/** Top-level requirements of a course. Every entry must hold. */
export function requirements(course: Course, ev?: { prereq?: EvalResult; coreq?: EvalResult }): Req[] {
  const parts = [course.prereq && toReq(course.prereq, ev?.prereq, false), course.coreq && toReq(course.coreq, ev?.coreq, true)];
  return parts.flatMap((p) => (!p ? [] : p.k === "group" && p.n === "all" ? p.kids : [p]));
}

/** How a later course depends on an earlier one. */
export type Link = "required" | "coreq" | "option";

export type UpNode =
  | { k: "course"; code: string; conc?: boolean; minGrade?: number; coreq?: boolean; seen?: boolean; kids: UpNode[] }
  | { k: "group"; n: number | "all"; kids: UpNode[] }
  | { k: "other"; node: ReqNode };

export interface DownNode {
  code: string;
  link: Link;
  seen?: boolean;
  kids: DownNode[];
}

function group(n: number | "all", kids: (UpNode | undefined)[]): UpNode | undefined {
  const flat = kids.flatMap((k) => (!k ? [] : k.k === "group" && (n === "all" || n === 1) && k.n === n ? k.kids : [k]));
  if (!flat.length) return undefined;
  if (flat.length === 1 && (n === "all" || n === 1)) return flat[0];
  return { k: "group", n, kids: flat };
}

/** `coursesOnly` drops level/program conditions that must hold alongside courses, but keeps them as alternatives. */
function fromReq(node: ReqNode, coreq: boolean, coursesOnly: boolean): UpNode | undefined {
  switch (node.t) {
    case "all": {
      const kids = node.c.map((c) => fromReq(c, coreq, coursesOnly));
      return group("all", coursesOnly ? kids.filter((k) => k?.k !== "other") : kids);
    }
    case "some":
      return group(node.n, node.c.map((c) => fromReq(c, coreq, coursesOnly)));
    case "courses": {
      const kids: UpNode[] = node.courses.map((code) => ({ k: "course", code, conc: node.conc, minGrade: node.minGrade, coreq, kids: [] }));
      return group(node.n === "all" || node.n >= kids.length ? "all" : node.n, kids);
    }
    case "notCourses":
      return undefined;
    default:
      return { k: "other", node };
  }
}

/** The prerequisite and corequisite structure one step above a course. */
export function directUpstream(catalog: Catalog, code: string, coursesOnly = false): UpNode[] {
  const c = catalog.courses[code];
  if (!c) return [];
  const parts = [c.prereq && fromReq(c.prereq, false, coursesOnly), c.coreq && fromReq(c.coreq, true, coursesOnly)];
  return parts.flatMap((p) => (!p ? [] : p.k === "group" && p.n === "all" ? p.kids : [p])).filter((p) => !coursesOnly || p.k !== "other");
}

function courseNodes(nodes: UpNode[]): Extract<UpNode, { k: "course" }>[] {
  return nodes.flatMap((n) => (n.k === "course" ? [n] : n.k === "group" ? courseNodes(n.kids) : []));
}

/** Every course that leads to `code`, expanded recursively. Each course is expanded once, at its shallowest position. */
export function upstreamTree(catalog: Catalog, code: string): { roots: UpNode[]; courses: Set<string> } {
  const expanded = new Set(equivalents(catalog, code));
  const courses = new Set<string>();
  const roots = directUpstream(catalog, code);
  const queue = courseNodes(roots);
  while (queue.length) {
    const n = queue.shift()!;
    courses.add(n.code);
    if (expanded.has(n.code)) {
      n.seen = directUpstream(catalog, n.code, true).length > 0;
      continue;
    }
    for (const e of equivalents(catalog, n.code)) expanded.add(e);
    n.kids = directUpstream(catalog, n.code, true);
    queue.push(...courseNodes(n.kids));
  }
  return { roots, courses };
}

/** One path from the earliest unmet required course up toward a locked target. */
export interface RetracePath {
  /** Foundation → … → immediate unmet required prereq (excludes the target course). */
  chain: string[];
}

const AVAIL_RANK: Record<Availability, number> = {
  eligible: 0,
  needsCoreq: 1,
  check: 2,
  locked: 3,
  taken: 4,
  restricted: 5,
  antireq: 6,
};

function courseCodesInReq(r: Req): string[] {
  if (r.k === "course") return r.coreq ? [] : [r.code];
  if (r.k === "group") return r.kids.flatMap(courseCodesInReq);
  return [];
}

/** Prefer courses the student can take soon, then program-local ones, then anything else open. */
function pickRequiredOption(codes: string[], evalOf: (code: string) => CourseEval | undefined, prefer?: (code: string) => boolean): string | undefined {
  const open = codes.filter((c) => {
    const a = evalOf(c)?.availability;
    return a !== undefined && a !== "taken" && a !== "antireq" && a !== "restricted";
  });
  const pool = open.length ? open : codes.filter((c) => evalOf(c)?.availability !== "taken");
  return [...pool].sort((a, b) => {
    const sa = AVAIL_RANK[evalOf(a)?.availability ?? "locked"];
    const sb = AVAIL_RANK[evalOf(b)?.availability ?? "locked"];
    if (sa !== sb) return sa - sb;
    const pa = prefer?.(a) ? 0 : 1;
    const pb = prefer?.(b) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return a.localeCompare(b, "en", { numeric: true });
  })[0];
}

/** Unmet non-coreq course prerequisites still blocking this course, one representative per option group. */
function nextRequiredCourses(reqs: Req[], evalOf: (code: string) => CourseEval | undefined, prefer?: (code: string) => boolean): string[] {
  const out: string[] = [];
  for (const r of reqs) {
    if (r.s === "ok" || r.coreq) continue;
    if (r.k === "course") {
      if (evalOf(r.code)?.availability !== "taken") out.push(r.code);
      continue;
    }
    if (r.k === "cond") continue;
    if (r.n === "all") {
      out.push(...nextRequiredCourses(r.kids, evalOf, prefer));
      continue;
    }
    const options = courseCodesInReq(r);
    if (!options.length) {
      out.push(...nextRequiredCourses(r.kids.filter((k) => k.s !== "ok"), evalOf, prefer));
      continue;
    }
    const pick = pickRequiredOption(options, evalOf, prefer);
    if (pick) out.push(pick);
  }
  return [...new Set(out)];
}

/**
 * For a course the student can't take yet, walk unmet required prerequisites back to the
 * most foundational course(s) they still need — the top of each required chain.
 * Option groups (`n of k`) collapse to one preferred path. Pure level/program blockers yield [].
 */
export function retraceRequired(
  catalog: Catalog,
  code: string,
  evalOf: (code: string) => CourseEval | undefined,
  prefer?: (code: string) => boolean,
): RetracePath[] {
  const root = code;
  const walk = (current: string, trail: string[]): RetracePath[] => {
    if (trail.includes(current)) return [];
    const course = catalog.courses[current];
    const ev = evalOf(current);
    if (!course || ev?.availability === "taken") return [];

    const next = nextRequiredCourses(requirements(course, ev), evalOf, prefer);
    if (!next.length) return current === root ? [] : [{ chain: [current] }];

    const paths: RetracePath[] = [];
    for (const pre of next) {
      const sub = walk(pre, [...trail, current]);
      if (!sub.length) {
        if (pre !== root) paths.push({ chain: current === root ? [pre] : [pre, current] });
        continue;
      }
      for (const p of sub) {
        paths.push({ chain: current === root ? p.chain : [...p.chain, current] });
      }
    }
    return paths;
  };

  const paths = walk(root, []);
  const best = new Map<string, RetracePath>();
  for (const p of paths) {
    const start = p.chain[0];
    if (!start) continue;
    const prev = best.get(start);
    if (!prev || p.chain.length > prev.chain.length) best.set(start, p);
  }
  return [...best.values()].sort((a, b) => b.chain.length - a.chain.length || a.chain[0].localeCompare(b.chain[0], "en", { numeric: true }));
}

export const STRENGTH: Record<Link, number> = { required: 3, coreq: 2, option: 1 };

/** Courses named in a course's prerequisites or corequisites, each with its strongest link. */
export function directLinks(course: Course): { code: string; link: Link }[] {
  const m = new Map<string, Link>();
  const add = (pre: string, link: Link) => {
    if (pre === course.code) return;
    const prev = m.get(pre);
    if (!prev || STRENGTH[link] > STRENGTH[prev]) m.set(pre, link);
  };
  const walk = (node: ReqNode, required: boolean, coreq: boolean) => {
    if (node.t === "all") node.c.forEach((c) => walk(c, required, coreq));
    else if (node.t === "some") node.c.forEach((c) => walk(c, required && node.n >= node.c.length, coreq));
    else if (node.t === "courses") {
      const req = required && (node.n === "all" || node.n >= node.courses.length);
      for (const pre of node.courses) add(pre, coreq ? "coreq" : req ? "required" : "option");
    }
  };
  if (course.prereq) walk(course.prereq, true, false);
  if (course.coreq) walk(course.coreq, true, true);
  return [...m].map(([code, link]) => ({ code, link }));
}

/** prerequisite code -> courses whose prerequisites or corequisites mention it. */
export function dependentsIndex(catalog: Catalog): Map<string, { code: string; link: Link }[]> {
  const out = new Map<string, { code: string; link: Link }[]>();
  for (const c of Object.values(catalog.courses)) {
    for (const { code: pre, link } of directLinks(c)) {
      let list = out.get(pre);
      if (!list) out.set(pre, (list = []));
      list.push({ code: c.code, link });
    }
  }
  return out;
}

export type DependentsIndex = ReturnType<typeof dependentsIndex>;

function directDownstream(catalog: Catalog, idx: DependentsIndex, code: string): { code: string; link: Link }[] {
  const self = new Set(equivalents(catalog, code));
  const best = new Map<string, Link>();
  for (const e of self) {
    for (const d of idx.get(e) ?? []) {
      if (self.has(d.code) || !catalog.courses[d.code]) continue;
      const prev = best.get(d.code);
      if (!prev || STRENGTH[d.link] > STRENGTH[prev]) best.set(d.code, d.link);
    }
  }
  return [...best]
    .map(([code, link]) => ({ code, link }))
    .sort((a, b) => STRENGTH[b.link] - STRENGTH[a.link] || a.code.localeCompare(b.code, "en", { numeric: true }));
}

/**
 * Every course that `code` leads to, breadth-first so each course sits at its shortest distance.
 * Courses rejected by `include` are hidden along with whatever is only reachable through them.
 */
export function downstreamTree(
  catalog: Catalog,
  idx: DependentsIndex,
  code: string,
  include: (code: string) => boolean = () => true,
): { roots: DownNode[]; courses: Set<string>; hidden: Set<string> } {
  const expanded = new Set(equivalents(catalog, code));
  const courses = new Set<string>();
  const hidden = new Set<string>();
  const children = (c: string): DownNode[] =>
    directDownstream(catalog, idx, c).flatMap((d) => {
      if (include(d.code)) return [{ ...d, kids: [] }];
      hidden.add(d.code);
      return [];
    });
  const roots = children(code);
  const queue = [...roots];
  while (queue.length) {
    const n = queue.shift()!;
    courses.add(n.code);
    if (expanded.has(n.code)) {
      n.seen = directDownstream(catalog, idx, n.code).length > 0;
      continue;
    }
    for (const e of equivalents(catalog, n.code)) expanded.add(e);
    n.kids = children(n.code);
    queue.push(...n.kids);
  }
  for (const c of courses) hidden.delete(c);
  return { roots, courses, hidden };
}
