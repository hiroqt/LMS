/**
 * Performance budget for slow connections (plan §6). Run after `npm run build`:
 *   npm run budget
 * Sizes are gzip, which is what phones download. Tighten the limits when they
 * shrink (cutover removes the legacy UI); raise one only with a DECISIONS entry.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const KB = 1024;
const BUDGET = {
  /** The entry chunk every visitor downloads before anything renders. */
  entryJs: 105 * KB,
  /** Any lazily loaded screen or shared chunk. */
  chunkJs: 40 * KB,
  /** Any stylesheet. */
  css: 26 * KB,
  /**
   * The PDF viewer (pdf.js), loaded only when a phone opens a PDF material and kept out of the
   * install cache (D-067). Its worker is a separate .mjs file, checked below.
   */
  pdfViewer: 140 * KB,
  pdfWorker: 380 * KB,
};
const isPdfViewer = (name: string) => name.startsWith("PdfPages-");

const dir = join(process.cwd(), "dist", "assets");
const files = readdirSync(dir).filter((name) => name.endsWith(".js") || name.endsWith(".mjs") || name.endsWith(".css"));
const html = readFileSync(join(process.cwd(), "dist", "index.html"), "utf8");
const entry = html.match(/assets\/(index-[^"]+\.js)/)?.[1];

const failures: string[] = [];
const rows = files.map((name) => {
  const size = gzipSync(readFileSync(join(dir, name))).length;
  const limit = name.endsWith(".css") ? BUDGET.css : name === entry ? BUDGET.entryJs : isPdfViewer(name) ? BUDGET.pdfViewer : name.startsWith("pdf.worker") ? BUDGET.pdfWorker : BUDGET.chunkJs;
  if (size > limit) failures.push(`${name}: ${(size / KB).toFixed(1)} KB gz > ${(limit / KB).toFixed(0)} KB`);
  return { name, size, limit };
});

rows.sort((a, b) => b.size - a.size).slice(0, 6).forEach((row) => console.log(`${(row.size / KB).toFixed(1).padStart(7)} KB gz / ${(row.limit / KB).toFixed(0)} KB  ${row.name}`));
if (!entry) failures.push("Could not find the entry script in dist/index.html.");
if (failures.length) {
  console.error(`\nPerformance budget exceeded:\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log("\nWithin the performance budget.");
