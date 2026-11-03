import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const en = readFileSync(join(ROOT, "lib/i18n/en.ts"), "utf8");
const dict = new Map<string, string>();
for (const m of en.matchAll(/^ {2}("(?:[^"\\]|\\.)*"): ("(?:[^"\\]|\\.)*"),$/gm)) dict.set(JSON.parse(m[1]), JSON.parse(m[2]));

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("English dictionary", () => {
  it("has an entry for every literal t() key", () => {
    const missing = new Set<string>();
    for (const file of ["app", "components", "lib", "constants"].flatMap((d) => files(join(ROOT, d)))) {
      for (const m of readFileSync(file, "utf8").matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) {
        if (/[؀-ۿ]/.test(m[1]) && !dict.has(m[1])) missing.add(m[1]);
      }
    }
    expect([...missing]).toEqual([]);
  });

  it("keeps the same {placeholders} in every translation", () => {
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
    const bad = [...dict].filter(([ar, text]) => vars(ar) !== vars(text));
    expect(bad).toEqual([]);
  });
});
