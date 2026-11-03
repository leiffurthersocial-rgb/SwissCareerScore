/** Minimal PDF text extraction with x/y positions (pdfjs-dist), grouped into visual lines. */
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export interface PdfItem {
  str: string;
  x: number;
  y: number;
  w: number;
}
export interface PdfLine {
  page: number;
  y: number;
  items: PdfItem[];
  text: string;
}

export async function pdfLines(buf: Buffer, yTolerance = 2): Promise<PdfLine[]> {
  const doc = await getDocument({ data: new Uint8Array(buf), useSystemFonts: true, verbosity: 0 }).promise;
  const lines: PdfLine[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items: PdfItem[] = [];
    for (const it of content.items) {
      if (!("str" in it) || !it.str.trim()) continue;
      items.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width });
    }
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    const pageLines: PdfLine[] = [];
    for (const it of items) {
      const line = pageLines.find((l) => Math.abs(l.y - it.y) <= yTolerance);
      if (line) line.items.push(it);
      else pageLines.push({ page: p, y: it.y, items: [it], text: "" });
    }
    for (const l of pageLines) {
      l.items.sort((a, b) => a.x - b.x);
      l.text = l.items.map((i) => i.str).join(" ").replace(/\s+/g, " ").trim();
    }
    pageLines.sort((a, b) => b.y - a.y);
    lines.push(...pageLines);
  }
  return lines;
}
