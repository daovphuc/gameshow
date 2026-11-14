import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { parseCsv } from "../js/csv.js";
import {
  calculateRound2QuestionScore,
  calculateRound2Score,
  calculateRound2AnswerTime,
  formatRound2AnswerTime,
  computeRound2Ranking,
  filterQuestionForTablet,
  normaliseRound2,
  groupRound2BySet,
  validateRound2Csv,
  parseRound2Csv,
  ROUND2_CSV_HEADER,
  ROUND2_CSV_SAMPLE,
  createInitialRound2LiveState,
  openRound2QuestionPreview,
  startRound2Question,
  submitRound2Answer,
  lockRound2Question,
  shouldAutoLockRound2,
  isRound2AllAnswered,
  revealRound2Question,
  nextRound2Question,
  buildQuestionKey,
  recomputeRound2FromAnswers
} from "../js/round2.js";
import * as round2 from "../js/round2.js";

test("Round-2 scoring: flat points per correct answer (default 2); wrong/missing/late = 0; total score is sum of points", () => {
  const shownAt = 10000;
  const duration = 30; // 30 seconds

  // Correct within deadline = 2 (default)
  const scoreAt0 = calculateRound2QuestionScore({
    isCorrect: true,
    answeredAt: 10000,
    shownAt,
    durationSeconds: duration
  });
  assert.equal(scoreAt0, 2);

  const scoreAt30 = calculateRound2QuestionScore({
    isCorrect: true,
    answeredAt: 40000,
    shownAt,
    durationSeconds: duration
  });
  assert.equal(scoreAt30, 2);

  const scoreAt15 = calculateRound2QuestionScore({
    isCorrect: true,
    answeredAt: 25000,
    shownAt,
    durationSeconds: duration
  });
  assert.equal(scoreAt15, 2);

  // Custom pointsPerCorrect
  const scoreCustom = calculateRound2QuestionScore({
    isCorrect: true,
    answeredAt: 25000,
    shownAt,
    durationSeconds: duration,
    pointsPerCorrect: 5
  });
  assert.equal(scoreCustom, 5);

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

  // Total score is sum of points
  assert.equal(calculateRound2Score(16), 16);
  assert.equal(calculateRound2Score(0), 0);
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
    durationSeconds: duration
  });
  assert.equal(score, 2);

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
      "doi-01": { answer: "A", answeredAt: shownAtQ0 + 15000 }, // Correct at 15s -> 2 pts
      "doi-02": { answer: "B", answeredAt: shownAtQ0 + 5000 }   // Wrong -> 0 pts
    },
    "set_1__q_1": {
      "doi-01": { answer: "B", answeredAt: shownAtQ1 + 0 },     // Correct at 0s -> 2 pts
      "doi-02": { answer: "B", answeredAt: shownAtQ1 + 30000 }  // Correct at 30s -> 2 pts
    }
  };

  const recomputed = recomputeRound2FromAnswers({
    questions,
    allAnswers,
    questionsMeta,
    teams,
    pointsPerCorrect: 2
  });

  // Doi 01: 2 + 2 = 4 pts, 2 correct
  assert.equal(recomputed.teamStats["doi-01"].points, 4);
  assert.equal(recomputed.teamStats["doi-01"].correctCount, 2);
  assert.equal(recomputed.teamStats["doi-01"].totalCorrectTimeMs, 15000);
  assert.equal(recomputed.scores["doi-01"], 4);

  // Doi 02: 0 + 2 = 2 pts, 1 correct
  assert.equal(recomputed.teamStats["doi-02"].points, 2);
  assert.equal(recomputed.teamStats["doi-02"].correctCount, 1);
  assert.equal(recomputed.teamStats["doi-02"].totalCorrectTimeMs, 30000);
  assert.equal(recomputed.scores["doi-02"], 2);

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
    pointsPerCorrect: 2
  });
  assert.deepEqual(recomputed, secondRun);
});

