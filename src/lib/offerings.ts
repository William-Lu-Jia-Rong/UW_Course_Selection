import type { Offering } from "./types";

export type OfferingIssue = { kind: "restricted" | "consent"; note: string };

const CANCELLED = /\bcancel+ed\b/i;
/** Others may still get in with approval, so these mean "check", not "closed". */
const OUTSIDERS_WITH_CONSENT = /Non-[\w-]+ students require [\w ]*(consent|permission)/i;
const CONSENT =
  /consent|permission|approval|application required|application process|by application|submit application|apply via|override form|audition|see your UG Advisor|Cross-Registration Form|native, near-native|for enrollment advice|only open to students who|For students currently enrolled in/i;
const RESTRICTED = [
  /Double Degree Students Only/i,
  /(?:^|[.|]\s*)[\w&,/ -]{1,40}? students only/i,
  /restricted to [\w&/ -]+ students/i,
  /(?<!sections )Reserved for (?:Year \d )?[\w &/-]+? (?:students|majors)\b/i,
  /for Exchange Students/i,
];
const OPEN_TO_ENGINEERING = /\bENG\b|Engineering|\bCOMPE\b|\bECE\b/i;

export function isCancelled(o: Offering): boolean {
  return CANCELLED.test(o.notes ?? "");
}

function issueFor(o: Offering): OfferingIssue | undefined {
  const notes = o.notes ?? "";
  if (!notes) return undefined;
  if (OUTSIDERS_WITH_CONSENT.test(notes)) return { kind: "consent", note: notes };
  if (!OPEN_TO_ENGINEERING.test(notes) && RESTRICTED.some((re) => re.test(notes))) return { kind: "restricted", note: notes };
  if (CONSENT.test(notes)) return { kind: "consent", note: notes };
  return undefined;
}

/** An issue only applies when every (non-cancelled) offering of the course has it. */
export function offeringIssue(offerings: Offering[] | undefined): OfferingIssue | undefined {
  if (!offerings?.length) return undefined;
  const issues = offerings.map(issueFor);
  if (issues.some((i) => !i)) return undefined;
  return issues.find((i) => i!.kind === "consent") ?? issues[0];
}
