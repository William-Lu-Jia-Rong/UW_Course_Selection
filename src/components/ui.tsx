import type { ReactNode } from "react";
import type { Availability } from "../lib/evaluate";
import { LANGS, type Lang, type Text } from "../lib/i18n";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-xl border border-stone-200 bg-white shadow-sm", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-2 border-b border-stone-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-stone-800">{title}</h2>
          {actions}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Badge({ children, tone = "stone", title }: { children: ReactNode; tone?: Tone; title?: string }) {
  return (
    <span title={title} className={cx("inline-flex items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset", TONES[tone])}>
      {children}
    </span>
  );
}

type Tone = "stone" | "green" | "amber" | "red" | "blue" | "violet" | "gold" | "teal";
const TONES: Record<Tone, string> = {
  stone: "bg-stone-50 text-stone-600 ring-stone-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-rose-50 text-rose-700 ring-rose-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  gold: "bg-yellow-50 text-yellow-800 ring-yellow-300",
  teal: "bg-teal-50 text-teal-700 ring-teal-200",
};

export const AVAILABILITY: Record<Availability, { label: Text; tone: Tone; hint: Text }> = {
  eligible: {
    label: { en: "Eligible", zh: "可选" },
    tone: "green",
    hint: { en: "Prerequisites met and no antirequisite conflict", zh: "先修/反修条件都满足" },
  },
  needsCoreq: {
    label: { en: "Needs coreq", zh: "需同修" },
    tone: "teal",
    hint: { en: "Prerequisites met, but a corequisite must be taken in the same term", zh: "先修满足，但有同修课（corequisite）需要同一学期一起选" },
  },
  check: {
    label: { en: "Check", zh: "需确认" },
    tone: "amber",
    hint: {
      en: "Some conditions can't be checked automatically (e.g. language skills, special permission, department consent); please confirm manually",
      zh: "有无法自动判断的条件（如语言能力、特殊许可、需要院系同意），请人工确认",
    },
  },
  restricted: {
    label: { en: "Restricted", zh: "限制开放" },
    tone: "red",
    hint: { en: "Schedule notes limit enrolment to specific students (e.g. double degree, GBDA, Architecture)", zh: "开课备注写明只对特定学生开放（如双学位、GBDA、建筑系等）" },
  },
  locked: {
    label: { en: "Not met", zh: "未满足" },
    tone: "stone",
    hint: { en: "Prerequisite courses or level/program conditions not met", zh: "先修课或年级/专业条件不满足" },
  },
  antireq: {
    label: { en: "Antireq conflict", zh: "反修冲突" },
    tone: "red",
    hint: { en: "You've taken (or plan to take) one of its antirequisites", zh: "你已修过（或计划修）它的反修课（antirequisite）" },
  },
  taken: {
    label: { en: "Taken", zh: "已修" },
    tone: "blue",
    hint: { en: "Already completed or in progress", zh: "已经修过或正在修" },
  },
};

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-stone-700">
      <span className={cx("relative inline-flex h-5 w-9 shrink-0 rounded-full transition", checked ? "bg-stone-900" : "bg-stone-300")}>
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className={cx("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition", checked ? "left-4.5" : "left-0.5")} />
      </span>
      {label}
    </label>
  );
}

export function Chip({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: ReactNode; count?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
        active ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 bg-white text-stone-600 hover:border-stone-400",
      )}
    >
      {children}
      {count !== undefined && <span className={cx("tabular-nums", active ? "text-stone-300" : "text-stone-400")}>{count}</span>}
    </button>
  );
}

export function LangSwitch({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <div className="flex rounded-lg border border-stone-200 bg-stone-50 p-0.5 text-xs" role="radiogroup" aria-label="Language / 语言">
      {LANGS.map((l) => (
        <button
          key={l.id}
          type="button"
          role="radio"
          aria-checked={lang === l.id}
          lang={l.id}
          onClick={() => onChange(l.id)}
          className={cx("rounded-md px-2.5 py-1 font-medium transition", lang === l.id ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800")}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

export function Button({ children, onClick, variant = "secondary", disabled, className }: { children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "ghost"; disabled?: boolean; className?: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-stone-900 text-white hover:bg-stone-700",
        variant === "secondary" && "border border-stone-200 bg-white text-stone-700 hover:border-stone-400",
        variant === "ghost" && "text-stone-500 hover:bg-stone-100 hover:text-stone-800",
        className,
      )}
    >
      {children}
    </button>
  );
}
