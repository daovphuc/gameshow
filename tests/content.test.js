import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { normaliseAllData } from "../js/data.js";
import { groupRound2BySet } from "../js/round2.js";
import { generateDefaultAccounts } from "../js/auth.js";
import {
  csvToContent,
  contentToQuizData,
  resolveQuizData,
  validateContent,
  isContentEmpty,
  exportContentToJson,
  importContentFromJson
} from "../js/content.js";

const sampleDir = path.resolve("data/sample");
const teamsCsv = fs.readFileSync(path.join(sampleDir, "teams.csv"), "utf8");
const round1Csv = fs.readFileSync(path.join(sampleDir, "round1.csv"), "utf8");
const round2Csv = fs.readFileSync(path.join(sampleDir, "round2.csv"), "utf8");
const round3Csv = fs.readFileSync(path.join(sampleDir, "round3.csv"), "utf8");
const judgesCsv = fs.readFileSync(path.join(sampleDir, "judges.csv"), "utf8");
const accountsCsv = fs.readFileSync(path.join(sampleDir, "accounts.csv"), "utf8");
const configCsv = fs.readFileSync(path.join(sampleDir, "config.csv"), "utf8");

test("converting sample CSV data into stored content shape and back into app quiz data gives same teams, round1 packages, round2 sets, round3 tiles, judges, accounts and config as current CSV path", () => {
  const currentQuizData = normaliseAllData({
    teamsCsv,
    round1Csv,
    round2Csv,
    round3Csv,
    judgesCsv,
    accountsCsv,
    configCsv
  });

  const storedContent = csvToContent({
    teamsCsv,
    round1Csv,
    round2Csv,
    round3Csv,
    judgesCsv,
    accountsCsv,
    configCsv
  });

  const quizData = contentToQuizData(storedContent);

  // 1. Teams
  assert.deepEqual(quizData.teams, currentQuizData.teams);

  // 2. Round 1 packages
  assert.deepEqual(quizData.round1Packages, currentQuizData.round1Packages);

  // 3. Round 2 sets
  assert.deepEqual(
    groupRound2BySet(quizData.round2Questions),
    groupRound2BySet(currentQuizData.round2Questions)
  );
  assert.deepEqual(quizData.round2Questions, currentQuizData.round2Questions);

  // 4. Round 3 tiles
  assert.deepEqual(quizData.round3Questions, currentQuizData.round3Questions);

  // 5. Judges
  assert.deepEqual(quizData.judges, currentQuizData.judges);

  // 6. Accounts
  assert.deepEqual(quizData.accounts, currentQuizData.accounts);

  // 7. Config
  assert.deepEqual(quizData.config, currentQuizData.config);
});

test("validation accepts valid content from sample data", () => {
  const storedContent = csvToContent({
    teamsCsv,
    round1Csv,
    round2Csv,
    round3Csv,
    judgesCsv,
    accountsCsv,
    configCsv
  });

  const result = validateContent(storedContent);
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test("validation rejects duplicate team ids and returns Vietnamese error message", () => {
  const content = csvToContent({ teamsCsv, judgesCsv });
  content.teams.push({ id: "doi-01", name: "Đội Trùng ID" });

  const result = validateContent(content);
  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some((msg) => msg.includes("trùng lặp") && msg.includes("doi-01")),
    `Expected Vietnamese duplicate team id message, got: ${JSON.stringify(result.errors)}`
  );
});

test("validation rejects a round1 package pointing at an unknown team and returns Vietnamese error message", () => {
  const content = csvToContent({ teamsCsv, judgesCsv });
  content.round1 = [
    { package: "Gói A", team_id: "doi-unknown", question: "Câu hỏi mẫu" }
  ];

  const result = validateContent(content);
  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some(
      (msg) =>
        (msg.includes("không tồn tại") || msg.includes("chưa được khai báo")) &&
        msg.includes("doi-unknown")
    ),
    `Expected Vietnamese unknown team message, got: ${JSON.stringify(result.errors)}`
  );
});

