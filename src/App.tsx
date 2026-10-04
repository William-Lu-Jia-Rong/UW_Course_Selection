import { useEffect, useMemo, useState } from "react";
import { CareerView } from "./components/CareerView";
import { CourseBrowser } from "./components/CourseBrowser";
import { ChainProvider } from "./components/PrereqChain";
import { NextTermView, type OfferingMode } from "./components/NextTermView";
import { PlanPanel } from "./components/PlanPanel";
import { ProgressView } from "./components/ProgressView";
import type { ProgramOption } from "./components/StartScreen";
import { StartScreen } from "./components/StartScreen";
import { TranscriptPanel, type Settings } from "./components/TranscriptPanel";
import { LangSwitch, cx } from "./components/ui";
import { extractCodes } from "./lib/codes";
import { applyOfferingIssue, buildContext, evaluateCourse } from "./lib/evaluate";
import { DEFAULT_LANG, LangProvider, locale, translator, type Lang } from "./lib/i18n";
import { isCancelled, offeringIssue } from "./lib/offerings";
import { buildCategorizer, computeProgress } from "./lib/requirements";
import { usePersistentState } from "./lib/storage";
import { emptyTranscript, suggestedTargetLevel } from "./lib/transcript";
import type { Catalog, Offering, Schedule, Transcript } from "./lib/types";

const PROGRAMS: ProgramOption[] = [
  { id: "H-Computer Engineering", label: { en: "Computer Engineering", zh: "计算机工程" } },
];
const DEFAULT_PROGRAM = PROGRAMS[0].id;
type Tab = "next" | "career" | "eligible" | "progress";

