import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  resolveImageUrl,
  normaliseConfig,
  normaliseTeams,
  normaliseRound1,
  normaliseRound3,
  getOfferedPackages,
  normaliseAllData
} from "../js/data.js";

test("resolveImageUrl maps bare file names to images/, keeps https:// and paths with /, and returns empty for blank", () => {
  assert.equal(resolveImageUrl("doi-01.jpg"), "images/doi-01.jpg");
  assert.equal(resolveImageUrl("  cau-05.png  "), "images/cau-05.png");
  assert.equal(resolveImageUrl("https://example.com/1.png"), "https://example.com/1.png");
  assert.equal(resolveImageUrl("http://example.com/a.jpg"), "http://example.com/a.jpg");
  assert.equal(resolveImageUrl("teams/x.png"), "teams/x.png");
  assert.equal(resolveImageUrl("images/doi-01.jpg"), "images/doi-01.jpg");
  assert.equal(resolveImageUrl(""), "");
  assert.equal(resolveImageUrl("   "), "");
  assert.equal(resolveImageUrl(null), "");
  assert.equal(resolveImageUrl(undefined), "");
});

test("normaliseTeams skips rows with blank required fields, resolves image_url, and fills optional defaults", () => {
  const rows = [
    { id: "t1", name: "Đội 1", image_url: "doi-01.jpg", color: "#112233" },
    { id: "t2", name: "Đội 2", image_url: "https://example.com/2.png" },
    { id: "t3", name: "Đội 3" },
    { id: "", name: "Không có ID" },
    { id: "t4", name: "   " }
  ];

  const teams = normaliseTeams(rows);
  assert.equal(teams.length, 3);
  assert.deepEqual(teams[0], {
    id: "t1",
    name: "Đội 1",
    image_url: "images/doi-01.jpg",
    color: "#112233"
  });
  assert.equal(teams[1].image_url, "https://example.com/2.png");
  assert.equal(teams[2].id, "t3");
  assert.equal(teams[2].name, "Đội 3");
  assert.equal(teams[2].image_url, "");
  assert.ok(teams[2].color.startsWith("#"));
});

test("normaliseRound1 requires team_id, skips rows without team_id, has no answer field, and first valid row wins per package", () => {
  const config = normaliseConfig([
    { key: "round1_time_seconds", value: "18" },
    { key: "round1_default_points", value: "15" }
  ]);

  const rows = [
    // Valid first row for t1::Gói A
    { package: "Gói A", team_id: "t1", question: "Câu hỏi đầu tiên (thắng)", time_seconds: "", points: "" },
    // Duplicate row for t1::Gói A is ignored
    { package: "Gói A", team_id: "t1", question: "Câu hỏi phụ bị bỏ qua", time_seconds: "25", points: "20" },
    // Valid row for t1::Gói B with bare image filename
    { package: "Gói B", team_id: "t1", question: "Câu hỏi B của đội 1", image_url: "v1-b.png", time_seconds: "12", points: "10" },
    // Rows without team_id are skipped (no shared packages)
    { package: "Gói Không Đội", team_id: "", question: "Câu hỏi không có team_id bị bỏ qua" },
    { package: "Gói Khoảng Trắng", team_id: "   ", question: "Bị bỏ qua" },
    // Incomplete rows skipped
    { package: "Gói Lỗi", team_id: "t1", question: "   " },
    { package: "", team_id: "t1", question: "Thiếu tên gói" }
  ];

  const packages = normaliseRound1(rows, config);
  assert.equal(packages.length, 2);

  const pkgA = packages[0];
  assert.equal(pkgA.id, "t1::Gói A");
  assert.equal(pkgA.package, "Gói A");
  assert.equal(pkgA.team_id, "t1");
  assert.equal(pkgA.questions.length, 1);
  assert.equal(pkgA.question, "Câu hỏi đầu tiên (thắng)");
  assert.equal(pkgA.questions[0].question, "Câu hỏi đầu tiên (thắng)");
  assert.equal("answer" in pkgA, false);
  assert.equal("answer" in pkgA.questions[0], false);
  assert.equal(pkgA.time_seconds, 18);
  assert.equal(pkgA.points, 15);
  assert.equal(pkgA.image_url, "");

  const pkgB = packages[1];
  assert.equal(pkgB.id, "t1::Gói B");
  assert.equal(pkgB.team_id, "t1");
  assert.equal("answer" in pkgB, false);
  assert.equal(pkgB.time_seconds, 12);
  assert.equal(pkgB.points, 10);
  assert.equal(pkgB.image_url, "images/v1-b.png");
});

