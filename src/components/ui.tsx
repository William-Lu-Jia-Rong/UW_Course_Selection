import type { ReactNode } from "react";
import type { Availability } from "../lib/evaluate";

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

export const AVAILABILITY: Record<Availability, { label: string; tone: Tone; hint: string }> = {
  eligible: { label: "可选", tone: "green", hint: "先修/反修条件都满足" },
  needsCoreq: { label: "需同修", tone: "teal", hint: "先修满足，但有同修课（corequisite）需要同一学期一起选" },
  check: { label: "需确认", tone: "amber", hint: "有无法自动判断的条件（如语言能力、特殊许可），请人工确认" },
  locked: { label: "未满足", tone: "stone", hint: "先修课或年级/专业条件不满足" },
  antireq: { label: "反修冲突", tone: "red", hint: "你已修过（或计划修）它的反修课（antirequisite）" },
  taken: { label: "已修", tone: "blue", hint: "已经修过或正在修" },
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
