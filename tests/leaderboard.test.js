import test from "node:test";
import assert from "node:assert/strict";
import {
  computeLeaderboard,
  buildPodiumSlots,
  getTeamInitials,
  diffLeaderboard
} from "../js/leaderboard.js";

const TEAMS = [
  { id: "t1", name: "Đội Sao Vàng", color: "#D97757" },
  { id: "t2", name: "Đội Hồng Hà", color: "#2E7D4F" },
  { id: "t3", name: "Đội Cửu Long", color: "#3B6E8C" },
  { id: "t4", name: "Đội Trường Sơn", color: "#8C5A3B" }
];

test("computeLeaderboard ranks per-round and total, ties share a rank, and missing scores default to 0", () => {
  const scores = {
    t1: { round1: 30, round2: 20, round3: 40 }, // total 90
    t2: { round1: 40, round2: 20, round3: 30 }, // total 90 (tie on total with t1!)
    t3: { round1: 10, round2: 15, round3: 20 }  // total 45
    // t4 has no entry in scores -> should show 0
  };

  // Total leaderboard (without tieBreak flag, ties share rank)
  const totalBoard = computeLeaderboard(TEAMS, scores, "total");
  assert.equal(totalBoard.length, 4);
  assert.equal(totalBoard[0].score, 90);
  assert.equal(totalBoard[0].rank, 1);
  assert.equal(totalBoard[1].score, 90);
  assert.equal(totalBoard[1].rank, 1); // Tie shares rank 1
  assert.equal(totalBoard[2].id, "t3");
  assert.equal(totalBoard[2].score, 45);
  assert.equal(totalBoard[2].rank, 3);
  assert.equal(totalBoard[3].id, "t4");
  assert.equal(totalBoard[3].score, 0);
  assert.equal(totalBoard[3].total, 0);
  assert.equal(totalBoard[3].rank, 4);

  // Round 1 leaderboard
  const r1Board = computeLeaderboard(TEAMS, scores, "round1");
  assert.equal(r1Board[0].id, "t2");
  assert.equal(r1Board[0].score, 40);
  assert.equal(r1Board[0].rank, 1);
  assert.equal(r1Board[1].id, "t1");
  assert.equal(r1Board[1].score, 30);
  assert.equal(r1Board[1].rank, 2);

  // Round 2 leaderboard (t1 and t2 tied at 20)
  const r2Board = computeLeaderboard(TEAMS, scores, "round2");
  assert.equal(r2Board[0].rank, 1);
  assert.equal(r2Board[1].rank, 1);
  assert.equal(r2Board[2].id, "t3");
  assert.equal(r2Board[2].rank, 3);
});

test("Total ranking with Điều 22 tie-break (round-1 rank, then round-3, then round-2)", () => {
  const teams = [
    { id: "A", name: "Đội A" },
    { id: "B", name: "Đội B" },
    { id: "C", name: "Đội C" },
    { id: "D", name: "Đội D" }
  ];

  // All 4 teams have total score = 80
  const scores = {
    // Team A: R1=35, R3=25, R2=20 (total 80)
    A: { round1: 35, round2: 20, round3: 25 },
    // Team B: R1=40, R3=20, R2=20 (total 80) -> Higher R1 than A, C, D! -> Should be #1
    B: { round1: 40, round2: 20, round3: 20 },
    // Team C: R1=35, R3=30, R2=15 (total 80) -> Same R1 as A, but higher R3 (30 > 25)! -> Should be #2 (A is #3)
    C: { round1: 35, round2: 15, round3: 30 },
    // Team D: R1=30, R3=30, R2=20 (total 80) -> Lower R1 (30) -> Should be #4
    D: { round1: 30, round2: 20, round3: 30 }
  };

  const ranked = computeLeaderboard(teams, scores, "total", { tieBreak: true });

  assert.equal(ranked[0].id, "B", "Team B wins tie-break due to better Round 1 score (40)");
  assert.equal(ranked[0].rank, 1);

  assert.equal(ranked[1].id, "C", "Team C beats A on Round 3 score (30 vs 25) after tying on Round 1 (35)");
  assert.equal(ranked[1].rank, 2);

  assert.equal(ranked[2].id, "A", "Team A is 3rd");
  assert.equal(ranked[2].rank, 3);

  assert.equal(ranked[3].id, "D", "Team D has lowest Round 1 score (30)");
  assert.equal(ranked[3].rank, 4);

  // Now test Round 2 breaking tie when R1 and R3 are equal:
  const scoresR2TieBreak = {
    X: { round1: 30, round2: 25, round3: 25 }, // total 80
    Y: { round1: 30, round2: 20, round3: 25 }  // total 75
  };
  const teamsXY = [{ id: "X", name: "X" }, { id: "Y", name: "Y" }];
  const rankedXY = computeLeaderboard(teamsXY, scoresR2TieBreak, "total", { tieBreak: true });
  assert.equal(rankedXY[0].id, "X");
});

