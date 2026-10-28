import test from "node:test";
import assert from "node:assert/strict";
import {
  normaliseJudges,
  clampScore,
  calculateTeamRoundScore,
  compareRound1Or3Teams
} from "../js/judges.js";

test("Judge scores: average of judges' content+manner minus penalty; judges who have not scored are excluded; values outside 0..max are clamped; round 1/3 tie broken by content", () => {
  // 1. Clamping check: values outside 0..max are clamped
  assert.equal(clampScore(-5, 45), 0);
  assert.equal(clampScore(50, 45), 45);
  assert.equal(clampScore(40, 45), 40);
  assert.equal(clampScore(10, 5), 5);
  assert.equal(clampScore(-1, 5), 0);

  // 2. Normal scoring with 3 judges, one has not scored
  const judgeScores = {
    "gk-01": { content: 40, manner: 4 }, // total 44
    "gk-02": { content: 44, manner: 5 }, // total 49
    "gk-03": null // Not scored yet -> excluded
  };

  const penalty = 2; // Overtime penalty 2 points
  const res = calculateTeamRoundScore({
    judgeScores,
    penalty,
    maxContent: 45,
    maxManner: 5
  });

  assert.equal(res.judgeCount, 2);
  // avgTotal = (44 + 49) / 2 = 46.5
  assert.equal(res.avgTotal, 46.5);
  // avgContent = (40 + 44) / 2 = 42
  assert.equal(res.avgContent, 42);
  // avgManner = (4 + 5) / 2 = 4.5
  assert.equal(res.avgManner, 4.5);
  // finalScore = 46.5 - 2 = 44.5
  assert.equal(res.finalScore, 44.5);

  // 3. Out-of-bounds inputs are clamped during calculation
  const clampedScores = {
    "gk-01": { content: 100, manner: 10 } // clamped to 45 and 5 -> total 50
  };
  const resClamped = calculateTeamRoundScore({
    judgeScores: clampedScores,
    penalty: 0,
    maxContent: 45,
    maxManner: 5
  });
  assert.equal(resClamped.avgContent, 45);
  assert.equal(resClamped.avgManner, 5);
  assert.equal(resClamped.finalScore, 50);

  // 4. Round 1 / 3 tie broken by content score (Điều 21)
  const teamA = {
    id: "doi-01",
    finalScore: 45.0,
    avgContent: 41.0,
    avgManner: 4.0
  };
  const teamB = {
    id: "doi-02",
    finalScore: 45.0,
    avgContent: 42.0, // Higher content wins tie
    avgManner: 3.0
  };

  const list = [teamA, teamB];
  list.sort(compareRound1Or3Teams);
  assert.equal(list[0].id, "doi-02");
  assert.equal(list[1].id, "doi-01");
});

test("normaliseJudges parses id, name and skips invalid rows", () => {
  const rows = [
    { id: "gk-01", name: "Đại tá Nguyễn Văn A" },
    { id: "gk-02", name: "Thượng tá Trần Thị B" },
    { id: "", name: "Không có mã" },
    { id: "gk-03", name: "" }
  ];
  const judges = normaliseJudges(rows);
  assert.equal(judges.length, 2);
  assert.equal(judges[0].id, "gk-01");
  assert.equal(judges[0].name, "Đại tá Nguyễn Văn A");
  assert.equal(judges[1].id, "gk-02");
});
