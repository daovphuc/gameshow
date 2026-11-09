// Pure logic for judges: sheet normalisation, score averaging, clamping, and tie breaking (DOM-free).

import { parseCsv } from "./csv.js";

function toRows(input) {
  if (typeof input === "string") {
    return parseCsv(input);
  }
  return Array.isArray(input) ? input : [];
}

/**
 * Clamps a score value between 0 and max.
 * @param {any} value
 * @param {number} max
 * @returns {number}
 */
export function clampScore(value, max) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return 0;
  }
  const num = Number(String(value).trim());
  if (!Number.isFinite(num)) {
    return 0;
  }
  return Math.max(0, Math.min(Number(max) || 0, num));
}

/**
 * Normalises rows from the `judges` tab.
 * Columns: id, name.
 * @param {Array<Record<string, any>>|string} input
 * @returns {Array<{id: string, name: string}>}
 */
export function normaliseJudges(input = []) {
  const rows = toRows(input);
  const judges = [];
  const seenIds = new Set();

  for (const row of rows) {
    const id = row?.id !== undefined && row?.id !== null ? String(row.id).trim() : "";
    const name = row?.name !== undefined && row?.name !== null ? String(row.name).trim() : "";
    if (!id || !name || seenIds.has(id)) {
      continue;
    }
    seenIds.add(id);
    judges.push({ id, name });
  }

  return judges;
}

/**
 * Calculates overtime penalty and qualification status per Điều 19 & Điều 20.
 * Round 1:
 * - 30s..60s: -0.5 points
 * - 61s..120s: -1.0 point
 * - 121s..180s: -3.0 points
 * - >180s: disqualified (Điều 20)
 *
 * Round 3:
 * - 15s..30s: -0.5 points
 * - 31s..60s: -1.0 point
 * - 61s..90s: -2.0 points
 * - >90s: disqualified (Điều 20)
 *
 * @param {string|number} round
 * @param {number} overtimeSeconds
 * @returns {{ penalty: number, disqualified: boolean }}
 */
export function calculateOvertimePenalty(round, overtimeSeconds) {
  const r = String(round || "").toLowerCase();
  const ot = Math.max(0, Number(overtimeSeconds) || 0);

  if (r === "1" || r === "round1") {
    if (ot > 180) {
      return { penalty: 0, disqualified: true };
    }
    if (ot >= 121) {
      return { penalty: 3.0, disqualified: false };
    }
    if (ot >= 61) {
      return { penalty: 1.0, disqualified: false };
    }
    if (ot >= 30) {
      return { penalty: 0.5, disqualified: false };
    }
    return { penalty: 0, disqualified: false };
  }

  if (r === "3" || r === "round3") {
    if (ot > 90) {
      return { penalty: 0, disqualified: true };
    }
    if (ot >= 61) {
      return { penalty: 2.0, disqualified: false };
    }
    if (ot >= 31) {
      return { penalty: 1.0, disqualified: false };
    }
    if (ot >= 15) {
      return { penalty: 0.5, disqualified: false };
    }
    return { penalty: 0, disqualified: false };
  }

  return { penalty: 0, disqualified: false };
}

/**
 * Calculates a team's Round 1 or Round 3 score:
 * - Average of judges' (content + manner) across judges who scored.
 * - Judges who have not scored are excluded.
 * - Values outside 0..max are clamped.
 * - Minus penalty (overtime, etc., Điều 19).
 * - Minimum score is 0.
 *
 * @param {{
 *   judgeScores?: Record<string, {content?: any, manner?: any}|null>,
 *   penalty?: number,
 *   maxContent?: number,
 *   maxManner?: number
 * }} params
 * @returns {{
 *   judgeCount: number,
 *   avgContent: number,
 *   avgManner: number,
 *   avgTotal: number,
 *   penalty: number,
 *   finalScore: number
 * }}
 */
