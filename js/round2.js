// Pure logic for Round 2 (Multiple Choice): normalisation, server-timed scoring,
// ranking, tablet payload filtering, and live state reducer (DOM-free).

import { parseCsv } from "./csv.js";
import { resolveImageUrl } from "./data.js";
import { DEFAULT_CONFIG } from "./config.js";
import { formatSeconds } from "./leaderboard.js";

export { formatSeconds };

/**
 * Calculates response time in milliseconds from question shownAt to answer answeredAt.
 * Uses authoritative server timestamps to eliminate client clock skew.
 *
 * @param {number|null} shownAt - Server timestamp when question started
 * @param {number|null} answeredAt - Server timestamp when answer was submitted
 * @returns {number} Response time in milliseconds (>= 0)
 */
/**
 * Total pause time (MC locked early, then resumed) that ended before an answer.
 * Answers cannot arrive during a pause, so whole pauses count.
 * @param {Array<{from: number, to: number}>|Record<string, {from: number, to: number}>} pauses
 * @param {number} answeredAt
 */
export function getPausedMsBefore(pauses, answeredAt) {
  const list = Array.isArray(pauses) ? pauses : pauses && typeof pauses === "object" ? Object.values(pauses) : [];
  const at = Number(answeredAt);
  if (!Number.isFinite(at)) return 0;
  let total = 0;
  for (const p of list) {
    const from = Number(p?.from);
    const to = Number(p?.to);
    if (Number.isFinite(from) && Number.isFinite(to) && to > from && to <= at) {
      total += to - from;
    }
  }
  return total;
}

/** The shown time for one answer, moved forward by the pauses before it. */
export function getAdjustedShownAt(shownAt, answeredAt, pauses) {
  if (shownAt === undefined || shownAt === null || !Number.isFinite(Number(shownAt))) return shownAt;
  return Number(shownAt) + getPausedMsBefore(pauses, answeredAt);
}

export function calculateRound2AnswerTime(shownAt, answeredAt) {
  if (
    shownAt === undefined ||
    shownAt === null ||
    answeredAt === undefined ||
    answeredAt === null ||
    !Number.isFinite(Number(shownAt)) ||
    !Number.isFinite(Number(answeredAt))
  ) {
    return 0;
  }
  return Math.max(0, Math.round(Number(answeredAt) - Number(shownAt)));
}

/**
 * Formats a response time duration in milliseconds with Vietnamese comma and 's' suffix.
 * @param {number} responseTimeMs
 * @returns {string}
 */
export function formatRound2AnswerTime(responseTimeMs) {
  return formatSeconds((Number(responseTimeMs) || 0) / 1000);
}

function toRows(input) {
  if (typeof input === "string") {
    return parseCsv(input);
  }
  return Array.isArray(input) ? input : [];
}

function parsePositiveNumber(value, fallback) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return fallback;
  }
  const num = Number(String(value).trim());
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

/**
 * Calculates points for a single Round 2 question.
 * - Flat points (default 2) for correct answer within time limit.
 * - Wrong, missing, or late (> deadline) = 0.
 *
 * @param {{
 *   isCorrect: boolean,
 *   answeredAt: number|null,
 *   shownAt: number|null,
 *   durationSeconds: number,
 *   pointsPerCorrect?: number,
 *   points?: number
 * }} params
 * @returns {number}
 */
export function calculateRound2QuestionScore({
  isCorrect,
  answeredAt,
  shownAt,
  durationSeconds,
  pointsPerCorrect = 2,
  points
}) {
  if (!isCorrect) {
    return 0;
  }
  if (
    answeredAt === undefined ||
    answeredAt === null ||
    shownAt === undefined ||
    shownAt === null ||
    !Number.isFinite(answeredAt) ||
    !Number.isFinite(shownAt)
  ) {
    return 0;
  }

  const durationSec = Number(durationSeconds) || 30;
  const elapsedMs = calculateRound2AnswerTime(shownAt, answeredAt);
  const elapsedSec = elapsedMs / 1000;

  // Answers strictly after the deadline are late and receive 0
  if (elapsedSec > durationSec) {
    return 0;
  }

  const targetPoints = points !== undefined ? Number(points) : Number(pointsPerCorrect);
  return Number.isFinite(targetPoints) ? targetPoints : 2;
}

