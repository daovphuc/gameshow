import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateRound2QuestionScore,
  calculateRound2Score,
  computeRound2Ranking,
  filterQuestionForTablet,
  normaliseRound2,
  groupRound2BySet,
  createInitialRound2LiveState,
  startRound2Question,
  submitRound2Answer,
  lockRound2Question,
  revealRound2Question,
  nextRound2Question,
  buildQuestionKey,
  recomputeRound2FromAnswers
} from "../js/round2.js";

test("Round-2 scoring: correct at 0 s = 1000; at deadline = 500; linear in between (e.g. 15 s of 30 = 750); wrong/missing/late = 0; total ÷ 500 rounded to 2 decimals (e.g. 9,876 → 19.75)", () => {
  const shownAt = 10000;
  const duration = 30; // 30 seconds

  // Correct at 0 s = 1000
  const scoreAt0 = calculateRound2QuestionScore({
    isCorrect: true,
    answeredAt: 10000,
    shownAt,
    durationSeconds: duration
  });
  assert.equal(scoreAt0, 1000);

  // Correct at deadline (30 s) = 500
  const scoreAt30 = calculateRound2QuestionScore({
    isCorrect: true,
    answeredAt: 40000,
    shownAt,
    durationSeconds: duration
  });
  assert.equal(scoreAt30, 500);

  // Correct at 15 s of 30 s = 750
  const scoreAt15 = calculateRound2QuestionScore({
    isCorrect: true,
    answeredAt: 25000,
    shownAt,
    durationSeconds: duration
  });
  assert.equal(scoreAt15, 750);

  // Wrong answer = 0
  const scoreWrong = calculateRound2QuestionScore({
    isCorrect: false,
    answeredAt: 15000,
    shownAt,
    durationSeconds: duration
  });
  assert.equal(scoreWrong, 0);

  // Late answer (30.1 s) = 0
  const scoreLate = calculateRound2QuestionScore({
    isCorrect: true,
    answeredAt: 40100,
    shownAt,
    durationSeconds: duration
  });
  assert.equal(scoreLate, 0);

  // Missing timestamp = 0
  const scoreMissing = calculateRound2QuestionScore({
    isCorrect: true,
    answeredAt: null,
    shownAt,
    durationSeconds: duration
  });
  assert.equal(scoreMissing, 0);

  // Total ÷ 500 rounded to 2 decimals (e.g. 9,876 → 19.75)
  assert.equal(calculateRound2Score(9876, 500), 19.75);
  assert.equal(calculateRound2Score(10000, 500), 20.0);
  assert.equal(calculateRound2Score(0, 500), 0);
  assert.equal(calculateRound2Score(500, 500), 1.0);
});

test("Round-2 timing uses server timestamps: given question shownAt and answer at values, response time and late check come out right regardless of client clock offset", () => {
  // Even if client clock is offset by minutes or days, server timestamps decide elapsed time
  const serverShownAt = 1700000000000;
  const duration = 20; // 20s

  // Tablet's local clock could be wildly inaccurate (e.g. 5 hours in the past or future)
  const tabletClockSkewed = serverShownAt - 5 * 3600 * 1000;
  assert.notEqual(tabletClockSkewed, serverShownAt);

  // But the server records answeredAt using server timestamp (8 seconds after shownAt)
  const serverAnsweredAt = serverShownAt + 8000;
  const score = calculateRound2QuestionScore({
    isCorrect: true,
    answeredAt: serverAnsweredAt,
    shownAt: serverShownAt,
    durationSeconds: duration,
    maxPoints: 1000,
    minPoints: 500
  });
  // 8s / 20s = 0.4. 1000 - (500 * 0.4) = 800 (independent of tabletClockSkewed)
  assert.equal(score, 800);

  // Server recorded answer 21 seconds after shownAt -> rejected as late
  const serverLateAnsweredAt = serverShownAt + 21000;
  const lateScore = calculateRound2QuestionScore({
    isCorrect: true,
    answeredAt: serverLateAnsweredAt,
    shownAt: serverShownAt,
    durationSeconds: duration
  });
  assert.equal(lateScore, 0);
});