export function calculateTeamRoundScore({
  judgeScores = {},
  penalty = 0,
  maxContent = 45,
  maxManner = 5
} = {}) {
  let count = 0;
  let totalContent = 0;
  let totalManner = 0;

  if (judgeScores && typeof judgeScores === "object") {
    for (const [_judgeId, entry] of Object.entries(judgeScores)) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const hasContent = entry.content !== undefined && entry.content !== null && String(entry.content).trim() !== "";
      const hasManner = entry.manner !== undefined && entry.manner !== null && String(entry.manner).trim() !== "";

      if (!hasContent && !hasManner) {
        continue;
      }

      const c = clampScore(entry.content, maxContent);
      const m = clampScore(entry.manner, maxManner);

      totalContent += c;
      totalManner += m;
      count += 1;
    }
  }

  const penaltyClean = Math.max(0, Number(penalty) || 0);

  if (count === 0) {
    return {
      judgeCount: 0,
      avgContent: 0,
      avgManner: 0,
      avgTotal: 0,
      penalty: penaltyClean,
      finalScore: 0
    };
  }

  const avgContent = Math.round((totalContent / count) * 100) / 100;
  const avgManner = Math.round((totalManner / count) * 100) / 100;
  const avgTotal = Math.round(((totalContent + totalManner) / count) * 100) / 100;
  const finalScore = Math.max(0, Math.round((avgTotal - penaltyClean) * 100) / 100);

  return {
    judgeCount: count,
    avgContent,
    avgManner,
    avgTotal,
    penalty: penaltyClean,
    finalScore
  };
}

/**
 * Compares two teams in Round 1 or Round 3:
 * Higher final score first; ties broken by higher average content score (Điều 21).
 *
 * @param {{finalScore?: number, avgContent?: number}} a
 * @param {{finalScore?: number, avgContent?: number}} b
 * @returns {number}
 */
export function compareRound1Or3Teams(a, b) {
  const scoreA = Number(a?.finalScore) || 0;
  const scoreB = Number(b?.finalScore) || 0;
  if (scoreB !== scoreA) {
    return scoreB - scoreA;
  }
  const contentA = Number(a?.avgContent) || 0;
  const contentB = Number(b?.avgContent) || 0;
  if (contentB !== contentA) {
    return contentB - contentA;
  }
  return 0;
}

/**
 * Builds per-judge score write entries for one team, clamped to limits.
 * Used by head judge to save paper ballots across all judges at once.
 *
 * @param {{
 *   round?: string,
 *   roundKey?: string,
 *   teamId?: string,
 *   judges?: Array<{id: string, name?: string}>,
 *   scores?: Record<string, {content?: any, manner?: any}>,
 *   scoresByJudge?: Record<string, {content?: any, manner?: any}>,
 *   maxContent?: number,
 *   maxManner?: number
 * }|string} params
 * @returns {Array<{judgeId: string, judgeName?: string, content: number, manner: number, score: number, path: string, teamId: string, round: string}>}
 */
export function buildPerJudgeScoreWrites(params, ...rest) {
  let round = "round1";
  let teamId = "";
  let judges = [];
  let scores = {};
  let maxContent = 45;
  let maxManner = 5;

  if (params && typeof params === "object" && !Array.isArray(params)) {
    round = params.round || params.roundKey || "round1";
    teamId = params.teamId || "";
    judges = params.judges || [];
    scores = params.scores || params.scoresByJudge || {};
    maxContent = params.maxContent !== undefined ? params.maxContent : 45;
    maxManner = params.maxManner !== undefined ? params.maxManner : 5;
  } else {
    teamId = params || "";
    judges = rest[0] || [];
    scores = rest[1] || {};
    const opts = rest[2] || {};
    round = opts.round || opts.roundKey || "round1";
    maxContent = opts.maxContent !== undefined ? opts.maxContent : 45;
    maxManner = opts.maxManner !== undefined ? opts.maxManner : 5;
  }

  const results = [];
  const updates = {};
  const scoresByJudge = {};

  for (const j of judges) {
    const jId = String(j?.id || "").trim();
    if (!jId) continue;
    const raw = scores[jId] || {};
    const content = clampScore(raw.content !== undefined ? raw.content : 0, maxContent);
    const manner = clampScore(raw.manner !== undefined ? raw.manner : 0, maxManner);
    const score = Math.round((content + manner) * 100) / 100;
    const path = `live/judgeScores/${round}/${teamId}/${jId}`;

    const entry = {
      judgeId: jId,
      judgeName: j.name || jId,
      content,
      manner,
      score,
      teamId,
      round,
      path
    };

    results.push(entry);
    results[jId] = entry;
    scoresByJudge[jId] = { content, manner, score };
    updates[path] = { content, manner, score };
  }

  results.updates = updates;
  results.scores = scoresByJudge;
  return results;
}

export const buildHeadJudgeScoreWrites = buildPerJudgeScoreWrites;
