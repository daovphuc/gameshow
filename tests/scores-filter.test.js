import test from "node:test";
import assert from "node:assert/strict";
import {
  removeVietnameseAccents,
  matchesSearch,
  getMissingJudgeFlags,
  filterAndSortScoreRows
} from "../js/scores-filter.js";

test("removeVietnameseAccents strips accents and diacritics correctly", () => {
  assert.equal(removeVietnameseAccents("Hà Nội"), "ha noi");
  assert.equal(removeVietnameseAccents("Đà Nẵng"), "da nang");
  assert.equal(removeVietnameseAccents("Công an TP. Hồ Chí Minh"), "cong an tp. ho chi minh");
  assert.equal(removeVietnameseAccents("Bà Rịa - Vũng Tàu"), "ba ria - vung tau");
  assert.equal(removeVietnameseAccents(""), "");
  assert.equal(removeVietnameseAccents(null), "");
});

test("matchesSearch performs case- and accent-insensitive Vietnamese search", () => {
  const teamName = "Công an TP. Hà Nội";
  assert.equal(matchesSearch(teamName, "ha noi"), true);
  assert.equal(matchesSearch(teamName, "Hà Nội"), true);
  assert.equal(matchesSearch(teamName, "HA NOI"), true);
  assert.equal(matchesSearch(teamName, "hà nội"), true);
  assert.equal(matchesSearch(teamName, "cong an"), true);
  assert.equal(matchesSearch(teamName, "da nang"), false);
  assert.equal(matchesSearch(teamName, ""), true);
  assert.equal(matchesSearch(teamName, "  "), true);

  const team2 = "Công an TP. Đà Nẵng";
  assert.equal(matchesSearch(team2, "da nang"), true);
  assert.equal(matchesSearch(team2, "Đà Nẵng"), true);
  assert.equal(matchesSearch(team2, "DANANG"), false);
});

test("getMissingJudgeFlags flags missing judges accurately", () => {
  const judges = [
    { id: "gk-01", name: "GK1" },
    { id: "gk-02", name: "GK2" },
    { id: "gk-03", name: "GK3" }
  ];

  // No scores recorded yet -> all 3 missing
  const allMissing = getMissingJudgeFlags(judges, {});
  assert.deepEqual(allMissing, ["Thiếu điểm GK1", "Thiếu điểm GK2", "Thiếu điểm GK3"]);

  // Only GK2 missing
  const gk2Missing = getMissingJudgeFlags(judges, {
    "gk-01": { content: 40, manner: 5 },
    "gk-03": { content: 42, manner: 4 }
  });
  assert.deepEqual(gk2Missing, ["Thiếu điểm GK2"]);

  // All have scored -> empty array
  const noneMissing = getMissingJudgeFlags(judges, {
    "gk-01": { content: 40, manner: 5 },
    "gk-02": { content: 38, manner: 4 },
    "gk-03": { content: 42, manner: 4 }
  });
  assert.deepEqual(noneMissing, []);
});

test("filterAndSortScoreRows filters by search query and onlyRoundTeams", () => {
  const sampleRows = [
    { id: "doi-01", name: "Công an TP. Hà Nội", orderNumber: 1, rank: 2, inRound: true, total: 85 },
    { id: "doi-02", name: "Công an TP. Đà Nẵng", orderNumber: 2, rank: 1, inRound: false, total: 90 },
    { id: "doi-03", name: "Công an TP. Hồ Chí Minh", orderNumber: 3, rank: 3, inRound: true, total: 80 }
  ];

  // Search filter
  const searchResults = filterAndSortScoreRows(sampleRows, { search: "ha noi" });
  assert.equal(searchResults.length, 1);
  assert.equal(searchResults[0].id, "doi-01");

  // Only round teams filter
  const roundOnly = filterAndSortScoreRows(sampleRows, { onlyRoundTeams: true });
  assert.equal(roundOnly.length, 2);
  assert.equal(roundOnly.some((r) => r.id === "doi-02"), false);

  // Both search and only round teams
  const combined = filterAndSortScoreRows(sampleRows, { search: "da nang", onlyRoundTeams: true });
  assert.equal(combined.length, 0); // doi-02 matches search but inRound is false
});

test("filterAndSortScoreRows sorts by rank, STT, and name", () => {
  const sampleRows = [
    { id: "doi-01", name: "Hà Nội", orderNumber: 2, rank: 3 },
    { id: "doi-02", name: "Đà Nẵng", orderNumber: 1, rank: 1 },
    { id: "doi-03", name: "An Giang", orderNumber: 3, rank: 2 }
  ];

  // Sort by rank: Đà Nẵng (1) -> An Giang (2) -> Hà Nội (3)
  const byRank = filterAndSortScoreRows(sampleRows, { sortBy: "rank" });
  assert.deepEqual(byRank.map((r) => r.id), ["doi-02", "doi-03", "doi-01"]);

  // Sort by STT: Đà Nẵng (1) -> Hà Nội (2) -> An Giang (3)
  const byStt = filterAndSortScoreRows(sampleRows, { sortBy: "stt" });
  assert.deepEqual(byStt.map((r) => r.id), ["doi-02", "doi-01", "doi-03"]);

  // Sort by name: An Giang -> Đà Nẵng -> Hà Nội
  const byName = filterAndSortScoreRows(sampleRows, { sortBy: "name" });
  assert.deepEqual(byName.map((r) => r.name), ["An Giang", "Đà Nẵng", "Hà Nội"]);
});
