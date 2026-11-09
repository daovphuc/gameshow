import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parseCsv } from "../js/csv.js";
import { normaliseClusters, applyCluster } from "../js/clusters.js";
import {
  normaliseRound2,
  calculateRound2QuestionScore,
  startRound2Question,
  submitRound2Answer,
  lockRound2Question,
  revealRound2Question
} from "../js/round2.js";
import {
  csvToContent,
  contentToQuizData,
  exportContentToJson,
  importContentFromJson,
  validateContent
} from "../js/content.js";

const sampleDir = path.resolve("data/sample");

test("cluster definitions parse from sample data, have 12/12/11 teams, and cover all 35 preset IDs once", () => {
  const clustersCsv = fs.readFileSync(path.join(sampleDir, "clusters.csv"), "utf8");
  const clusters = normaliseClusters(clustersCsv);

  assert.ok(clusters.length >= 4);

  const cum1 = clusters.find((c) => c.id === "cum-1");
  const cum2 = clusters.find((c) => c.id === "cum-2");
  const cum3 = clusters.find((c) => c.id === "cum-3");
  const chungKet = clusters.find((c) => c.id === "chung-ket");

  assert.ok(cum1);
  assert.ok(cum2);
  assert.ok(cum3);
  assert.ok(chungKet);

  assert.equal(cum1.team_ids.length, 12, "Cụm 1 must have 12 teams");
  assert.equal(cum2.team_ids.length, 12, "Cụm 2 must have 12 teams");
  assert.equal(cum3.team_ids.length, 11, "Cụm 3 must have 11 teams");

  const totalAssigned = cum1.team_ids.length + cum2.team_ids.length + cum3.team_ids.length;
  assert.equal(totalAssigned, 35, "Total teams across 3 clusters must be 35");

  const allAssignedIds = [...cum1.team_ids, ...cum2.team_ids, ...cum3.team_ids];
  const uniqueIds = new Set(allAssignedIds);
  assert.equal(uniqueIds.size, 35, "Every team ID in clusters must be unique");

  for (let i = 1; i <= 35; i++) {
    const expectedId = `doi-${String(i).padStart(2, "0")}`;
    assert.ok(uniqueIds.has(expectedId), `Preset ID ${expectedId} must be present in clusters`);
  }

  assert.ok(cum1.subtitle.includes("Cụm 1"));
  assert.ok(cum1.subtitle.includes("Học viện PCCC và CNCH"));
  assert.ok(cum2.subtitle.includes("Cụm 2"));
  assert.ok(cum2.subtitle.includes("Quảng Ngãi"));
  assert.ok(cum3.subtitle.includes("Cụm 3"));
  assert.ok(cum3.subtitle.includes("Tây Ninh"));
  assert.ok(chungKet.subtitle.includes("Chung kết"));
  assert.ok(chungKet.subtitle.includes("Khánh Hòa"));
});

test("applying a cluster sets contest and round orders to that list and updates show_subtitle", () => {
  const clustersCsv = fs.readFileSync(path.join(sampleDir, "clusters.csv"), "utf8");
  const clusters = normaliseClusters(clustersCsv);
  const cum1 = clusters.find((c) => c.id === "cum-1");

  const initialRoundOrder = { contest: ["doi-01"], round1: ["doi-01"], round2: [], round3: [] };
  const initialConfig = { show_subtitle: "Default subtitle" };

  const res = applyCluster("cum-1", {
    round_order: initialRoundOrder,
    config: initialConfig,
    clusters
  });

  assert.deepEqual(res.round_order.contest, cum1.team_ids);
  assert.deepEqual(res.round_order.round1, cum1.team_ids);
  assert.deepEqual(res.round_order.round2, cum1.team_ids);
  assert.deepEqual(res.round_order.round3, cum1.team_ids);
  assert.equal(res.config.show_subtitle, cum1.subtitle);
  assert.equal(res.appliedCluster.id, "cum-1");
});

