import { formatCode } from "../lib/codes";
import { useT } from "../lib/i18n";
import type { DegreeProgress, ProgressStatus, SlotFill } from "../lib/requirements";
import type { Catalog } from "../lib/types";
import { Card, cx } from "./ui";

const CELL: Record<ProgressStatus, string> = {
  completed: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  inProgress: "bg-sky-50 text-sky-800 ring-sky-200",
  missing: "bg-white text-stone-500 ring-stone-200 border-dashed",
};

function count(slots: SlotFill[]) {
  return {
    done: slots.filter((s) => s.status === "completed").length,
    ip: slots.filter((s) => s.status === "inProgress").length,
    total: slots.length,
  };
}

function Stat({ label, done, ip = 0, total, unit = "" }: { label: string; done: number; ip?: number; total: number; unit?: string }) {
  const pct = Math.min(100, (done / total) * 100);
  const pctIp = Math.min(100 - pct, (ip / total) * 100);
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3">
      <div className="text-xs text-stone-500">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-stone-900">
        {done}
        {ip > 0 && <span className="text-sm font-normal text-sky-600"> +{ip}</span>}
        <span className="text-sm font-normal text-stone-400">
          {" "}
          / {total}
          {unit}
        </span>
      </div>
      <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-stone-100">
        <div className="bg-emerald-500" style={{ width: `${pct}%` }} />
        <div className="bg-sky-400" style={{ width: `${pctIp}%` }} />
      </div>
    </div>
  );
}

function Slots({ title, slots, catalog, hint }: { title: string; slots: SlotFill[]; catalog: Catalog; hint?: string }) {
  const t = useT();
  return (
    <Card title={title}>
      {hint && <p className="mb-3 text-xs text-stone-500">{hint}</p>}
      <ul className="space-y-1.5">
        {slots.map((s, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span className="w-36 shrink-0 text-xs text-stone-500">{t(s.label)}</span>
            {s.code ? (
              <span className={cx("rounded-md px-1.5 py-0.5 text-xs ring-1 ring-inset", CELL[s.status])}>
                <span className="font-mono">{formatCode(s.code)}</span> <span className="opacity-70">{catalog.courses[s.code]?.title}</span>
              </span>
            ) : (
              <span className="text-xs text-stone-400">{t("— To do", "— 待完成")}</span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function ProgressView({ progress, catalog }: { progress: DegreeProgress; catalog: Catalog }) {
  const t = useT();
  const requiredRows = progress.terms.flatMap((t) => t.rows.filter((r) => !r.optional));
  const te = count(progress.te);
  const ns = count(progress.natsci);
  const cse = count(progress.cse);
  const eth = count(progress.ethics);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t("Units earned (excl. COOP/PD)", "已获学分（不含 COOP/PD）")} done={progress.unitsEarned} total={21.25} />
        <Stat
          label={t("Required courses", "必修课")}
          done={requiredRows.filter((r) => r.courses.some((c) => c.status === "completed")).length}
          ip={requiredRows.filter((r) => r.done && !r.courses.some((c) => c.status === "completed")).length}
          total={requiredRows.length}
        />
        <Stat label={t("Technical electives (TE)", "技术选修 TE")} done={te.done} ip={te.ip} total={te.total} />
        <Stat label={t("Complementary studies (CSE)", "通识选修 CSE")} done={cse.done} ip={cse.ip} total={cse.total} />
        <Stat label={t("Natural science (NS)", "自然科学 NS")} done={ns.done} ip={ns.ip} total={ns.total} />
        <Stat label={t("Ethics", "伦理 Ethics")} done={eth.done} ip={eth.ip} total={eth.total} />
        <Stat label={t("PD courses", "PD 课程")} done={progress.pd.done.length} ip={progress.pd.inProgress.length} total={progress.pd.need} />
        <Stat label={t("Credited co-op work terms", "带学分的 Co-op 工作学期")} done={progress.workTerms.done.length} ip={progress.workTerms.inProgress.length} total={progress.workTerms.need} />
      </div>

      <Card title={t("Required courses by term", "每学期必修课")}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {progress.terms.map((term) => (
            <div key={term.term}>
              <div className="mb-1.5 text-xs font-semibold text-stone-500">{term.term}</div>
              <div className="flex flex-wrap gap-1">
                {term.rows.map((r, i) =>
                  r.courses.length === 1 ? (
                    <span
                      key={i}
                      title={catalog.courses[r.courses[0].code]?.title}
                      className={cx("rounded-md border px-1.5 py-0.5 font-mono text-xs ring-1 ring-inset", CELL[r.courses[0].status], r.optional && "opacity-50")}
                    >
                      {formatCode(r.courses[0].code)}
                    </span>
                  ) : (
                    <span key={i} className="inline-flex items-center gap-0.5 rounded-md bg-stone-50 px-1 py-0.5 text-[11px] text-stone-400">
                      {r.courses.map((c, j) => (
                        <span key={c.code}>
                          {j > 0 && "/"}
                          <span className={cx("rounded px-1 font-mono text-xs ring-1 ring-inset", CELL[c.status])}>{formatCode(c.code)}</span>
                        </span>
                      ))}
                    </span>
                  ),
                )}
              </div>
              {term.electives.length > 0 && <div className="mt-1.5 text-[11px] text-stone-400">+ {term.electives.join(t(", ", "，"))}</div>}
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-stone-400">
          {t("Faded entries are 0-unit Information Sessions, which usually don't appear on transcripts.", "半透明的是 0 学分的 Information Session，成绩单上通常不显示。")}
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Slots
          title={t("Technical electives TE (8 courses)", "技术选修 TE（8 门）")}
          slots={progress.te}
          catalog={catalog}
          hint={t(
            "At least 2 from List 1; 1 from List 2 (or another List 1); 3 from List 3; 1 from List 4; 1 from List 5 (or any of List 1–4). In addition, 1–2 TEs must come from an engineering program other than CE/EE.",
            "List 1 至少 2 门；List 2 一门（或多修一门 List 1）；List 3 三门；List 4 一门；List 5 一门（或 List 1–4 任意一门）。另外 1–2 门 TE 须来自 CE/EE 以外的工程专业。",
          )}
        />
        <div className="space-y-4">
          <Slots
            title={t("Complementary studies CSE (3 courses)", "通识选修 CSE（3 门）")}
            slots={progress.cse}
            catalog={catalog}
            hint={t("Two from List C and one from List A, C or D. An Ethics course can also count as a CSE.", "两门来自 List C，另一门来自 List A、C 或 D。Ethics 课可以同时算作 CSE。")}
          />
          <Slots title={t("Natural science NS (2 lecture courses)", "自然科学 NS（2 门讲座课）")} slots={progress.natsci} catalog={catalog} />
          <Slots title={t("Ethics (1 course)", "伦理 Ethics（1 门）")} slots={progress.ethics} catalog={catalog} />
        </div>
      </div>
    </div>
  );
}
