import test from "node:test";
import assert from "node:assert/strict";
import { normaliseRound1 } from "../js/data.js";
import {
  createInitialState,
  getAvailableRound1Packages,
  pickRound1Package,
  finishRound1Package,
  isTeamLocked,
  openRound3Tile,
  isTileOpened,
  recordAnswer,
  setRound2Score,
  unlockRound1Team,
  unlockRound1Package,
  unlockRound3Tile,
  resetState,
  exportState,
  importState
} from "../js/state.js";

const SAMPLE_TEAMS = [
  { id: "t1", name: "Đội 1" },
  { id: "t2", name: "Đội 2" },
  { id: "t3", name: "Đội 3" }
];

const SAMPLE_PACKAGES = normaliseRound1([
  { package: "Gói A", team_id: "t1", question: "Q1", points: "10" },
  { package: "Gói B", team_id: "t1", question: "Q2", points: "10" },
  { package: "Gói A", team_id: "t2", question: "Q3", points: "10" }
]);

test("picking and finishing a team's round-1 package locks the team and leaves other teams' packages untouched", () => {
  let state = createInitialState(SAMPLE_TEAMS);

  // t1 picks its own package "t1::Gói A"
  state = pickRound1Package(state, "t1", "t1::Gói A");

  // t1 has "t1::Gói B" remaining; t2 still has "t2::Gói A"
  const availableForT1 = getAvailableRound1Packages(state, SAMPLE_PACKAGES, "t1");
  assert.deepEqual(
    availableForT1.map((p) => p.id),
    ["t1::Gói B"]
  );
  const availableForT2 = getAvailableRound1Packages(state, SAMPLE_PACKAGES, "t2");
  assert.deepEqual(
    availableForT2.map((p) => p.id),
    ["t2::Gói A"]
  );

  // Finishing the package locks t1
  state = finishRound1Package(state, "t1");
  assert.equal(isTeamLocked(state, "t1"), true);
  assert.equal(isTeamLocked(state, "t2"), false);
  assert.throws(() => pickRound1Package(state, "t1", "t1::Gói B"));
});

test("opening a round-3 tile marks it opened", () => {
  let state = createInitialState(SAMPLE_TEAMS);
  assert.equal(isTileOpened(state, 12), false);

  state = openRound3Tile(state, 12, "t2");
  assert.equal(isTileOpened(state, 12), true);
  assert.equal(state.round3.activeTile.number, 12);
  assert.equal(state.round3.activeTile.selectedTeamId, "t2");
});

test("correct answer adds points to the right team and round, wrong adds none, and manual round-2 score works", () => {
  let state = createInitialState(SAMPLE_TEAMS);

  // Round 1 correct for t1 (+10), wrong for t1 (+0)
  state = recordAnswer(state, { round: 1, teamId: "t1", points: 10, correct: true });
  state = recordAnswer(state, { round: 1, teamId: "t1", points: 10, correct: false });
  assert.equal(state.scores.t1.round1, 10);
  assert.equal(state.scores.t1.round3, 0);

  // Round 3 correct for t2 (+30), wrong for t3 (+0)
  state = recordAnswer(state, { round: 3, teamId: "t2", points: 30, correct: true });
  state = recordAnswer(state, { round: 3, teamId: "t3", points: 30, correct: false });
  assert.equal(state.scores.t2.round3, 30);
  assert.equal(state.scores.t3.round3, 0);

  // Manual Round 2 score entry
  state = setRound2Score(state, "t1", 45);
  assert.equal(state.scores.t1.round2, 45);
});

test("unlock team/package/tile, reset, and export->import round-trip", () => {
  let state = createInitialState(SAMPLE_TEAMS);
  state = pickRound1Package(state, "t1", "t1::Gói A");
  state = finishRound1Package(state, "t1");
  state = openRound3Tile(state, 7, "t2");
  state = recordAnswer(state, { round: 1, teamId: "t1", points: 20, correct: true });
  state = setRound2Score(state, "t2", 50);

  // Export -> Import round-trip
  const json = exportState(state);
  const restored = importState(json);
  assert.deepEqual(restored, state);

  // Unlock team, package, and tile
  let unlocked = unlockRound1Team(restored, "t1");
  assert.equal(isTeamLocked(unlocked, "t1"), false);

  unlocked = unlockRound1Package(unlocked, "t1::Gói A");
  assert.equal(unlocked.round1.pickedPackages.includes("t1::Gói A"), false);

  unlocked = unlockRound3Tile(unlocked, 7);
  assert.equal(isTileOpened(unlocked, 7), false);

  // Reset wipes all scores and locks
  const fresh = resetState(SAMPLE_TEAMS);
  assert.equal(fresh.scores.t1.round1, 0);
  assert.equal(fresh.scores.t2.round2, 0);
  assert.deepEqual(fresh.round1.lockedTeams, []);
  assert.deepEqual(fresh.round3.openedTiles, []);
});
