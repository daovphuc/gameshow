// Data normalisation, image path resolution, and package selection logic (DOM-free).

import { DEFAULT_CONFIG, TEAM_PALETTE } from "./config.js";
export { DEFAULT_CONFIG, TEAM_PALETTE } from "./config.js";
import { parseCsv } from "./csv.js";
import { normaliseRound2 } from "./round2.js";
import { normaliseJudges } from "./judges.js";
import { normaliseAccounts, resolveAccounts } from "./auth.js";
import { normaliseClusters } from "./clusters.js";

function toRows(input) {
  if (typeof input === "string") {
    return parseCsv(input);
  }
  if (Array.isArray(input)) return input;
  if (input && typeof input === "object") return Object.entries(input).map(([key, value]) => ({ key, value }));
  return [];
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

export const TEAM_ICONS = {
  "ha-noi": "images/teams/ha-noi.svg",
  "hai-phong": "images/teams/hai-phong.svg",
  "hue": "images/teams/hue.svg",
  "da-nang": "images/teams/da-nang.svg",
  "ho-chi-minh": "images/teams/ho-chi-minh.svg",
  "can-tho": "images/teams/can-tho.svg",
  "lai-chau": "images/teams/lai-chau.svg",
  "dien-bien": "images/teams/dien-bien.svg",
  "son-la": "images/teams/son-la.svg",
  "lao-cai": "images/teams/lao-cai.svg",
  "tuyen-quang": "images/teams/tuyen-quang.svg",
  "cao-bang": "images/teams/cao-bang.svg",
  "lang-son": "images/teams/lang-son.svg",
  "thai-nguyen": "images/teams/thai-nguyen.svg",
  "phu-tho": "images/teams/phu-tho.svg",
  "bac-ninh": "images/teams/bac-ninh.svg",
  "quang-ninh": "images/teams/quang-ninh.svg",
  "hung-yen": "images/teams/hung-yen.svg",
  "ninh-binh": "images/teams/ninh-binh.svg",
  "thanh-hoa": "images/teams/thanh-hoa.svg",
  "nghe-an": "images/teams/nghe-an.svg",
  "ha-tinh": "images/teams/ha-tinh.svg",
  "quang-tri": "images/teams/quang-tri.svg",
  "quang-ngai": "images/teams/quang-ngai.svg",
  "gia-lai": "images/teams/gia-lai.svg",
  "dak-lak": "images/teams/dak-lak.svg",
  "khanh-hoa": "images/teams/khanh-hoa.svg",
  "lam-dong": "images/teams/lam-dong.svg",
  "dong-nai": "images/teams/dong-nai.svg",
  "tay-ninh": "images/teams/tay-ninh.svg",
  "dong-thap": "images/teams/dong-thap.svg",
  "vinh-long": "images/teams/vinh-long.svg",
  "an-giang": "images/teams/an-giang.svg",
  "ca-mau": "images/teams/ca-mau.svg",
  "t06": "images/teams/t06.svg"
};

const TEAM_MATCH_RULES = [
  { slug: "t06", patterns: [/\bt06\b/, /\bhoc vien\b/] },
  { slug: "ho-chi-minh", patterns: [/\bho chi minh\b/, /\bhcm\b/, /\btphcm\b/, /\bsai gon\b/] },
  { slug: "ha-noi", patterns: [/\bha noi\b/, /\bhanoi\b/] },
  { slug: "hai-phong", patterns: [/\bhai phong\b/] },
  { slug: "da-nang", patterns: [/\bda nang\b/] },
  { slug: "can-tho", patterns: [/\bcan tho\b/] },
  { slug: "lai-chau", patterns: [/\blai chau\b/] },
  { slug: "dien-bien", patterns: [/\bdien bien\b/] },
  { slug: "son-la", patterns: [/\bson la\b/] },
  { slug: "lao-cai", patterns: [/\blao cai\b/] },
  { slug: "tuyen-quang", patterns: [/\btuyen quang\b/] },
  { slug: "cao-bang", patterns: [/\bcao bang\b/] },
  { slug: "lang-son", patterns: [/\blang son\b/] },
  { slug: "thai-nguyen", patterns: [/\bthai nguyen\b/] },
  { slug: "phu-tho", patterns: [/\bphu tho\b/] },
  { slug: "bac-ninh", patterns: [/\bbac ninh\b/] },
  { slug: "quang-ninh", patterns: [/\bquang ninh\b/] },
  { slug: "hung-yen", patterns: [/\bhung yen\b/] },
  { slug: "ninh-binh", patterns: [/\bninh binh\b/] },
  { slug: "thanh-hoa", patterns: [/\bthanh hoa\b/] },
  { slug: "nghe-an", patterns: [/\bnghe an\b/] },
  { slug: "ha-tinh", patterns: [/\bha tinh\b/] },
  { slug: "quang-tri", patterns: [/\bquang tri\b/] },
  { slug: "quang-ngai", patterns: [/\bquang ngai\b/] },
  { slug: "gia-lai", patterns: [/\bgia lai\b/] },
  { slug: "dak-lak", patterns: [/\bdak lak\b/, /\bdaklak\b/, /\bdac lac\b/, /\bdaclac\b/] },
  { slug: "khanh-hoa", patterns: [/\bkhanh hoa\b/] },
  { slug: "lam-dong", patterns: [/\blam dong\b/] },
  { slug: "dong-nai", patterns: [/\bdong nai\b/] },
  { slug: "tay-ninh", patterns: [/\btay ninh\b/] },
  { slug: "dong-thap", patterns: [/\bdong thap\b/] },
  { slug: "vinh-long", patterns: [/\bvinh long\b/] },
  { slug: "an-giang", patterns: [/\ban giang\b/] },
  { slug: "ca-mau", patterns: [/\bca mau\b/] },
  { slug: "hue", patterns: [/\bhue\b/, /\bthua thien\b/] }
];

function normalizeMatchString(str) {
  if (str === undefined || str === null) return "";
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Resolves a team's icon file path:
 * 1. An explicit image (image_url or image) set by the host wins.
 * 2. Otherwise matches the province/unit name or code (accent- and case-insensitive).
 * 3. Returns null if unknown (triggering initials fallback).
 *
 * @param {string|{name?: string, id?: string, image_url?: string, image?: string}} [teamOrName]
 * @returns {string|null}
 */
export function resolveTeamIcon(teamOrName) {
  if (teamOrName === undefined || teamOrName === null) {
    return null;
  }
  if (typeof teamOrName === "object") {
    const explicit = teamOrName.image_url ?? teamOrName.image ?? teamOrName.avatar;
    if (explicit !== undefined && explicit !== null && String(explicit).trim() !== "") {
      const resolved = resolveImageUrl(String(explicit).trim());
      if (resolved) return resolved;
    }
  }

  // Match by name only: team ids are host-defined and may be in any order.
  const rawName = typeof teamOrName === "object"
    ? (teamOrName.name || "")
    : String(teamOrName || "");

  const norm = normalizeMatchString(rawName);
  if (!norm) return null;

  for (const rule of TEAM_MATCH_RULES) {
    for (const pat of rule.patterns) {
      if (pat.test(norm)) {
        return TEAM_ICONS[rule.slug] || null;
      }
    }
  }

  return null;
}

export const getTeamIcon = resolveTeamIcon;

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
    "round2_points_per_correct",
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
 * Derives a human-friendly "Chủ đề 1", "Chủ đề 2", ... label for a Round 1 package.
 * Works for both new naming ("Chủ đề 1") and legacy naming ("Gói A", "Gói B"),
 * honoring package order for each team.
 *
 * @param {any} pkg
 * @param {number|null} [index]
 * @returns {string}
 */
export function getRound1TopicLabel(pkg, index = null) {
  if (typeof index === "number" && index >= 0) {
    return `Chủ đề ${index + 1}`;
  }
  if (pkg && typeof pkg === "object") {
    if (pkg.label) return pkg.label;
    if (typeof pkg.topicIndex === "number" && pkg.topicIndex >= 0) {
      return `Chủ đề ${pkg.topicIndex + 1}`;
    }
  }
  const name = typeof pkg === "object" && pkg !== null
    ? (pkg.package || pkg.name || "")
    : String(pkg || "");
  const trimmed = name.trim();
  const mNum = trimmed.match(/(?:chủ\s*đề|gói)\s*(\d+)/i);
  if (mNum) {
    return `Chủ đề ${mNum[1]}`;
  }
  const mLetter = trimmed.match(/(?:chủ\s*đề|gói)?\s*([a-zA-Z])$/i);
  if (mLetter) {
    const code = mLetter[1].toUpperCase().charCodeAt(0) - 64;
    if (code >= 1 && code <= 26) {
      return `Chủ đề ${code}`;
    }
  }
  return trimmed ? `Chủ đề ${trimmed}` : "Chủ đề 1";
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
 *   label: string,
 *   topicIndex: number,
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
  const teamPackageCounts = new Map();

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

    const topicIndex = teamPackageCounts.get(team_id) || 0;
    teamPackageCounts.set(team_id, topicIndex + 1);
    const label = getRound1TopicLabel(pkgName, topicIndex);

    const singleQuestion = {
      id: `${pkgKey}__1`,
      package: pkgName,
      label,
      topicIndex,
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
      label,
      topicIndex,
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
  configCsv = [],
  clustersCsv = []
} = {}) {
  const config = normaliseConfig(configCsv);
  const teams = normaliseTeams(teamsCsv);
  const round1Packages = normaliseRound1(round1Csv, config);
  const round2Questions = normaliseRound2(round2Csv, config);
  const round3Questions = normaliseRound3(round3Csv, config);
  const judges = normaliseJudges(judgesCsv);
  const accounts = resolveAccounts(toRows(accountsCsv), { judges, teams });
  const clusters = normaliseClusters(clustersCsv);

  return {
    config,
    teams,
    round1Packages,
    round2Questions,
    round3Questions,
    judges,
    accounts,
    clusters,
    scores: {}
  };
}
