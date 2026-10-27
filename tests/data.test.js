import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  normaliseConfig,
  normaliseTeams,
  normaliseRound1,
  normaliseRound3,
  getOfferedPackages,
  normaliseAllData
} from "../js/data.js";

test("normaliseTeams skips rows with blank required fields and fills optional defaults", () => {
  const rows = [
    { id: "t1", name: "Đội 1", image_url: "https://example.com/1.png", color: "#112233" },
    { id: "t2", name: "Đội 2" },
    { id: "", name: "Không có ID" },
    { id: "t3", name: "   " }
  ];

  const teams = normaliseTeams(rows);
  assert.equal(teams.length, 2);
  assert.deepEqual(teams[0], {
    id: "t1",
    name: "Đội 1",
    image_url: "https://example.com/1.png",
    color: "#112233"
  });
  assert.equal(teams[1].id, "t2");
  assert.equal(teams[1].name, "Đội 2");
  assert.equal(teams[1].image_url, "");
  assert.ok(teams[1].color.startsWith("#"));
});

test("normaliseRound1 groups by package, sorts by order, parses numbers, Applies config defaults, and skips incomplete rows", () => {
  const config = normaliseConfig([
    { key: "round1_time_seconds", value: "18" },
    { key: "round1_default_points", value: "15" }
  ]);

  const rows = [
    { package: "Gói A", team_id: "t1", order: "3", question: "Câu 3", answer: "Đáp 3", time_seconds: "25", points: "20" },
    { package: "Gói A", team_id: "t1", order: "1", question: "Câu 1", answer: "Đáp 1", time_seconds: "", points: "" },
    { package: "Gói A", team_id: "t1", order: "2", question: "Câu 2", answer: "Đáp 2", image_url: "img.png", time_seconds: "12", points: "10" },
    { package: "Gói A", team_id: "t1", order: "4", question: "", answer: "Thiếu câu hỏi" },
    { package: "", team_id: "", order: "1", question: "Thiếu gói", answer: "Đáp" },
    { package: "Gói Chung 1", team_id: "", order: "1", question: "Chung 1", answer: "Đáp C1" }
  ];

  const packages = normaliseRound1(rows, config);
  assert.equal(packages.length, 2);

  const pkgA = packages[0];
  assert.equal(pkgA.package, "Gói A");
  assert.equal(pkgA.team_id, "t1");
  assert.equal(pkgA.questions.length, 3);
  assert.deepEqual(
    pkgA.questions.map((q) => q.question),
    ["Câu 1", "Câu 2", "Câu 3"]
  );
  // Missing time_seconds and points get defaults from config
  assert.equal(pkgA.questions[0].time_seconds, 18);
  assert.equal(pkgA.questions[0].points, 15);
  assert.equal(pkgA.questions[0].image_url, "");
  // Provided numbers are parsed
  assert.equal(pkgA.questions[1].time_seconds, 12);
  assert.equal(pkgA.questions[1].points, 10);
  assert.equal(pkgA.questions[1].image_url, "img.png");
});

test("getOfferedPackages offers team-specific packages only to that team and unpicked shared packages to any team", () => {
  const packages = normaliseRound1([
    { package: "Gói T1-A", team_id: "t1", order: "1", question: "Q1", answer: "A1" },
    { package: "Gói T1-B", team_id: "t1", order: "1", question: "Q2", answer: "A2" },
    { package: "Gói T2-A", team_id: "t2", order: "1", question: "Q3", answer: "A3" },
    { package: "Gói Chung 1", team_id: "", order: "1", question: "Q4", answer: "A4" },
    { package: "Gói Chung 2", team_id: "", order: "1", question: "Q5", answer: "A5" }
  ]);

  const forT1 = getOfferedPackages(packages, "t1", []);
  assert.deepEqual(
    forT1.map((p) => p.package),
    ["Gói T1-A", "Gói T1-B", "Gói Chung 1", "Gói Chung 2"]
  );

  // With limit = 2, t1 gets its 2 team-specific packages
  const forT1Limited = getOfferedPackages(packages, "t1", [], 2);
  assert.deepEqual(
    forT1Limited.map((p) => p.package),
    ["Gói T1-A", "Gói T1-B"]
  );

  // Team t3 has no team-specific packages, so it gets the shared pool
  const forT3 = getOfferedPackages(packages, "t3", []);
  assert.deepEqual(
    forT3.map((p) => p.package),
    ["Gói Chung 1", "Gói Chung 2"]
  );

  // Once "Gói Chung 1" is picked, it is excluded for other teams
  const forT3AfterPick = getOfferedPackages(packages, "t3", ["Gói Chung 1"]);
  assert.deepEqual(
    forT3AfterPick.map((p) => p.id),
    ["Gói Chung 2"]
  );
});

test("normaliseRound3 parses numbers, applies defaults, skips invalid rows, and sorts by tile number", () => {
  const config = normaliseConfig([{ key: "round3_time_seconds", value: "25" }]);
  const rows = [
    { number: "2", question: "Câu số 2", answer: "Đáp 2", points: "30", time_seconds: "15" },
    { number: "1", question: "Câu số 1", answer: "Đáp 1", points: "", time_seconds: "" },
    { number: "abc", question: "Số sai", answer: "Đáp" },
    { number: "3", question: "Thiếu đáp án", answer: "" }
  ];

  const tiles = normaliseRound3(rows, config);
  assert.equal(tiles.length, 2);
  assert.equal(tiles[0].number, 1);
  assert.equal(tiles[0].time_seconds, 25);
  assert.equal(tiles[0].points, 20);
  assert.equal(tiles[0].image_url, "");

  assert.equal(tiles[1].number, 2);
  assert.equal(tiles[1].time_seconds, 15);
  assert.equal(tiles[1].points, 30);
});

test("sample CSV files in data/sample parse and normalise cleanly with 12 teams and 50 round-3 questions", () => {
  const sampleDir = path.resolve("data/sample");
  const teamsCsv = fs.readFileSync(path.join(sampleDir, "teams.csv"), "utf8");
  const round1Csv = fs.readFileSync(path.join(sampleDir, "round1.csv"), "utf8");
  const round3Csv = fs.readFileSync(path.join(sampleDir, "round3.csv"), "utf8");
  const configCsv = fs.readFileSync(path.join(sampleDir, "config.csv"), "utf8");

  const data = normaliseAllData({ teamsCsv, round1Csv, round3Csv, configCsv });
  assert.equal(data.teams.length, 12);
  assert.ok(data.round1Packages.length >= 24);
  assert.equal(data.round3Questions.length, 50);
  assert.equal(data.config.round1_time_seconds, 15);
  assert.equal(data.config.round3_time_seconds, 20);
});

test("team-specific packages with the same name stay separate per team", () => {
  const packages = normaliseRound1([
    { package: "Gói A", team_id: "t1", order: "1", question: "Q1", answer: "A1" },
    { package: "Gói A", team_id: "t2", order: "1", question: "Q2", answer: "A2" }
  ]);
  assert.equal(packages.length, 2);
  const t1Pkg = getOfferedPackages(packages, "t1")[0];
  assert.equal(t1Pkg.questions[0].question, "Q1");
  const offeredT2 = getOfferedPackages(packages, "t2", [t1Pkg.id]);
  assert.deepEqual(offeredT2.map((p) => p.questions[0].question), ["Q2"]);
});
