import { useState } from "react";
import { useT } from "../lib/i18n";
import { parseTranscriptLines } from "../lib/transcript";
import type { Transcript } from "../lib/types";
import { Button, cx } from "./ui";

export function UploadZone({ onParsed, compact }: { onParsed: (t: Transcript) => void; compact?: boolean }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [drag, setDrag] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pasted, setPasted] = useState("");

  const accept = (transcript: Transcript) => {
    if (!transcript.courses.length) {
      setError(
        t(
          "No courses were detected. Make sure this is the Unofficial Transcript exported from Quest (SSR_TSRPT.pdf).",
          "没有识别到任何课程。请确认这是 Quest 导出的 Unofficial Transcript（SSR_TSRPT.pdf）。",
        ),
      );
      return;
    }
    setError(undefined);
    onParsed(transcript);
  };

  const handleFile = async (file: File) => {
    setBusy(true);
    setError(undefined);
    try {
      const { pdfToLines } = await import("../lib/pdf");
      const lines = await pdfToLines(await file.arrayBuffer());
      accept(parseTranscriptLines(lines));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(t(`Failed to read the PDF: ${msg}`, `读取 PDF 失败：${msg}`));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files[0];
          if (f) void handleFile(f);
        }}
        className={cx(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed text-center transition",
          compact ? "px-3 py-4" : "px-6 py-12",
          drag ? "border-yellow-500 bg-yellow-50" : "border-stone-300 bg-stone-50 hover:border-stone-400",
        )}
      >
        <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => e.target.files?.[0] && void handleFile(e.target.files[0])} />
        <span className={cx("font-medium text-stone-800", compact ? "text-sm" : "text-base")}>
          {busy
            ? t("Reading…", "正在识别…")
            : compact
              ? t("Re-upload transcript PDF", "重新上传成绩单 PDF")
              : t("Drop or click to upload your transcript PDF", "拖入或点击上传成绩单 PDF")}
        </span>
        {!compact && (
          <span className="mt-1 text-sm text-stone-500">
            {t(
              "SSR_TSRPT.pdf exported from Quest → Academics → Unofficial Transcript. It's parsed locally in your browser and never uploaded.",
              "Quest → Academics → Unofficial Transcript 导出的 SSR_TSRPT.pdf，只在浏览器本地解析，不会上传。",
            )}
          </span>
        )}
      </label>
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {!compact && (
        <div className="text-center">
          <Button variant="ghost" onClick={() => setShowPaste((v) => !v)}>
            {showPaste ? t("Hide", "收起") : t("Or paste transcript text", "或者粘贴成绩单文本")}
          </Button>
        </div>
      )}
      {showPaste && (
        <div className="space-y-2">
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            rows={8}
            placeholder={"Fall 2024\nLevel: 1A Form Of Study: Enrolment\nECE 105 Classical Mechanics 0.50 0.50 82\n..."}
            className="w-full rounded-lg border border-stone-200 p-3 font-mono text-xs outline-none focus:border-stone-400"
          />
          <Button variant="primary" onClick={() => accept(parseTranscriptLines(pasted.split(/\r?\n/)))} disabled={!pasted.trim()}>
            {t("Parse text", "解析文本")}
          </Button>
        </div>
      )}
    </div>
  );
}
