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

test("new pages exist and all pages use relative paths and load Firebase SDK only via the adapter", () => {
  const newPages = ["intro.html", "stage-timer.html", "draw.html"];
  for (const np of newPages) {
    assert.ok(fs.existsSync(path.join(root, np)), `Expected ${np} to exist`);
  }

  const allHtml = fs.readdirSync(root).filter((f) => f.endsWith(".html"));
  for (const page of allHtml) {
    const src = fs.readFileSync(path.join(root, page), "utf8");

    // Must not import Firebase SDK directly from gstatic CDN (only via adapter ./js/backend.js)
    assert.ok(
      !src.includes("www.gstatic.com/firebasejs"),
      `${page} must not import Firebase JS SDK directly; only adapter js/backend.js may`
    );

    // Links to css and scripts must be relative (./ or relative filename, not starting with /)
    for (const match of src.matchAll(/<(?:link|script|a)\s+[^>]*(?:href|src)=["']([^"']+)["']/g)) {
      const url = match[1];
      if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("#") || url.startsWith("data:")) {
        continue;
      }
      assert.ok(
        !url.startsWith("/") || url.startsWith("//"),
        `${page} has non-relative path: ${url}`
      );
    }
  }
});
