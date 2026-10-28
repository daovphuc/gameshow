// Pure logic for Round 2 (Multiple Choice): normalisation, server-timed scoring,
// ranking, tablet payload filtering, and live state reducer (DOM-free).

import { parseCsv } from "./csv.js";
import { resolveImageUrl } from "./data.js";
import { DEFAULT_CONFIG } from "./config.js";

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
 * Calculates software points for a single Round 2 question based on speed and correctness.
 * - Linear from maxPoints at 0 s down to minPoints at deadline.
 * - Wrong, missing, or late (> deadline) = 0.
 *
 * @param {{
 *   isCorrect: boolean,
 *   answeredAt: number|null,
 *   shownAt: number|null,
 *   durationSeconds: number,
 *   maxPoints?: number,
 *   minPoints?: number
 * }} params
 * @returns {number}
 */
export function calculateRound2QuestionScore({
  isCorrect,
  answeredAt,
  shownAt,
  durationSeconds,
  maxPoints = 1000,
  minPoints = 500
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
  const elapsedMs = Math.max(0, answeredAt - shownAt);
  const elapsedSec = elapsedMs / 1000;

  // Answers strictly after the deadline are late and receive 0
  if (elapsedSec > durationSec) {
    return 0;
  }

  const ratio = durationSec > 0 ? Math.min(1, Math.max(0, elapsedSec / durationSec)) : 1;
  const rawPoints = maxPoints - (maxPoints - minPoints) * ratio;
  return Math.round(rawPoints);
}

/**
 * Converts total software points into a Round 2 score.
 * Formula: total ÷ divisor, rounded to 2 decimals (max 20).
 *
 * @param {number} totalSoftwarePoints
 * @param {number} [divisor]
 * @returns {number}
 */
export function calculateRound2Score(totalSoftwarePoints, divisor = 500) {
  const points = Number(totalSoftwarePoints) || 0;
  const div = Number(divisor) || 500;
  if (div <= 0 || points <= 0) {
    return 0;
  }
  const score = points / div;
  return Math.round(score * 100) / 100;
}

/**
 * Computes Round 2 ranking:
 * 1. Higher total software points
 * 2. More correct answers
 * 3. Shorter total correct time (faster)
 * Ties share the same rank.
 *
 * @param {Array<{id: string, name: string}>} teams
 * @param {Record<string, {softwarePoints?: number, correctCount?: number, totalCorrectTimeMs?: number}>} teamStats
 * @param {number} [divisor]
 * @returns {Array<any>}
 */
export function computeRound2Ranking(teams = [], teamStats = {}, divisor = 500) {
  const entries = teams.map((team, index) => {
    const stats = teamStats[team.id] || {};
    const softwarePoints = Number(stats.softwarePoints) || 0;
    const correctCount = Number(stats.correctCount) || 0;
    const totalCorrectTimeMs = Number(stats.totalCorrectTimeMs) || 0;
    const round2Score = calculateRound2Score(softwarePoints, divisor);

    return {
      id: team.id,
      name: team.name,
      softwarePoints,
      correctCount,
      totalCorrectTimeMs,
      round2Score,
      rank: 1,
      _originalIndex: index
    };
  });

  entries.sort((a, b) => {
    if (b.softwarePoints !== a.softwarePoints) {
      return b.softwarePoints - a.softwarePoints;
    }
    if (b.correctCount !== a.correctCount) {
      return b.correctCount - a.correctCount;
    }
    if (a.totalCorrectTimeMs !== b.totalCorrectTimeMs) {
      return a.totalCorrectTimeMs - b.totalCorrectTimeMs;
    }
    return a._originalIndex - b._originalIndex;
  });

  for (let i = 0; i < entries.length; i++) {
    if (
      i > 0 &&
      entries[i].softwarePoints === entries[i - 1].softwarePoints &&
      entries[i].correctCount === entries[i - 1].correctCount &&
      entries[i].totalCorrectTimeMs === entries[i - 1].totalCorrectTimeMs
    ) {
      entries[i].rank = entries[i - 1].rank;
    } else {
      entries[i].rank = i + 1;
    }
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
  const { correct: _omittedCorrect, ...safeQuestion } = question;
  return { ...safeQuestion };
}

/**
 * Normalises rows from the `round2` sheet tab.
 * Required: question, option_a, option_b, option_c, option_d, correct (A-D).
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
 *   image_url: string
 * }>}
 */
export function normaliseRound2(input = [], config = DEFAULT_CONFIG) {
  const rows = toRows(input);
  const defaultTime = parsePositiveNumber(
    config?.round2_time_seconds,
    DEFAULT_CONFIG.round2_time_seconds || 30
  );

  const results = [];
  const validLetters = new Set(["A", "B", "C", "D"]);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const question = row?.question !== undefined && row?.question !== null ? String(row.question).trim() : "";
    const option_a = row?.option_a !== undefined && row?.option_a !== null ? String(row.option_a).trim() : "";
    const option_b = row?.option_b !== undefined && row?.option_b !== null ? String(row.option_b).trim() : "";
    const option_c = row?.option_c !== undefined && row?.option_c !== null ? String(row.option_c).trim() : "";
    const option_d = row?.option_d !== undefined && row?.option_d !== null ? String(row.option_d).trim() : "";
    const rawCorrect = row?.correct !== undefined && row?.correct !== null ? String(row.correct).trim().toUpperCase() : "";

    if (!question || !option_a || !option_b || !option_c || !option_d) {
      continue;
    }
    if (!validLetters.has(rawCorrect)) {
      continue;
    }

    const set = row?.set !== undefined && row?.set !== null && String(row.set).trim() !== ""
      ? String(row.set).trim()
      : "1";
    const number = parsePositiveNumber(row?.number, results.length + 1);
    const time_seconds = parsePositiveNumber(row?.time_seconds, defaultTime);
    const image_url = resolveImageUrl(row?.image_url);

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
      image_url
    });
  }

  return results;
}

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
 * Opens a question for all tablets at once and starts the synced countdown.
 */
