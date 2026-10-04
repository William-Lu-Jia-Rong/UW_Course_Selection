import { describeNode } from "./describe";
import { equivalents, type EvalResult, type Tri } from "./evaluate";
import type { Catalog, Course, ReqNode } from "./types";

/** A requirement annotated with whether the student meets it (`s` is undefined without a transcript). */
export type Req =
  | { k: "course"; code: string; s?: Tri; coreq: boolean; conc?: boolean; minGrade?: number }
  | { k: "group"; n: number | "all"; s?: Tri; coreq: boolean; kids: Req[] }
  | { k: "cond"; text: string; s?: Tri; coreq: boolean; note?: string };

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
      return { k: "cond", text: describeNode(node), s: r?.s, coreq, note: r?.note };
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
  | { k: "other"; text: string };

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
      return { k: "other", text: describeNode(node) };
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