/**
 * Converts total software points into a Round 2 score.
 * Formula: sum of points earned across all questions.
 *
 * @param {number} totalPoints
 * @returns {number}
 */
export function calculateRound2Score(totalPoints) {
  const pts = Number(totalPoints) || 0;
  return Math.round(pts * 100) / 100;
}

/**
 * Computes Round 2 ranking:
 * 1. Higher total points
 * 2. Shorter total correct time (faster wins)
 * 3. Tie broken by team order
 *
 * @param {Array<{id: string, name: string}>} teams
 * @param {Record<string, {points?: number, softwarePoints?: number, correctCount?: number, totalCorrectTimeMs?: number}>} teamStats
 * @returns {Array<any>}
 */
export function computeRound2Ranking(teams = [], teamStats = {}) {
  const entries = teams.map((team, index) => {
    const stats = teamStats[team.id] || {};
    const points = Number(stats.points !== undefined ? stats.points : stats.softwarePoints) || 0;
    const correctCount = Number(stats.correctCount) || 0;
    const fastestCount = Number(stats.fastestCount) || 0;
    const totalCorrectTimeMs = Number(stats.totalCorrectTimeMs) || 0;
    const totalCorrectTimeSeconds = Math.round((totalCorrectTimeMs / 1000) * 100) / 100;
    const round2Score = calculateRound2Score(points);

    return {
      id: team.id,
      name: team.name,
      points,
      softwarePoints: points, // For backwards compatibility
      round2Score,
      correctCount,
      fastestCount,
      totalCorrectTimeMs,
      totalCorrectTimeSeconds,
      rank: 1,
      _originalIndex: index
    };
  });

  entries.sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    // Điều 21.2.b: đội có nhiều câu trả lời nhanh nhất xếp trên
    if (b.fastestCount !== a.fastestCount) {
      return b.fastestCount - a.fastestCount;
    }
    if (a.totalCorrectTimeMs !== b.totalCorrectTimeMs) {
      return a.totalCorrectTimeMs - b.totalCorrectTimeMs;
    }
    return a._originalIndex - b._originalIndex;
  });

  for (let i = 0; i < entries.length; i++) {
    entries[i].rank = i + 1;
    delete entries[i]._originalIndex;
  }

  return entries;
}

/**
 * Strips the `correct` answer from the question payload sent to client tablets.
 * Tablets never receive the correct answer before the reveal.
 *
 * @param {Record<string, any>} question
 * @returns {Record<string, any>}
 */
export function filterQuestionForTablet(question = {}) {
  if (!question || typeof question !== "object") {
    return null;
  }
  const { correct: _omittedCorrect, explanation: _omittedExplanation, ...safeQuestion } = question;
  return { ...safeQuestion };
}

/**
 * Normalises rows from the `round2` sheet tab.
 * Required: question, option_a, option_b, correct (valid letter among available options).
 * Optional: option_c, option_d, category, explanation.
 *
 * @param {Array<Record<string, any>>|string} input
 * @param {Record<string, any>} [config]
 * @returns {Array<{
 *   id: string,
 *   set: string,
 *   number: number,
 *   question: string,
 *   option_a: string,
 *   option_b: string,
 *   option_c: string,
 *   option_d: string,
 *   correct: "A"|"B"|"C"|"D",
 *   time_seconds: number,
 *   image_url: string,
 *   category: string,
 *   explanation: string
 * }>}
 */
