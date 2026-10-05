import { useState } from "react";
import { LEVELS } from "../lib/codes";
import type { Text } from "../lib/i18n";
import { useT } from "../lib/i18n";
import type { Transcript } from "../lib/types";
import { UploadZone } from "./UploadZone";
import { Button, Card } from "./ui";

export interface ProgramOption {
  id: string;
  label: Text;
}

interface Props {
  programs: ProgramOption[];
  defaultProgram: string;
  defaultLevel: string;
  onBrowse: (opts: { program: string; level: string }) => void;
  onTranscript: (t: Transcript) => void;
}

export function StartScreen({ programs, defaultProgram, defaultLevel, onBrowse, onTranscript }: Props) {
  const t = useT();
  const [program, setProgram] = useState(defaultProgram);
  const [level, setLevel] = useState(defaultLevel);

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-5 py-12">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          {t("Pick a program and level to see what you can take", "先选专业和年级，看看能读什么课")}
        </h2>
        <p className="mt-2 text-stone-600">
          {t(
            "Without a transcript we only check level and program rules. Courses that need prior coursework stay locked until you upload or add those courses.",
            "不上传成绩单时，只按专业和年级判断。需要先修课的课程会显示为未满足，上传成绩单或手动添加已修课后会更准确。",
          )}
        </p>
      </div>

      <Card>
        <div className="space-y-4">
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium text-stone-700">{t("Program", "专业")}</span>
            <select
              value={program}
              onChange={(e) => setProgram(e.target.value)}
              className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-stone-400"
            >
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {t(p.label)}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium text-stone-700">{t("Level for the term you're planning", "要选课的学期年级")}</span>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-stone-400"
            >
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <Button variant="primary" onClick={() => onBrowse({ program, level })}>
            {t("Browse courses", "查看可选课程")}
          </Button>
        </div>
      </Card>

      <div className="relative text-center text-xs font-medium uppercase tracking-wide text-stone-400">
        <span className="relative z-10 bg-stone-100/70 px-3">{t("or", "或者")}</span>
        <span className="absolute inset-x-0 top-1/2 border-t border-stone-200" />
      </div>

      <div>
        <h3 className="text-lg font-semibold tracking-tight">{t("Upload your transcript for accurate eligibility", "上传成绩单，得到更准确的可选课")}</h3>
        <p className="mt-1 text-sm text-stone-600">
          {t(
            "We detect courses you've taken and are taking, then check degree requirements and every course's prerequisites.",
            "自动识别你修过和正在修的课，对照毕业要求和每门课的先修条件。",
          )}
        </p>
        <div className="mt-4">
          <UploadZone onParsed={onTranscript} />
        </div>
      </div>
    </main>
  );
}
