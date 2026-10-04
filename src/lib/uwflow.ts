import { useEffect, useSyncExternalStore } from "react";

export const UWFLOW_COURSE_URL = "https://uwflow.com/course/";
const ENDPOINT = "https://uwflow.com/graphql";
const STORAGE_KEY = "uwcp:v1:uwflow";
const TTL_MS = 3 * 24 * 3600 * 1000;
const BATCH_SIZE = 100;

export interface FlowRating {
  liked: number | null;
  easy: number | null;
  useful: number | null;
  filled: number;
  comments: number;
}

/** `rating: null` means UWFlow has no page for the course. */
export type FlowState = { status: "loading" } | { status: "error" } | { status: "ok"; rating: FlowRating | null };

interface Cached {
  rating: FlowRating | null;
  at: number;
}

const LOADING: FlowState = { status: "loading" };
const ERROR: FlowState = { status: "error" };

const cache = new Map<string, Cached>(loadCache());
const states = new Map<string, FlowState>([...cache].map(([code, c]) => [code, { status: "ok", rating: c.rating }]));
const pending = new Set<string>();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

function loadCache(): [string, Cached][] {
  try {
    const now = Date.now();
    const raw: Record<string, Cached> = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return Object.entries(raw).filter(([, v]) => now - v.at < TTL_MS);
  } catch {
    return [];
  }
}

function saveCache() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(cache)));
  } catch {
    // Quota errors only cost a refetch next session.
  }
}

function emit() {
  for (const l of listeners) l();
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

interface RawCourse {
  code: string;
  rating: { liked: unknown; easy: unknown; useful: unknown; filled_count: number | null; comment_count: number | null } | null;
}

export async function fetchFlowRatings(codes: string[]): Promise<Map<string, FlowRating | null>> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: "query ($codes: [String!]) { course(where: {code: {_in: $codes}}) { code rating { liked easy useful filled_count comment_count } } }",
      variables: { codes: codes.map((c) => c.toLowerCase()) },
    }),
  });
  if (!res.ok) throw new Error(`UWFlow HTTP ${res.status}`);
  const json: { data?: { course: RawCourse[] }; errors?: { message: string }[] } = await res.json();
  if (!json.data) throw new Error(json.errors?.[0]?.message ?? "UWFlow returned no data");

  const out = new Map<string, FlowRating | null>(codes.map((c) => [c, null]));
  for (const c of json.data.course) {
    const r = c.rating;
    out.set(c.code.toUpperCase(), {
      liked: num(r?.liked),
      easy: num(r?.easy),
      useful: num(r?.useful),
      filled: r?.filled_count ?? 0,
      comments: r?.comment_count ?? 0,
    });
  }
  return out;
}

async function flush() {
  timer = undefined;
  const codes = [...pending];
  pending.clear();
  for (let i = 0; i < codes.length; i += BATCH_SIZE) {
    const batch = codes.slice(i, i + BATCH_SIZE);
    try {
      const now = Date.now();
      for (const [code, rating] of await fetchFlowRatings(batch)) {
        cache.set(code, { rating, at: now });
        states.set(code, { status: "ok", rating });
      }
      saveCache();
    } catch {
      for (const code of batch) states.set(code, ERROR);
    }
    emit();
  }
}

function request(code: string) {
  if (states.has(code)) return;
  states.set(code, LOADING);
  pending.add(code);
  timer ??= setTimeout(flush, 30);
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Rating for a catalog code like "ECE250"; requests are batched across all mounted rows. */
export function useFlowRating(code: string): FlowState {
  useEffect(() => request(code), [code]);
  return useSyncExternalStore(subscribe, () => states.get(code) ?? LOADING);
}