export function startRound2Question(state, fullQuestion, serverTime = Date.now()) {
  const durationSec = Number(fullQuestion.time_seconds) || 30;
  return {
    ...state,
    status: "open",
    activeQuestion: filterQuestionForTablet(fullQuestion),
    shownAt: serverTime,
    deadline: serverTime + durationSec * 1000,
    answers: {},
    results: null
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
  const responseTimeMs = state.shownAt ? Math.max(0, serverTime - state.shownAt) : 0;

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
export function lockRound2Question(state) {
  if (state.status !== "open") {
    return state;
  }
  return {
    ...state,
    status: "locked"
  };
}

/**
 * Reveals the correct answer and computes each team's score.
 */
export function revealRound2Question(
  state,
  fullQuestion,
  { maxPoints = 1000, minPoints = 500 } = {}
) {
  const durationSec = Number(fullQuestion.time_seconds) || 30;
  const correctLetter = String(fullQuestion.correct || "").trim().toUpperCase();
  const results = {};

  const answers = state.answers || {};
  for (const [teamId, record] of Object.entries(answers)) {
    const isCorrect = record.answer === correctLetter;
    const points = calculateRound2QuestionScore({
      isCorrect,
      answeredAt: record.answeredAt,
      shownAt: state.shownAt,
      durationSeconds: durationSec,
      maxPoints,
      minPoints
    });

    results[teamId] = {
      answer: record.answer,
      isCorrect,
      // Tablets store only the server-side answeredAt, so derive the time here.
      responseTimeMs:
        Number.isFinite(record.answeredAt) && Number.isFinite(state.shownAt)
          ? Math.max(0, record.answeredAt - state.shownAt)
          : null,
      points
    };
  }

  return {
    ...state,
    status: "revealed",
    activeQuestion: { ...fullQuestion },
    results
  };
}

/**
 * Moves to the next question, archiving current question & results to history.
 */
export function nextRound2Question(state) {
  const entry = {
    question: state.activeQuestion,
    shownAt: state.shownAt,
    deadline: state.deadline,
    answers: state.answers,
    results: state.results
  };

  return {
    ...state,
    status: "idle",
    currentQuestionIndex: (state.currentQuestionIndex || 0) + 1,
    activeQuestion: null,
    shownAt: null,
    deadline: null,
    answers: {},
    results: null,
    history: [...(state.history || []), entry]
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
 *   divisor?: number
 * }} params
 * @returns {{
 *   teamStats: Record<string, {softwarePoints: number, correctCount: number, totalCorrectTimeMs: number}>,
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
  divisor = 500
} = {}) {
  const teamStats = {};
  for (const t of teams) {
    if (t?.id) {
      teamStats[t.id] = { softwarePoints: 0, correctCount: 0, totalCorrectTimeMs: 0 };
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
        teamStats[teamId] = { softwarePoints: 0, correctCount: 0, totalCorrectTimeMs: 0 };
      }
      const rawAns = String(ansRecord?.answer || "").trim().toUpperCase();
      const isCorrect = rawAns === String(q.correct || "").trim().toUpperCase();
      const answeredAt = Number(ansRecord?.answeredAt) || 0;
      const points = calculateRound2QuestionScore({
        isCorrect,
        answeredAt,
        shownAt,
        durationSeconds
      });

      const responseTimeMs = Math.max(0, answeredAt - shownAt);

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
        teamStats[teamId].softwarePoints += points;
        teamStats[teamId].totalCorrectTimeMs += responseTimeMs;
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
    scores[teamId] = calculateRound2Score(stats.softwarePoints, divisor);
  }

  const currentQuestionIndex = highestFinishedIdx >= 0 ? highestFinishedIdx + 1 : 0;

  return {
    teamStats,
    scores,
    currentQuestionIndex,
    history
  };
}
