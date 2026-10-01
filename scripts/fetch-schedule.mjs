// Snapshots the upcoming-term offerings list into public/data/schedule.json.
// Usage: node scripts/fetch-schedule.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchScheduleHtml, parseScheduleHtml } from "./schedule-lib.mjs";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "data");
mkdirSync(OUT_DIR, { recursive: true });

const schedule = parseScheduleHtml(await fetchScheduleHtml());
writeFileSync(join(OUT_DIR, "schedule.json"), JSON.stringify(schedule));
console.log(schedule.term, schedule.termCode, "offerings:", schedule.offerings.length);