export function normaliseRound2(input = [], config = DEFAULT_CONFIG) {
  const rows = toRows(input);
  const defaultTime = parsePositiveNumber(
    config?.round2_time_seconds,
    DEFAULT_CONFIG.round2_time_seconds || 30
  );

  const results = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const question = row?.question !== undefined && row?.question !== null ? String(row.question).trim() : "";
    const option_a = row?.option_a !== undefined && row?.option_a !== null ? String(row.option_a).trim() : "";
    const option_b = row?.option_b !== undefined && row?.option_b !== null ? String(row.option_b).trim() : "";
    const option_c = row?.option_c !== undefined && row?.option_c !== null ? String(row.option_c).trim() : "";
    const option_d = row?.option_d !== undefined && row?.option_d !== null ? String(row.option_d).trim() : "";
    const rawCorrect = row?.correct !== undefined && row?.correct !== null ? String(row.correct).trim().toUpperCase() : "";

    if (!question || !option_a || !option_b) {
      continue;
    }

    // Must be 4 options (A-D) or 2 options (A-B only)
    if ((option_c && !option_d) || (!option_c && option_d)) {
      continue;
    }

    const validLetters = new Set(["A", "B"]);
    if (option_c) validLetters.add("C");
    if (option_d) validLetters.add("D");

    if (!validLetters.has(rawCorrect)) {
      continue;
    }

    const set = row?.set !== undefined && row?.set !== null && String(row.set).trim() !== ""
      ? String(row.set).trim()
      : "1";
    const number = parsePositiveNumber(row?.number, results.length + 1);
    const time_seconds = parsePositiveNumber(row?.time_seconds, defaultTime);
    const image_url = resolveImageUrl(row?.image_url);
    const category = row?.category !== undefined && row?.category !== null ? String(row.category).trim() : "";
    const explanation = row?.explanation !== undefined && row?.explanation !== null ? String(row.explanation).trim() : "";

    results.push({
      id: `r2_${set}_${number}`,
      set,
      number,
      question,
      option_a,
      option_b,
      option_c,
      option_d,
      correct: rawCorrect,
      time_seconds,
      image_url,
      category,
      explanation
    });
  }

  return results;
}

export const ROUND2_CSV_HEADER = "set,number,question,option_a,option_b,option_c,option_d,correct,time_seconds,image_url,category,explanation";

export const ROUND2_CSV_SAMPLE = `\ufeff${ROUND2_CSV_HEADER}
1,1,"Số điện thoại gọi cứu hỏa khẩn cấp tại Việt Nam là gì?",113,114,115,116,B,30,,Tuyên truyền,"Căn cứ Luật PCCC"`;

/**
 * Parses and validates Round 2 questions from CSV string or parsed row objects.
 * Reports errors per row (with 1-based row number) for missing questions, missing
 * options, missing correct answer, or correct answer pointing to an empty option.
 *
 * @param {string|Array<any>} input CSV text or rows
 * @param {Record<string, any>} [config]
 * @returns {{
 *   ok: boolean,
 *   questions: Array<any>,
 *   errors: Array<string>,
 *   results: Array<{ row: number, ok: boolean, errors: Array<string> }>,
 *   preview: {
 *     totalSets: number,
 *     totalQuestions: number,
 *     sets: Record<string, { count: number, categories: Record<string, number> }>,
 *     setCounts: Record<string, number>,
 *     categoryCounts: Record<string, number>
 *   }
 * }}
 */
