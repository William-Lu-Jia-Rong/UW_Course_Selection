import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractCodes } from "./codes";
import { applyOfferingIssue, buildContext, evaluateCourse } from "./evaluate";
import { offeringIssue } from "./offerings";
import { buildCategorizer, computeProgress } from "./requirements";
import { parseTranscriptLines, suggestedTargetLevel } from "./transcript";
import type { Catalog, Transcript } from "./types";

const catalog: Catalog = JSON.parse(readFileSync(new URL("../../public/data/catalog.json", import.meta.url), "utf8"));
const cz = buildCategorizer(catalog);

const SAMPLE = `University of Waterloo
Undergraduate Unofficial Transcript
Name: Student, Test
Student ID: 12345678
Fall 2024
Program: Computer Engineering, Honours, Co-operative Program
Level: 1A Form Of Study: Enrolment
Course Description Attempted Earned Grade
ECE 105 Classical Mechanics 0.50 0.50 82
ECE 150 Fundamentals of Programming 0.50 0.50 95
ECE 190 Engineering Profession and Practice 0.25 0.25 83
ECE 198 Project Studio 0.25 0.25 89
ENGL 192 Communication in the Engineering Profession 0.50 0.50 72
(COMPE, ELE, MGTE)
MATH 115 Linear Algebra for Engineering 0.50 0.50 85
MATH 117 Calculus 1 for Engineering 0.50 0.50 45
Course Topic: First year readiness
Cumulative GPA 80.00 Cumulative Totals 3.00 3.00
Winter 2025
Level: 1B Form Of Study: Enrolment
ECE 106 Electricity and Magnetism 0.50 0.50 86
ECE 108 Discrete Mathematics and Logic 1 0.50 0.50 77
ECE 124 Digital Circuits and Systems 0.50 0.50 83
ECE 140 Linear Circuits 0.50 0.50 82
ECE 192 Engineering Economics and Impact on Society 0.25 0.25 96
MATH 119 Calculus 2 for Engineering 0.50 0.50 71
Spring 2025
Level: 1B Form Of Study: Co-op Work Term
COOP 1 Co-operative Work Term 0.50 0.00 CR
PD 19 Tactics for Workplace Success 0.50 0.00 CR
Fall 2025
Level: 2A Form Of Study: Enrolment
ECE 109 Materials Chemistry for Engineers 0.25 0.25 80
ECE 204 Numerical Methods 0.50 0.50 76
ECE 205 Advanced Calculus 1 for Electrical and Computer
Engineers
0.50 0.50 76
ECE 222 Digital Computers 0.50 0.50 76
ECE 240 Electronic Circuits 1 0.50 0.50 71
ECE 250 Algorithms and Data Structures 0.50 0.50 73
Cumulative GPA 80.53 Cumulative Totals 8.50 8.50
Spring 2026
Level: 2B Form Of Study: Enrolment
ECE 203 Probability Theory and Statistics 1
ECE 207 Signals and Systems
ECE 208 Discrete Mathematics and Logic 2
ECE 224 Embedded Microprocessor Systems
ECE 252 Systems Programming and Concurrency
ECE 298 Instrumentation and Prototyping Laboratory
Milestones
Date Completed Description Status
10/04/2024 Workplace Hazardous Materials Information System Completed
End of Undergraduate Unofficial Transcript`;

const transcript = parseTranscriptLines(SAMPLE.split("\n"));

function availability(code: string, t: Transcript = transcript, opts: { level?: string; plan?: string[]; inProgress?: boolean } = {}) {
  const ctx = buildContext(catalog, t, {
    includeInProgress: opts.inProgress ?? true,
    level: opts.level ?? suggestedTargetLevel(t),
    programs: ["H-Computer Engineering"],
    concurrent: opts.plan,
  });
  return evaluateCourse(catalog.courses[code], ctx).availability;
}

describe("transcript parsing", () => {
  it("reads header, terms, grades and statuses", () => {
    expect(transcript.name).toBe("Student, Test");
    expect(transcript.cumulativeAvg).toBe(80.53);
    expect(transcript.terms.map((t) => t.level)).toEqual(["1A", "1B", "1B", "2A", "2B"]);
    const byCode = Object.fromEntries(transcript.courses.map((c) => [c.code, c]));
    expect(byCode.ECE105).toMatchObject({ grade: "82", status: "completed", term: "Fall 2024" });
    expect(byCode.MATH117.status).toBe("failed");
    expect(byCode.ECE205).toMatchObject({ grade: "76", status: "completed" });
    expect(byCode.PD19.status).toBe("completed");
    expect(byCode.ECE252.status).toBe("inProgress");
    expect(transcript.milestones).toContain("Workplace Hazardous Materials");
  });

  it("plans for the term after the latest study term", () => {
    expect(suggestedTargetLevel(transcript)).toBe("3A");
  });
});

