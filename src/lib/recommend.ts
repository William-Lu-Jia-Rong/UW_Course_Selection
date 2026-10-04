import { careerMatch, type Career } from "./careers";
import { levelIndex } from "./codes";
import type { Availability, CourseEval } from "./evaluate";
import type { Categorizer, Category, DegreeProgress } from "./requirements";
import type { Catalog } from "./types";

export interface Candidate {
  code: string;
  availability: Availability;
  offered: boolean;
  score: number;
  why: string[];
}

export interface Suggestion {
  kind: "required" | "choose" | "elective";
  /** What the term-by-term plan asks for. */
  slot: string;
  /** The graduation requirement the pick counts towards. */
  fills?: string;
  pick?: Candidate;
  alternatives: Candidate[];
  problem?: string;
  note?: string;
}

export interface Recommendation {
  term: string;
  suggestions: Suggestion[];
  /** Core courses of the chosen directions that aren't offered or can't be taken yet. */
  later: Candidate[];
}

const TE_ANY: Category[] = ["te1", "te2", "te3", "te4", "te5"];
const APPROVED: Category[] = [...TE_ANY, "natsci", "ethics", "cseA", "cseC", "cseD"];
const TAKEABLE: Availability[] = ["eligible", "needsCoreq", "check"];
const AVAIL_RANK: Partial<Record<Availability, number>> = { eligible: 0, needsCoreq: 1, check: 2 };
const MAX_ALTERNATIVES = 5;
/** Below this the pick only matched a stray keyword or subject. */
const WEAK_MATCH = 3;

function termSlotAccepts(label: string): Category[] {
  if (/List 1 or List 2/i.test(label)) return ["te1", "te2"];
  if (/List 1/i.test(label)) return ["te1"];
  if (/technical/i.test(label)) return TE_ANY;
  return APPROVED;
}

interface DegreeSlot {
  label: string;
  accepts: Category[];
  open: boolean;
  reserved?: boolean;
}

function degreeSlots(progress: DegreeProgress): DegreeSlot[] {
  const group = (prefix: string, slots: DegreeProgress["te"]) =>
    slots.filter((s) => s.status === "missing").map((s) => ({ label: `${prefix}${s.label}`, accepts: s.accepts, open: true }));
  return [...group("TE ", progress.te), ...group("", progress.natsci), ...group("", progress.ethics), ...group("CSE ", progress.cse)];
}

const overlaps = (a: Category[], b: Category[]) => a.some((x) => b.includes(x));

/** The open degree slot a course would use, preferring the most restrictive so flexible slots stay free. */
function slotFor(slots: DegreeSlot[], cats: Category[], termAccepts: Category[], allowReserved: boolean): DegreeSlot | undefined {
  const usable = cats.filter((c) => termAccepts.includes(c));
  return slots
    .filter((s) => s.open && (allowReserved || !s.reserved) && overlaps(s.accepts, usable))
    .sort((a, b) => a.accepts.length - b.accepts.length)[0];
}

export interface RecommendInput {
  catalog: Catalog;
  cz: Categorizer;
  evals: CourseEval[];
  offered: Set<string>;
  progress: DegreeProgress;
  level: string;
  careers: Career[];
}