export function validateRound2Csv(input, config = DEFAULT_CONFIG) {
  const rows = toRows(input);
  const defaultTime = parsePositiveNumber(
    config?.round2_time_seconds,
    DEFAULT_CONFIG.round2_time_seconds || 30
  );

  const errors = [];
  const results = [];
  const questions = [];

  if (rows.length === 0) {
    errors.push("Dữ liệu CSV trống hoặc không có dòng câu hỏi nào.");
    return {
      ok: false,
      questions: [],
      errors,
      results: [],
      preview: { totalSets: 0, totalQuestions: 0, sets: {}, setCounts: {}, categoryCounts: {} }
    };
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;
    const rowErrors = [];

    if (!row || typeof row !== "object") {
      rowErrors.push(`Dòng ${rowNum}: Dữ liệu dòng không hợp lệ.`);
      errors.push(...rowErrors);
      results.push({ row: rowNum, ok: false, errors: rowErrors });
      continue;
    }

    const question = row?.question !== undefined && row?.question !== null ? String(row.question).trim() : "";
    const option_a = row?.option_a !== undefined && row?.option_a !== null ? String(row.option_a).trim() : "";
    const option_b = row?.option_b !== undefined && row?.option_b !== null ? String(row.option_b).trim() : "";
    const option_c = row?.option_c !== undefined && row?.option_c !== null ? String(row.option_c).trim() : "";
    const option_d = row?.option_d !== undefined && row?.option_d !== null ? String(row.option_d).trim() : "";
    const rawCorrect = row?.correct !== undefined && row?.correct !== null ? String(row.correct).trim().toUpperCase() : "";

    if (!question) {
      rowErrors.push(`Dòng ${rowNum}: Thiếu nội dung câu hỏi.`);
    }

    if (!option_a) {
      rowErrors.push(`Dòng ${rowNum}: Thiếu phương án A.`);
    }

    if (!option_b) {
      rowErrors.push(`Dòng ${rowNum}: Thiếu phương án B.`);
    }

    if ((option_c && !option_d) || (!option_c && option_d)) {
      rowErrors.push(`Dòng ${rowNum}: Phải có đủ 4 phương án (A, B, C, D) hoặc chỉ có 2 phương án (A, B).`);
    }

    if (!rawCorrect) {
      rowErrors.push(`Dòng ${rowNum}: Thiếu đáp án đúng.`);
    } else {
      const validLetters = new Set(["A", "B"]);
      if (option_c) validLetters.add("C");
      if (option_d) validLetters.add("D");

      if (!["A", "B", "C", "D"].includes(rawCorrect)) {
        rowErrors.push(`Dòng ${rowNum}: Đáp án đúng "${rawCorrect}" không hợp lệ (phải là A, B, C hoặc D).`);
      } else if (!validLetters.has(rawCorrect)) {
        rowErrors.push(`Dòng ${rowNum}: Đáp án đúng "${rawCorrect}" tương ứng với phương án bị trống.`);
      }
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      results.push({ row: rowNum, ok: false, errors: rowErrors });
    } else {
      const set = row?.set !== undefined && row?.set !== null && String(row.set).trim() !== ""
        ? String(row.set).trim()
        : "1";
      const number = parsePositiveNumber(row?.number, questions.length + 1);
      const time_seconds = parsePositiveNumber(row?.time_seconds, defaultTime);
      const image_url = resolveImageUrl(row?.image_url);
      const category = row?.category !== undefined && row?.category !== null ? String(row.category).trim() : "";
      const explanation = row?.explanation !== undefined && row?.explanation !== null ? String(row.explanation).trim() : "";

      const q = {
        id: `r2_${set}_${number}`,
        set,
        number,
        question,
        option_a,
        option_b,
        option_c,
        option_d,
        correct: rawCorrect,
        time_seconds,
        image_url,
        category,
        explanation
      };
      questions.push(q);
      results.push({ row: rowNum, ok: true, errors: [] });
    }
  }

  const previewSets = {};
  const setCounts = {};
  const categoryCounts = {};

  for (const q of questions) {
    const s = q.set || "1";
    if (!previewSets[s]) {
      previewSets[s] = { count: 0, categories: {} };
    }
    previewSets[s].count++;
    setCounts[s] = (setCounts[s] || 0) + 1;

    const cat = q.category || "Chưa phân loại";
    previewSets[s].categories[cat] = (previewSets[s].categories[cat] || 0) + 1;
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  }

  const preview = {
    totalSets: Object.keys(previewSets).length,
    totalQuestions: questions.length,
    sets: previewSets,
    setCounts,
    categoryCounts
  };

  return {
    ok: errors.length === 0,
    questions,
    errors,
    results,
    preview
  };
}

export const parseRound2Csv = validateRound2Csv;

/**
 * Groups normalised Round 2 questions by set.
 * @param {Array<any>} questions
 * @returns {Record<string, Array<any>>}
 */
export function groupRound2BySet(questions = []) {
  const grouped = {};
  for (const q of questions) {
    const setKey = String(q.set || "1");
    if (!grouped[setKey]) {
      grouped[setKey] = [];
    }
    grouped[setKey].push(q);
  }
  for (const k of Object.keys(grouped)) {
    grouped[k].sort((a, b) => a.number - b.number);
  }
  return grouped;
}

// -----------------------------------------------------------------------------
// Pure Live-State Reducers / Commands for Round 2
// -----------------------------------------------------------------------------