describe("requisite evaluation", () => {
  it("unlocks 3A core courses once 2B courses count as done", () => {
    expect(availability("ECE327")).toBe("eligible");
    expect(availability("ECE350")).toBe("eligible");
    expect(availability("ECE318")).toBe("eligible");
  });

  it("respects the in-progress toggle", () => {
    expect(availability("ECE318", transcript, { inProgress: false })).toBe("locked");
  });

  it("enforces level and program restrictions", () => {
    expect(availability("ECE457B")).toBe("locked");
    expect(availability("ECE457B", transcript, { level: "4A" })).toBe("eligible");
    expect(availability("ECE498A")).toBe("locked");
    expect(availability("CS486", transcript, { level: "4A" })).toBe("locked");
  });

  it("marks completed courses and cross-listed equivalents as taken", () => {
    expect(availability("ECE250")).toBe("taken");
    expect(availability("COMMST192")).toBe("taken");
  });

  it("flags antirequisite conflicts from planned courses", () => {
    expect(availability("ECE457B", transcript, { level: "4A", plan: ["SYDE522"] })).toBe("antireq");
  });
});

describe("degree progress", () => {
  it("matches electives into requirement slots", () => {
    const t: Transcript = {
      ...transcript,
      courses: [
        ...transcript.courses,
        ...["ECE320", "ECE351", "ECE358", "ECE457A", "PHIL215", "STV202", "CHE102"].map((code) => ({
          code,
          title: "",
          term: "Later",
          status: "completed" as const,
          grade: "80",
        })),
      ],
    };
    const p = computeProgress(catalog, t, cz);
    const te = p.te.filter((s) => s.code).map((s) => s.code);
    expect(te).toEqual(expect.arrayContaining(["ECE320", "ECE351", "ECE358", "ECE457A"]));
    expect(p.ethics[0].code).toBe("PHIL215");
    expect(p.cse.filter((s) => s.code).map((s) => s.code)).toEqual(expect.arrayContaining(["PHIL215", "STV202"]));
    expect(p.natsci[0].code).toBe("CHE102");
    expect(p.pd.done).toEqual(["PD19"]);
  });

  it("does not count the communication requirement as a List C CSE", () => {
    expect(cz.categories.get("ENGL192") ?? []).not.toContain("cseC");
    expect(cz.categories.get("ENGL200A") ?? []).toContain("cseC");
  });
});

describe("level rules without 'or higher'", () => {
  it("treats a higher level as needing confirmation, not as locked", () => {
    const ctx = buildContext(catalog, transcript, { includeInProgress: true, level: "4B", programs: ["H-Computer Engineering"] });
    const ev = evaluateCourse(catalog.courses.ECE454, ctx);
    expect(ev.prereq && JSON.stringify(ev.prereq)).toContain('"s":"unk"');
    expect(availability("ECE454", transcript, { level: "3A" })).toBe("locked");
  });
});

describe("schedule notes", () => {
  const offer = (notes: string) => [{ code: "X100", title: "", campus: "UW", notes }];
  it("classifies restrictions, consent and open notes", () => {
    expect(offeringIssue(offer("Open to Double Degree Students Only"))?.kind).toBe("restricted");
    expect(offeringIssue(offer("MGTE students only"))?.kind).toBe("restricted");
    expect(offeringIssue(offer("Reserved for Legal Studies majors in at least 3A only"))?.kind).toBe("restricted");
    expect(offeringIssue(offer("Department Consent Required"))?.kind).toBe("consent");
    expect(offeringIssue(offer("Online course Reserved for co-op and ENG students only"))).toBeUndefined();
    expect(offeringIssue(offer("Held with ECON 673"))).toBeUndefined();
  });
  it("ignores a restriction when another offering of the course is open", () => {
    expect(offeringIssue([...offer("SE students only."), { code: "X100", title: "", campus: "UW" }])).toBeUndefined();
  });
  it("downgrades an eligible course", () => {
    const ctx = buildContext(catalog, transcript, { includeInProgress: true, level: "3A", programs: ["H-Computer Engineering"] });
    const ev = applyOfferingIssue(evaluateCourse(catalog.courses.STV202, ctx), offeringIssue(offer("GBDA students only.")));
    expect(ev.availability).toBe("restricted");
  });
});

describe("CSE list membership", () => {
  it("records why a course is on a list", () => {
    expect(cz.reasons.get("STV202:cseA")).toBe("listed");
    expect(cz.reasons.get("BET400:cseC")).toBe("subject");
  });
  it("extends named lists to cross-listed twins", () => {
    for (const code of catalog.program.lists.cseA) {
      for (const twin of catalog.courses[code]?.cross ?? []) expect(cz.categories.get(twin)).toContain("cseA");
    }
  });
  it("excludes List C candidates whose cross-listed twin is on List D", () => {
    const dTwins = Object.values(catalog.courses).filter(
      (c) => !catalog.program.lists.cseC.includes(c.code) && (c.cross ?? []).some((t) => catalog.program.lists.cseD.includes(t)),
    );
    expect(dTwins.length).toBeGreaterThan(0);
    for (const c of dTwins) expect(cz.reasons.get(`${c.code}:cseC`)).not.toBe("subject");
  });
});

describe("pasted course lists", () => {
  it("extracts codes from free text", () => {
    expect(extractCodes("ECE 327, ece350 / CS 486 and XYZ 999", (c) => !!catalog.courses[c])).toEqual(["ECE327", "ECE350", "CS486"]);
  });
});
