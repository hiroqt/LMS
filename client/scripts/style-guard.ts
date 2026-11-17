/**
 * Fails when source code uses a decoration the UI no longer allows (C-019, D-033):
 *   npm run style:check
 * Scans styles and components, except tests, in the folders given as arguments
 * (default: src). Fix the code rather than adding an exception here; a new rule
 * needs a DECISIONS entry.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RULES: { name: string; pattern: RegExp; fix: string }[] = [
  { name: "gradient", pattern: /gradient/i, fix: "use a flat token color; put text over images on a solid panel" },
  { name: "eyebrow", pattern: /eyebrow/i, fix: "drop it; put a useful fact in the heading description" },
  { name: "uppercase label", pattern: /\buppercase\b|text-transform:\s*uppercase/, fix: "use sentence case" },
  { name: "pulse or keyframe animation", pattern: /animate-(pulse|ping|bounce)|@keyframes|animation:/, fix: "use a static skeleton or a 150 ms transition" },
  { name: "side line", pattern: /\bborder-[ls]-|border-left|border-inline-start/, fix: "use a uniform border and a soft tint" },
  { name: "status dot", pattern: /[-_]dot\b|\bdot[-_]/i, fix: "use an icon with text or a Badge" },
  { name: "blur", pattern: /backdrop-blur|backdrop-filter/, fix: "use a solid bg-surface" },
];

const roots = process.argv.slice(2).length ? process.argv.slice(2) : ["src"];
const SOURCE = /\.(css|[jt]sx?)$/;
const TEST = /\.test\.[jt]sx?$/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return SOURCE.test(name) && !TEST.test(name) ? [path] : [];
  });
}

const failures: string[] = [];
for (const path of roots.flatMap((dir) => files(join(process.cwd(), dir)))) {
  readFileSync(path, "utf8")
    .split("\n")
    .forEach((line, index) => {
      for (const rule of RULES) {
        if (rule.pattern.test(line)) failures.push(`${relative(process.cwd(), path)}:${index + 1}  ${rule.name}: ${rule.fix}`);
      }
    });
}

if (failures.length) {
  console.error(`Decoration the UI no longer allows (C-019):\n  ${failures.join("\n  ")}\n\n${failures.length} problem(s).`);
  process.exit(1);
}
console.log("No disallowed decoration.");
