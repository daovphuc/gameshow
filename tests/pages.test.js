import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

// A syntax error or a wrong named import in a page's inline module leaves the page blank,
// and no logic test notices; these checks catch both.

const root = path.resolve(".");
const pages = fs.readdirSync(root).filter((f) => f.endsWith(".html"));

function inlineModules(file) {
  const src = fs.readFileSync(path.join(root, file), "utf8");
  return [...src.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
}

function exportedNames(file) {
  const src = fs.readFileSync(file, "utf8");
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z0-9_$]+)/g)) {
    names.add(m[1]);
  }
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (name) names.add(name);
    }
  }
  return names;
}

test("every page's inline module scripts parse", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pages-"));
  try {
    for (const page of pages) {
      inlineModules(page).forEach((code, i) => {
        const file = path.join(dir, `${page}.${i}.mjs`);
        fs.writeFileSync(file, code);
        const res = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
        assert.equal(res.status, 0, `${page} script ${i}: ${res.stderr.split("\n").slice(0, 5).join("\n")}`);
      });
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("every named import in pages and js/ modules resolves", () => {
  const sources = [
    ...pages.map((p) => ({ file: path.join(root, p), code: inlineModules(p).join("\n") })),
    ...fs.readdirSync(path.join(root, "js"))
      .filter((f) => f.endsWith(".js"))
      .map((f) => ({ file: path.join(root, "js", f), code: fs.readFileSync(path.join(root, "js", f), "utf8") }))
  ];
  const missing = [];
  for (const { file, code } of sources) {
    for (const m of code.matchAll(/import\s*\{([^}]*)\}\s*from\s*["'](\.[^"']+)["']/g)) {
      const target = path.resolve(path.dirname(file), m[2].split("?")[0]);
      if (!fs.existsSync(target)) {
        missing.push(`${path.basename(file)}: no module ${m[2]}`);
        continue;
      }
      const names = exportedNames(target);
      for (const part of m[1].split(",")) {
        const name = part.trim().split(/\s+as\s+/)[0].trim();
        if (name && !names.has(name)) missing.push(`${path.basename(file)}: ${m[2]} has no export ${name}`);
      }
    }
  }
  assert.deepEqual(missing, []);
});
