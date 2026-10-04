import { useMemo, useState } from "react";
import type { Availability, CourseEval } from "../lib/evaluate";
import { plural, useT, type Text } from "../lib/i18n";
import { CATEGORY_GROUPS, type Categorizer, type Category } from "../lib/requirements";
import type { Offering } from "../lib/types";
import { CourseList } from "./CourseList";
import { Chip } from "./ui";

type AvailFilter = "eligible" | "maybe" | "notTaken" | "all";

const AVAIL_FILTERS: { key: AvailFilter; label: Text; match: Availability[] }[] = [
  { key: "eligible", label: { en: "Eligible", zh: "能选" }, match: ["eligible", "needsCoreq"] },
  { key: "maybe", label: { en: "Eligible + check", zh: "能选 + 需确认" }, match: ["eligible", "needsCoreq", "check"] },
  { key: "notTaken", label: { en: "All not taken", zh: "全部未修" }, match: ["eligible", "needsCoreq", "check", "restricted", "locked", "antireq"] },
  { key: "all", label: { en: "All", zh: "全部" }, match: ["eligible", "needsCoreq", "check", "restricted", "locked", "antireq", "taken"] },
];

const AVAIL_ORDER: Availability[] = ["eligible", "needsCoreq", "check", "restricted", "locked", "antireq", "taken"];

const OTHER_GROUP: Text = { en: "Other (not on any CE course list)", zh: "其他（不在 CE 选课列表里）" };

interface Props {
  evals: CourseEval[];
  cz: Categorizer;
  offerings?: Map<string, Offering[]>;
  plan: string[];
  onTogglePlan: (code: string) => void;
  defaultAvail?: AvailFilter;
}

export function CourseBrowser({ evals, cz, offerings, plan, onTogglePlan, defaultAvail = "eligible" }: Props) {
  const t = useT();
  const [group, setGroup] = useState<number | "all">("all");
  const [avail, setAvail] = useState<AvailFilter>(defaultAvail);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const allowed = AVAIL_FILTERS.find((f) => f.key === avail)!.match;
    const q = query.trim().toLowerCase().replace(/\s+/g, "");
    return evals
      .filter((e) => allowed.includes(e.availability))
      .filter((e) => !q || e.course.code.toLowerCase().includes(q) || e.course.title.toLowerCase().replace(/\s+/g, "").includes(q))
      .sort(
        (a, b) =>
          AVAIL_ORDER.indexOf(a.availability) - AVAIL_ORDER.indexOf(b.availability) ||
          a.course.code.localeCompare(b.course.code, "en", { numeric: true }),
      );
  }, [evals, avail, query]);

  const inGroup = (e: CourseEval, cats: Category[]) => (cz.categories.get(e.course.code) ?? []).some((c) => cats.includes(c));
  const groups = CATEGORY_GROUPS.map((g) => ({ ...g, evals: filtered.filter((e) => inGroup(e, g.cats)) }));
  const other = filtered.filter((e) => !cz.categories.get(e.course.code)?.length);
  if (other.length) groups.push({ label: OTHER_GROUP, cats: [], evals: other });
  const visible = group === "all" ? groups : [groups[group]];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip active={group === "all"} onClick={() => setGroup("all")}>
          {t("All categories", "全部类别")}
        </Chip>
        {groups.map((g, i) => (
          <Chip key={g.label.en} active={group === i} onClick={() => setGroup(i)} count={g.evals.length}>
            {t(g.label)}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-stone-200 bg-white p-0.5">
          {AVAIL_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setAvail(f.key)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${avail === f.key ? "bg-stone-900 text-white" : "text-stone-600 hover:text-stone-900"}`}
            >
              {t(f.label)}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Search by code or title, e.g. ECE 4 / machine", "搜索课号或名称，例如 ECE 4 / machine")}
          className="min-w-56 flex-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-stone-400"
        />
      </div>

      {visible.map((g) => (
        <section key={g.label.en} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <header className="flex items-baseline justify-between border-b border-stone-100 bg-stone-50 px-3 py-2">
            <h3 className="text-sm font-semibold text-stone-800">{t(g.label)}</h3>
            <span className="text-xs text-stone-500">{t(plural(g.evals.length, "course"), `${g.evals.length} 门`)}</span>
          </header>
          <CourseList
            key={`${g.label.en}-${avail}-${query}`}
            evals={g.evals}
            cz={cz}
            offerings={offerings}
            plan={plan}
            onTogglePlan={onTogglePlan}
            limit={g.cats.some((c) => c.startsWith("cse")) ? 25 : 60}
            empty={query ? t(`No courses match "${query}"`, `没有匹配“${query}”的课程`) : t("No matching courses", "没有符合条件的课程")}
          />
        </section>
      ))}
    </div>
  );
}
