// Scores tab parsing, Apps Script POST payload builder, sheet-vs-local merge,
// and pure 2D table upsert logic (shared with apps-script/Code.gs).

import { parseCsv } from "./csv.js";

export const SCORES_HEADERS = ["team_id", "round1", "round2", "round3", "updated_at"];

function toRows(input) {
  if (typeof input === "string") {
    return parseCsv(input);
  }
  return Array.isArray(input) ? input : [];
}

function safeScore(value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return 0;
  }
  const num = Number(String(value).trim());
  return Number.isFinite(num) ? num : 0;
}

/**
 * Parses rows from the `scores` tab into a per-team score map.
 * Missing teams get 0s; non-numeric values become 0.
 * @param {Array<Record<string, any>>|string} input
 * @param {Array<{id: string}>} [teams]
 * @returns {Record<string, {round1: number, round2: number, round3: number}>}
 */
export function normaliseScores(input = [], teams = []) {
  const rows = toRows(input);
  const result = {};

  for (const team of teams) {
    const id = team?.id ? String(team.id).trim() : "";
    if (id) {
      result[id] = { round1: 0, round2: 0, round3: 0 };
    }
  }

  for (const row of rows) {
    const teamId = row?.team_id !== undefined && row?.team_id !== null
      ? String(row.team_id).trim()
      : row?.id !== undefined && row?.id !== null
        ? String(row.id).trim()
        : "";
    if (!teamId) {
      continue;
    }
    result[teamId] = {
      round1: safeScore(row.round1),
      round2: safeScore(row.round2),
      round3: safeScore(row.round3)
    };
  }

  return result;
}

export const parseScoresTab = normaliseScores;

/**
 * Builds the JSON payload sent via POST (text/plain) to the Apps Script web app.
 * @param {Record<string, any>} scoresOrState
 * @param {Array<{id: string}>} [teams]
 * @param {string} [updatedAt]
 */
export function buildScoresPayload(
  scoresOrState = {},
  teams = [],
  updatedAt = new Date().toISOString()
) {
  const scoresMap =
    scoresOrState &&
    typeof scoresOrState === "object" &&
    scoresOrState.scores &&
    typeof scoresOrState.scores === "object"
      ? scoresOrState.scores
      : scoresOrState || {};

  const teamIds = [];
  const seen = new Set();

  for (const team of teams) {
    const id = team?.id ? String(team.id).trim() : "";
    if (id && !seen.has(id)) {
      seen.add(id);
      teamIds.push(id);
    }
  }

  for (const id of Object.keys(scoresMap)) {
    const clean = id.trim();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      teamIds.push(clean);
    }
  }

  const rows = teamIds.map((teamId) => {
    const entry = scoresMap[teamId] || {};
    return {
      team_id: teamId,
      round1: safeScore(entry.round1),
      round2: safeScore(entry.round2),
      round3: safeScore(entry.round3),
      updated_at: updatedAt
    };
  });

  return {
    action: "upsert_scores",
    updated_at: updatedAt,
    rows
  };
}

/**
 * Pure merge rule between sheet scores and localStorage fallback scores.
 * When a web-app URL is configured, sheet scores win over local scores.
 * Without a web-app URL, local scores win over sheet scores.
 * @param {{
 *   teams?: Array<{id: string}>,
 *   sheetScores?: Record<string, {round1?: number, round2?: number, round3?: number}>,
 *   localScores?: Record<string, {round1?: number, round2?: number, round3?: number}>,
 *   webAppUrl?: string
 * }} params
 */
export function mergeScores({
  teams = [],
  sheetScores = {},
  localScores = {},
  webAppUrl = ""
} = {}) {
  const hasWebApp = Boolean(webAppUrl && String(webAppUrl).trim() !== "");
  const primary = hasWebApp ? sheetScores || {} : localScores || {};
  const secondary = hasWebApp ? localScores || {} : sheetScores || {};

  const allTeamIds = new Set();
  for (const t of teams) {
    if (t?.id) allTeamIds.add(String(t.id).trim());
  }
  for (const k of Object.keys(sheetScores || {})) {
    if (k.trim()) allTeamIds.add(k.trim());
  }
  for (const k of Object.keys(localScores || {})) {
    if (k.trim()) allTeamIds.add(k.trim());
  }

  const merged = {};
  for (const teamId of allTeamIds) {
    const src = primary[teamId] !== undefined ? primary[teamId] : secondary[teamId] || {};
    merged[teamId] = {
      round1: safeScore(src.round1),
      round2: safeScore(src.round2),
      round3: safeScore(src.round3)
    };
  }

  return merged;
}

/**
 * Pure 2D sheet row upsert function (shared with apps-script/Code.gs).
 * Given existing 2D rows from the `scores` sheet and incoming score objects,
 * returns the updated 2D rows array including the header row.
 * @param {Array<Array<any>>} [existingTable]
 * @param {Array<{team_id: string, round1?: any, round2?: any, round3?: any, updated_at?: string}>} [incomingRows]
 * @param {string} [nowIso]
 * @returns {Array<Array<any>>}
 */
export function upsertScoreRows(
  existingTable = [],
  incomingRows = [],
  nowIso = new Date().toISOString()
) {
  const dataRows = [];
  const indexByTeamId = new Map();

  for (let i = 0; i < existingTable.length; i++) {
    const r = existingTable[i];
    if (!Array.isArray(r) || r.length === 0) continue;
    const col0 = String(r[0] ?? "").trim();
    if (!col0 || col0.toLowerCase() === "team_id") continue;

    const cleanRow = [
      col0,
      safeScore(r[1]),
      safeScore(r[2]),
      safeScore(r[3]),
      r[4] !== undefined && r[4] !== null && String(r[4]).trim() !== ""
        ? String(r[4]).trim()
        : nowIso
    ];

    if (indexByTeamId.has(col0)) {
      dataRows[indexByTeamId.get(col0)] = cleanRow;
    } else {
      indexByTeamId.set(col0, dataRows.length);
      dataRows.push(cleanRow);
    }
  }

  const list = Array.isArray(incomingRows) ? incomingRows : [incomingRows];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const teamId = String(item.team_id ?? item.teamId ?? "").trim();
    if (!teamId) continue;

    const updatedRow = [
      teamId,
      safeScore(item.round1),
      safeScore(item.round2),
      safeScore(item.round3),
      item.updated_at ? String(item.updated_at).trim() : nowIso
    ];

    if (indexByTeamId.has(teamId)) {
      dataRows[indexByTeamId.get(teamId)] = updatedRow;
    } else {
      indexByTeamId.set(teamId, dataRows.length);
      dataRows.push(updatedRow);
    }
  }

  return [SCORES_HEADERS.slice(), ...dataRows];
}
