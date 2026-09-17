/**
 * Static guard: no function props from Server Components.
 *
 * Passing a function across the server/client boundary is a runtime failure —
 * "Event handlers cannot be passed to Client Component props" — and it is
 * invisible to every other check we run:
 *
 *   • `tsc` is happy, because the prop type is satisfied.
 *   • `eslint` has no rule for it.
 *   • `next build` never renders these routes; they are all dynamic.
 *   • `scripts/smoke-render.ts` cannot provoke it over `fetch`. The check fires
 *     during a real browser's Flight render, so a curl of the same URL returns
 *     a clean 200. That is not a gap worth engineering around — it is the
 *     reason this file exists instead.
 *
 * So this is a source scan, which catches the whole class deterministically and
 * runs in a second. It found the `onChange={() => {}}` that shipped to a user
 * on the posting review step, and the identical one waiting on the job screen.
 *
 *   npx tsx scripts/check-server-props.ts
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const ROOT = "src";

/**
 * `action={...}` is excluded deliberately: a Server Action IS allowed to cross
 * the boundary — that is the entire point of one. Everything shaped like an
 * event handler is not.
 */
const HANDLER_PROP = /\s(on[A-Z][A-Za-z]*)=\{/g;

/** An inline function, or a bare identifier that is probably one. */
const FUNCTION_VALUE = /^\s*(\(|async\s|function\b|\w+\s*=>)/;

interface Finding {
  file: string;
  line: number;
  prop: string;
  snippet: string;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (extname(path) === ".tsx") out.push(path);
  }
  return out;
}

function scan(file: string): Finding[] {
  const source = readFileSync(file, "utf8");

  // A Client Component may pass functions freely — that is ordinary React.
  if (/^\s*["']use client["']/m.test(source)) return [];

  const findings: Finding[] = [];
  const lines = source.split("\n");

  lines.forEach((line, index) => {
    for (const match of line.matchAll(HANDLER_PROP)) {
      const after = line.slice(match.index! + match[0].length);
      if (FUNCTION_VALUE.test(after) || after.trimStart().startsWith("}")) {
        findings.push({
          file,
          line: index + 1,
          prop: match[1],
          snippet: line.trim().slice(0, 100),
        });
      }
    }
  });

  return findings;
}

const files = walk(ROOT);
const findings = files.flatMap(scan);

console.log(`\n  Scanned ${files.length} .tsx files for function props in Server Components.\n`);

if (findings.length === 0) {
  console.log("  Clean — no handler props cross a server/client boundary.\n");
  process.exit(0);
}

for (const finding of findings) {
  console.log(`  ${finding.file}:${finding.line}`);
  console.log(`    ${finding.prop} — ${finding.snippet}`);
  console.log(
    `    A Server Component cannot pass a function to a Client Component. Make the\n` +
      `    prop optional and omit it, or move the markup into a Client Component.\n`,
  );
}

console.log(`  ${findings.length} problem(s).\n`);
process.exit(1);