export function recommend({ catalog, cz, evals, offered, progress, level, careers }: RecommendInput): Recommendation {
  const evalOf = new Map(evals.map((e) => [e.course.code, e]));
  const cats = (code: string) => cz.categories.get(code) ?? [];
  const candidate = (code: string): Candidate => {
    const course = catalog.courses[code];
    const m = course ? careerMatch(course, careers, course.cross) : { score: 0, why: [] };
    return { code, availability: evalOf.get(code)?.availability ?? "locked", offered: offered.has(code), ...m };
  };
  const rank = (a: Candidate, b: Candidate) =>
    b.score - a.score || (AVAIL_RANK[a.availability] ?? 9) - (AVAIL_RANK[b.availability] ?? 9) || a.code.localeCompare(b.code, "en", { numeric: true });
  const ready = (c: Candidate) => c.offered && TAKEABLE.includes(c.availability);

  const suggestions: Suggestion[] = [];
  const used = new Set<string>();
  const term = catalog.program.termByTerm.find((t) => t.term === level);

  for (const item of term?.items ?? []) {
    if (item.kind === "required") {
      for (const code of item.courses) {
        const c = candidate(code);
        if (c.availability === "taken") continue;
        used.add(code);
        const problem = !c.offered ? "下学期开课列表里没有这门课" : !TAKEABLE.includes(c.availability) ? "按日历条件现在还不能选，请检查先修" : undefined;
        suggestions.push({ kind: "required", slot: `${level} 必修`, pick: c, alternatives: [], problem });
      }
    } else if (item.kind === "choose") {
      const options = item.courses.map(candidate);
      if (options.some((o) => o.availability === "taken")) continue;
      // Keep the calendar's order (e.g. ECE 498A before GENE 403) unless the first option can't be taken.
      options.sort((a, b) => Number(ready(b)) - Number(ready(a)));
      used.add(options[0].code);
      suggestions.push({
        kind: "choose",
        slot: `${level} 必修（${item.n} 选 1）`,
        pick: options[0],
        alternatives: options.slice(1),
        problem: ready(options[0]) ? undefined : "这几门下学期都没开或现在还不能选",
      });
    }
  }

  const slots = degreeSlots(progress);
  // Later terms that ask specifically for List 1 / List 2 need those requirements left open.
  for (const t of catalog.program.termByTerm) {
    if (levelIndex(t.term) <= levelIndex(level)) continue;
    for (const item of t.items) {
      if (item.kind !== "elective") continue;
      const accepts = termSlotAccepts(item.label);
      if (accepts === APPROVED) continue;
      for (let i = 0; i < item.n; i++) {
        const s = slots.filter((d) => d.open && !d.reserved && overlaps(d.accepts, accepts)).sort((a, b) => a.accepts.length - b.accepts.length)[0];
        if (s) s.reserved = true;
      }
    }
  }

  const pool = evals
    .filter((e) => offered.has(e.course.code) && TAKEABLE.includes(e.availability) && e.course.units >= 0.5 && !used.has(e.course.code))
    .filter((e) => overlaps(cats(e.course.code), APPROVED))
    .map((e) => candidate(e.course.code))
    .sort(rank);

  const termSlots = (term?.items ?? [])
    .flatMap((item) => (item.kind === "elective" ? Array.from({ length: item.n }, () => ({ label: item.label, accepts: termSlotAccepts(item.label) })) : []))
    .sort((a, b) => a.accepts.length - b.accepts.length);

  for (const ts of termSlots) {
    const restrictive = ts.accepts !== APPROVED;
    const valid = pool.filter((c) => !used.has(c.code) && slotFor(slots, cats(c.code), ts.accepts, restrictive));
    const pick = valid[0];
    if (!pick) {
      suggestions.push({ kind: "elective", slot: ts.label, alternatives: [], problem: "下学期开的课里没有能填这个名额、你又能选的课" });
      continue;
    }
    used.add(pick.code);
    const pickCats = cats(pick.code);
    const ds = slotFor(slots, pickCats, ts.accepts, restrictive)!;
    ds.open = false;
    let fills = ds.label;
    // An Ethics course also counts as a complementary studies elective.
    if (ds.label.startsWith("Ethics")) {
      const cse = slotFor(slots, pickCats, ["cseA", "cseC", "cseD"], false);
      if (cse) {
        cse.open = false;
        fills += ` + ${cse.label}`;
      }
    }
    const note = careers.length && pick.score < WEAK_MATCH ? `这学期没有和所选方向直接相关、你又能选的课，先用这个名额完成 ${fills}` : undefined;
    suggestions.push({ kind: "elective", slot: ts.label, fills, pick, alternatives: valid.slice(1, 1 + MAX_ALTERNATIVES), note });
  }

  const coreCodes = new Set(careers.flatMap((c) => c.core));
  const later = [...coreCodes]
    .filter((code) => catalog.courses[code] && !used.has(code))
    .map(candidate)
    .filter((c) => c.availability !== "taken" && !ready(c))
    .sort(rank);

  return { term: level, suggestions, later };
}