export function createInitialRound2LiveState() {
  return {
    status: "idle", // "idle" | "open" | "locked" | "revealed"
    activeSet: "1",
    currentQuestionIndex: 0,
    activeQuestion: null,
    shownAt: null,
    deadline: null,
    answers: {},
    results: null,
    history: []
  };
}

/**
 * Opens a question for reading/preview without starting the timer or answering.
 * Stage, host, and team iPads show question and options, with answering disabled.
 */
export function openRound2QuestionPreview(state, fullQuestion) {
  const { correct: _omittedCorrect, explanation: _omittedExplanation, ...restState } = state || {};
  return {
    ...restState,
    status: "reading",
    activeQuestion: filterQuestionForTablet(fullQuestion),
    shownAt: null,
    deadline: null,
    answers: {},
    results: null,
    pauses: [],
    lockedAt: null,
    lockedRemainingMs: null
  };
}

/**
 * Opens a question for all tablets at once and starts the synced countdown.
 */
export function startRound2Question(state, fullQuestion, serverTime = Date.now()) {
  const durationSec = Number(fullQuestion.time_seconds) || 30;
  const { correct: _omittedCorrect, explanation: _omittedExplanation, ...restState } = state || {};
  return {
    ...restState,
    status: "open",
    activeQuestion: filterQuestionForTablet(fullQuestion),
    shownAt: serverTime,
    deadline: serverTime + durationSec * 1000,
    answers: {},
    results: null,
    pauses: [],
    lockedAt: null,
    lockedRemainingMs: null
  };
}

/**
 * Records a team's answer.
 * - Rejects if question is not open.
 * - Rejects if serverTime > deadline (late answer).
 * - Ignores if team has already answered (one answer per team, no overwrite).
 */
export function submitRound2Answer(state, { teamId, answer, serverTime = Date.now() }) {
  if (state.status !== "open") {
    return state;
  }
  if (!teamId || !answer) {
    return state;
  }
  if (state.deadline && serverTime > state.deadline) {
    return state;
  }
  if (state.answers && state.answers[teamId]) {
    return state;
  }

  const cleanAns = String(answer).trim().toUpperCase();
  const responseTimeMs = calculateRound2AnswerTime(state?.shownAt, serverTime);

  return {
    ...state,
    answers: {
      ...state.answers,
      [teamId]: {
        answer: cleanAns,
        answeredAt: serverTime,
        responseTimeMs
      }
    }
  };
}

/**
 * Locks the question once time is up or host manually locks.
 */
export function lockRound2Question(state, serverTime) {
  if (state.status !== "open") {
    return state;
  }
  const locked = { ...state, status: "locked" };
  // Remember the time left so a mistaken early lock can be undone.
  if (Number.isFinite(serverTime) && Number.isFinite(state.deadline)) {
    locked.lockedAt = serverTime;
    locked.lockedRemainingMs = Math.max(0, state.deadline - serverTime);
  }
  return locked;
}

/** True when an early lock can be undone: the question still had time left. */
export function canResumeRound2Question(state) {
  return state?.status === "locked" && Number(state?.lockedRemainingMs) > 0 && Number.isFinite(Number(state?.lockedAt));
}

/**
 * Undoes an early lock: reopens the question with the time that was left.
 * The paused span is recorded so answer times and the time limit leave it out.
 */
export function resumeRound2Question(state, serverTime = Date.now()) {
  if (!canResumeRound2Question(state)) {
    return state;
  }
  const pauses = [
    ...(Array.isArray(state.pauses) ? state.pauses : state.pauses ? Object.values(state.pauses) : []),
    { from: Number(state.lockedAt), to: serverTime }
  ];
  return {
    ...state,
    status: "open",
    deadline: serverTime + Number(state.lockedRemainingMs),
    pauses,
    lockedAt: null,
    lockedRemainingMs: null
  };
}

/**
 * Pure helper to determine whether Round 2 should auto-lock:
 * - returns true ONLY when all participating teams have answered.
 * - returns false when none or only some participating teams have answered.
 * - ignores non-participating teams.
 *
 * @param {Array<string|{id: string}>} participatingTeams
 * @param {Record<string, any>} answers
 * @returns {boolean}
 */
