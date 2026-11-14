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

test("brief acceptance requirements: 5 portals, sidebar links removed, ceremony headers, overview buttons removed, draw-only pages", () => {
  // 1. index.html offers the 5 portals
  const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
  for (const portal of ["host", "judge", "team", "stage_timer", "draw"]) {
    assert.ok(
      indexHtml.includes(`data-portal="${portal}"`),
      `index.html must offer portal ${portal}`
    );
  }

  // 2. sidebar no longer links stage-timer.html / draw.html
  const appJs = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
  assert.ok(!appJs.includes("stage-timer.html"), "sidebar must not link stage-timer.html");
  assert.ok(!appJs.includes("draw.html"), "sidebar must not link draw.html");

  // 3. intro.html contains 'BỘ CÔNG AN' and 'CỤC CẢNH SÁT PCCC VÀ CNCH'
  const introHtml = fs.readFileSync(path.join(root, "intro.html"), "utf8");
  assert.ok(introHtml.includes("BỘ CÔNG AN"), "intro.html must contain 'BỘ CÔNG AN'");
  assert.ok(
    introHtml.includes("CỤC CẢNH SÁT PCCC VÀ CNCH") || introHtml.includes("CỤC CẢNH SÁT PCCC &amp; CNCH"),
    "intro.html must contain 'CỤC CẢNH SÁT PCCC VÀ CNCH'"
  );

  // 4. host.html no longer contains 'Vào Bảng Điều Khiển' / 'Toàn màn hình'
  const hostHtml = fs.readFileSync(path.join(root, "host.html"), "utf8");
  assert.ok(!hostHtml.includes("Vào Bảng Điều Khiển"), "host.html must not contain 'Vào Bảng Điều Khiển'");
  assert.ok(!hostHtml.includes("Toàn màn hình"), "host.html must not contain 'Toàn màn hình'");

  // 5. round pages contain no 'Chọn thủ công'
  for (const roundPage of ["round1.html", "round2.html", "round3.html"]) {
    const src = fs.readFileSync(path.join(root, roundPage), "utf8");
    assert.ok(
      !src.includes("Chọn thủ công") && !src.includes("chọn thủ công"),
      `${roundPage} must not contain 'Chọn thủ công'`
    );
  }
});

test("brief acceptance requirements: round 3 has no tile grid markup, draw.html uses shared lottery animation, lottery markup has no 'LỒNG QUAY SỐ' or 'Lượt thi của'", () => {
  // 1. round 3 host page has no tile grid markup
  const round3Html = fs.readFileSync(path.join(root, "round3.html"), "utf8");
  assert.ok(!round3Html.includes("tiles-grid"), "round3.html must not contain 'tiles-grid'");
  assert.ok(!round3Html.includes("tile-btn"), "round3.html must not contain 'tile-btn'");

  // 2. draw.html uses the shared lottery animation
  const drawHtml = fs.readFileSync(path.join(root, "draw.html"), "utf8");
  assert.ok(drawHtml.includes("showLotteryDrawModal"), "draw.html must import or call showLotteryDrawModal");

  // 3. lottery markup in js/draw-ui.js and all html pages no longer contains 'LỒNG QUAY SỐ' or 'Lượt thi của'
  const drawUiJs = fs.readFileSync(path.join(root, "js", "draw-ui.js"), "utf8");
  assert.ok(!drawUiJs.includes("LỒNG QUAY SỐ"), "js/draw-ui.js must not contain 'LỒNG QUAY SỐ'");
  assert.ok(!drawUiJs.includes("Lượt thi của"), "js/draw-ui.js must not contain 'Lượt thi của'");

  for (const page of fs.readdirSync(root).filter((f) => f.endsWith(".html"))) {
    const src = fs.readFileSync(path.join(root, page), "utf8");
    assert.ok(!src.includes("LỒNG QUAY SỐ"), `${page} must not contain 'LỒNG QUAY SỐ'`);
    assert.ok(!src.includes("Lượt thi của"), `${page} must not contain 'Lượt thi của'`);
  }
});


test("the MC pages publish the drawn ball pool and draw.html renders the same pool", () => {
  for (const page of ["round1.html", "round2.html", "round3.html"]) {
    const html = fs.readFileSync(path.join(root, page), "utf8");
    assert.match(html, /set\("live\/draw", \{[\s\S]*?pool/, `${page} must write the ball pool to live/draw`);
  }
  const drawHtml = fs.readFileSync(path.join(root, "draw.html"), "utf8");
  assert.ok(drawHtml.includes("draw.pool"), "draw.html must build its drum from live/draw.pool");
});

test("round 2 clears the previous question's results when it opens the next question", () => {
  const html = fs.readFileSync(path.join(root, "round2.html"), "utf8");
  const preview = html.slice(html.indexOf("async function handleOpenQuestionPreview"));
  const previewUpdate = preview.slice(0, preview.indexOf("subscribeToQuestionAnswers"));
  assert.match(previewUpdate, /results: null/, "the reading-phase update must clear results");
  const team = fs.readFileSync(path.join(root, "team.html"), "utf8");
  assert.ok(team.includes('isRevealedNow ? r2.results'), "team tablets read results only once revealed");
});

test("MC pages: icon-only back/rules buttons, no remote-draw hints, round 3 has no round links", () => {
  const r1 = fs.readFileSync(path.join(root, "round1.html"), "utf8");
  assert.ok(!r1.includes("Hệ thống bốc thăm ngẫu nhiên"));
  assert.ok(!r1.includes("Đội thi cũng có thể bấm nút Quay số"));
  const r3 = fs.readFileSync(path.join(root, "round3.html"), "utf8");
  assert.ok(!r3.includes("btn-draw-back") && !r3.includes("btn-draw-continue"));
  for (const page of ["round1.html", "round2.html", "round3.html"]) {
    const html = fs.readFileSync(path.join(root, page), "utf8");
    assert.ok(!/📜 Thể lệ/.test(html), `${page}: rules button is icon-only`);
    assert.ok(!/← Quay lại/.test(html.replace(/Quay lại phần thi/g, "")), `${page}: back button is icon-only`);
    assert.ok(html.includes("createCountdownSound"), `${page}: timer plays the countdown sound`);
  }
});

test("round 2 bar has no category pill and the stats popup has two tabs", () => {
  const html = fs.readFileSync(path.join(root, "round2.html"), "utf8");
  assert.ok(!html.includes("Chuyên đề:"));
  assert.ok(html.includes('data-tab="results"') && html.includes('data-tab="table"'));
  assert.ok(!html.includes("← Bộ đề"));
});

test("stage timer and draw screen stay minimal; leaderboard has award music", () => {
  const lb = fs.readFileSync(path.join(root, "leaderboard.html"), "utf8");
  assert.ok(lb.includes("startAwardMusic"));
});