test("Leaderboard order diff helper used by the animation (which rows moved/changed)", () => {
  const prev = [
    { id: "A", score: 50, rank: 1 },
    { id: "B", score: 45, rank: 2 },
    { id: "C", score: 40, rank: 3 }
  ];

  // Team C scores 20 points and moves to 1st place!
  const next = [
    { id: "C", score: 60, rank: 1 },
    { id: "A", score: 50, rank: 2 },
    { id: "B", score: 45, rank: 3 }
  ];

  const diff = diffLeaderboard(prev, next);
  assert.equal(diff.hasChanged, true);

  // C moved up from index 2 to 0
  const cMove = diff.moved.find((m) => m.id === "C");
  assert.equal(cMove.oldIndex, 2);
  assert.equal(cMove.newIndex, 0);
  assert.equal(cMove.direction, "up");

  // A moved down from index 0 to 1
  const aMove = diff.moved.find((m) => m.id === "A");
  assert.equal(aMove.oldIndex, 0);
  assert.equal(aMove.newIndex, 1);
  assert.equal(aMove.direction, "down");

  // Changed scores: C changed from 40 to 60 (+20)
  assert.equal(diff.changedScores.length, 1);
  assert.equal(diff.changedScores[0].id, "C");
  assert.equal(diff.changedScores[0].oldScore, 40);
  assert.equal(diff.changedScores[0].newScore, 60);
  assert.equal(diff.changedScores[0].delta, 20);
});

test("buildPodiumSlots returns left-to-right order 4,2,1,3,5, subsets for 1-4 teams, and keeps shared ranks for ties", () => {
  const sixRankedWithTie = [
    { id: "p1", name: "Đội 1", score: 100, rank: 1 },
    { id: "p2", name: "Đội 2", score: 90, rank: 2 },
    { id: "p3", name: "Đội 3", score: 90, rank: 2 }, // tied for 2nd -> rank 2, slot 3
    { id: "p4", name: "Đội 4", score: 70, rank: 4 },
    { id: "p5", name: "Đội 5", score: 60, rank: 5 },
    { id: "p6", name: "Đội 6", score: 50, rank: 6 }
  ];

  // Full 5 places: left-to-right slots 4, 2, 1, 3, 5
  const full5 = buildPodiumSlots(sixRankedWithTie);
  assert.deepEqual(
    full5.map((s) => s.slot),
    [4, 2, 1, 3, 5]
  );
  assert.deepEqual(
    full5.map((s) => s.id),
    ["p4", "p2", "p1", "p3", "p5"]
  );
  // Shared rank 2 is preserved on both slot 2 (p2) and slot 3 (p3)
  assert.deepEqual(
    full5.map((s) => s.rank),
    [4, 2, 1, 2, 5]
  );
  assert.deepEqual(
    full5.map((s) => s.trophy),
    ["clay", "silver", "gold", "bronze", "clay"]
  );

  // Subsets for 1-4 teams
  assert.deepEqual(
    buildPodiumSlots(sixRankedWithTie.slice(0, 4)).map((s) => s.slot),
    [4, 2, 1, 3]
  );
  assert.deepEqual(
    buildPodiumSlots(sixRankedWithTie.slice(0, 3)).map((s) => s.slot),
    [2, 1, 3]
  );
  assert.deepEqual(
    buildPodiumSlots(sixRankedWithTie.slice(0, 2)).map((s) => s.slot),
    [2, 1]
  );
  assert.deepEqual(
    buildPodiumSlots(sixRankedWithTie.slice(0, 1)).map((s) => s.slot),
    [1]
  );
  assert.deepEqual(buildPodiumSlots([]), []);
});

test("getTeamInitials extracts readable 2-character Vietnamese initials", () => {
  assert.equal(getTeamInitials("Đội Sao Vàng"), "SV");
  assert.equal(getTeamInitials("Hồng Hà"), "HH");
  assert.equal(getTeamInitials("Đội 1"), "Đ1");
});