test("round 2 question CSV <-> content round trip keeps category and explanation", () => {
  const teamsCsv = fs.readFileSync(path.join(sampleDir, "teams.csv"), "utf8");
  const round2Csv = fs.readFileSync(path.join(sampleDir, "round2.csv"), "utf8");
  const judgesCsv = fs.readFileSync(path.join(sampleDir, "judges.csv"), "utf8");

  const content = csvToContent({ teamsCsv, round2Csv, judgesCsv });
  assert.ok(content.round2.length > 0);

  const chayThuQuestions = content.round2.filter((q) => String(q.set) === "Chạy thử");
  assert.equal(chayThuQuestions.length, 10);

  for (const q of chayThuQuestions) {
    assert.ok(q.category, `Question ${q.number} must have category`);
    assert.ok(q.explanation, `Question ${q.number} must have explanation`);
  }

  // JSON export & import round trip
  const jsonStr = exportContentToJson(content);
  const importedContent = importContentFromJson(jsonStr);
  assert.equal(importedContent.ok, true);
  const reChayThu = importedContent.content.round2.filter((q) => String(q.set) === "Chạy thử");
  assert.equal(reChayThu.length, 10);
  for (let i = 0; i < 10; i++) {
    assert.equal(reChayThu[i].category, chayThuQuestions[i].category);
    assert.equal(reChayThu[i].explanation, chayThuQuestions[i].explanation);
  }

  // Converted quiz data round trip
  const quizData = contentToQuizData(content);
  const qdChayThu = quizData.round2Questions.filter((q) => String(q.set) === "Chạy thử");
  assert.equal(qdChayThu.length, 10);
  for (let i = 0; i < 10; i++) {
    assert.equal(qdChayThu[i].category, chayThuQuestions[i].category);
    assert.equal(qdChayThu[i].explanation, chayThuQuestions[i].explanation);
  }
});

test("the 'Chạy thử' set has 10 questions with category counts 4/3/2/1, valid options, and explanations", () => {
  const round2Csv = fs.readFileSync(path.join(sampleDir, "round2.csv"), "utf8");
  const questions = normaliseRound2(round2Csv);
  const chayThu = questions.filter((q) => String(q.set) === "Chạy thử");

  assert.equal(chayThu.length, 10, "Set 'Chạy thử' must have exactly 10 questions");

  const catCounts = {};
  for (const q of chayThu) {
    catCounts[q.category] = (catCounts[q.category] || 0) + 1;
    assert.ok(q.explanation && q.explanation.trim().length > 0, `Question ${q.number} must have explanation`);

    const validOptions = new Set(["A", "B"]);
    if (q.option_c) validOptions.add("C");
    if (q.option_d) validOptions.add("D");

    assert.ok(
      validOptions.has(q.correct),
      `Question ${q.number} correct answer '${q.correct}' must be in valid options`
    );
  }

  assert.equal(catCounts["Kiểm tra"], 4, "Must have 4 Kiểm tra questions");
  assert.equal(catCounts["Tuyên truyền"], 3, "Must have 3 Tuyên truyền questions");
  assert.equal(catCounts["Xử phạt"], 2, "Must have 2 Xử phạt questions");
  assert.equal(catCounts["Điều tra"], 1, "Must have 1 Điều tra questions");
});

test("2-option questions render and score correctly in Round 2", () => {
  const twoOptionQ = {
    id: "r2_test_2opt",
    set: "test",
    number: 1,
    question: "Hành vi này có vi phạm không?",
    option_a: "Có",
    option_b: "Không",
    option_c: "",
    option_d: "",
    correct: "B",
    time_seconds: 30,
    category: "Xử phạt",
    explanation: "Căn cứ quy định..."
  };

  // Test scoring logic
  const correctScore = calculateRound2QuestionScore({
    isCorrect: true,
    answeredAt: 10000,
    shownAt: 5000,
    durationSeconds: 30,
    pointsPerCorrect: 2
  });
  assert.equal(correctScore, 2);

  const wrongScore = calculateRound2QuestionScore({
    isCorrect: false,
    answeredAt: 10000,
    shownAt: 5000,
    durationSeconds: 30,
    pointsPerCorrect: 2
  });
  assert.equal(wrongScore, 0);

  // Test live state reducer with 2-option question
  const t0 = 1000;
  let state = {
    status: "idle",
    activeQuestion: null,
    shownAt: null,
    deadline: null,
    answers: {},
    results: null
  };

  state = startRound2Question(state, twoOptionQ, t0);
  assert.equal(state.status, "open");
  assert.equal(state.activeQuestion.option_a, "Có");
  assert.equal(state.activeQuestion.option_b, "Không");
  assert.equal(state.activeQuestion.correct, undefined, "Tablet question payload must not have correct answer");
  assert.equal(state.activeQuestion.explanation, undefined, "Tablet question payload must not have explanation");

  state = submitRound2Answer(state, { teamId: "doi-01", answer: "B", serverTime: t0 + 5000 });
  state = submitRound2Answer(state, { teamId: "doi-02", answer: "A", serverTime: t0 + 7000 });

  state = lockRound2Question(state);
  assert.equal(state.status, "locked");

  state = revealRound2Question(state, twoOptionQ, { pointsPerCorrect: 2 });
  assert.equal(state.status, "revealed");
  assert.equal(state.results["doi-01"].isCorrect, true);
  assert.equal(state.results["doi-01"].points, 2);
  assert.equal(state.results["doi-02"].isCorrect, false);
  assert.equal(state.results["doi-02"].points, 0);
});
