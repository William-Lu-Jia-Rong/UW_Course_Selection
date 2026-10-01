// Downloads the raw UW academic calendar data (Kuali) into data/raw/.
// Usage: node scripts/fetch-catalog.mjs [--force]
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RAW = join(ROOT, "data", "raw");
const COURSE_DIR = join(RAW, "courses");
const BASE = "https://uwaterloocm.kuali.co/api/v1/catalog";
const CALENDAR_PAGE = "https://uwaterloo.ca/academic-calendar/undergraduate-studies/catalog";
const PROGRAMS = {
  ce: "BybwJ10Ri3", // Computer Engineering (BASc - Honours)
  basc: "B1ligZqRn", // BASc degree requirements (Complementary Studies lists)
};
const force = process.argv.includes("--force");

mkdirSync(COURSE_DIR, { recursive: true });

async function getText(url, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": "uw-course-planner" } });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return await res.text();
    } catch (e) {
      if (i >= tries) throw e;
      await new Promise((r) => setTimeout(r, 500 * i));
    }
  }
}

async function findCatalogId() {
  const html = await getText(CALENDAR_PAGE);
  const m = html.match(/catalogId\s*=\s*'([0-9a-f]+)'/);
  if (!m) throw new Error("catalogId not found on calendar page");
  return m[1];
}

const catalogId = await findCatalogId();
console.log("catalogId", catalogId);
writeFileSync(join(RAW, "meta.json"), JSON.stringify({ catalogId, fetchedAt: new Date().toISOString() }, null, 2));

for (const [name, pid] of Object.entries(PROGRAMS)) {
  const text = await getText(`${BASE}/program/${catalogId}/${pid}`);
  writeFileSync(join(RAW, `program-${name}.json`), text);
  console.log("program", name, text.length);
}

const list = JSON.parse(await getText(`${BASE}/courses/${catalogId}`));
writeFileSync(join(RAW, "courses-index.json"), JSON.stringify(list));
console.log("courses in index", list.length);

const todo = list.filter((c) => force || !existsSync(join(COURSE_DIR, `${c.pid}.json`)));
console.log("course details to fetch", todo.length);

let done = 0;
async function worker() {
  while (todo.length) {
    const c = todo.shift();
    try {
      const text = await getText(`${BASE}/course/${catalogId}/${c.pid}`);
      writeFileSync(join(COURSE_DIR, `${c.pid}.json`), text);
    } catch (e) {
      console.warn("failed", c.__catalogCourseId, e.message);
    }
    if (++done % 250 === 0) console.log("fetched", done);
  }
}
await Promise.all(Array.from({ length: 12 }, worker));
console.log("done");
