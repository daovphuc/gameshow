// Data normalisation and package selection logic (DOM-free).

import { DEFAULT_CONFIG, TEAM_PALETTE } from "./config.js";
import { parseCsv } from "./csv.js";
import { normaliseScores } from "./scores.js";

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

function parseNumber(value, fallback) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return fallback;
  }
  const num = Number(String(value).trim());
  return Number.isFinite(num) ? num : fallback;
}

/**
 * Normalises key/value rows from the `config` tab into a config object.
 * @param {Array<Record<string, any>>|string} input
 * @returns {Record<string, any>}
 */
export function normaliseConfig(input = []) {
  const rows = toRows(input);
  const config = { ...DEFAULT_CONFIG };

  const numericKeys = new Set([
    "round1_time_seconds",
    "round3_time_seconds",
    "round1_default_points",
    "round3_default_points",
    "round1_packages_offered",
    "warning_seconds"
  ]);

  for (const row of rows) {
    const key = row?.key ? String(row.key).trim().toLowerCase() : "";
    const rawValue = row?.value !== undefined && row?.value !== null ? String(row.value).trim() : "";
    if (!key || rawValue === "") {
      continue;
    }
    if (numericKeys.has(key)) {
      config[key] = parsePositiveNumber(rawValue, DEFAULT_CONFIG[key] ?? 15);
    } else {
      config[key] = rawValue;
    }
  }

  return config;
}

/**
 * Normalises rows from the `teams` tab.
 * Required fields: id, name.
 * Optional fields: image_url, color.
 * @param {Array<Record<string, any>>|string} input
 * @returns {Array<{id: string, name: string, image_url: string, color: string}>}
 */
export function normaliseTeams(input = []) {
  const rows = toRows(input);
  const teams = [];
  const seenIds = new Set();

  for (const row of rows) {
    const id = row?.id !== undefined && row?.id !== null ? String(row.id).trim() : "";
    const name = row?.name !== undefined && row?.name !== null ? String(row.name).trim() : "";
    if (!id || !name || seenIds.has(id)) {
      continue;
    }
    seenIds.add(id);
    const image_url = row?.image_url ? String(row.image_url).trim() : "";
    const rawColor = row?.color ? String(row.color).trim() : "";
    const color = rawColor || TEAM_PALETTE[teams.length % TEAM_PALETTE.length];

    teams.push({
      id,
      name,
      image_url,
      color
    });
  }

  return teams;
}

/**
 * Normalises rows from the `round1` tab into single-question packages.
 * - Required fields per row: `package`, `question`.
 * - Optional fields: `team_id`, `answer`, `image_url`, `time_seconds`, `points`.
 * - Team-specific packages are keyed as `<team_id>::<package>` so different teams can have a "Gói A".
 * - Rule for duplicate rows of the same package key: the FIRST valid row wins; extra rows for the
 *   same package are ignored so a package never has more than one question.
 * @param {Array<Record<string, any>>|string} input
 * @param {Record<string, any>} [config]
 * @returns {Array<{
 *   id: string,
 *   package: string,
 *   team_id: string,
 *   question: string,
 *   answer: string,
 *   image_url: string,
 *   time_seconds: number,
 *   points: number,
 *   questions: Array<any>
 * }>}
 */
export function normaliseRound1(input = [], config = DEFAULT_CONFIG) {
  const rows = toRows(input);
  const defaultTime = parsePositiveNumber(
    config?.round1_time_seconds ?? config?.time_seconds,
    DEFAULT_CONFIG.round1_time_seconds
  );
  const defaultPoints = parseNumber(
    config?.round1_default_points ?? config?.points,
    DEFAULT_CONFIG.round1_default_points
  );

  const packageMap = new Map();

  for (const row of rows) {
    const pkgName = row?.package !== undefined && row?.package !== null ? String(row.package).trim() : "";
    const question = row?.question !== undefined && row?.question !== null ? String(row.question).trim() : "";

    if (!pkgName || !question) {
      continue;
    }

    const answer = row?.answer !== undefined && row?.answer !== null ? String(row.answer).trim() : "";
    const team_id = row?.team_id !== undefined && row?.team_id !== null ? String(row.team_id).trim() : "";
    const image_url = row?.image_url !== undefined && row?.image_url !== null ? String(row.image_url).trim() : "";
    const time_seconds = parsePositiveNumber(row?.time_seconds, defaultTime);
    const points = parseNumber(row?.points, defaultPoints);

    // Team-specific packages are keyed per team so every team may have its own "Gói A".
    const pkgKey = team_id ? `${team_id}::${pkgName}` : pkgName;

    // First valid row for a package wins; extra rows for the same package are ignored.
    if (packageMap.has(pkgKey)) {
      continue;
    }

    const singleQuestion = {
      id: `${pkgKey}__1`,
      package: pkgName,
      team_id,
      order: 1,
      question,
      answer,
      image_url,
      time_seconds,
      points
    };

    packageMap.set(pkgKey, {
      id: pkgKey,
      package: pkgName,
      team_id,
      question,
      answer,
      image_url,
      time_seconds,
      points,
      questions: [singleQuestion]
    });
  }

  return Array.from(packageMap.values());
}

