import { useFlowRating } from "../lib/uwflow";
import { Badge } from "./ui";

const pct = (v: number | null) => (v === null ? "–" : `${Math.round(v * 100)}%`);
const tone = (liked: number | null) => (liked === null ? "stone" : liked >= 0.75 ? "green" : liked >= 0.5 ? "amber" : "red");

/** UWFlow liked / easy / useful percentages; `compact` shows only liked. */
export function FlowRating({ code, compact }: { code: string; compact?: boolean }) {
  const state = useFlowRating(code);
  if (state.status === "loading") return <span className="text-[11px] text-stone-400">UWFlow…</span>;
  if (state.status === "error") return <span className="text-[11px] text-stone-400" title="请求 uwflow.com 失败，刷新页面重试">UWFlow 加载失败</span>;

  const r = state.rating;
  if (!r || r.filled === 0) return <Badge>{r ? "UWFlow 暂无评分" : "UWFlow 无此课"}</Badge>;

  const title = `UWFlow：${r.filled} 人评分，${r.comments} 条评论`;
  if (compact) {
    return (
      <Badge tone={tone(r.liked)} title={title}>
        喜欢 {pct(r.liked)}
      </Badge>
    );
  }
  return (
    <Badge tone={tone(r.liked)} title={title}>
      UWFlow 喜欢 {pct(r.liked)} · 简单 {pct(r.easy)} · 有用 {pct(r.useful)}
      <span className="ml-1 font-normal opacity-70">({r.filled})</span>
    </Badge>
  );
}
