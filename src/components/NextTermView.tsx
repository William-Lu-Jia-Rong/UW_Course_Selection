import { useState } from "react";
import { extractCodes, formatCode } from "../lib/codes";
import type { CourseEval } from "../lib/evaluate";
import { locale, useLang, useT } from "../lib/i18n";
import type { Categorizer } from "../lib/requirements";
import type { Catalog, Offering, Schedule } from "../lib/types";
import { CourseBrowser } from "./CourseBrowser";
import { useOpenChain } from "./PrereqChain";
import { AVAILABILITY, Badge, Button, Card, cx } from "./ui";

export type OfferingMode = "official" | "custom";

interface Props {
  catalog: Catalog;
  schedule: Schedule | null;
  setSchedule: (s: Schedule) => void;
  mode: OfferingMode;
  setMode: (m: OfferingMode) => void;
  customText: string;
  setCustomText: (t: string) => void;
  offered: Map<string, Offering[]>;
  evals: CourseEval[];
  cz: Categorizer;
  plan: string[];
  onTogglePlan: (code: string) => void;
  targetLevel: string;
}

export function NextTermView(p: Props) {
  const t = useT();
  const lang = useLang();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string>();
  const openChain = useOpenChain();

  const refresh = async () => {
    setRefreshing(true);
    setRefreshError(undefined);
    try {
      const res = await fetch("/api/schedule");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      p.setSchedule(data as Schedule);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setRefreshError(t(`Refresh failed (this endpoint only exists under npm run dev): ${msg}`, `刷新失败（需要用 npm run dev 启动才有这个接口）：${msg}`));
    } finally {
      setRefreshing(false);
    }
  };

  const customCodes = extractCodes(p.customText, (c) => !!p.catalog.courses[c]);
  const offeredEvals = p.evals.filter((e) => p.offered.has(e.course.code));
  const termRequired = p.catalog.program.termByTerm.find((t) => t.term === p.targetLevel);
  const requiredCodes = termRequired?.items.flatMap((i) => (i.kind === "elective" ? [] : i.courses)) ?? [];
  const evalByCode = new Map(p.evals.map((e) => [e.course.code, e]));
  const fetchedAt = p.schedule ? new Date(p.schedule.fetchedAt).toLocaleString(locale(lang)) : "";

  return (
    <div className="space-y-5">
      <Card title={t("Next term's offerings", "下学期开课列表")}>
        <div className="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => p.setMode("official")}
            className={cx("rounded-xl border p-3 text-left transition", p.mode === "official" ? "border-stone-900 ring-1 ring-stone-900" : "border-stone-200 hover:border-stone-400")}
          >
            <div className="text-sm font-semibold text-stone-900">{t("Official schedule", "官方开课列表")}</div>
            <div className="mt-0.5 text-xs text-stone-500">
              {p.schedule
                ? t(
                    `${p.schedule.term} · ${p.schedule.offerings.length} offerings · fetched ${fetchedAt}`,
                    `${p.schedule.term} · ${p.schedule.offerings.length} 个开课条目 · 抓取于 ${fetchedAt}`,
                  )
                : t("No data yet", "还没有数据")}
            </div>
            <div className="mt-0.5 text-xs text-stone-400">{t("Source:", "来源")} classes.uwaterloo.ca/uwpcshtm.html</div>
          </button>
          <button
            type="button"
            onClick={() => p.setMode("custom")}
            className={cx("rounded-xl border p-3 text-left transition", p.mode === "custom" ? "border-stone-900 ring-1 ring-stone-900" : "border-stone-200 hover:border-stone-400")}
          >
            <div className="text-sm font-semibold text-stone-900">{t("Custom course list", "自定义课程列表")}</div>
            <div className="mt-0.5 text-xs text-stone-500">
              {t(
                `Paste any text and course codes are extracted automatically (${customCodes.length} found)`,
                `粘贴任意文本，自动提取课号（已识别 ${customCodes.length} 门）`,
              )}
            </div>
          </button>
        </div>

        {p.mode === "official" ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button onClick={refresh} disabled={refreshing}>
              {refreshing ? t("Refreshing…", "刷新中…") : t("Re-fetch from classes.uwaterloo.ca", "从 classes.uwaterloo.ca 重新抓取")}
            </Button>
            {refreshError && <span className="text-xs text-rose-600">{refreshError}</span>}
          </div>
        ) : (
          <textarea
            value={p.customText}
            onChange={(e) => p.setCustomText(e.target.value)}
            rows={5}
            placeholder={t(
              "For example:\nECE 327, ECE 350, ECE 457B, CS 486\nPHIL 215  STV 202\n(you can paste a whole block straight from Quest or a web page)",
              "例如：\nECE 327, ECE 350, ECE 457B, CS 486\nPHIL 215  STV 202\n（可以直接从 Quest 或网页复制一大段）",
            )}
            className="mt-3 w-full rounded-lg border border-stone-200 p-3 font-mono text-xs outline-none focus:border-stone-400"
          />
        )}
      </Card>

      {termRequired && (
        <Card title={t(`${p.targetLevel} required courses`, `${p.targetLevel} 学期必修`)}>
          <ul className="space-y-1.5">
            {requiredCodes.map((code) => {
              const ev = evalByCode.get(code);
              const offered = p.offered.has(code);
              const meta = ev && AVAILABILITY[ev.availability];
              return (
                <li key={code} className="flex flex-wrap items-center gap-2 text-sm">
                  <button type="button" onClick={() => openChain(code)} className="w-20 text-left font-mono font-semibold text-sky-800 hover:underline" title={t("View course chain", "查看课程链")}>
                    {formatCode(code)}
                  </button>
                  <span className="text-stone-700">{p.catalog.courses[code]?.title}</span>
                  {meta && <Badge tone={meta.tone}>{t(meta.label)}</Badge>}
                  <Badge tone={offered ? "green" : "stone"}>{offered ? t("Offered next term", "下学期开") : t("Not on the list", "列表里没有")}</Badge>
                </li>
              );
            })}
          </ul>
          {termRequired.items.some((i) => i.kind === "elective") && (
            <p className="mt-3 text-xs text-stone-500">
              {t("This term you also need: ", "另外这学期还要选：")}
              {termRequired.items
                .filter((i) => i.kind === "elective")
                .map((i) => (i.kind === "elective" ? t(`${i.n} × ${i.label}`, `${i.n} 门 ${i.label}`) : ""))
                .join(t(", ", "，"))}
            </p>
          )}
        </Card>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-stone-800">
          {t("Useful courses offered next term", "下学期开、并且对你有用的课")}{" "}
          <span className="font-normal text-stone-500">{t(`(${offeredEvals.length})`, `（${offeredEvals.length} 门）`)}</span>
        </h2>
        <CourseBrowser evals={offeredEvals} cz={p.cz} offerings={p.offered} plan={p.plan} onTogglePlan={p.onTogglePlan} />
      </div>
    </div>
  );
}
