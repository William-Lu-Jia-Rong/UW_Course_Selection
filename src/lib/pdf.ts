import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

interface Item {
  str: string;
  x: number;
  y: number;
}

/** Extracts visual text lines (items grouped by baseline, sorted left-to-right) from a PDF. */
export async function pdfToLines(data: ArrayBuffer): Promise<string[]> {
  const doc = await pdfjs.getDocument({ data }).promise;
  const lines: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items: Item[] = [];
    for (const it of content.items) {
      if (!("str" in it) || !it.str.trim()) continue;
      items.push({ str: it.str, x: it.transform[4], y: it.transform[5] });
    }
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    let row: Item[] = [];
    const flush = () => {
      if (row.length) lines.push(row.sort((a, b) => a.x - b.x).map((i) => i.str.trim()).join(" "));
      row = [];
    };
    for (const it of items) {
      if (row.length && Math.abs(row[0].y - it.y) > 2.5) flush();
      row.push(it);
    }
    flush();
  }
  return lines;
}