test("Round-2 ranking: tie on points broken by shorter total correct time, then team order", () => {
  const teams = [
    { id: "doi-A", name: "Đội A" },
    { id: "doi-B", name: "Đội B" },
    { id: "doi-C", name: "Đội C" },
    { id: "doi-D", name: "Đội D" }
  ];

  // Doi A: 6 pts, 3 correct, 30000 ms total time
  // Doi B: 8 pts, 4 correct, 45000 ms total time
  // Doi C: 6 pts, 3 correct, 25000 ms total time (better than A: shorter time)
  // Doi D: 10 pts, 5 correct, 40000 ms total time (highest points)
  const teamStats = {
    "doi-A": { points: 6, correctCount: 3, totalCorrectTimeMs: 30000 },
    "doi-B": { points: 8, correctCount: 4, totalCorrectTimeMs: 45000 },
    "doi-C": { points: 6, correctCount: 3, totalCorrectTimeMs: 25000 },
    "doi-D": { points: 10, correctCount: 5, totalCorrectTimeMs: 40000 }
  };

  const ranked = computeRound2Ranking(teams, teamStats);

  // Expected order:
  // 1: doi-D (10 pts)
  // 2: doi-B (8 pts)
  // 3: doi-C (6 pts, 25000ms)
  // 4: doi-A (6 pts, 30000ms)
  assert.equal(ranked[0].id, "doi-D");
  assert.equal(ranked[0].rank, 1);

  assert.equal(ranked[1].id, "doi-B");
  assert.equal(ranked[1].rank, 2);

  assert.equal(ranked[2].id, "doi-C");
  assert.equal(ranked[2].rank, 3);

  assert.equal(ranked[3].id, "doi-A");
  assert.equal(ranked[3].rank, 4);

  // Điều 21.2.b: Tie on points broken by fastestCount first, then totalCorrectTimeMs
  const tiedTeams = [
    { id: "doi-X", name: "Đội X" },
    { id: "doi-Y", name: "Đội Y" }
  ];
  const statsWithFastest = {
    // Both 10 points; doi-X has 2 fastest questions, doi-Y has 1, even if doi-Y had lower total time
    "doi-X": { points: 10, correctCount: 5, fastestCount: 2, totalCorrectTimeMs: 40000 },
    "doi-Y": { points: 10, correctCount: 5, fastestCount: 1, totalCorrectTimeMs: 30000 }
  };
  const rankedTied = computeRound2Ranking(tiedTeams, statsWithFastest);
  assert.equal(rankedTied[0].id, "doi-X");
  assert.equal(rankedTied[0].rank, 1);
  assert.equal(rankedTied[1].id, "doi-Y");
  assert.equal(rankedTied[1].rank, 2);
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
  assert.equal(state.results["doi-01"].points, 2);
  assert.equal(state.results["doi-02"].isCorrect, false);
  assert.equal(state.results["doi-02"].points, 0);

  // 5. Next
  state = nextRound2Question(state);
  assert.equal(state.status, "idle");
  assert.equal(state.currentQuestionIndex, 1);
  assert.equal(state.history.length, 1);
});

test("Host publishes reveal details only until the next question", () => {
  const page = readFileSync(new URL("../round2.html", import.meta.url), "utf8");
  function publishedUpdate(handler, context) {
    const body = page.split(`async function ${handler}()`)[1].split('await update("live/round2", ')[1];
    const end = body.search(/\n\s*\}\);/);
    const expression = `${body.slice(0, end)}\n}`;
    return Function(...Object.keys(context), `return (${expression});`)(...Object.values(context));
  }

  const question = { question: "Q", option_a: "A", option_b: "B", correct: "B", explanation: "Because", time_seconds: 30 };
  let state = startRound2Question(createInitialRound2LiveState(), question, 1000);
  const context = { liveR2: state, currentQuestionIdx: 0, questionKey: "q1", tabletQuestion: state.activeQuestion };
  state.questionsMeta = { q1: {} };
  const open = publishedUpdate("handleStartQuestion", context);
  assert.equal(open.correct, null);
  assert.equal(open.explanation, null);
  assert.equal("correct" in open.activeQuestion, false);
  assert.equal("explanation" in open.activeQuestion, false);

  state = revealRound2Question(lockRound2Question(state), question);
  const revealed = publishedUpdate("handleRevealQuestion", { liveR2: state });
  assert.equal(revealed.correct, "B");
  assert.equal(revealed.explanation, "Because");
  const next = publishedUpdate("handleNextQuestion", { currentQuestionIdx: 1 });
  assert.equal(next.correct, null);
  assert.equal(next.explanation, null);
  assert.equal(next.activeQuestion, null);
  const nextState = nextRound2Question(state);
  assert.equal("correct" in nextState, false);
  assert.equal("explanation" in nextState, false);
  const reopened = startRound2Question(state, question, 2000);
  assert.equal("correct" in reopened, false);
  assert.equal("explanation" in reopened, false);
  state = revealRound2Question(reopened, { ...question, explanation: undefined });
  assert.equal(publishedUpdate("handleRevealQuestion", { liveR2: state }).explanation, null);
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
  assert.equal(revealed.results.t1.points, 2);
  assert.equal(revealed.results.t2.responseTimeMs, 2000);
  assert.equal(revealed.results.t2.points, 0);
});

