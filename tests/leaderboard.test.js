import test from "node:test";
import assert from "node:assert/strict";
import {
  computeLeaderboard,
  buildPodiumSlots,
  getTeamInitials
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

  // Total leaderboard
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