test("recomputeRound2FromAnswers restores per-team totals, question history, and next position from stored answers snapshot", () => {
  const teams = [
    { id: "doi-01", name: "Đội 1" },
    { id: "doi-02", name: "Đội 2" }
  ];

  const questions = [
    { set: "1", number: 1, question: "Q1", correct: "A", time_seconds: 30 },
    { set: "1", number: 2, question: "Q2", correct: "B", time_seconds: 30 },
    { set: "1", number: 3, question: "Q3", correct: "C", time_seconds: 30 }
  ];

  const shownAtQ0 = 1700000000000;
  const shownAtQ1 = 1700000040000;

  const questionsMeta = {
    "set_1__q_0": { shownAt: shownAtQ0, deadline: shownAtQ0 + 30000 },
    "set_1__q_1": { shownAt: shownAtQ1, deadline: shownAtQ1 + 30000 }
  };

  const allAnswers = {
    "set_1__q_0": {
      "doi-01": { answer: "A", answeredAt: shownAtQ0 + 15000 }, // Correct at 15s -> 750 pts
      "doi-02": { answer: "B", answeredAt: shownAtQ0 + 5000 }   // Wrong -> 0 pts
    },
    "set_1__q_1": {
      "doi-01": { answer: "B", answeredAt: shownAtQ1 + 0 },     // Correct at 0s -> 1000 pts
      "doi-02": { answer: "B", answeredAt: shownAtQ1 + 30000 }  // Correct at 30s -> 500 pts
    }
  };

  const recomputed = recomputeRound2FromAnswers({
    questions,
    allAnswers,
    questionsMeta,
    teams,
    divisor: 500
  });

  // Doi 01: 750 + 1000 = 1750 pts -> 1750 / 500 = 3.5 score, 2 correct
  assert.equal(recomputed.teamStats["doi-01"].softwarePoints, 1750);
  assert.equal(recomputed.teamStats["doi-01"].correctCount, 2);
  assert.equal(recomputed.teamStats["doi-01"].totalCorrectTimeMs, 15000);
  assert.equal(recomputed.scores["doi-01"], 3.5);

  // Doi 02: 0 + 500 = 500 pts -> 500 / 500 = 1.0 score, 1 correct
  assert.equal(recomputed.teamStats["doi-02"].softwarePoints, 500);
  assert.equal(recomputed.teamStats["doi-02"].correctCount, 1);
  assert.equal(recomputed.teamStats["doi-02"].totalCorrectTimeMs, 30000);
  assert.equal(recomputed.scores["doi-02"], 1.0);

  // Current position: Q0 and Q1 done -> next index is 2
  assert.equal(recomputed.currentQuestionIndex, 2);

  // History contains exactly 2 questions
  assert.equal(recomputed.history.length, 2);
  assert.equal(recomputed.history[0].questionKey, "set_1__q_0");
  assert.equal(recomputed.history[1].questionKey, "set_1__q_1");

  // Re-running with same inputs produces identical deterministic snapshot
  const secondRun = recomputeRound2FromAnswers({
    questions,
    allAnswers,
    questionsMeta,
    teams,
    divisor: 500
  });
  assert.deepEqual(recomputed, secondRun);
});

