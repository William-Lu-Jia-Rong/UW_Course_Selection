import { directLinks, STRENGTH, type DependentsIndex, type Link } from "./chain";
import type { Catalog } from "./types";

export const NODE_W = 116;
export const ROW_H = 116;
const DUMMY_W = 30;
const PAD_X = 90;
const PAD_Y = 70;

export interface GraphNode {
  id: string;
  /** Cross-listed codes merged into this node, display code first. */
  codes: string[];
  /** 0 is the center course, negative rows are prerequisites, positive rows are later courses. */
  row: number;
  x: number;
  y: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  link: Link;
  points: [number, number][];
}

export interface ChainGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  rows: { row: number; y: number }[];
  width: number;
  height: number;
  upCount: number;
  downCount: number;
  /** Later courses left out because the full set was too large to draw. */
  downOmitted: number;
}

export interface GraphOptions {
  includeUp?: (code: string, link: Link) => boolean;
  includeDown?: (code: string) => boolean;
  /** Preferred display code among cross-listed equivalents. */
  prefer?: (code: string) => boolean;
  maxDown?: number;
}

const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

/**
 * Every course leading to `center` and every course it leads to, laid out top to bottom:
 * the most basic prerequisites on top, `center` in the middle, the furthest later courses at the bottom.
 */
