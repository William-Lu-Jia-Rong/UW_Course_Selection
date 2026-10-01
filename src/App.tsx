import { useEffect, useMemo, useState } from "react";
import { CourseBrowser } from "./components/CourseBrowser";
import { NextTermView, type OfferingMode } from "./components/NextTermView";
import { PlanPanel } from "./components/PlanPanel";
import { ProgressView } from "./components/ProgressView";
import { TranscriptPanel, type Settings } from "./components/TranscriptPanel";
import { UploadZone } from "./components/UploadZone";
import { cx } from "./components/ui";
import { extractCodes } from "./lib/codes";
import { buildContext, evaluateCourse } from "./lib/evaluate";
import { buildCategorizer, computeProgress } from "./lib/requirements";
import { usePersistentState } from "./lib/storage";
import { suggestedTargetLevel } from "./lib/transcript";
import type { Catalog, Offering, Schedule, Transcript } from "./lib/types";

const PROGRAMS = ["H-Computer Engineering"];
type Tab = "next" | "eligible" | "progress";

export default function App() {
  const [catalog, setCatalog] = useState<Catalog>();
  const [loadError, setLoadError] = useState<string>();
  const [transcript, setTranscript] = usePersistentState<Transcript | null>("transcript", null);
  const [settings, setSettings] = usePersistentState<Settings>("settings", { includeInProgress: true });
  const [plan, setPlan] = usePersistentState<string[]>("plan", []);
  const [mode, setMode] = usePersistentState<OfferingMode>("offeringMode", "official");
  const [customText, setCustomText] = usePersistentState("customOfferings", "");
  const [liveSchedule, setLiveSchedule] = usePersistentState<Schedule | null>("liveSchedule", null);
  const [snapshot, setSnapshot] = useState<Schedule | null>(null);
  const [tab, setTab] = usePersistentState<Tab>("tab", "next");

  useEffect(() => {
    fetch("/data/catalog.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then(setCatalog)
      .catch((e) => setLoadError(`加载 catalog.json 失败（先运行 npm run data）：${e.message}`));
    fetch("/data/schedule.json")
      .then((r) => (r.ok ? r.json() : null))
      .then(setSnapshot)
      .catch(() => setSnapshot(null));
  }, []);

  const schedule = liveSchedule && (!snapshot || liveSchedule.fetchedAt > snapshot.fetchedAt) ? liveSchedule : snapshot;
  const cz = useMemo(() => catalog && buildCategorizer(catalog), [catalog]);
  const suggestedLevel = transcript ? suggestedTargetLevel(transcript) : "1A";
  const level = settings.levelOverride ?? suggestedLevel;

  const offered = useMemo(() => {
    const map = new Map<string, Offering[]>();
    if (!catalog) return map;
    if (mode === "official") {
      for (const o of schedule?.offerings ?? []) map.set(o.code, [...(map.get(o.code) ?? []), o]);
    } else {
      for (const code of extractCodes(customText, (c) => !!catalog.courses[c])) {
        map.set(code, [{ code, title: catalog.courses[code].title, campus: "自定义列表" }]);
      }
    }
    return map;
  }, [catalog, mode, schedule, customText]);

  const evals = useMemo(() => {
    if (!catalog || !cz || !transcript) return [];
    const ctx = buildContext(catalog, transcript, { includeInProgress: settings.includeInProgress, level, programs: PROGRAMS, concurrent: plan });
    // 0-unit information sessions never show on transcripts; only the one for the planned term matters.
    const staleInfoSession = (c: string) => catalog.courses[c].units === 0 && cz.requiredTerm.has(c) && cz.requiredTerm.get(c) !== level;
    const codes = new Set([...cz.categories.keys(), ...plan, ...(mode === "custom" ? offered.keys() : [])]);
    return [...codes]
      .filter((c) => catalog.courses[c] && !staleInfoSession(c))
      .map((c) => evaluateCourse(catalog.courses[c], ctx));
  }, [catalog, cz, transcript, settings.includeInProgress, level, plan, mode, offered]);

  const evalMap = useMemo(() => new Map(evals.map((e) => [e.course.code, e])), [evals]);
  const progress = useMemo(() => catalog && cz && transcript && computeProgress(catalog, transcript, cz), [catalog, cz, transcript]);
  const togglePlan = (code: string) => setPlan((p) => (p.includes(code) ? p.filter((c) => c !== code) : [...p, code]));

  if (loadError) return <div className="p-10 text-rose-700">{loadError}</div>;
  if (!catalog || !cz) return <div className="p-10 text-stone-500">正在加载课程日历数据…</div>;

  const eligibleCount = evals.filter((e) => e.availability === "eligible" || e.availability === "needsCoreq").length;
  const offeredEligible = evals.filter((e) => offered.has(e.course.code) && (e.availability === "eligible" || e.availability === "needsCoreq")).length;

  return (
    <div className="min-h-screen bg-stone-100/70 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-stone-900 text-sm font-bold text-yellow-400">UW</div>
            <div>
              <h1 className="text-base font-semibold leading-tight">选课助手</h1>
              <p className="text-xs text-stone-500">{catalog.program.title}</p>
            </div>
          </div>
          <p className="text-xs text-stone-400">
            Academic Calendar 生效于 {catalog.program.catalogActivationDate} · 数据抓取 {new Date(catalog.meta.fetchedAt).toLocaleDateString("zh-CN")}
          </p>
        </div>
      </header>

      {!transcript ? (
        <main className="mx-auto max-w-2xl px-5 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">先上传你的成绩单</h2>
          <p className="mt-2 text-stone-600">
            自动识别你修过和正在修的课，对照 Computer Engineering 的毕业要求和每门课的先修条件，算出你下学期能选哪些课。
          </p>
          <div className="mt-8">
            <UploadZone
              onParsed={(t) => {
                setTranscript(t);
                setSettings({ ...settings, levelOverride: undefined });
              }}
            />
          </div>
        </main>
      ) : (
        <main className="mx-auto grid max-w-7xl gap-5 px-5 py-6 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
            <TranscriptPanel
              catalog={catalog}
              transcript={transcript}
              setTranscript={setTranscript}
              settings={settings}
              setSettings={setSettings}
              suggestedLevel={suggestedLevel}
            />
            <PlanPanel plan={plan} evals={evalMap} offered={offered} onRemove={togglePlan} onClear={() => setPlan([])} />
          </aside>

          <div className="min-w-0 space-y-5">
            <nav className="flex gap-1 rounded-xl border border-stone-200 bg-white p-1">
              {(
                [
                  ["next", `下学期选课`, offeredEligible],
                  ["eligible", "所有能选的课", eligibleCount],
                  ["progress", "毕业进度", undefined],
                ] as const
              ).map(([key, label, n]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={cx(
                    "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition",
                    tab === key ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100",
                  )}
                >
                  {label}
                  {n !== undefined && <span className={cx("ml-1.5 tabular-nums", tab === key ? "text-yellow-400" : "text-stone-400")}>{n}</span>}
                </button>
              ))}
            </nav>

            {tab === "next" && (
              <NextTermView
                catalog={catalog}
                schedule={schedule}
                setSchedule={setLiveSchedule}
                mode={mode}
                setMode={setMode}
                customText={customText}
                setCustomText={setCustomText}
                offered={offered}
                evals={evals}
                cz={cz}
                plan={plan}
                onTogglePlan={togglePlan}
                targetLevel={level}
              />
            )}
            {tab === "eligible" && <CourseBrowser evals={evals} cz={cz} plan={plan} onTogglePlan={togglePlan} offerings={offered} />}
            {tab === "progress" && progress && <ProgressView progress={progress} catalog={catalog} />}
          </div>
        </main>
      )}
    </div>
  );
}