test("Round-2 ranking: tie on raw points broken by more correct, then shorter total correct time", () => {
  const teams = [
    { id: "doi-A", name: "Đội A" },
    { id: "doi-B", name: "Đội B" },
    { id: "doi-C", name: "Đội C" },
    { id: "doi-D", name: "Đội D" }
  ];

  // Doi A: 2500 pts, 3 correct, 30000 ms total time
  // Doi B: 2500 pts, 4 correct, 45000 ms total time (better: more correct answers)
  // Doi C: 2500 pts, 3 correct, 25000 ms total time (better than A: shorter time)
  // Doi D: 2800 pts, 3 correct, 40000 ms total time (highest points)
  const teamStats = {
    "doi-A": { softwarePoints: 2500, correctCount: 3, totalCorrectTimeMs: 30000 },
    "doi-B": { softwarePoints: 2500, correctCount: 4, totalCorrectTimeMs: 45000 },
    "doi-C": { softwarePoints: 2500, correctCount: 3, totalCorrectTimeMs: 25000 },
    "doi-D": { softwarePoints: 2800, correctCount: 3, totalCorrectTimeMs: 40000 }
  };

  const ranked = computeRound2Ranking(teams, teamStats);

  // Expected order:
  // 1: doi-D (2800 pts)
  // 2: doi-B (2500 pts, 4 correct)
  // 3: doi-C (2500 pts, 3 correct, 25000ms)
  // 4: doi-A (2500 pts, 3 correct, 30000ms)
  assert.equal(ranked[0].id, "doi-D");
  assert.equal(ranked[0].rank, 1);

  assert.equal(ranked[1].id, "doi-B");
  assert.equal(ranked[1].rank, 2);

  assert.equal(ranked[2].id, "doi-C");
  assert.equal(ranked[2].rank, 3);

  assert.equal(ranked[3].id, "doi-A");
  assert.equal(ranked[3].rank, 4);
});

test("Round-2 sheet normalisation: options, correct A-D (case-insensitive), invalid rows skipped, grouping by set, default time", () => {
  const config = { round2_time_seconds: 25 };
  const rawRows = [
    {
      set: "1",
      number: "1",
      question: "Câu hỏi 1",
      option_a: "A1",
      option_b: "B1",
      option_c: "C1",
      option_d: "D1",
      correct: " a ",
      time_seconds: "",
      image_url: "q1.jpg"
    },
    {
      set: "1",
      number: "2",
      question: "Câu hỏi 2",
      option_a: "A2",
      option_b: "B2",
      option_c: "C2",
      option_d: "D2",
      correct: "C",
      time_seconds: "15"
    },
    // Invalid: missing option_d
    {
      set: "1",
      number: "3",
      question: "Câu hỏi thiếu đáp án",
      option_a: "A3",
      option_b: "B3",
      option_c: "C3",
      option_d: "",
      correct: "B"
    },
    // Invalid: correct is 'E' (not A-D)
    {
      set: "2",
      number: "1",
      question: "Câu hỏi sai chữ đáp án",
      option_a: "A",
      option_b: "B",
      option_c: "C",
      option_d: "D",
      correct: "E"
    },
    // Valid set 2
    {
      set: "2",
      number: "1",
      question: "Câu hỏi bộ 2",
      option_a: "A",
      option_b: "B",
      option_c: "C",
      option_d: "D",
      correct: "d",
      time_seconds: "20"
    }
  ];

  const normalised = normaliseRound2(rawRows, config);
  assert.equal(normalised.length, 3);

  assert.equal(normalised[0].set, "1");
  assert.equal(normalised[0].number, 1);
  assert.equal(normalised[0].correct, "A");
  assert.equal(normalised[0].time_seconds, 25); // default from config
  assert.equal(normalised[0].image_url, "images/q1.jpg");

  assert.equal(normalised[1].set, "1");
  assert.equal(normalised[1].number, 2);
  assert.equal(normalised[1].correct, "C");
  assert.equal(normalised[1].time_seconds, 15);

  assert.equal(normalised[2].set, "2");
  assert.equal(normalised[2].number, 1);
  assert.equal(normalised[2].correct, "D");

  const bySet = groupRound2BySet(normalised);
  assert.equal(bySet["1"].length, 2);
  assert.equal(bySet["2"].length, 1);
});

