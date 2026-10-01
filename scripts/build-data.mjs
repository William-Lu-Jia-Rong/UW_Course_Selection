// Parses data/raw/ (from fetch-catalog.mjs) into public/data/catalog.json.
// Usage: node scripts/build-data.mjs
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "node-html-parser";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RAW = join(ROOT, "data", "raw");
const OUT_DIR = join(ROOT, "public", "data");
mkdirSync(OUT_DIR, { recursive: true });

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const clean = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const TEXT_CODE_RE = /\b([A-Z]{2,7}) ?(\d{2,3}[A-Z]{0,2})\b/g;

// ---------- requisites ----------

function elementChildren(node) {
  return node.childNodes.filter((n) => n.nodeType === 1);
}

/** Collect <li> items of a <ul>, looking through the <div> wrappers Kuali inserts. */
function listItems(ul) {
  const items = [];
  for (const child of elementChildren(ul)) {
    if (child.rawTagName === "li") items.push(child);
    else items.push(...listItems(child));
  }
  return items;
}

function parseLeaf(resultDiv) {
  const text = clean(resultDiv.text).replace(/\bMSCi(\d)/g, "MSCI$1");
  const courseLinks = resultDiv
    .querySelectorAll('a[href^="#/courses/"]')
    .map((a) => clean(a.text).replace(/\s+/g, ""));
  const programLinks = resultDiv.querySelectorAll('a[href^="#/programs/"]').map((a) => clean(a.text));
  let plain = text;
  for (const a of resultDiv.querySelectorAll("a")) plain = plain.replace(clean(a.text), " ");
  const textCodes = [...plain.matchAll(TEXT_CODE_RE)].map((m) => m[1] + m[2]);
  const courses = [...new Set([...courseLinks, ...textCodes])];
  const num = (s) => (s ? Number(s) : undefined);
  let m;

  if ((m = text.match(/^Students must be in (at least )?level (\d[AB])( or higher)?/i))) {
    return { t: "level", level: m[2].toUpperCase(), exact: !m[1] && !m[3], text };
  }
  if ((m = text.match(/^Earned a minimum grade of (\d+)% in (?:each of the following|at least (\d+) of the following|the following)/i))) {
    return courses.length
      ? { t: "courses", n: num(m[2]) ?? "all", courses, minGrade: Number(m[1]), text }
      : { t: "text", text };
  }
  if ((m = text.match(/^Completed or concurrently enrolled in(?: at least (\d+) of)?/i))) {
    return courses.length ? { t: "courses", n: num(m[1]) ?? "all", courses, conc: true, text } : { t: "text", text };
  }
  if ((m = text.match(/^Earned a minimum cumulative average of (\d+(?:\.\d+)?)%?$/i))) {
    return { t: "avg", min: Number(m[1]), text };
  }
  if ((m = text.match(/^Obtained (?:all of the following milestones|the following milestone):\s*(.*)$/i))) {
    const names = m[1].split(/\s+and\s+|,\s*/).map((s) => s.replace(/\s*Milestone$/i, "").trim()).filter(Boolean);
    return { t: "milestone", names, text };
  }
  if ((m = text.match(/^Must have completed?\b:? ?(?:at least (\d+) of|(\d+) of|(one|any) of|the following)?/i))) {
    if (!courses.length) {
      if (/\b(4U|Grade 1[12]|Ontario|high school|Calculus and Vectors|Advanced Functions)\b/i.test(text))
        return { t: "hs", text };
      return { t: "text", text };
    }
    const n = num(m[1]) ?? num(m[2]) ?? (m[3] ? 1 : "all");
    return { t: "courses", n, courses, text };
  }
  if (/^Enrolled in/i.test(text)) {
    return { t: "program", programs: programLinks, generic: programLinks.length ? undefined : text, text };
  }
  if (/^Not completed (nor|or) (concurrently|currently) enrolled/i.test(text)) {
    return courses.length ? { t: "notCourses", courses, conc: true, text } : { t: "text", text };
  }
  if (/^Not completed/i.test(text)) {
    return courses.length ? { t: "notCourses", courses, text } : { t: "text", text };
  }
  if (/^Not open to students enrolled in/i.test(text)) {
    return { t: "notProgram", programs: programLinks, generic: programLinks.length ? undefined : text, text };
  }
  return { t: "text", text };
}

function parseItem(li) {
  if (li.getAttribute("data-test")?.startsWith("ruleView")) {
    const result = li.querySelector('[data-test$="-result"]');
    return result ? parseLeaf(result) : null;
  }
  const header = elementChildren(li).find((c) => c.rawTagName === "span");
  const sub = elementChildren(li).find((c) => c.rawTagName === "ul");
  if (!sub) return null;
  const children = listItems(sub).map(parseItem).filter(Boolean);
  const h = clean(header?.text ?? "");
  const m = h.match(/Complete (\d+) of the following/i);
  if (m) return { t: "some", n: Number(m[1]), c: children };
  return { t: "all", c: children };
}

function parseRequisite(html) {
  if (!html) return null;
  const root = parse(html);
  const ul = root.querySelector("ul");
  if (!ul) return null;
  const items = listItems(ul).map(parseItem).filter(Boolean);
  if (!items.length) return null;
  return items.length === 1 ? items[0] : { t: "all", c: items };
}

// ---------- courses ----------

