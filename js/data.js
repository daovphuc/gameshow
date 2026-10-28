// Data normalisation, image path resolution, and package selection logic (DOM-free).

import { DEFAULT_CONFIG, TEAM_PALETTE } from "./config.js";
import { parseCsv } from "./csv.js";
import { normaliseRound2 } from "./round2.js";
import { normaliseJudges } from "./judges.js";
import { normaliseAccounts, resolveAccounts } from "./auth.js";

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
 * Resolves an `image_url` cell value:
 * - Blank / null / undefined -> `""` (triggers initials avatar fallback or hides question image).
 * - Full `http(s)://` URL or any path already containing `/` (e.g. `teams/x.png`, `images/a.jpg`) -> unchanged.
 * - Bare file name (e.g. `doi-01.jpg`) -> `images/doi-01.jpg`.
 * @param {string} [raw]
 * @returns {string}
 */
export function resolveImageUrl(raw) {
  if (raw === undefined || raw === null) {
    return "";
  }
  const trimmed = String(raw).trim();
  if (!trimmed) {
    return "";
  }
  if (/^https?:\/\//i.test(trimmed) || trimmed.includes("/")) {
    return trimmed;
  }
  return `images/${trimmed}`;
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
    "round1_default_points",
    "round1_max_content",
    "round1_max_manner",
    "round1_packages_offered",
    "round2_time_seconds",
    "round2_max_points",
    "round2_min_points",
    "round2_divisor",
    "round3_time_seconds",
    "round3_default_points",
    "round3_max_content",
    "round3_max_manner",
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
    const image_url = resolveImageUrl(row?.image_url);
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
 * Normalises rows from the `round1` tab into single-question team packages.
 * - Required fields per row: `package`, `team_id`, `question`.
 * - Optional fields: `image_url`, `time_seconds`, `points`.
 * - Packages are keyed as `<team_id>::<package>`.
 * - Rule for duplicate rows of the same package key: the FIRST valid row wins.
 * @param {Array<Record<string, any>>|string} input
 * @param {Record<string, any>} [config]
 * @returns {Array<{
 *   id: string,
 *   package: string,
 *   team_id: string,
 *   question: string,
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
    const team_id = row?.team_id !== undefined && row?.team_id !== null ? String(row.team_id).trim() : "";
    const question = row?.question !== undefined && row?.question !== null ? String(row.question).trim() : "";

    if (!pkgName || !team_id || !question) {
      continue;
    }

    const image_url = resolveImageUrl(row?.image_url);
    const time_seconds = parsePositiveNumber(row?.time_seconds, defaultTime);
    const points = parseNumber(row?.points, defaultPoints);

    const pkgKey = `${team_id}::${pkgName}`;

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
      image_url,
      time_seconds,
      points
    };

    packageMap.set(pkgKey, {
      id: pkgKey,
      package: pkgName,
      team_id,
      question,
      image_url,
      time_seconds,
      points,
      questions: [singleQuestion]
    });
  }

  return Array.from(packageMap.values());
}

/**
 * Returns Round 1 packages belonging to `teamId` that have not yet been picked.
 * @param {Array<{id?: string, package: string, team_id?: string, questions: Array<any>}>} packages
 * @param {string} teamId
 * @param {Iterable<string>} [pickedPackages]
 * @param {number|null} [limit]
 * @returns {Array<any>}
 */
export function getOfferedPackages(packages = [], teamId, pickedPackages = [], limit = null) {
  const cleanTeamId = teamId ? String(teamId).trim() : "";
  if (!cleanTeamId) {
    return [];
  }
  const pickedSet = new Set(pickedPackages || []);

  const owned = [];
  for (const pkg of packages) {
    const pkgId = pkg.id || pkg.package;
    if (pickedSet.has(pkgId)) {
      continue;
    }
    const pkgTeam = pkg.team_id ? String(pkg.team_id).trim() : "";
    if (pkgTeam === cleanTeamId) {
      owned.push(pkg);
    }
  }

  if (typeof limit === "number" && limit > 0) {
    return owned.slice(0, limit);
  }
  return owned;
}

export const getPackagesForTeam = getOfferedPackages;

/**
 * Normalises rows from the `round3` tab into ordered situation question tiles.
 * Required fields: number, question.
 * Optional fields: image_url, time_seconds, points.
 * @param {Array<Record<string, any>>|string} input
 * @param {Record<string, any>} [config]
 * @returns {Array<{number: number, question: string, image_url: string, time_seconds: number, points: number}>}
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

    if (!rawNum || !question) {
      continue;
    }

    const number = Number(rawNum);
    if (!Number.isFinite(number) || number <= 0) {
      continue;
    }

    const image_url = resolveImageUrl(row?.image_url);
    const time_seconds = parsePositiveNumber(row?.time_seconds, defaultTime);
    const points = parseNumber(row?.points, defaultPoints);

    byNumber.set(number, {
      number,
      question,
      image_url,
      time_seconds,
      points
    });
  }

  return Array.from(byNumber.values()).sort((a, b) => a.number - b.number);
}

export { normaliseAccounts, resolveAccounts };

/**
 * Normalises all sheet tabs together.
 * @param {{
 *   teamsCsv?: any,
 *   round1Csv?: any,
 *   round2Csv?: any,
 *   round3Csv?: any,
 *   judgesCsv?: any,
 *   accountsCsv?: any,
 *   configCsv?: any
 * }} raw
 */
export function normaliseAllData({
  teamsCsv = [],
  round1Csv = [],
  round2Csv = [],
  round3Csv = [],
  judgesCsv = [],
  accountsCsv = [],
  configCsv = []
} = {}) {
  const config = normaliseConfig(configCsv);
  const teams = normaliseTeams(teamsCsv);
  const round1Packages = normaliseRound1(round1Csv, config);
  const round2Questions = normaliseRound2(round2Csv, config);
  const round3Questions = normaliseRound3(round3Csv, config);
  const judges = normaliseJudges(judgesCsv);
  const accounts = resolveAccounts(toRows(accountsCsv), { judges, teams });

  return {
    config,
    teams,
    round1Packages,
    round2Questions,
    round3Questions,
    judges,
    accounts,
    scores: {}
  };
}
