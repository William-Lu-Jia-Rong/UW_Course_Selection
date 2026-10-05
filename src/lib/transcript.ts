import { levelIndex, nextLevel } from "./codes";
import type { CourseStatus, Transcript, TranscriptCourse } from "./types";

const TERM_RE = /^(Fall|Winter|Spring) (\d{4})$/;
const COURSE_RE = /^([A-Z]{2,7}) (\d{1,3}[A-Z]{0,2})\b\s*(.*)$/;
const UNITS_TAIL_RE = /(?:^|\s)(\d+\.\d{2})\s+(\d+\.\d{2})(?:\s+([A-Z]{1,4}|\d{1,3}))?$/;
const PASSING_LETTER = new Set(["CR", "AEG", "P", "S"]);
const NOT_COURSE_PREFIX = /^(Term GPA|Cumulative GPA|In GPA|Course Topic|Course Description)/;

function statusFor(grade: string | undefined, earned: number | undefined): CourseStatus {
  if (!grade) return "inProgress";
  if (/^\d+$/.test(grade)) {
    const g = Number(grade);
    if (earned === 0 || g < 50) return "failed";
    return "completed";
  }
  if (PASSING_LETTER.has(grade)) return "completed";
  if (grade === "NMR" || grade === "IP") return "inProgress";
  if (["NCR", "F", "FTC", "DNW", "WD", "WF", "WE", "INC", "FR"].includes(grade)) return "failed";
  return "other";
}

/** Empty transcript used when browsing by program + level only (no uploaded courses). */
export function emptyTranscript(program?: string): Transcript {
  return { program, terms: [], courses: [], milestones: "" };
}

/** Parses the text lines of a UW "Undergraduate Unofficial Transcript" (SSR_TSRPT). */
export function parseTranscriptLines(lines: string[]): Transcript {
  const t: Transcript = { terms: [], courses: [], milestones: "" };
  let term = "";
  let inMilestones = false;
  let last: TranscriptCourse | undefined;
  const milestoneLines: string[] = [];

  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line) continue;

    if (/^Milestones$/i.test(line)) {
      inMilestones = true;
      continue;
    }
    if (/^(Scholarships and Awards|End of Undergraduate)/i.test(line)) {
      inMilestones = false;
      continue;
    }
    if (inMilestones) {
      milestoneLines.push(line);
      continue;
    }

    let m: RegExpMatchArray | null;
    if ((m = line.match(/^Name:\s*(.+)$/))) {
      t.name ??= m[1];
      continue;
    }
    if ((m = line.match(/^Student ID:\s*(\d+)/))) {
      t.studentId ??= m[1];
      continue;
    }
    if ((m = line.match(TERM_RE))) {
      term = `${m[1]} ${m[2]}`;
      t.terms.push({ term });
      last = undefined;
      continue;
    }
    if ((m = line.match(/^Program:\s*(.+)$/))) {
      t.program = m[1];
      continue;
    }
    if ((m = line.match(/Level:\s*(\d[AB])(?:\s+Form Of Study:\s*(.+))?/i))) {
      const cur = t.terms[t.terms.length - 1];
      if (cur) {
        cur.level = m[1].toUpperCase();
        cur.formOfStudy = m[2]?.trim();
      }
      continue;
    }
    if ((m = line.match(/Cumulative GPA\s+(\d+(?:\.\d+)?)/))) {
      const v = Number(m[1]);
      if (v > 0) t.cumulativeAvg = v;
      continue;
    }
    if (NOT_COURSE_PREFIX.test(line)) continue;

    if (term && (m = line.match(COURSE_RE))) {
      const [, subject, number, rest] = m;
      const tail = rest.match(UNITS_TAIL_RE);
      last = {
        code: subject + number,
        title: (tail ? rest.slice(0, tail.index) : rest).trim(),
        term,
        status: "inProgress",
      };
      if (tail) applyUnits(last, tail);
      t.courses.push(last);
      continue;
    }

    // Units/grade wrapped onto their own line after a long course title.
    if (last && last.attempted === undefined && (m = line.match(/^(\d+\.\d{2})\s+(\d+\.\d{2})(?:\s+([A-Z]{1,4}|\d{1,3}))?$/))) {
      applyUnits(last, m);
    }
  }

  t.milestones = milestoneLines.join("\n");
  return t;
}

function applyUnits(c: TranscriptCourse, m: RegExpMatchArray) {
  c.attempted = Number(m[1]);
  c.earned = Number(m[2]);
  c.grade = m[3];
  c.status = statusFor(c.grade, c.earned);
}

/** Highest academic (non-work-term) level on the transcript. */
export function currentStudyLevel(t: Transcript): string | undefined {
  let best: string | undefined;
  for (const term of t.terms) {
    if (!term.level || /co-?op|work/i.test(term.formOfStudy ?? "")) continue;
    if (!best || levelIndex(term.level) > levelIndex(best)) best = term.level;
  }
  return best;
}

/** The level of the next academic term to plan for. */
export function suggestedTargetLevel(t: Transcript): string {
  const cur = currentStudyLevel(t);
  return cur ? nextLevel(cur) : "1A";
}

export function numericGrade(c: TranscriptCourse): number | undefined {
  return c.grade && /^\d+$/.test(c.grade) ? Number(c.grade) : undefined;
}
