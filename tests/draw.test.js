import test from "node:test";
import assert from "node:assert/strict";
import {
  DRAW_DURATION_MS,
  drawLotteryItem,
  drawLottery,
  isRehearsalSet,
  isTestMode,
  getRound2DrawPool,
  getRound2SetLabel,
  drawRound1Package,
  drawRound2Set,
  drawRound3Tile
} from "../js/draw.js";

test("drawLotteryItem: returns one item given available items and an injected random source", () => {
  const items = ["Chủ đề 1", "Chủ đề 2", "Chủ đề 3"];

  // Random source = 0 -> first item
  const first = drawLotteryItem(items, { randomSource: () => 0 });
  assert.equal(first, "Chủ đề 1");

  // Random source = 0.4 -> middle item
  const middle = drawLotteryItem(items, { randomSource: () => 0.4 });
  assert.equal(middle, "Chủ đề 2");

  // Random source = 0.99 -> last item
  const last = drawLotteryItem(items, { randomSource: () => 0.99 });
  assert.equal(last, "Chủ đề 3");
});

test("drawLotteryItem: excludes used/opened items", () => {
  const items = [
    { id: "pkg-1", name: "Chủ đề 1" },
    { id: "pkg-2", name: "Chủ đề 2" },
    { id: "pkg-3", name: "Chủ đề 3" }
  ];

  // Exclude pkg-1 and pkg-2
  const picked = drawLotteryItem(items, {
    exclude: ["pkg-1", "pkg-2"],
    randomSource: () => 0
  });
  assert.equal(picked?.id, "pkg-3");

  // Exclude with objects
  const picked2 = drawLotteryItem(items, {
    exclude: [{ id: "pkg-1" }, { id: "pkg-3" }],
    randomSource: () => 0
  });
  assert.equal(picked2?.id, "pkg-2");
});

test("drawLotteryItem: excludes 'Chạy thử' rehearsal set", () => {
  const sets = ["1", "2", "3", "4", "5", "Chạy thử"];

  // With excludeRehearsal: true
  const drawn = drawLotteryItem(sets, {
    excludeRehearsal: true,
    randomSource: () => 0.99 // Points towards the end of the pool
  });
  assert.equal(drawn, "5");
  assert.notEqual(drawn, "Chạy thử");

  // Rehearsal set check handles accents and casing
  assert.equal(isRehearsalSet("Chạy thử"), true);
  assert.equal(isRehearsalSet("chạy thử"), true);
  assert.equal(isRehearsalSet("CHẠY THỬ"), true);
  assert.equal(isRehearsalSet("Chay thu"), true);
  assert.equal(isRehearsalSet("Bộ 1"), false);
});

test("drawLotteryItem: returns null for empty pool or when all items are excluded", () => {
  assert.equal(drawLotteryItem([], { randomSource: () => 0 }), null);
  assert.equal(drawLotteryItem(null, { randomSource: () => 0 }), null);

  const items = ["A", "B"];
  const allExcluded = drawLotteryItem(items, {
    exclude: ["A", "B"],
    randomSource: () => 0
  });
  assert.equal(allExcluded, null);

  const onlyRehearsal = ["Chạy thử"];
  const noOfficialSets = drawLotteryItem(onlyRehearsal, {
    excludeRehearsal: true,
    randomSource: () => 0
  });
  assert.equal(noOfficialSets, null);
});

test("drawRound1Package: takes count from data and excludes already picked packages", () => {
  // Team has 3 packages in data
  const packages = [
    { id: "t1::pkg1", label: "Chủ đề 1" },
    { id: "t1::pkg2", label: "Chủ đề 2" },
    { id: "t1::pkg3", label: "Chủ đề 3" }
  ];

  // Pick first available
  const p1 = drawRound1Package(packages, { pickedPackages: [], randomSource: () => 0 });
  assert.equal(p1.id, "t1::pkg1");

  // If pkg1 picked already, pool shrinks to 2
  const p2 = drawRound1Package(packages, { pickedPackages: ["t1::pkg1"], randomSource: () => 0.5 });
  assert.equal(p2.id, "t1::pkg3");
});

test("drawRound2Set: draws from 5 official sets and never 'Chạy thử'", () => {
  const sets = ["1", "2", "3", "4", "5", "Chạy thử"];
  for (let r = 0; r <= 0.99; r += 0.1) {
    const s = drawRound2Set(sets, { randomSource: () => r });
    assert.ok(["1", "2", "3", "4", "5"].includes(s));
    assert.notEqual(s, "Chạy thử");
  }
});

test("drawRound3Tile: draws from 15 tiles and excludes already opened tiles", () => {
  const tiles = Array.from({ length: 15 }, (_, i) => ({ number: i + 1 }));
  const opened = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

  // Only tile 15 remains
  const drawn = drawRound3Tile(tiles, { openedTiles: opened, randomSource: () => 0 });
  assert.equal(drawn.number, 15);

  // When all 15 are opened
  const allOpened = drawRound3Tile(tiles, { openedTiles: [...opened, 15], randomSource: () => 0 });
  assert.equal(allOpened, null);
});

test("draw duration constant is about 5000 ms", () => {
  assert.equal(typeof DRAW_DURATION_MS, "number");
  assert.ok(
    DRAW_DURATION_MS >= 4500 && DRAW_DURATION_MS <= 5500,
    `Expected DRAW_DURATION_MS to be about 5000 ms, got ${DRAW_DURATION_MS}`
  );
});

test("run mode: only config run_mode = test is test mode; live is the default", () => {
  assert.equal(isTestMode({ run_mode: "test" }), true);
  assert.equal(isTestMode({ run_mode: " TEST " }), true);
  assert.equal(isTestMode({ run_mode: "live" }), false);
  assert.equal(isTestMode({}), false);
  assert.equal(isTestMode(undefined), false);
});

test("getRound2DrawPool: test mode draws rehearsal sets, live mode the official ones", () => {
  const sets = ["1", "2", "3", "4", "5", "Chạy thử", "Chạy thử 2"];
  assert.deepEqual(getRound2DrawPool(sets, { run_mode: "test" }), ["Chạy thử", "Chạy thử 2"]);
  assert.deepEqual(getRound2DrawPool(sets, { run_mode: "live" }), ["1", "2", "3", "4", "5"]);
  assert.deepEqual(getRound2DrawPool(sets, {}), ["1", "2", "3", "4", "5"]);
  // Test mode without a rehearsal set: nothing to draw (never the official sets).
  assert.deepEqual(getRound2DrawPool(["1", "2"], { run_mode: "test" }), []);
  // Live mode with only a rehearsal set keeps it, as before.
  assert.deepEqual(getRound2DrawPool(["Chạy thử"], {}), ["Chạy thử"]);
});

test("getRound2SetLabel names official and rehearsal sets", () => {
  assert.equal(getRound2SetLabel("3"), "Bộ đề số 3");
  assert.equal(getRound2SetLabel("Chạy thử"), "Bộ đề thử");
  assert.equal(getRound2SetLabel("Chạy thử 2"), "Bộ đề thử 2");
  assert.equal(isRehearsalSet("Chạy thử 2"), true);
});