export function shouldAutoLockRound2(participatingTeams = [], answers = {}) {
  if (!Array.isArray(participatingTeams) || participatingTeams.length === 0) {
    return false;
  }
  if (!answers || typeof answers !== "object") {
    return false;
  }
  return participatingTeams.every((team) => {
    const id = typeof team === "string" ? team : team?.id;
    if (!id) return true;
    const ans = answers[id];
    if (ans === undefined || ans === null) return false;
    if (typeof ans === "string") return ans.trim() !== "";
    if (ans.answer !== undefined && ans.answer !== null) {
      return String(ans.answer).trim() !== "";
    }
    return false;
  });
}

export const isRound2AllAnswered = shouldAutoLockRound2;

/**
 * Reveals the correct answer and computes each team's score.
 */
export function revealRound2Question(
  state,
  fullQuestion,
  { pointsPerCorrect = 2 } = {}
) {
  const durationSec = Number(fullQuestion.time_seconds) || 30;
  const correctLetter = String(fullQuestion.correct || "").trim().toUpperCase();
  const rawExplanation =
    fullQuestion.explanation !== undefined && fullQuestion.explanation !== null
      ? String(fullQuestion.explanation).trim()
      : "";
  const results = {};

  const answers = state?.answers || {};
  for (const [teamId, record] of Object.entries(answers)) {
    const isCorrect = record.answer === correctLetter;
    const shownAt = getAdjustedShownAt(state?.shownAt, record.answeredAt, state?.pauses);
    const points = calculateRound2QuestionScore({
      isCorrect,
      answeredAt: record.answeredAt,
      shownAt,
      durationSeconds: durationSec,
      pointsPerCorrect
    });

    results[teamId] = {
      answer: record.answer,
      isCorrect,
      // Tablets store only the server-side answeredAt, so derive the time here.
      responseTimeMs: calculateRound2AnswerTime(shownAt, record.answeredAt),
      points
    };
  }

  const revealedState = {
    ...state,
    status: "revealed",
    activeQuestion: {
      ...fullQuestion,
      correct: correctLetter
    },
    correct: correctLetter,
    results
  };

  if (rawExplanation) {
    revealedState.explanation = rawExplanation;
    revealedState.activeQuestion.explanation = rawExplanation;
  } else {
    delete revealedState.explanation;
    delete revealedState.activeQuestion.explanation;
  }

  return revealedState;
}

/**
 * Moves to the next question, archiving current question & results to history.
 */
export function nextRound2Question(state) {
  const entry = {
    question: state?.activeQuestion,
    shownAt: state?.shownAt,
    deadline: state?.deadline,
    answers: state?.answers,
    results: state?.results
  };

  const { correct: _omittedCorrect, explanation: _omittedExplanation, ...restState } = state || {};

  return {
    ...restState,
    status: "idle",
    currentQuestionIndex: (state?.currentQuestionIndex || 0) + 1,
    activeQuestion: null,
    shownAt: null,
    deadline: null,
    answers: {},
    results: null,
    history: [...(state?.history || []), entry]
  };
}

/**
 * Builds a deterministic question key identifying set and question index.
 * Example: `set_1__q_0`.
 * @param {string|number} setId
 * @param {number} questionIndex
 * @returns {string}
 */
export function buildQuestionKey(setId, questionIndex) {
  const s = String(setId ?? "1").trim();
  const q = Number(questionIndex) || 0;
  return `set_${s}__q_${q}`;
}

/**
 * Pure function to restore and recompute Round 2 state, per-team totals,
 * and question history from stored answers and questions.
 * Handles host reload gracefully without data loss.
 *
 * @param {{
 *   questions?: Array<Record<string, any>>,
 *   allAnswers?: Record<string, Record<string, {answer?: string, answeredAt?: number}>>,
 *   questionsMeta?: Record<string, {shownAt?: number, deadline?: number}>,
 *   teams?: Array<{id: string, name?: string}>,
 *   pointsPerCorrect?: number,
 *   config?: Record<string, any>
 * }} params
 * @returns {{
 *   teamStats: Record<string, {points: number, softwarePoints: number, correctCount: number, totalCorrectTimeMs: number}>,
 *   scores: Record<string, number>,
 *   currentQuestionIndex: number,
 *   history: Array<Record<string, any>>
 * }}
 */
