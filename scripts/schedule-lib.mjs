import https from "node:https";

export const SCHEDULE_URL = "https://classes.uwaterloo.ca/uwpcshtm.html";

// classes.uwaterloo.ca serves an incomplete certificate chain (browsers repair it via AIA, Node does not),
// so verification is relaxed for this single read-only public page.
const agent = new https.Agent({ rejectUnauthorized: false });

export function fetchScheduleHtml(url = SCHEDULE_URL) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { agent, headers: { "user-agent": "uw-course-planner" } }, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} from ${url}`));
          res.resume();
          return;
        }
        res.setEncoding("latin1");
        let body = "";
        res.on("data", (d) => (body += d));
        res.on("end", () => resolve(body));
      })
      .on("error", reject);
  });
}

const decode = (s) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

/** Parses the "Course Selection Offerings List" page into { term, termCode, offerings[] }. */
export function parseScheduleHtml(html) {
  const termMatch = html.match(/<h2>\s*([A-Za-z]+ \d{4})\s*\((\d{4})\)\s*<\/h2>/);
  const offerings = [];
  const rowRe = /<tr>((?:\s*<td[^>]*>[\s\S]*?<\/td>){7})\s*<\/tr>/g;
  let m;
  while ((m = rowRe.exec(html))) {
    const cells = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => decode(c[1]));
    const [subject, catNbr, title, topic, campus, , notes] = cells;
    if (!/^[A-Z]{2,7}$/.test(subject) || !/^\d{1,3}[A-Z]{0,2}$/.test(catNbr)) continue;
    offerings.push({
      code: subject + catNbr,
      title,
      ...(topic && { topic }),
      campus,
      ...(notes && { notes }),
    });
  }
  return {
    term: termMatch?.[1] ?? "Unknown term",
    termCode: termMatch?.[2] ?? "",
    fetchedAt: new Date().toISOString(),
    source: SCHEDULE_URL,
    offerings,
  };
}
