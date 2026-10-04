import { useState } from "react";
import { LEVELS, formatCode, normalizeCode } from "../lib/codes";
import { useT } from "../lib/i18n";
import type { Catalog, CourseStatus, Transcript } from "../lib/types";
import type { ProgramOption } from "./StartScreen";
import { UploadZone } from "./UploadZone";
import { Button, Card, Toggle, cx } from "./ui";

const STATUS_STYLE: Record<CourseStatus, string> = {
  completed: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  inProgress: "bg-sky-50 text-sky-800 ring-sky-200",
  failed: "bg-rose-50 text-rose-700 ring-rose-200 line-through",
  other: "bg-stone-50 text-stone-600 ring-stone-200",
};

const MANUAL_TERM = "Manual";

export interface Settings {
  includeInProgress: boolean;
  levelOverride?: string;
  program?: string;
  /** True when the user started without a transcript (program + level only). */
  browseOnly?: boolean;
}

interface Props {
  catalog: Catalog;
  transcript: Transcript;
  setTranscript: (t: Transcript | null) => void;
  settings: Settings;
  setSettings: (s: Settings) => void;
  suggestedLevel: string;
  programs: ProgramOption[];
  browseOnly?: boolean;
}

export function TranscriptPanel({
  catalog,
  transcript,
  setTranscript,
  settings,
  setSettings,
  suggestedLevel,
  programs,
  browseOnly,
}: Props) {
  const t = useT();
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<CourseStatus>("completed");
  const [error, setError] = useState<string>();

  const byTerm = new Map<string, Transcript["courses"]>();
  for (const c of transcript.courses) {
    const term = c.manual ? MANUAL_TERM : c.term;
    byTerm.set(term, [...(byTerm.get(term) ?? []), c]);
  }

  const addCourse = () => {
    const norm = normalizeCode(code);
    if (!norm) return;
    if (!catalog.courses[norm]) {
      setError(t(`${formatCode(norm)} is not in the calendar`, `日历里没有 ${formatCode(norm)}`));
      return;
    }
    setError(undefined);
    setTranscript({
      ...transcript,
      courses: [...transcript.courses, { code: norm, title: catalog.courses[norm].title, term: MANUAL_TERM, status, manual: true }],
    });
    setCode("");
  };

  const removeAt = (idx: number) => setTranscript({ ...transcript, courses: transcript.courses.filter((_, i) => i !== idx) });
  const level = settings.levelOverride ?? suggestedLevel;
  const program = settings.program ?? programs[0]?.id;
  const programLabel = programs.find((p) => p.id === program);

  const clearLabel = browseOnly
    ? t("Leave browse mode?", "退出浏览模式？")
    : t("Clear the imported transcript?", "清除已导入的成绩单？");

  return (
    <Card
      title={browseOnly ? t("Browse by program & level", "按专业和年级浏览") : t("My transcript", "我的成绩单")}
      actions={
        <Button variant="ghost" onClick={() => confirm(clearLabel) && setTranscript(null)}>
          {browseOnly ? t("Back", "返回") : t("Clear", "清除")}
        </Button>
      }
    >
      <div className="space-y-4">
        {!browseOnly && (
          <div className="text-sm">
            <div className="font-medium text-stone-900">{transcript.name ?? t("(name not detected)", "（未识别姓名）")}</div>
            <div className="text-stone-500">{transcript.program ?? programLabel?.label.en ?? "Computer Engineering"}</div>
            {transcript.cumulativeAvg !== undefined && (
              <div className="text-stone-500">
                {t("Cumulative average", "累计均分")} {transcript.cumulativeAvg.toFixed(2)}
              </div>
            )}
          </div>
        )}

        <div className="space-y-3 rounded-lg bg-stone-50 p-3">
          <label className="flex items-center justify-between gap-2 text-sm text-stone-700">
            <span>{t("Program", "专业")}</span>
            <select
              value={program}
              onChange={(e) => setSettings({ ...settings, program: e.target.value })}
              className="rounded-md border border-stone-200 bg-white px-2 py-1 text-sm"
            >
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {t(p.label)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center justify-between gap-2 text-sm text-stone-700">
            <span>{t("Level for the term you're planning", "要选课的学期年级")}</span>
            <select
              value={level}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  levelOverride: browseOnly || e.target.value !== suggestedLevel ? e.target.value : undefined,
                })
              }
              className="rounded-md border border-stone-200 bg-white px-2 py-1 text-sm"
            >
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                  {!browseOnly && l === suggestedLevel ? t(" (auto)", "（自动）") : ""}
                </option>
              ))}
            </select>
          </label>
          {!browseOnly && (
            <Toggle
              checked={settings.includeInProgress}
              onChange={(v) => setSettings({ ...settings, includeInProgress: v })}
              label={t("Count in-progress courses as completed", "把正在修的课当作已完成")}
            />
          )}
        </div>

        {browseOnly ? (
          <p className="text-xs leading-relaxed text-stone-500">
            {t(
              "No transcript loaded. You can still add completed courses below, or upload a PDF for full prerequisite checking.",
              "尚未加载成绩单。可以在下方手动添加已修课，或上传 PDF 以完整检查先修条件。",
            )}
          </p>
        ) : (
          <div className="space-y-3">
            {[...byTerm].map(([term, courses]) => (
              <div key={term}>
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-stone-400">{term === MANUAL_TERM ? t("Added manually", "手动添加") : term}</div>
                <div className="flex flex-wrap gap-1">
                  {courses.map((c) => {
                    const idx = transcript.courses.indexOf(c);
                    return (
                      <span
                        key={idx}
                        title={`${c.title}${c.grade ? ` · ${c.grade}` : ""}`}
                        className={cx("group inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs ring-1 ring-inset", STATUS_STYLE[c.status])}
                      >
                        <span className="font-mono">{formatCode(c.code)}</span>
                        {c.grade && <span className="opacity-60">{c.grade}</span>}
                        <button type="button" onClick={() => removeAt(idx)} className="hidden text-stone-400 hover:text-rose-600 group-hover:inline" aria-label={t("Remove", "移除")}>
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="flex gap-3 text-[11px] text-stone-500">
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-emerald-300" />{t("Completed", "已完成")}</span>
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-sky-300" />{t("In progress", "在修")}</span>
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-rose-300" />{t("Failed", "未通过")}</span>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <div className="text-xs font-medium text-stone-500">
            {browseOnly
              ? t("Optionally add courses you've already taken", "可选：手动添加已修课程")
              : t("Add courses manually (transfer credits, courses missing from the transcript, etc.)", "手动补充课程（转学分、成绩单没显示的等）")}
          </div>
          <div className="flex gap-1.5">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCourse()}
              placeholder={t("e.g. CHE 102", "例如 CHE 102")}
              className="min-w-0 flex-1 rounded-md border border-stone-200 px-2 py-1 text-sm outline-none focus:border-stone-400"
            />
            <select value={status} onChange={(e) => setStatus(e.target.value as CourseStatus)} className="rounded-md border border-stone-200 px-1 text-sm">
              <option value="completed">{t("Completed", "已完成")}</option>
              <option value="inProgress">{t("In progress", "在修")}</option>
            </select>
            <Button onClick={addCourse}>{t("Add", "添加")}</Button>
          </div>
          {error && <p className="text-xs text-rose-600">{error}</p>}
        </div>

        {browseOnly && transcript.courses.length > 0 && (
          <div className="space-y-3">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-stone-400">{t("Added manually", "手动添加")}</div>
            <div className="flex flex-wrap gap-1">
              {transcript.courses.map((c, idx) => (
                <span
                  key={idx}
                  title={c.title}
                  className={cx("group inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs ring-1 ring-inset", STATUS_STYLE[c.status])}
                >
                  <span className="font-mono">{formatCode(c.code)}</span>
                  <button type="button" onClick={() => removeAt(idx)} className="hidden text-stone-400 hover:text-rose-600 group-hover:inline" aria-label={t("Remove", "移除")}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        <UploadZone
          compact
          onParsed={(parsed) => {
            setTranscript(parsed);
            setSettings({ ...settings, levelOverride: undefined, browseOnly: false });
          }}
        />
      </div>
    </Card>
  );
}
