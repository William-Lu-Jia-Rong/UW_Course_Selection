export type ReqNode =
  | { t: "all"; c: ReqNode[] }
  | { t: "some"; n: number; c: ReqNode[] }
  | { t: "courses"; n: number | "all"; courses: string[]; conc?: boolean; minGrade?: number; text: string }
  | { t: "level"; level: string; exact: boolean; text: string }
  | { t: "program"; programs: string[]; generic?: string; text: string }
  | { t: "notCourses"; courses: string[]; conc?: boolean; text: string }
  | { t: "notProgram"; programs: string[]; generic?: string; text: string }
  | { t: "avg"; min: number; text: string }
  | { t: "milestone"; names: string[]; text: string }
  | { t: "hs"; text: string }
  | { t: "text"; text: string };

export interface Course {
  code: string;
  subject: string;
  title: string;
  units: number;
  pid: string;
  desc: string;
  prereq?: ReqNode;
  coreq?: ReqNode;
  antireq?: ReqNode;
  cross?: string[];
  repeatable?: boolean;
}

export type TermItem =
  | { kind: "required"; n: number; courses: string[] }
  | { kind: "choose"; n: number; courses: string[] }
  | { kind: "elective"; n: number; label: string };

export type ListKey =
  | "ethics"
  | "natsci"
  | "te1"
  | "te2"
  | "te3"
  | "te4"
  | "te5"
  | "cseA"
  | "cseB"
  | "cseC"
  | "cseD"
  | "cseExclusions";

export interface Program {
  title: string;
  code: string;
  catalogActivationDate: string;
  termByTerm: { term: string; items: TermItem[] }[];
  lists: Record<ListKey, string[]>;
  cseSubjects: { C: string[]; D: string[] };
  notes: { graduation: string; additional: string[]; coop: string[] };
}

export interface Catalog {
  meta: { catalogId: string; fetchedAt: string; builtAt: string };
  program: Program;
  courses: Record<string, Course>;
}

export interface Offering {
  code: string;
  title: string;
  topic?: string;
  campus: string;
  notes?: string;
}

export interface Schedule {
  term: string;
  termCode: string;
  fetchedAt: string;
  source: string;
  offerings: Offering[];
}

export type CourseStatus = "completed" | "inProgress" | "failed" | "other";

export interface TranscriptCourse {
  code: string;
  title: string;
  term: string;
  attempted?: number;
  earned?: number;
  grade?: string;
  status: CourseStatus;
  manual?: boolean;
}

export interface TranscriptTerm {
  term: string;
  level?: string;
  formOfStudy?: string;
}

export interface Transcript {
  name?: string;
  studentId?: string;
  program?: string;
  terms: TranscriptTerm[];
  courses: TranscriptCourse[];
  cumulativeAvg?: number;
  milestones: string;
}
