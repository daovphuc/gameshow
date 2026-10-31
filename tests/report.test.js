import test from "node:test";
import assert from "node:assert/strict";
import { buildReportCsv } from "../js/report.js";

test("Report CSV builder: header, UTF-8 BOM, one row per team, round-2 detail rows", () => {
  const teams = [
    { id: "doi-01", name: "Đội Sao Vàng" },
    { id: "doi-02", name: "Đội Hồng Hà" }
  ];

  const rankedEntries = [
    {
      id: "doi-01",
      name: "Đội Sao Vàng",
      rank: 1,
      r1Content: 42,
      r1Manner: 4.5,
      r1Penalty: 0,
      round1: 46.5,
      r2SoftwarePoints: 9500,
      round2: 19.0,
      r3Content: 24,
      r3Manner: 4.5,
      r3Penalty: 1,
      round3: 27.5,
      total: 93.0
    },
    {
      id: "doi-02",
      name: "Đội Hồng Hà",
      rank: 2,
      r1Content: 40,
      r1Manner: 4.0,
      r1Penalty: 0,
      round1: 44.0,
      r2SoftwarePoints: 8500,
      round2: 17.0,
      r3Content: 22,
      r3Manner: 4.0,
      r3Penalty: 0,
      round3: 26.0,
      total: 87.0
    }
  ];

  const round2Details = [
    {
      teamId: "doi-01",
      teamName: "Đội Sao Vàng",
      set: "1",
      questionNumber: 1,
      choice: "B",
      correct: "B",
      isCorrect: true,
      timeSeconds: 4.25,
      points: 929
    },
    {
      teamId: "doi-02",
      teamName: "Đội Hồng Hà",
      set: "1",
      questionNumber: 1,
      choice: "A",
      correct: "B",
      isCorrect: false,
      timeSeconds: 6.1,
      points: 0
    }
  ];

  const csv = buildReportCsv({
    title: "HỘI THI CÁN BỘ PCCC VÀ CNCH",
    rankedEntries,
    round2Details
  });

  // Must begin with UTF-8 BOM (\uFEFF)
  assert.equal(csv.startsWith("\uFEFF"), true, "Must have UTF-8 BOM for Excel compatibility");

  // Contains header
  assert.equal(csv.includes("HỘI THI CÁN BỘ PCCC VÀ CNCH"), true);
  assert.equal(csv.includes("BẢNG TỔNG HỢP KẾT QUẢ ĐIỂM"), true);

  // One row per team in summary
  assert.equal(csv.includes("Đội Sao Vàng"), true);
  assert.equal(csv.includes("Đội Hồng Hà"), true);
  assert.equal(csv.includes("93"), true);

  // Contains Round 2 stats ranking table
  assert.equal(csv.includes("THỐNG KÊ VÒNG 2 (TRẮC NGHIỆM)"), true);

  // Contains Round 2 detail section
  assert.equal(csv.includes("CHI TIẾT ĐÁP ÁN VÒNG 2"), true);
  assert.equal(csv.includes("4.25"), true);
  assert.equal(csv.includes("929"), true);
  assert.equal(csv.includes("Đúng"), true);
  assert.equal(csv.includes("Sai"), true);
});

test("Report CSV builder rebuilds round-2 detail section and round-2 stats from stored answers snapshot", () => {
  const teams = [
    { id: "doi-01", name: "Đội Sao Vàng" },
    { id: "doi-02", name: "Đội Hồng Hà" }
  ];

  const round2Questions = [
    { set: "1", number: 1, question: "Q1", correct: "A", time_seconds: 30 }
  ];

  const shownAt = 1700000000000;
  const allAnswers = {
    "set_1__q_0": {
      "doi-01": { answer: "A", answeredAt: shownAt + 6000 },
      "doi-02": { answer: "C", answeredAt: shownAt + 12000 }
    }
  };

  const gameState = {
    round2: {
      questionsMeta: {
        "set_1__q_0": { shownAt, deadline: shownAt + 30000 }
      }
    },
    scores: {
      "doi-01": { round1: 40, round2: 2, round3: 20 },
      "doi-02": { round1: 30, round2: 0, round3: 20 }
    }
  };

  const csv = buildReportCsv({
    title: "BÁO CÁO TỰ ĐỘNG",
    teams,
    gameState,
    round2Questions,
    allAnswers
  });

  assert.equal(csv.startsWith("\uFEFF"), true);
  assert.equal(csv.includes("BÁO CÁO TỰ ĐỘNG"), true);
  assert.equal(csv.includes("Đội Sao Vàng"), true);
  assert.equal(csv.includes("Đội Hồng Hà"), true);
  assert.equal(csv.includes("THỐNG KÊ VÒNG 2 (TRẮC NGHIỆM)"), true);
  assert.equal(csv.includes("CHI TIẾT ĐÁP ÁN VÒNG 2"), true);
  assert.equal(csv.includes("6.00"), true);
  assert.equal(csv.includes("12.00"), true);
  assert.equal(csv.includes("Đúng"), true);
  assert.equal(csv.includes("Sai"), true);
});

test("Report round-2 detail keys questions by their position inside each set", () => {
  const teams = [{ id: "doi-01", name: "Đội Sao Vàng" }];
  const round2Questions = [
    { set: "1", number: 1, question: "Q1", correct: "A", time_seconds: 30 },
    { set: "2", number: 1, question: "Q2-1", correct: "D", time_seconds: 30 }
  ];
  const shownAt = 1700000000000;
  const csv = buildReportCsv({
    title: "BÁO CÁO",
    teams,
    gameState: { round2: { questionsMeta: { "set_2__q_0": { shownAt, deadline: shownAt + 30000 } } }, scores: {} },
    round2Questions,
    allAnswers: { "set_2__q_0": { "doi-01": { answer: "D", answeredAt: shownAt + 3500 } } }
  });
  assert.equal(csv.includes("3.50"), true);
  assert.equal(csv.includes("Đúng"), true);
});