test("calculateRound2AnswerTime computes server-time delta accurately and resists clock skew/invalid inputs", () => {
  // Normal delta
  assert.equal(calculateRound2AnswerTime(10000, 13200), 3200);
  assert.equal(calculateRound2AnswerTime(1000000, 1000540), 540);

  // Negative delta (clock anomaly or answeredAt < shownAt) clamps to 0
  assert.equal(calculateRound2AnswerTime(10000, 9000), 0);
  assert.equal(calculateRound2AnswerTime(10000, 10000), 0);

  // Missing or non-finite inputs return 0
  assert.equal(calculateRound2AnswerTime(null, 12000), 0);
  assert.equal(calculateRound2AnswerTime(10000, null), 0);
  assert.equal(calculateRound2AnswerTime(undefined, undefined), 0);
  assert.equal(calculateRound2AnswerTime("abc", 12000), 0);
  assert.equal(calculateRound2AnswerTime(10000, "xyz"), 0);

  // Fractional milliseconds get rounded cleanly
  assert.equal(calculateRound2AnswerTime(1000.4, 4200.8), 3200);
});

test("formatRound2AnswerTime formats milliseconds into Vietnamese comma-separated seconds string", () => {
  assert.equal(formatRound2AnswerTime(3200), "3,20 s");
  assert.equal(formatRound2AnswerTime(0), "0,00 s");
  assert.equal(formatRound2AnswerTime(540), "0,54 s");
  assert.equal(formatRound2AnswerTime(15040), "15,04 s");
  assert.equal(formatRound2AnswerTime(null), "0,00 s");
  assert.equal(formatRound2AnswerTime(undefined), "0,00 s");
});

test("validateRound2Csv: parses valid CSV, computes preview per-set counts and categories", () => {
  const csv = `set,number,question,option_a,option_b,option_c,option_d,correct,time_seconds,image_url,category,explanation
1,1,"Câu hỏi 1 bộ 1?",A1,B1,C1,D1,A,30,,Kiểm tra,"Giải thích 1"
1,2,"Câu hỏi 2 bộ 1?",A2,B2,,,B,30,,Tuyên truyền,
2,1,"Câu hỏi 1 bộ 2?",A3,B3,C3,D3,C,30,,Xử phạt,
2,2,"Câu hỏi 2 bộ 2?",A4,B4,C4,D4,D,30,,Điều tra,
2,3,"Câu hỏi 3 bộ 2?",A5,B5,,,A,30,,Kiểm tra,`;

  const res = validateRound2Csv(csv);
  assert.equal(res.ok, true);
  assert.equal(res.errors.length, 0);
  assert.equal(res.questions.length, 5);
  assert.equal(res.preview.totalSets, 2);
  assert.equal(res.preview.totalQuestions, 5);
  assert.equal(res.preview.setCounts["1"], 2);
  assert.equal(res.preview.setCounts["2"], 3);
  assert.equal(res.preview.sets["1"].count, 2);
  assert.equal(res.preview.sets["1"].categories["Kiểm tra"], 1);
  assert.equal(res.preview.sets["1"].categories["Tuyên truyền"], 1);
  assert.equal(res.preview.sets["2"].count, 3);
  assert.equal(res.preview.sets["2"].categories["Xử phạt"], 1);
  assert.equal(res.preview.sets["2"].categories["Điều tra"], 1);
  assert.equal(res.preview.sets["2"].categories["Kiểm tra"], 1);
});

test("validateRound2Csv: reports row-level errors for missing correct, empty correct option, and malformed rows", () => {
  // Row 1: missing correct
  // Row 2: correct option letter is C, but options are only A and B
  // Row 3: missing option B
  // Row 4: missing question
  const invalidCsv = `set,number,question,option_a,option_b,option_c,option_d,correct,time_seconds,image_url,category,explanation
1,1,"Câu hỏi không có đáp án?",A,B,C,D,,30,,Kiểm tra,
1,2,"Câu hỏi đáp án C nhưng chỉ có 2 phương án?",A,B,,,C,30,,Kiểm tra,
1,3,"Câu hỏi thiếu phương án B?",A,,,,A,30,,Kiểm tra,
1,4,,A,B,C,D,A,30,,Kiểm tra,`;

  const res = validateRound2Csv(invalidCsv);
  assert.equal(res.ok, false);
  assert.equal(res.questions.length, 0);

  // Missing correct on row 1
  assert.ok(
    res.errors.some((e) => e.includes("Dòng 1") && e.includes("Thiếu đáp án đúng")),
    `Expected Dòng 1 missing correct error, got: ${JSON.stringify(res.errors)}`
  );

  // Correct points to empty option on row 2
  assert.ok(
    res.errors.some((e) => e.includes("Dòng 2") && (e.includes("trống") || e.includes("không hợp lệ"))),
    `Expected Dòng 2 empty option for correct error, got: ${JSON.stringify(res.errors)}`
  );

  // Missing option B on row 3
  assert.ok(
    res.errors.some((e) => e.includes("Dòng 3") && e.includes("phương án B")),
    `Expected Dòng 3 missing option B error, got: ${JSON.stringify(res.errors)}`
  );

  // Missing question on row 4
  assert.ok(
    res.errors.some((e) => e.includes("Dòng 4") && e.includes("câu hỏi")),
    `Expected Dòng 4 missing question error, got: ${JSON.stringify(res.errors)}`
  );
});

