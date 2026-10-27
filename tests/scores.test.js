import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import {
  normaliseScores,
  buildScoresPayload,
  mergeScores,
  upsertScoreRows
} from "../js/scores.js";

const TEAMS = [
  { id: "doi-01", name: "Đội 1" },
  { id: "doi-02", name: "Đội 2" },
  { id: "doi-03", name: "Đội 3" }
];

test("normaliseScores parses scores tab, defaults missing teams to 0, and converts bad numbers to 0", () => {
  const csv = [
    "team_id,round1,round2,round3,updated_at",
    "doi-01,20,35,40,2026-10-27T05:00:00Z",
    "doi-02,abc,,15,2026-10-27T05:00:00Z"
    // doi-03 is missing from the sheet
  ].join("\n");

  const scores = normaliseScores(csv, TEAMS);
  assert.deepEqual(scores["doi-01"], { round1: 20, round2: 35, round3: 40 });
  assert.deepEqual(scores["doi-02"], { round1: 0, round2: 0, round3: 15 });
  assert.deepEqual(scores["doi-03"], { round1: 0, round2: 0, round3: 0 });
});

test("buildScoresPayload builds upsert_scores payload with all team rows", () => {
  const scores = {
    "doi-01": { round1: 10, round2: 20, round3: 30 },
    "doi-02": { round1: 5, round2: "bad", round3: 0 }
  };
  const payload = buildScoresPayload(scores, TEAMS, "2026-10-27T12:00:00.000Z");

  assert.equal(payload.action, "upsert_scores");
  assert.equal(payload.updated_at, "2026-10-27T12:00:00.000Z");
  assert.equal(payload.rows.length, 3);
  assert.deepEqual(payload.rows[0], {
    team_id: "doi-01",
    round1: 10,
    round2: 20,
    round3: 30,
    updated_at: "2026-10-27T12:00:00.000Z"
  });
  assert.deepEqual(payload.rows[1], {
    team_id: "doi-02",
    round1: 5,
    round2: 0,
    round3: 0,
    updated_at: "2026-10-27T12:00:00.000Z"
  });
  assert.deepEqual(payload.rows[2], {
    team_id: "doi-03",
    round1: 0,
    round2: 0,
    round3: 0,
    updated_at: "2026-10-27T12:00:00.000Z"
  });
});

test("mergeScores lets sheet scores win when webAppUrl is set, and local fallback win when webAppUrl is empty", () => {
  const sheetScores = {
    "doi-01": { round1: 50, round2: 40, round3: 60 },
    "doi-02": { round1: 10, round2: 10, round3: 10 }
  };
  const localScores = {
    "doi-01": { round1: 15, round2: 0, round3: 0 },
    "doi-02": { round1: 99, round2: 99, round3: 99 },
    "doi-03": { round1: 25, round2: 0, round3: 0 }
  };

  // With webAppUrl set -> sheetScores win
  const withWebApp = mergeScores({
    teams: TEAMS,
    sheetScores,
    localScores,
    webAppUrl: "https://script.google.com/macros/s/test-id/exec"
  });
  assert.deepEqual(withWebApp["doi-01"], { round1: 50, round2: 40, round3: 60 });
  assert.deepEqual(withWebApp["doi-02"], { round1: 10, round2: 10, round3: 10 });
  assert.deepEqual(withWebApp["doi-03"], { round1: 25, round2: 0, round3: 0 });

  // Without webAppUrl -> localScores win
  const withoutWebApp = mergeScores({
    teams: TEAMS,
    sheetScores,
    localScores,
    webAppUrl: "   "
  });
  assert.deepEqual(withoutWebApp["doi-01"], { round1: 15, round2: 0, round3: 0 });
  assert.deepEqual(withoutWebApp["doi-02"], { round1: 99, round2: 99, round3: 99 });
  assert.deepEqual(withoutWebApp["doi-03"], { round1: 25, round2: 0, round3: 0 });
});

test("upsertScoreRows upserts rows in both js/scores.js and apps-script/Code.gs", () => {
  const existing = [
    ["team_id", "round1", "round2", "round3", "updated_at"],
    ["doi-01", 10, 20, 30, "2026-10-27T01:00:00Z"],
    ["doi-02", 5, 0, 10, "2026-10-27T01:00:00Z"]
  ];

  const incoming = [
    { team_id: "doi-02", round1: 25, round2: 15, round3: 40, updated_at: "2026-10-27T02:00:00Z" },
    { team_id: "doi-03", round1: 10, round2: "invalid", round3: 30, updated_at: "2026-10-27T02:00:00Z" }
  ];

  const expected = [
    ["team_id", "round1", "round2", "round3", "updated_at"],
    ["doi-01", 10, 20, 30, "2026-10-27T01:00:00Z"],
    ["doi-02", 25, 15, 40, "2026-10-27T02:00:00Z"],
    ["doi-03", 10, 0, 30, "2026-10-27T02:00:00Z"]
  ];

  const fromModule = upsertScoreRows(existing, incoming, "2026-10-27T02:00:00Z");
  assert.deepEqual(fromModule, expected);

  // Also execute the pure upsertScoreRows directly from apps-script/Code.gs in a VM context
  const gasCode = fs.readFileSync(path.resolve("apps-script/Code.gs"), "utf8");
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(gasCode, sandbox);
  const fromGas = JSON.parse(
    JSON.stringify(sandbox.upsertScoreRows(existing, incoming, "2026-10-27T02:00:00Z"))
  );
  assert.deepEqual(fromGas, expected);
});
