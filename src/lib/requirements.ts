import type { Catalog, ListKey, Transcript } from "./types";
import { equivalents } from "./evaluate";

export type Category = "required" | "te1" | "te2" | "te3" | "te4" | "te5" | "natsci" | "ethics" | "cseA" | "cseB" | "cseC" | "cseD";

export const CATEGORY_LABEL: Record<Category, string> = {
  required: "必修",
  te1: "TE List 1",
  te2: "TE List 2",
  te3: "TE List 3",
  te4: "TE List 4",
  te5: "TE List 5",
  natsci: "Natural Science",
  ethics: "Ethics",
  cseA: "CSE List A",
  cseB: "CSE List B",
  cseC: "CSE List C",
  cseD: "CSE List D",
};

export const CATEGORY_GROUPS: { label: string; cats: Category[] }[] = [
  { label: "必修课", cats: ["required"] },
  { label: "技术选修 (TE)", cats: ["te1", "te2", "te3", "te4", "te5"] },
  { label: "自然科学 (NS)", cats: ["natsci"] },
  { label: "伦理 (Ethics)", cats: ["ethics"] },
  { label: "通识选修 (CSE)", cats: ["cseA", "cseC", "cseD"] },
];

/** Communication-requirement courses can't double as List C CSEs for this major. */
const COMM_REQUIREMENT = ["COMMST192", "ENGL192"];

export type MembershipReason = "listed" | "crossListed" | "subject";

export interface Categorizer {
  categories: Map<string, Category[]>;
  requiredTerm: Map<string, string>;
  /** Why a course is in a list, keyed by `${code}:${category}`. */
  reasons: Map<string, MembershipReason>;
}

export function buildCategorizer(catalog: Catalog): Categorizer {
  const { program, courses } = catalog;
  const categories = new Map<string, Category[]>();
  const reasons = new Map<string, MembershipReason>();
  const add = (code: string, cat: Category, reason: MembershipReason = "listed") => {
    const list = categories.get(code) ?? [];
    if (!list.includes(cat)) list.push(cat);
    categories.set(code, list);
    if (!reasons.has(`${code}:${cat}`)) reasons.set(`${code}:${cat}`, reason);
  };
  const twins = (code: string) => courses[code]?.cross ?? [];
  const requiredTerm = new Map<string, string>();
  for (const t of program.termByTerm) {
    for (const item of t.items) {
      if (item.kind === "elective") continue;
      for (const code of item.courses) {
        add(code, "required");
        requiredTerm.set(code, t.term);
      }
    }
  }
  const listCats: [ListKey, Category][] = [
    ["te1", "te1"],
    ["te2", "te2"],
    ["te3", "te3"],
    ["te4", "te4"],
    ["te5", "te5"],
    ["natsci", "natsci"],
    ["ethics", "ethics"],
    ["cseA", "cseA"],
    ["cseB", "cseB"],
    ["cseC", "cseC"],
    ["cseD", "cseD"],
  ];
  for (const [key, cat] of listCats) for (const code of program.lists[key]) add(code, cat);
  // A cross-listed course is the same course under another subject code.
  for (const [key, cat] of listCats) for (const code of program.lists[key]) for (const twin of twins(code)) add(twin, cat, "crossListed");

  const excludedFromC = new Set([...program.lists.cseExclusions, ...program.lists.cseD, ...COMM_REQUIREMENT]);
  const isExcludedFromC = (code: string) => excludedFromC.has(code) || twins(code).some((t) => excludedFromC.has(t));
  const cSubjects = new Set(program.cseSubjects.C);
  const dSubjects = new Set(program.cseSubjects.D);
  for (const c of Object.values(courses)) {
    if (c.units < 0.5) continue;
    if (cSubjects.has(c.subject) && !isExcludedFromC(c.code)) add(c.code, "cseC", "subject");
    if (dSubjects.has(c.subject)) add(c.code, "cseD", "subject");
  }
  return { categories, requiredTerm, reasons };
}

// ---------- progress ----------

export type ProgressStatus = "completed" | "inProgress" | "missing";

export interface SlotFill {
  label: string;
  code?: string;
  status: ProgressStatus;
}

export interface TermProgress {
  term: string;
  rows: { label: string; need: number; courses: { code: string; status: ProgressStatus }[]; done: boolean; optional?: boolean }[];
  electives: string[];
}

export interface CountedRequirement {
  done: string[];
  inProgress: string[];
  need: number;
}

export interface DegreeProgress {
  terms: TermProgress[];
  te: SlotFill[];
  natsci: SlotFill[];
  ethics: SlotFill[];
  cse: SlotFill[];
  pd: CountedRequirement;
  workTerms: CountedRequirement;
  unitsEarned: number;
}

interface Slot {
  label: string;
  accepts: Category[];
}