export default function App() {
  const [lang, setLang] = usePersistentState<Lang>("lang", DEFAULT_LANG);
  const t = useMemo(() => translator(lang), [lang]);
  const [catalog, setCatalog] = useState<Catalog>();
  const [loadError, setLoadError] = useState<string>();
  const [transcript, setTranscript] = usePersistentState<Transcript | null>("transcript", null);
  const [settings, setSettings] = usePersistentState<Settings>("settings", {
    includeInProgress: true,
    program: DEFAULT_PROGRAM,
  });
  const [plan, setPlan] = usePersistentState<string[]>("plan", []);
  const [mode, setMode] = usePersistentState<OfferingMode>("offeringMode", "official");
  const [customText, setCustomText] = usePersistentState("customOfferings", "");
  const [liveSchedule, setLiveSchedule] = usePersistentState<Schedule | null>("liveSchedule", null);
  const [snapshot, setSnapshot] = useState<Schedule | null>(null);
  const [tab, setTab] = usePersistentState<Tab>("tab", "next");
  const [careers, setCareers] = usePersistentState<string[]>("careers", []);

  useEffect(() => {
    fetch("/data/catalog.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then(setCatalog)
      .catch((e) => setLoadError(e.message));
    fetch("/data/schedule.json")
      .then((r) => (r.ok ? r.json() : null))
      .then(setSnapshot)
      .catch(() => setSnapshot(null));
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    document.title = t("UW Course Planner · Computer Engineering", "UW 选课助手 · Computer Engineering");
  }, [lang, t]);

  const schedule = liveSchedule && (!snapshot || liveSchedule.fetchedAt > snapshot.fetchedAt) ? liveSchedule : snapshot;
  const cz = useMemo(() => catalog && buildCategorizer(catalog), [catalog]);
  const browseOnly = !!settings.browseOnly;
  const suggestedLevel = transcript && !browseOnly ? suggestedTargetLevel(transcript) : "1A";
  const level = settings.levelOverride ?? suggestedLevel;
  const program = settings.program ?? DEFAULT_PROGRAM;
  const programs = [program];

  const offered = useMemo(() => {
    const map = new Map<string, Offering[]>();
    if (!catalog) return map;
    if (mode === "official") {
      for (const o of schedule?.offerings ?? []) if (!isCancelled(o)) map.set(o.code, [...(map.get(o.code) ?? []), o]);
    } else {
      for (const code of extractCodes(customText, (c) => !!catalog.courses[c])) {
        map.set(code, [{ code, title: catalog.courses[code].title, campus: t("Custom list", "自定义列表") }]);
      }
    }
    return map;
  }, [catalog, mode, schedule, customText, t]);

  const ctx = useMemo(
    () => catalog && transcript && buildContext(catalog, transcript, { includeInProgress: settings.includeInProgress, level, programs, concurrent: plan }),
    [catalog, transcript, settings.includeInProgress, level, program, plan],
  );

  const evals = useMemo(() => {
    if (!catalog || !cz || !ctx) return [];
    // 0-unit information sessions never show on transcripts; only the one for the planned term matters.
    const staleInfoSession = (c: string) => catalog.courses[c].units === 0 && cz.requiredTerm.has(c) && cz.requiredTerm.get(c) !== level;
    const codes = new Set([...cz.categories.keys(), ...plan, ...(mode === "custom" ? offered.keys() : [])]);
    return [...codes]
      .filter((c) => catalog.courses[c] && !staleInfoSession(c))
      .map((c) => applyOfferingIssue(evaluateCourse(catalog.courses[c], ctx), offeringIssue(offered.get(c))));
  }, [catalog, cz, ctx, level, plan, mode, offered]);

  const evalMap = useMemo(() => new Map(evals.map((e) => [e.course.code, e])), [evals]);
  const progress = useMemo(() => catalog && cz && transcript && computeProgress(catalog, transcript, cz), [catalog, cz, transcript]);
  const togglePlan = (code: string) => setPlan((p) => (p.includes(code) ? p.filter((c) => c !== code) : [...p, code]));
  const addToPlan = (codes: string[]) => setPlan((p) => [...p, ...codes.filter((c) => !p.includes(c))]);

  const startWithTranscript = (parsed: Transcript) => {
    setTranscript(parsed);
    setSettings({
      ...settings,
      levelOverride: undefined,
      program: settings.program ?? DEFAULT_PROGRAM,
      browseOnly: false,
    });
    setTab("next");
  };

  const startBrowse = ({ program: prog, level: lvl }: { program: string; level: string }) => {
    const label = PROGRAMS.find((p) => p.id === prog)?.label;
    setTranscript(emptyTranscript(label ? (lang === "zh" ? label.zh : label.en) : prog));
    setSettings({ ...settings, includeInProgress: true, levelOverride: lvl, program: prog, browseOnly: true });
    setPlan([]);
    setTab("eligible");
  };

  const status = (body: string, className: string) => (
    <div className="flex items-start justify-between gap-3 p-10">
      <div className={className}>{body}</div>
      <LangSwitch lang={lang} onChange={setLang} />
    </div>
  );
  if (loadError) return status(t(`Failed to load catalog.json (run npm run data first): ${loadError}`, `加载 catalog.json 失败（先运行 npm run data）：${loadError}`), "text-rose-700");
  if (!catalog || !cz) return status(t("Loading Academic Calendar data…", "正在加载课程日历数据…"), "text-stone-500");

  const eligibleCount = evals.filter((e) => e.availability === "eligible" || e.availability === "needsCoreq").length;
  const offeredEligible = evals.filter((e) => offered.has(e.course.code) && (e.availability === "eligible" || e.availability === "needsCoreq")).length;

  return (
    <LangProvider value={lang}>
    <ChainProvider catalog={catalog} cz={cz} ctx={ctx || undefined}>
    <div className="min-h-screen bg-stone-100/70 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-stone-900 text-sm font-bold text-yellow-400">UW</div>
            <div>
              <h1 className="text-base font-semibold leading-tight">{t("Course Planner", "选课助手")}</h1>
              <p className="text-xs text-stone-500">{catalog.program.title}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs text-stone-400">
              {t(
                `Academic Calendar effective ${catalog.program.catalogActivationDate} · Data fetched ${new Date(catalog.meta.fetchedAt).toLocaleDateString(locale(lang))}`,
                `Academic Calendar 生效于 ${catalog.program.catalogActivationDate} · 数据抓取 ${new Date(catalog.meta.fetchedAt).toLocaleDateString(locale(lang))}`,
              )}
            </p>
            <LangSwitch lang={lang} onChange={setLang} />
          </div>
        </div>
      </header>

      {!transcript ? (
        <StartScreen
          programs={PROGRAMS}
          defaultProgram={program}
          defaultLevel={level}
          onBrowse={startBrowse}
          onTranscript={startWithTranscript}
        />
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
              programs={PROGRAMS}
              browseOnly={browseOnly}
            />
            <PlanPanel plan={plan} evals={evalMap} offered={offered} onRemove={togglePlan} onClear={() => setPlan([])} />
          </aside>

          <div className="min-w-0 space-y-5">
            {browseOnly && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {t(
                  `Browsing as ${PROGRAMS.find((p) => p.id === program)?.label.en ?? program} · level ${level}. Only level/program rules are checked — upload a transcript for prerequisite-aware results.`,
                  `当前按「${PROGRAMS.find((p) => p.id === program)?.label.zh ?? program} · ${level}」浏览。仅校验专业和年级；上传成绩单后才会按先修课判断。`,
                )}
              </div>
            )}
            <nav className="flex gap-1 rounded-xl border border-stone-200 bg-white p-1">
              {(
                [
                  ["next", t("Next term", "下学期选课"), offeredEligible],
                  ["career", t("By career", "按方向推荐"), undefined],
                  ["eligible", t("All eligible", "所有能选的课"), eligibleCount],
                  ["progress", t("Degree progress", "毕业进度"), undefined],
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
            {tab === "career" && progress && (
              <CareerView
                catalog={catalog}
                cz={cz}
                evals={evals}
                offered={offered}
                progress={progress}
                level={level}
                careers={careers}
                setCareers={setCareers}
                plan={plan}
                onTogglePlan={togglePlan}
                onAddToPlan={addToPlan}
              />
            )}
            {tab === "eligible" && <CourseBrowser evals={evals} cz={cz} plan={plan} onTogglePlan={togglePlan} offerings={offered} />}
            {tab === "progress" && progress && <ProgressView progress={progress} catalog={catalog} />}
          </div>
        </main>
      )}
    </div>
    </ChainProvider>
    </LangProvider>
  );
}