test("validation rejects a round2 question whose correct answer is not one of A-D or whose option is empty, with Vietnamese messages", () => {
  // Test invalid correct answer
  const contentBadAnswer = csvToContent({ teamsCsv, judgesCsv });
  contentBadAnswer.round2 = [
    {
      set: "1",
      number: 1,
      question: "Câu hỏi trắc nghiệm?",
      option_a: "A",
      option_b: "B",
      option_c: "C",
      option_d: "D",
      correct: "E" // Invalid, must be A-D
    }
  ];

  const res1 = validateContent(contentBadAnswer);
  assert.equal(res1.valid, false);
  assert.ok(
    res1.errors.some((msg) => msg.includes("đáp án đúng") && msg.includes("không hợp lệ")),
    `Expected Vietnamese invalid answer message, got: ${JSON.stringify(res1.errors)}`
  );

  // Test empty option
  const contentEmptyOption = csvToContent({ teamsCsv, judgesCsv });
  contentEmptyOption.round2 = [
    {
      set: "1",
      number: 2,
      question: "Câu hỏi trắc nghiệm?",
      option_a: "A",
      option_b: "", // Empty option
      option_c: "C",
      option_d: "D",
      correct: "A"
    }
  ];

  const res2 = validateContent(contentEmptyOption);
  assert.equal(res2.valid, false);
  assert.ok(
    res2.errors.some((msg) => msg.includes("phương án lựa chọn") && msg.includes("trống")),
    `Expected Vietnamese empty option message, got: ${JSON.stringify(res2.errors)}`
  );
});

test("validation rejects duplicate round3 tile numbers and returns Vietnamese error message", () => {
  const content = csvToContent({ teamsCsv, judgesCsv });
  content.round3 = [
    { number: 1, question: "Tình huống 1" },
    { number: 1, question: "Tình huống 1 trùng lặp" }
  ];

  const result = validateContent(content);
  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some((msg) => msg.includes("trùng lặp") && msg.includes("1")),
    `Expected Vietnamese duplicate tile number message, got: ${JSON.stringify(result.errors)}`
  );
});

test("validation rejects an account linked to an unknown team or judge with Vietnamese message", () => {
  // Account with unknown team
  const contentBadTeamAcc = csvToContent({ teamsCsv, judgesCsv });
  contentBadTeamAcc.accounts = [
    { username: "doi99", password: "123", role: "team", ref_id: "doi-khong-ton-tai" }
  ];
  const res1 = validateContent(contentBadTeamAcc);
  assert.equal(res1.valid, false);
  assert.ok(
    res1.errors.some((msg) => msg.includes("đội thi không tồn tại") && msg.includes("doi-khong-ton-tai")),
    `Expected Vietnamese unknown team account message, got: ${JSON.stringify(res1.errors)}`
  );

  // Account with unknown judge
  const contentBadJudgeAcc = csvToContent({ teamsCsv, judgesCsv });
  contentBadJudgeAcc.accounts = [
    { username: "gk99", password: "123", role: "judge", ref_id: "gk-khong-ton-tai" }
  ];
  const res2 = validateContent(contentBadJudgeAcc);
  assert.equal(res2.valid, false);
  assert.ok(
    res2.errors.some((msg) => msg.includes("giám khảo không tồn tại") && msg.includes("gk-khong-ton-tai")),
    `Expected Vietnamese unknown judge account message, got: ${JSON.stringify(res2.errors)}`
  );
});

test("when content has teams/judges but no accounts, default accounts are generated from them as today", () => {
  const storedContent = csvToContent({ teamsCsv, judgesCsv });
  delete storedContent.accounts; // Missing accounts

  const quizData = contentToQuizData(storedContent);
  const expectedDefaults = generateDefaultAccounts({
    judges: quizData.judges,
    teams: quizData.teams
  });

  assert.equal(quizData.accounts.length, expectedDefaults.length);
  assert.deepEqual(quizData.accounts, expectedDefaults);
  assert.equal(quizData.accounts[0].username, "mc");
  assert.ok(quizData.accounts.some((a) => a.username === "gk1" && a.role === "judge"));
  assert.ok(quizData.accounts.some((a) => a.username === "doi01" && a.role === "team"));
});