export function recomputeRound2FromAnswers({
  questions = [],
  allAnswers = {},
  questionsMeta = {},
  teams = [],
  pointsPerCorrect = 2,
  config = {}
} = {}) {
  const ptsPerCorrect = Number(config?.round2_points_per_correct) || Number(pointsPerCorrect) || 2;
  const teamStats = {};
  for (const t of teams) {
    if (t?.id) {
      teamStats[t.id] = { points: 0, softwarePoints: 0, correctCount: 0, fastestCount: 0, totalCorrectTimeMs: 0 };
    }
  }

  const history = [];
  let highestFinishedIdx = -1;

  for (let idx = 0; idx < questions.length; idx++) {
    const q = questions[idx];
    const qKey = buildQuestionKey(q.set, idx);
    const answersForQ = allAnswers[qKey] || {};
    const meta = questionsMeta[qKey] || {};
    const shownAt = meta.shownAt ?? q.shownAt ?? 0;
    const durationSeconds = Number(q.time_seconds) || 30;

    const answerKeys = Object.keys(answersForQ);
    if (answerKeys.length === 0 && !meta.shownAt) {
      continue;
    }

    highestFinishedIdx = idx;
    const results = {};
    let correctCount = 0;

    for (const [teamId, ansRecord] of Object.entries(answersForQ)) {
      if (!teamStats[teamId]) {
        teamStats[teamId] = { points: 0, softwarePoints: 0, correctCount: 0, fastestCount: 0, totalCorrectTimeMs: 0 };
      }
      const rawAns = String(ansRecord?.answer || "").trim().toUpperCase();
      const isCorrect = rawAns === String(q.correct || "").trim().toUpperCase();
      const answeredAt = Number(ansRecord?.answeredAt) || 0;
      const answerShownAt = getAdjustedShownAt(shownAt, answeredAt, meta.pauses);
      const points = calculateRound2QuestionScore({
        isCorrect,
        answeredAt,
        shownAt: answerShownAt,
        durationSeconds,
        pointsPerCorrect: ptsPerCorrect
      });

      const responseTimeMs = calculateRound2AnswerTime(answerShownAt, answeredAt);

      results[teamId] = {
        answer: rawAns,
        isCorrect,
        answeredAt,
        responseTimeMs,
        points
      };

      if (isCorrect) {
        correctCount += 1;
        teamStats[teamId].correctCount += 1;
        teamStats[teamId].points += points;
        teamStats[teamId].softwarePoints += points;
        teamStats[teamId].totalCorrectTimeMs += responseTimeMs;
        teamStats[teamId].totalCorrectTimeSeconds = Math.round((teamStats[teamId].totalCorrectTimeMs / 1000) * 100) / 100;
      }
    }

    // Determine the fastest correct answer(s) for this question (Điều 21.2.b)
    let minTime = Infinity;
    const fastestTeams = [];
    for (const [tId, res] of Object.entries(results)) {
      if (res.isCorrect && Number.isFinite(res.responseTimeMs)) {
        if (res.responseTimeMs < minTime) {
          minTime = res.responseTimeMs;
          fastestTeams.length = 0;
          fastestTeams.push(tId);
        } else if (res.responseTimeMs === minTime) {
          fastestTeams.push(tId);
        }
      }
    }
    for (const fId of fastestTeams) {
      if (teamStats[fId]) {
        teamStats[fId].fastestCount = (teamStats[fId].fastestCount || 0) + 1;
      }
    }

    history.push({
      questionKey: qKey,
      questionIndex: idx,
      question: q,
      shownAt,
      deadline: meta.deadline ?? (shownAt + durationSeconds * 1000),
      answers: answersForQ,
      results,
      stats: {
        totalAnswered: answerKeys.length,
        correctCount,
        wrongCount: answerKeys.length - correctCount
      }
    });
  }

  const scores = {};
  for (const [teamId, stats] of Object.entries(teamStats)) {
    scores[teamId] = calculateRound2Score(stats.points);
  }

  const currentQuestionIndex = highestFinishedIdx >= 0 ? highestFinishedIdx + 1 : 0;

  return {
    teamStats,
    scores,
    currentQuestionIndex,
    history
  };
}