test("round 2 auto-lock: true only when all participating teams have answered, false when none/some, ignores non-participating teams", () => {
  const participating = [
    { id: "team-a", name: "Đội A" },
    { id: "team-b", name: "Đội B" },
    { id: "team-c", name: "Đội C" }
  ];

  // 1. None answered -> false
  assert.equal(shouldAutoLockRound2(participating, {}), false);
  assert.equal(isRound2AllAnswered(participating, {}), false);

  // 2. Some answered -> false
  const someAnswers = {
    "team-a": { answer: "A", answeredAt: 1000 },
    "team-b": { answer: "B", answeredAt: 1200 }
  };
  assert.equal(shouldAutoLockRound2(participating, someAnswers), false);

  // 3. All participating answered -> true
  const allAnswers = {
    "team-a": { answer: "A", answeredAt: 1000 },
    "team-b": { answer: "B", answeredAt: 1200 },
    "team-c": { answer: "C", answeredAt: 1500 }
  };
  assert.equal(shouldAutoLockRound2(participating, allAnswers), true);
  assert.equal(isRound2AllAnswered(participating, allAnswers), true);

  // 4. Ignores non-participating teams:
  // Non-participating team answered, but team-c has not -> still false
  const withNonParticipatingIncomplete = {
    "team-a": { answer: "A" },
    "team-b": { answer: "B" },
    "team-extra": { answer: "D" }
  };
  assert.equal(shouldAutoLockRound2(participating, withNonParticipatingIncomplete), false);

  // Non-participating team answered and all participating answered -> true
  const withNonParticipatingComplete = {
    ...allAnswers,
    "team-extra": { answer: "D" }
  };
  assert.equal(shouldAutoLockRound2(participating, withNonParticipatingComplete), true);

  // Also supports array of string IDs
  assert.equal(shouldAutoLockRound2(["team-a", "team-b"], { "team-a": { answer: "A" }, "team-b": { answer: "B" } }), true);
  assert.equal(shouldAutoLockRound2(["team-a", "team-b"], { "team-a": { answer: "A" } }), false);

  // Empty participating teams returns false
  assert.equal(shouldAutoLockRound2([], allAnswers), false);
});

test("openRound2QuestionPreview sets status to reading with tablet filtered question and no active timer", () => {
  const fullQ = {
    id: "r2_1_1",
    question: "Câu hỏi 1?",
    option_a: "A",
    option_b: "B",
    correct: "A",
    explanation: "Giải thích",
    time_seconds: 30
  };

  const state = createInitialRound2LiveState();
  const previewState = openRound2QuestionPreview(state, fullQ);

  assert.equal(previewState.status, "reading");
  assert.equal(previewState.shownAt, null);
  assert.equal(previewState.deadline, null);
  assert.equal(previewState.activeQuestion.question, "Câu hỏi 1?");
  assert.equal("correct" in previewState.activeQuestion, false);
});


test("an early lock can be undone: the question reopens with the time that was left", () => {
  const q = { set: "1", number: 1, question: "Q", option_a: "A", option_b: "B", correct: "A", time_seconds: 30 };
  let state = round2.startRound2Question({}, q, 1000);
  assert.equal(state.deadline, 31000);

  state = round2.lockRound2Question(state, 11000); // 20 s left
  assert.equal(state.status, "locked");
  assert.equal(state.lockedRemainingMs, 20000);
  assert.equal(round2.canResumeRound2Question(state), true);

  state = round2.resumeRound2Question(state, 50000); // paused 39 s
  assert.equal(state.status, "open");
  assert.equal(state.deadline, 70000);
  assert.deepEqual(state.pauses, [{ from: 11000, to: 50000 }]);
  assert.equal(state.lockedRemainingMs, null);
  assert.equal(round2.canResumeRound2Question(state), false);
});