export function buildChainGraph(catalog: Catalog, idx: DependentsIndex, center: string, opts: GraphOptions = {}): ChainGraph {
  const { includeUp = () => true, includeDown = () => true, prefer = () => false, maxDown = 40 } = opts;

  const canonOf = new Map<string, string>();
  const members = new Map<string, string[]>();
  const canon = (code: string) => {
    let id = canonOf.get(code);
    if (id) return id;
    const cls = [...new Set([code, ...(catalog.courses[code]?.cross ?? [])])].filter((c) => catalog.courses[c]);
    cls.sort((a, b) => Number(b === center) - Number(a === center) || Number(prefer(b)) - Number(prefer(a)) || a.localeCompare(b, "en", { numeric: true }));
    id = cls[0];
    for (const c of cls) canonOf.set(c, id);
    members.set(id, cls);
    return id;
  };
  canon(center);

  const strongest = (pairs: { code: string; link: Link }[], self: string) => {
    const m = new Map<string, Link>();
    for (const { code, link } of pairs) {
      if (!catalog.courses[code]) continue;
      const id = canon(code);
      if (id === self) continue;
      const prev = m.get(id);
      if (!prev || STRENGTH[link] > STRENGTH[prev]) m.set(id, link);
    }
    return m;
  };
  const linksInto = (id: string) => strongest(members.get(id)!.flatMap((c) => directLinks(catalog.courses[c])), id);
  const linksOut = (id: string) => strongest(members.get(id)!.flatMap((c) => idx.get(c) ?? []), id);

  const order = [center];
  const up = new Set<string>();
  for (let i = 0; i < order.length; i++) {
    for (const [p, link] of linksInto(order[i])) {
      if (p === center || up.has(p) || !includeUp(p, link)) continue;
      up.add(p);
      order.push(p);
    }
  }

  const depth = new Map<string, number>([[center, 0]]);
  const downOrder: string[] = [];
  for (let i = -1; i < downOrder.length; i++) {
    const n = i < 0 ? center : downOrder[i];
    for (const [d] of linksOut(n)) {
      if (depth.has(d) || up.has(d) || !includeDown(d)) continue;
      depth.set(d, depth.get(n)! + 1);
      downOrder.push(d);
    }
  }
  const downAll = downOrder.length;
  const down = downAll > maxDown ? downOrder.filter((d) => depth.get(d) === 1).slice(0, maxDown) : downOrder;
  const downSet = new Set(down);

  const all = [...order, ...down];
  const inGraph = new Set(all);
  let edges: { from: string; to: string; link: Link }[] = [];
  for (const n of all) for (const [p, link] of linksInto(n)) if (inGraph.has(p)) edges.push({ from: p, to: n, link });

  const outs = new Map<string, string[]>();
  const ins = new Map<string, string[]>();
  for (const e of edges) {
    (outs.get(e.from) ?? outs.set(e.from, []).get(e.from)!).push(e.to);
    (ins.get(e.to) ?? ins.set(e.to, []).get(e.to)!).push(e.from);
  }
  const longest = (adj: Map<string, string[]>, within: Set<string>) => {
    const memo = new Map<string, number>([[center, 0]]);
    const visiting = new Set<string>();
    const go = (n: string): number => {
      const known = memo.get(n);
      if (known !== undefined) return known;
      if (visiting.has(n)) return -Infinity;
      visiting.add(n);
      let best = -Infinity;
      for (const m of adj.get(n) ?? []) if (m === center || within.has(m)) best = Math.max(best, go(m) + 1);
      visiting.delete(n);
      memo.set(n, best);
      return best;
    };
    return go;
  };
  const toCenter = longest(outs, up);
  const fromCenter = longest(ins, downSet);
  const rowOf = new Map<string, number>([[center, 0]]);
  for (const n of up) rowOf.set(n, -(Number.isFinite(toCenter(n)) ? toCenter(n) : 1));
  for (const n of down) rowOf.set(n, Number.isFinite(fromCenter(n)) ? fromCenter(n) : 1);
  edges = edges.filter((e) => rowOf.get(e.from)! < rowOf.get(e.to)!);

  const minRow = Math.min(...rowOf.values());
  const maxRow = Math.max(...rowOf.values());
  const rows: string[][] = Array.from({ length: maxRow - minRow + 1 }, () => []);
  for (const n of all) rows[rowOf.get(n)! - minRow].push(n);

  const isDummy = (id: string) => id.startsWith("~");
  const upN = new Map<string, string[]>();
  const downN = new Map<string, string[]>();
  const connect = (a: string, b: string) => {
    (downN.get(a) ?? downN.set(a, []).get(a)!).push(b);
    (upN.get(b) ?? upN.set(b, []).get(b)!).push(a);
  };
  let dummies = 0;
  const chains = edges.map((e) => {
    const ids = [e.from];
    for (let r = rowOf.get(e.from)! + 1; r < rowOf.get(e.to)!; r++) {
      const d = `~${dummies++}`;
      rows[r - minRow].push(d);
      ids.push(d);
    }
    ids.push(e.to);
    for (let i = 1; i < ids.length; i++) connect(ids[i - 1], ids[i]);
    return ids;
  });

  const pos = new Map<string, number>();
  rows.forEach((r) => r.forEach((id, i) => pos.set(id, i)));
  for (let it = 0; it < 16; it++) {
    const downward = it % 2 === 0;
    const seq = downward ? rows.slice(1) : rows.slice(0, -1).reverse();
    for (const r of seq) {
      const nb = downward ? upN : downN;
      const bc = new Map(r.map((id) => [id, nb.get(id)?.length ? avg(nb.get(id)!.map((n) => pos.get(n)!)) : pos.get(id)!]));
      r.sort((a, b) => bc.get(a)! - bc.get(b)!);
      r.forEach((id, i) => pos.set(id, i));
    }
  }

  const width = (id: string) => (isDummy(id) ? DUMMY_W : NODE_W);
  const xOf = new Map<string, number>();
  for (const r of rows) {
    let x = -r.reduce((s, id) => s + width(id), 0) / 2;
    for (const id of r) {
      xOf.set(id, x + width(id) / 2);
      x += width(id);
    }
  }
  for (let it = 0; it < 8; it++) {
    for (const r of rows) {
      const want = r.map((id) => {
        const ns = [...(upN.get(id) ?? []), ...(downN.get(id) ?? [])];
        return ns.length ? avg(ns.map((n) => xOf.get(n)!)) : xOf.get(id)!;
      });
      const xs = [...want];
      for (let i = 1; i < r.length; i++) xs[i] = Math.max(xs[i], xs[i - 1] + (width(r[i - 1]) + width(r[i])) / 2);
      const shift = avg(want) - avg(xs);
      r.forEach((id, i) => xOf.set(id, xs[i] + shift));
    }
  }

  const rowIndex = new Map<string, number>();
  rows.forEach((r, i) => r.forEach((id) => rowIndex.set(id, i)));
  const xs = [...xOf.values()];
  const left = Math.min(...xs) - PAD_X;
  const point = (id: string): [number, number] => [xOf.get(id)! - left, PAD_Y + rowIndex.get(id)! * ROW_H];

  return {
    nodes: all.map((id) => ({ id, codes: members.get(id)!, row: rowOf.get(id)!, x: point(id)[0], y: point(id)[1] })),
    edges: edges.map((e, i) => ({ ...e, points: chains[i].map(point) })),
    rows: rows.map((_, i) => ({ row: i + minRow, y: PAD_Y + i * ROW_H })),
    width: Math.max(...xs) - left + PAD_X,
    height: PAD_Y * 2 + (rows.length - 1) * ROW_H,
    upCount: up.size,
    downCount: downAll,
    downOmitted: downAll - down.length,
  };
}