const TE_SLOTS: Slot[] = [
  { label: "List 1", accepts: ["te1"] },
  { label: "List 1", accepts: ["te1"] },
  { label: "List 1 或 List 2", accepts: ["te1", "te2"] },
  { label: "List 3", accepts: ["te3"] },
  { label: "List 3", accepts: ["te3"] },
  { label: "List 3", accepts: ["te3"] },
  { label: "List 4", accepts: ["te4"] },
  { label: "List 5 或 List 1–4 任意", accepts: ["te1", "te2", "te3", "te4", "te5"] },
];
const NATSCI_SLOTS: Slot[] = [
  { label: "Natural Science", accepts: ["natsci"] },
  { label: "Natural Science", accepts: ["natsci"] },
];
const ETHICS_SLOTS: Slot[] = [{ label: "Ethics List", accepts: ["ethics"] }];
const CSE_SLOTS: Slot[] = [
  { label: "List C", accepts: ["cseC"] },
  { label: "List C", accepts: ["cseC"] },
  { label: "List A / C / D", accepts: ["cseA", "cseC", "cseD"] },
];

/** Maximum bipartite matching of courses into slots (augmenting paths; inputs are tiny). */
function matchSlots(slots: Slot[], candidates: string[], cats: (code: string) => Category[]): (string | undefined)[] {
  const slotOf = new Map<string, number>();
  const owner: (string | undefined)[] = slots.map(() => undefined);
  const tryAssign = (code: string, seen: Set<number>): boolean => {
    const mine = cats(code);
    for (let i = 0; i < slots.length; i++) {
      if (seen.has(i) || !slots[i].accepts.some((a) => mine.includes(a))) continue;
      seen.add(i);
      const cur = owner[i];
      if (cur === undefined || tryAssign(cur, seen)) {
        owner[i] = code;
        slotOf.set(code, i);
        return true;
      }
    }
    return false;
  };
  for (const code of candidates) tryAssign(code, new Set());
  return owner;
}

export function computeProgress(catalog: Catalog, transcript: Transcript, cz: Categorizer): DegreeProgress {
  const status = new Map<string, ProgressStatus>();
  const order: string[] = [];
  for (const c of transcript.courses) {
    if (c.status !== "completed" && c.status !== "inProgress") continue;
    for (const code of equivalents(catalog, c.code)) {
      if (status.get(code) === "completed") continue;
      status.set(code, c.status);
    }
    order.push(c.code);
  }
  const st = (code: string): ProgressStatus => status.get(code) ?? "missing";
  const usedForRequired = new Set<string>();

  const terms: TermProgress[] = catalog.program.termByTerm.map((t) => {
    const rows: TermProgress["rows"] = [];
    const electives: string[] = [];
    for (const item of t.items) {
      if (item.kind === "elective") {
        electives.push(`${item.n} × ${item.label}`);
        continue;
      }
      const courses = item.courses.map((code) => ({ code, status: st(code) }));
      if (item.kind === "required") {
        for (const c of courses) {
          const units = catalog.courses[c.code]?.units ?? 0.5;
          rows.push({ label: c.code, need: 1, courses: [c], done: c.status !== "missing", optional: units === 0 });
          if (c.status !== "missing") usedForRequired.add(c.code);
        }
      } else {
        const got = courses.filter((c) => c.status !== "missing");
        got.slice(0, item.n).forEach((c) => usedForRequired.add(c.code));
        rows.push({ label: `${item.n} of`, need: item.n, courses, done: got.length >= item.n });
      }
    }
    return { term: t.term, rows, electives };
  });

  const cats = (code: string) => cz.categories.get(code) ?? [];
  // Completed courses first so they win slots over in-progress ones.
  const pool = [...new Set(order)]
    .filter((c) => !usedForRequired.has(c))
    .sort((a, b) => (st(a) === "completed" ? 0 : 1) - (st(b) === "completed" ? 0 : 1));

  const fill = (slots: Slot[], candidates: string[]) => {
    const owners = matchSlots(slots, candidates, cats);
    return slots.map((s, i): SlotFill => ({ label: s.label, code: owners[i], status: owners[i] ? st(owners[i]!) : "missing" }));
  };

  const te = fill(TE_SLOTS, pool);
  const usedTe = new Set(te.map((s) => s.code).filter(Boolean));
  const natsciPool = pool.filter((c) => !usedTe.has(c) && !/\dL$/.test(c));
  const natsci = fill(NATSCI_SLOTS, natsciPool);
  const usedNs = new Set(natsci.map((s) => s.code).filter(Boolean));
  const ethics = fill(ETHICS_SLOTS, pool);
  // The Ethics course may also count towards a CSE, so it stays in the CSE pool.
  const cse = fill(CSE_SLOTS, pool.filter((c) => !usedTe.has(c) && !usedNs.has(c)));

  const split = (re: RegExp, need: number) => ({
    done: order.filter((c) => re.test(c) && st(c) === "completed"),
    inProgress: order.filter((c) => re.test(c) && st(c) === "inProgress"),
    need,
  });
  const unitsEarned = transcript.courses
    .filter((c) => c.status === "completed" && !/^(PD|COOP)\d/.test(c.code))
    .reduce((s, c) => s + (c.earned ?? catalog.courses[c.code]?.units ?? 0), 0);

  return { terms, te, natsci, ethics, cse, pd: split(/^PD\d/, 4), workTerms: split(/^COOP\d/, 5), unitsEarned };
}