/**
 * Returns Round 1 packages eligible to be offered to a specific team.
 * - Packages with `team_id === teamId` are offered only to that team (listed first).
 * - Packages with blank `team_id` are shared and offered to any team until picked.
 * - Packages already in `pickedPackages` are excluded.
 * @param {Array<{id?: string, package: string, team_id?: string, questions: Array<any>}>} packages
 * @param {string} teamId
 * @param {Iterable<string>} [pickedPackages]
 * @param {number|null} [limit]
 * @returns {Array<any>}
 */
export function getOfferedPackages(packages = [], teamId, pickedPackages = [], limit = null) {
  const cleanTeamId = teamId ? String(teamId).trim() : "";
  const pickedSet = new Set(pickedPackages || []);

  const teamSpecific = [];
  const shared = [];

  for (const pkg of packages) {
    const pkgId = pkg.id || pkg.package;
    if (pickedSet.has(pkgId)) {
      continue;
    }
    const pkgTeam = pkg.team_id ? String(pkg.team_id).trim() : "";
    if (pkgTeam && pkgTeam === cleanTeamId) {
      teamSpecific.push(pkg);
    } else if (!pkgTeam) {
      shared.push(pkg);
    }
  }

  const combined = [...teamSpecific, ...shared];
  if (typeof limit === "number" && limit > 0) {
    return combined.slice(0, limit);
  }
  return combined;
}

export const getPackagesForTeam = getOfferedPackages;

/**
 * Normalises rows from the `round3` tab into ordered question tiles.
 * Required fields: number, question.
 * Optional fields: answer, image_url, time_seconds, points.
 * @param {Array<Record<string, any>>|string} input
 * @param {Record<string, any>} [config]
 * @returns {Array<{number: number, question: string, answer: string, image_url: string, time_seconds: number, points: number}>}
 */
export function normaliseRound3(input = [], config = DEFAULT_CONFIG) {
  const rows = toRows(input);
  const defaultTime = parsePositiveNumber(
    config?.round3_time_seconds ?? config?.time_seconds,
    DEFAULT_CONFIG.round3_time_seconds
  );
  const defaultPoints = parseNumber(
    config?.round3_default_points ?? config?.points,
    DEFAULT_CONFIG.round3_default_points
  );

  const byNumber = new Map();

  for (const row of rows) {
    const rawNum = row?.number !== undefined && row?.number !== null ? String(row.number).trim() : "";
    const question = row?.question !== undefined && row?.question !== null ? String(row.question).trim() : "";
    const answer = row?.answer !== undefined && row?.answer !== null ? String(row.answer).trim() : "";

    if (!rawNum || !question) {
      continue;
    }

    const number = Number(rawNum);
    if (!Number.isFinite(number) || number <= 0) {
      continue;
    }

    const image_url = row?.image_url !== undefined && row?.image_url !== null ? String(row.image_url).trim() : "";
    const time_seconds = parsePositiveNumber(row?.time_seconds, defaultTime);
    const points = parseNumber(row?.points, defaultPoints);

    byNumber.set(number, {
      number,
      question,
      answer,
      image_url,
      time_seconds,
      points
    });
  }

  return Array.from(byNumber.values()).sort((a, b) => a.number - b.number);
}

/**
 * Normalises all sheet tabs together.
 * @param {{teamsCsv?: any, round1Csv?: any, round3Csv?: any, configCsv?: any, scoresCsv?: any}} raw
 */
export function normaliseAllData({
  teamsCsv = [],
  round1Csv = [],
  round3Csv = [],
  configCsv = [],
  scoresCsv = []
} = {}) {
  const config = normaliseConfig(configCsv);
  const teams = normaliseTeams(teamsCsv);
  const round1Packages = normaliseRound1(round1Csv, config);
  const round3Questions = normaliseRound3(round3Csv, config);
  const scores = normaliseScores(scoresCsv, teams);

  return {
    config,
    teams,
    round1Packages,
    round3Questions,
    scores
  };
}