test("getOfferedPackages offers only a team's own packages and never offers another team's packages", () => {
  const packages = normaliseRound1([
    { package: "Gói A", team_id: "t1", question: "Q1" },
    { package: "Gói B", team_id: "t1", question: "Q2" },
    { package: "Gói C", team_id: "t1", question: "Q3" },
    { package: "Gói A", team_id: "t2", question: "Q4" }
  ]);

  const forT1 = getOfferedPackages(packages, "t1", []);
  assert.deepEqual(
    forT1.map((p) => p.id),
    ["t1::Gói A", "t1::Gói B", "t1::Gói C"]
  );

  // With limit = 2, t1 gets its first 2 packages
  const forT1Limited = getOfferedPackages(packages, "t1", [], 2);
  assert.deepEqual(
    forT1Limited.map((p) => p.id),
    ["t1::Gói A", "t1::Gói B"]
  );

  // Picking t1::Gói A removes it from t1's available packages and does not affect t2::Gói A
  const forT1AfterPick = getOfferedPackages(packages, "t1", ["t1::Gói A"]);
  assert.deepEqual(
    forT1AfterPick.map((p) => p.id),
    ["t1::Gói B", "t1::Gói C"]
  );

  const forT2 = getOfferedPackages(packages, "t2", ["t1::Gói A"]);
  assert.deepEqual(
    forT2.map((p) => p.id),
    ["t2::Gói A"]
  );

  // Team t3 has no packages configured -> gets empty list
  assert.deepEqual(getOfferedPackages(packages, "t3", []), []);
});

test("normaliseRound3 parses numbers, applies defaults, resolves image_url, has no answer field, and sorts by tile number", () => {
  const config = normaliseConfig([{ key: "round3_time_seconds", value: "25" }]);
  const rows = [
    { number: "2", question: "Câu số 2", image_url: "cau-2.jpg", points: "30", time_seconds: "15" },
    { number: "1", question: "Câu số 1", points: "", time_seconds: "" },
    { number: "abc", question: "Số sai" },
    { number: "3", question: "" }
  ];

  const tiles = normaliseRound3(rows, config);
  assert.equal(tiles.length, 2);
  assert.equal(tiles[0].number, 1);
  assert.equal("answer" in tiles[0], false);
  assert.equal(tiles[0].time_seconds, 25);
  assert.equal(tiles[0].points, 20);
  assert.equal(tiles[0].image_url, "");

  assert.equal(tiles[1].number, 2);
  assert.equal("answer" in tiles[1], false);
  assert.equal(tiles[1].time_seconds, 15);
  assert.equal(tiles[1].points, 30);
  assert.equal(tiles[1].image_url, "images/cau-2.jpg");
});

test("sample CSV files in data/sample parse and normalise cleanly with 12 teams, 24 team-owned round-1 packages, 50 round-3 questions, and no answer fields", () => {
  const sampleDir = path.resolve("data/sample");
  const teamsCsv = fs.readFileSync(path.join(sampleDir, "teams.csv"), "utf8");
  const round1Csv = fs.readFileSync(path.join(sampleDir, "round1.csv"), "utf8");
  const round3Csv = fs.readFileSync(path.join(sampleDir, "round3.csv"), "utf8");
  const configCsv = fs.readFileSync(path.join(sampleDir, "config.csv"), "utf8");
  const scoresCsv = fs.readFileSync(path.join(sampleDir, "scores.csv"), "utf8");

  const data = normaliseAllData({ teamsCsv, round1Csv, round3Csv, configCsv, scoresCsv });
  assert.equal(data.teams.length, 12);
  assert.equal(data.round1Packages.length, 24);
  for (const pkg of data.round1Packages) {
    assert.ok(pkg.team_id);
    assert.equal(pkg.questions.length, 1);
    assert.equal("answer" in pkg, false);
    assert.equal("answer" in pkg.questions[0], false);
  }
  assert.equal(data.round3Questions.length, 50);
  for (const tile of data.round3Questions) {
    assert.equal("answer" in tile, false);
  }
  assert.equal(data.config.round1_time_seconds, 15);
  assert.equal(data.config.round3_time_seconds, 20);
  assert.equal(data.config.warning_seconds, 5);
  assert.equal(Object.keys(data.scores).length, 12);
});