test("Payload sent to team tablets for an open question does not contain the correct answer", () => {
  const fullQuestion = {
    id: "r2_1_1",
    set: "1",
    number: 1,
    question: "Bình chữa cháy CO2 không dùng cho đám cháy nào?",
    option_a: "Đám cháy chất lỏng",
    option_b: "Đám cháy kim loại kiềm",
    option_c: "Đám cháy thiết bị điện",
    option_d: "Đám cháy trong phòng kín",
    correct: "B",
    time_seconds: 30,
    image_url: "co2.png"
  };

  const tabletPayload = filterQuestionForTablet(fullQuestion);
  assert.equal("correct" in tabletPayload, false);
  assert.equal(tabletPayload.question, fullQuestion.question);
  assert.equal(tabletPayload.option_a, fullQuestion.option_a);
  assert.equal(tabletPayload.option_b, fullQuestion.option_b);
  assert.equal(tabletPayload.option_c, fullQuestion.option_c);
  assert.equal(tabletPayload.option_d, fullQuestion.option_d);
  assert.equal(tabletPayload.time_seconds, 30);
});

test("Live-state reducer/commands (pure): show question → answers accepted → time up locks → reveal → next; a second answer from the same team is ignored", () => {
  let state = createInitialRound2LiveState();
  assert.equal(state.status, "idle");

  const question = {
    id: "q1",
    set: "1",
    number: 1,
    question: "Số khẩn cấp PCCC là gì?",
    option_a: "113",
    option_b: "114",
    option_c: "115",
    option_d: "116",
    correct: "B",
    time_seconds: 30
  };

  const startTime = 100000;
  // 1. Show question
  state = startRound2Question(state, question, startTime);
  assert.equal(state.status, "open");
  assert.equal("correct" in state.activeQuestion, false);
  assert.equal(state.deadline, startTime + 30000);

  // 2. Answers accepted
  // Team 1 answers B at 5s
  state = submitRound2Answer(state, {
    teamId: "doi-01",
    answer: "B",
    serverTime: startTime + 5000
  });
  assert.equal(state.answers["doi-01"].answer, "B");
  assert.equal(state.answers["doi-01"].responseTimeMs, 5000);

  // Team 1 tries to change answer to C -> ignored!
  state = submitRound2Answer(state, {
    teamId: "doi-01",
    answer: "C",
    serverTime: startTime + 8000
  });
  assert.equal(state.answers["doi-01"].answer, "B"); // Still B

  // Team 2 answers A at 10s
  state = submitRound2Answer(state, {
    teamId: "doi-02",
    answer: "A",
    serverTime: startTime + 10000
  });
  assert.equal(state.answers["doi-02"].answer, "A");

  // Team 3 answers B late at 35s -> rejected!
  state = submitRound2Answer(state, {
    teamId: "doi-03",
    answer: "B",
    serverTime: startTime + 35000
  });
  assert.equal(state.answers["doi-03"], undefined);

  // 3. Time up locks
  state = lockRound2Question(state);
  assert.equal(state.status, "locked");

  // Attempt to answer after locked -> rejected
  state = submitRound2Answer(state, {
    teamId: "doi-04",
    answer: "B",
    serverTime: startTime + 12000
  });
  assert.equal(state.answers["doi-04"], undefined);

  // 4. Reveal
  state = revealRound2Question(state, question);
  assert.equal(state.status, "revealed");
  assert.equal(state.results["doi-01"].isCorrect, true);
  assert.ok(state.results["doi-01"].points > 900);
  assert.equal(state.results["doi-02"].isCorrect, false);
  assert.equal(state.results["doi-02"].points, 0);

  // 5. Next
  state = nextRound2Question(state);
  assert.equal(state.status, "idle");
  assert.equal(state.currentQuestionIndex, 1);
  assert.equal(state.history.length, 1);
});

test("Reveal derives response time from server answeredAt when tablets store only answeredAt", () => {
  const question = { id: "q1", correct: "B", time_seconds: 30 };
  const state = {
    status: "locked",
    shownAt: 1_000_000,
    deadline: 1_030_000,
    answers: { t1: { answer: "B", answeredAt: 1_006_000 }, t2: { answer: "A", answeredAt: 1_002_000 } }
  };
  const revealed = revealRound2Question(state, question);
  assert.equal(revealed.results.t1.responseTimeMs, 6000);
  assert.equal(revealed.results.t1.points, 900);
  assert.equal(revealed.results.t2.responseTimeMs, 2000);
  assert.equal(revealed.results.t2.points, 0);
});