const meta = readJson(join(RAW, "meta.json"));
const courses = {};
const stats = {};
const countTypes = (node) => {
  if (!node) return;
  stats[node.t] = (stats[node.t] || 0) + 1;
  node.c?.forEach(countTypes);
};

for (const file of readdirSync(join(RAW, "courses"))) {
  const j = readJson(join(RAW, "courses", file));
  const code = j.__catalogCourseId;
  const prereq = parseRequisite(j.prerequisites);
  const coreq = parseRequisite(j.corequisites);
  const antireq = parseRequisite(j.antirequisites);
  [prereq, coreq, antireq].forEach(countTypes);
  courses[code] = {
    code,
    subject: j.subjectCode?.name ?? code.replace(/\d.*$/, ""),
    title: clean(j.title ?? ""),
    units: Number(j.credits?.value ?? j.credits?.credits?.min ?? 0.5),
    pid: j.pid,
    desc: clean(parse(j.description ?? "").text),
    ...(prereq && { prereq }),
    ...(coreq && { coreq }),
    ...(antireq && { antireq }),
    ...(j.crossListedCourses?.length && { cross: j.crossListedCourses.map((c) => c.__catalogCourseId) }),
    ...(j.totalCompletionsAllowed && { repeatable: true }),
  };
}

// ---------- program ----------

/** Walk a program HTML field in document order, splitting it into labelled sections. */
function sections(html) {
  const out = [];
  let cur = null;
  const walk = (node) => {
    if (node.nodeType !== 1) return;
    if (/^h\d$/.test(node.rawTagName)) {
      cur = { label: clean(node.text), rules: [], courses: [] };
      out.push(cur);
      return;
    }
    if (cur && node.getAttribute("data-test")?.match(/^ruleView-[^-]+-result$/)) {
      const links = node.querySelectorAll('a[href^="#/courses/"]').map((a) => clean(a.text).replace(/\s+/g, ""));
      const text = clean(node.text);
      const head = text.replace(/:.*$/s, "").trim();
      cur.rules.push({ text: links.length ? head : text, courses: links });
      cur.courses.push(...links);
    }
    elementChildren(node).forEach(walk);
  };
  elementChildren(parse(html)).forEach(walk);
  return out;
}

const ce = readJson(join(RAW, "program-ce.json"));
const basc = readJson(join(RAW, "program-basc.json"));

const termByTerm = sections(ce.requiredCoursesTermByTerm).map((s) => ({
  term: s.label.replace(/\s*Term$/, ""),
  items: s.rules.map((r) => {
    if (r.courses.length) {
      const m = r.text.match(/Complete (\d+) of/i);
      return { kind: m ? "choose" : "required", n: m ? Number(m[1]) : r.courses.length, courses: r.courses };
    }
    const m = r.text.match(/Complete (\d+) (.*)/i);
    return { kind: "elective", n: m ? Number(m[1]) : 1, label: m ? m[2] : r.text };
  }),
}));

const ceLists = Object.fromEntries(sections(ce.courseListsNew).map((s) => [s.label, s]));
const bascLists = Object.fromEntries(sections(basc.courseListsNew).map((s) => [s.label, s]));
const subjectsFrom = (sec) => {
  const rule = sec.rules.find((r) => /Eligible subject codes/i.test(r.text));
  return rule ? rule.text.replace(/^.*?:\s*/, "").split(/,\s*/).map((s) => s.trim()) : [];
};

const program = {
  title: clean(ce.title),
  code: clean(ce.code),
  catalogActivationDate: ce.catalogActivationDate,
  termByTerm,
  lists: {
    ethics: ceLists["Ethics List"].courses,
    natsci: ceLists["Natural Science List"].courses,
    te1: ceLists["List 1"].courses,
    te2: ceLists["List 2"].courses,
    te3: ceLists["List 3"].courses,
    te4: ceLists["List 4"].courses,
    te5: ceLists["List 5"].courses,
    cseA: bascLists["List A"].courses,
    cseB: bascLists["List B"].courses,
    cseC: bascLists["List C"].courses,
    cseD: bascLists["List D"].courses,
    cseExclusions: bascLists["Exclusions"].courses,
  },
  cseSubjects: { C: subjectsFrom(bascLists["List C"]), D: subjectsFrom(bascLists["List D"]) },
  notes: {
    graduation: clean(parse(ce.graduationRequirements ?? "").text),
    additional: parse(ce.additionalConstraints ?? "").querySelectorAll("li").map((li) => clean(li.text)),
    coop: parse(ce.coOperativeRequirementsUndergraduate ?? "").querySelectorAll("li").map((li) => clean(li.text)),
  },
};

for (const [k, v] of Object.entries(program.lists)) {
  const missing = v.filter((c) => !courses[c]);
  if (missing.length) console.warn(`list ${k}: ${missing.length} codes not in catalog:`, missing.join(", "));
}

const out = {
  meta: { catalogId: meta.catalogId, fetchedAt: meta.fetchedAt, builtAt: new Date().toISOString() },
  program,
  courses,
};
const json = JSON.stringify(out);
writeFileSync(join(OUT_DIR, "catalog.json"), json);
console.log("courses", Object.keys(courses).length, "size", (json.length / 1e6).toFixed(2), "MB");
console.log("rule node types", stats);
console.log("terms", termByTerm.map((t) => `${t.term}:${t.items.length}`).join(" "));
console.log("lists", Object.entries(program.lists).map(([k, v]) => `${k}:${v.length}`).join(" "));
console.log("cse subjects", program.cseSubjects);