test("answer times and the time limit leave out the paused span", () => {
  const pauses = [{ from: 11000, to: 50000 }];
  assert.equal(round2.getPausedMsBefore(pauses, 5000), 0);
  assert.equal(round2.getPausedMsBefore(pauses, 60000), 39000);
  assert.equal(round2.getAdjustedShownAt(1000, 60000, pauses), 40000);

  const q = { set: "1", number: 1, question: "Q", option_a: "A", option_b: "B", correct: "A", time_seconds: 30 };
  // Answered 59 s after the question was shown, 20 s of it real answering time: still in time.
  const revealed = round2.revealRound2Question(
    { status: "locked", shownAt: 1000, pauses, answers: { t1: { answer: "A", answeredAt: 60000 }, t2: { answer: "A", answeredAt: 6000 } } },
    q,
    { pointsPerCorrect: 2 }
  );
  assert.equal(revealed.results.t1.responseTimeMs, 20000);
  assert.equal(revealed.results.t1.points, 2);
  assert.equal(revealed.results.t2.responseTimeMs, 5000);

  const recomputed = round2.recomputeRound2FromAnswers({
    questions: [q],
    allAnswers: { set_1__q_0: { t1: { answer: "A", answeredAt: 60000 } } },
    questionsMeta: { set_1__q_0: { shownAt: 1000, pauses } },
    teams: [{ id: "t1" }],
    pointsPerCorrect: 2
  });
  assert.equal(recomputed.history[0].results.t1.responseTimeMs, 20000);
  assert.equal(recomputed.history[0].results.t1.points, 2);
});

test("a lock made when time ran out cannot be resumed", () => {
  const q = { set: "1", number: 1, question: "Q", option_a: "A", option_b: "B", correct: "A", time_seconds: 30 };
  let state = round2.startRound2Question({}, q, 1000);
  state = round2.lockRound2Question(state, 40000);
  assert.equal(state.lockedRemainingMs, 0);
  assert.equal(round2.canResumeRound2Question(state), false);
  assert.equal(round2.resumeRound2Question(state, 41000).status, "locked");
});

test("round 2 popup data: the answer grid and ranking count only revealed questions", () => {
  const teams = [{ id: "t1", name: "Đội 1" }, { id: "t2", name: "Đội 2" }, { id: "t3", name: "Đội 3" }];
  const questions = [
    { set: "1", correct: "A" },
    { set: "1", correct: "B" },
    { set: "1", correct: "C" }
  ];
  const history = [
    {
      questionIndex: 0,
      answers: { t1: { answer: "A" }, t2: { answer: "C" } },
      results: {
        t1: { answer: "A", isCorrect: true, responseTimeMs: 4000, points: 2 },
        t2: { answer: "C", isCorrect: false, responseTimeMs: 3000, points: 0 }
      }
    },
    {
      questionIndex: 1,
      answers: { t1: { answer: "B" }, t2: { answer: "B" } },
      results: {
        t1: { answer: "B", isCorrect: true, responseTimeMs: 6000, points: 2 },
        t2: { answer: "B", isCorrect: true, responseTimeMs: 5000, points: 2 }
      }
    },
    // Question 3 is open: answers exist but must not be judged yet.
    { questionIndex: 2, answers: { t1: { answer: "C" } }, results: { t1: { answer: "C", isCorrect: true, responseTimeMs: 1000, points: 2 } } }
  ];

  const { columns, rows } = round2.buildRound2AnswerMatrix({ teams, questions, history, revealedCount: 2 });
  assert.deepEqual(columns.map((c) => c.correct), ["A", "B", ""]);
  assert.deepEqual(rows[0].cells.map((c) => c.status), ["correct", "correct", "answered"]);
  assert.deepEqual(rows[1].cells.map((c) => c.status), ["wrong", "correct", "pending"]);
  assert.deepEqual(rows[2].cells.map((c) => c.status), ["none", "none", "pending"]);
  assert.equal(rows[0].correctCount, 2);
  assert.equal(rows[0].points, 4);
  assert.equal(rows[0].totalCorrectTimeMs, 10000);

  const stats = round2.buildRound2StatsFromHistory(teams, history, 2);
  assert.deepEqual(stats.t1, { points: 4, correctCount: 2, fastestCount: 1, totalCorrectTimeMs: 10000 });
  assert.deepEqual(stats.t2, { points: 2, correctCount: 1, fastestCount: 1, totalCorrectTimeMs: 5000 });
  assert.deepEqual(stats.t3, { points: 0, correctCount: 0, fastestCount: 0, totalCorrectTimeMs: 0 });
  const ranking = round2.computeRound2Ranking(teams, stats);
  assert.deepEqual(ranking.map((r) => r.id), ["t1", "t2", "t3"]);
});