test("empty/missing content resolves to the sample fallback", () => {
  const sampleFallback = normaliseAllData({
    teamsCsv,
    round1Csv,
    round2Csv,
    round3Csv,
    judgesCsv,
    accountsCsv,
    configCsv
  });

  assert.equal(isContentEmpty(null), true);
  assert.equal(isContentEmpty(undefined), true);
  assert.equal(isContentEmpty({}), true);
  assert.equal(isContentEmpty({ teams: [] }), true);

  // resolveQuizData with fallback
  const resolvedNull = resolveQuizData(null, sampleFallback);
  assert.deepEqual(resolvedNull, sampleFallback);

  const resolvedUndefined = resolveQuizData(undefined, sampleFallback);
  assert.deepEqual(resolvedUndefined, sampleFallback);

  const resolvedEmptyObj = resolveQuizData({}, sampleFallback);
  assert.deepEqual(resolvedEmptyObj, sampleFallback);

  // contentToQuizData with fallback argument
  const fallbackFromNull = contentToQuizData(null, sampleFallback);
  assert.deepEqual(fallbackFromNull, sampleFallback);
});

test("JSON export and import round-trip preserves content and validates correctly", () => {
  const storedContent = csvToContent({
    teamsCsv,
    round1Csv,
    round2Csv,
    round3Csv,
    judgesCsv,
    accountsCsv,
    configCsv
  });

  const jsonStr = exportContentToJson(storedContent);
  assert.ok(typeof jsonStr === "string" && jsonStr.length > 0);

  const imported = importContentFromJson(jsonStr);
  assert.equal(imported.ok, true);
  assert.deepEqual(imported.content, storedContent);

  // Invalid JSON test
  const badImport = importContentFromJson("{ invalid json ");
  assert.equal(badImport.ok, false);
  assert.ok(badImport.errors.length > 0);
});

test("validation rejects data: URLs for team and question images with Vietnamese message", () => {
  const content = csvToContent({
    teamsCsv,
    round1Csv,
    round2Csv,
    round3Csv,
    judgesCsv,
    accountsCsv,
    configCsv
  });

  // 1. Team image as data: URL
  const teamContent = JSON.parse(JSON.stringify(content));
  teamContent.teams[0].image_url = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const resTeam = validateContent(teamContent);
  assert.equal(resTeam.valid, false);
  assert.ok(
    resTeam.errors.some((msg) => msg.includes("data: URL") && msg.includes("images/")),
    `Expected Vietnamese rejection for team data: URL, got: ${JSON.stringify(resTeam.errors)}`
  );

  // 2. Round 1 question image as data: URL
  const r1Content = JSON.parse(JSON.stringify(content));
  r1Content.round1[0].image_url = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
  const resR1 = validateContent(r1Content);
  assert.equal(resR1.valid, false);
  assert.ok(
    resR1.errors.some((msg) => msg.includes("data: URL") && msg.includes("images/")),
    `Expected Vietnamese rejection for round 1 data: URL, got: ${JSON.stringify(resR1.errors)}`
  );

  // 3. Round 2 question image as data: URL
  const r2Content = JSON.parse(JSON.stringify(content));
  r2Content.round2[0].image_url = "data:image/png;base64,iVBORw0KGgo==";
  const resR2 = validateContent(r2Content);
  assert.equal(resR2.valid, false);
  assert.ok(
    resR2.errors.some((msg) => msg.includes("data: URL") && msg.includes("images/")),
    `Expected Vietnamese rejection for round 2 data: URL, got: ${JSON.stringify(resR2.errors)}`
  );

  // 4. Round 3 question image as data: URL
  const r3Content = JSON.parse(JSON.stringify(content));
  r3Content.round3[0].image_url = "data:image/png;base64,iVBORw0KGgo==";
  const resR3 = validateContent(r3Content);
  assert.equal(resR3.valid, false);
  assert.ok(
    resR3.errors.some((msg) => msg.includes("data: URL") && msg.includes("images/")),
    `Expected Vietnamese rejection for round 3 data: URL, got: ${JSON.stringify(resR3.errors)}`
  );

  // 5. Valid filename or https URL is accepted
  const validContent = JSON.parse(JSON.stringify(content));
  validContent.teams[0].image_url = "doi01.png";
  validContent.round1[0].image_url = "images/round1-pkg1.png";
  validContent.round2[0].image_url = "https://example.com/pccc.jpg";
  validContent.round3[0].image_url = "tinh-huong-1.jpg";
  const resValid = validateContent(validContent);
  assert.equal(resValid.valid, true);
  assert.equal(resValid.errors.length, 0);
});
