import { formatCode } from "../lib/codes";
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
  return (
    <Card title={title}>
      {hint && <p className="mb-3 text-xs text-stone-500">{hint}</p>}
      <ul className="space-y-1.5">
        {slots.map((s, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span className="w-36 shrink-0 text-xs text-stone-500">{s.label}</span>
            {s.code ? (
              <span className={cx("rounded-md px-1.5 py-0.5 text-xs ring-1 ring-inset", CELL[s.status])}>
                <span className="font-mono">{formatCode(s.code)}</span> <span className="opacity-70">{catalog.courses[s.code]?.title}</span>
              </span>
            ) : (
              <span className="text-xs text-stone-400">— 待完成</span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function ProgressView({ progress, catalog }: { progress: DegreeProgress; catalog: Catalog }) {
  const requiredRows = progress.terms.flatMap((t) => t.rows.filter((r) => !r.optional));
  const te = count(progress.te);
  const ns = count(progress.natsci);
  const cse = count(progress.cse);
  const eth = count(progress.ethics);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="已获学分（不含 COOP/PD）" done={progress.unitsEarned} total={21.25} />
        <Stat
          label="必修课"
          done={requiredRows.filter((r) => r.courses.some((c) => c.status === "completed")).length}
          ip={requiredRows.filter((r) => r.done && !r.courses.some((c) => c.status === "completed")).length}
          total={requiredRows.length}
        />
        <Stat label="技术选修 TE" done={te.done} ip={te.ip} total={te.total} />
        <Stat label="通识选修 CSE" done={cse.done} ip={cse.ip} total={cse.total} />
        <Stat label="自然科学 NS" done={ns.done} ip={ns.ip} total={ns.total} />
        <Stat label="伦理 Ethics" done={eth.done} ip={eth.ip} total={eth.total} />
        <Stat label="PD 课程" done={progress.pd.done.length} ip={progress.pd.inProgress.length} total={progress.pd.need} />
        <Stat label="带学分的 Co-op 工作学期" done={progress.workTerms.done.length} ip={progress.workTerms.inProgress.length} total={progress.workTerms.need} />
      </div>

      <Card title="每学期必修课">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {progress.terms.map((t) => (
            <div key={t.term}>
              <div className="mb-1.5 text-xs font-semibold text-stone-500">{t.term}</div>
              <div className="flex flex-wrap gap-1">
                {t.rows.map((r, i) =>
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
              {t.electives.length > 0 && <div className="mt-1.5 text-[11px] text-stone-400">+ {t.electives.join("，")}</div>}
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-stone-400">半透明的是 0 学分的 Information Session，成绩单上通常不显示。</p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Slots
          title="技术选修 TE（8 门）"
          slots={progress.te}
          catalog={catalog}
          hint="List 1 至少 2 门；List 2 一门（或多修一门 List 1）；List 3 三门；List 4 一门；List 5 一门（或 List 1–4 任意一门）。另外 1–2 门 TE 须来自 CE/EE 以外的工程专业。"
        />
        <div className="space-y-4">
          <Slots title="通识选修 CSE（3 门）" slots={progress.cse} catalog={catalog} hint="两门来自 List C，另一门来自 List A、C 或 D。Ethics 课可以同时算作 CSE。" />
          <Slots title="自然科学 NS（2 门讲座课）" slots={progress.natsci} catalog={catalog} />
          <Slots title="伦理 Ethics（1 门）" slots={progress.ethics} catalog={catalog} />
        </div>
      </div>
    </div>
  );
}
