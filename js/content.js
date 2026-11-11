// Pure logic for content management, validation, and conversion (DOM-free).

import { DEFAULT_CONFIG } from "./config.js";
import { parseCsv } from "./csv.js";
import {
  normaliseConfig,
  normaliseTeams,
  normaliseRound1,
  normaliseRound3
} from "./data.js";
import { normaliseRound2, groupRound2BySet } from "./round2.js";
import { normaliseJudges } from "./judges.js";
import { normaliseAccounts, resolveAccounts, generateDefaultAccounts } from "./auth.js";
import { normaliseClusters } from "./clusters.js";

export const CONTENT_TABS = ["teams", "round1", "round2", "round3", "judges", "accounts", "config", "clusters"];

function toRows(input) {
  if (typeof input === "string") {
    return parseCsv(input);
  }
  if (Array.isArray(input)) {
    return input;
  }
  if (input && typeof input === "object") {
    return Object.entries(input).map(([key, value]) => ({ key, value }));
  }
  return [];
}

/**
 * Checks whether a given string is a data: URL.
 * @param {any} url
 * @returns {boolean}
 */
export function isDataUrl(url) {
  if (url === undefined || url === null) return false;
  return String(url).trim().toLowerCase().startsWith("data:");
}

/**
 * Checks whether a content object is empty or missing necessary contest data.
 * @param {any} content
 * @returns {boolean}
 */
export function isContentEmpty(content) {
  if (!content || typeof content !== "object") {
    return true;
  }
  const hasTeams = Array.isArray(content.teams) && content.teams.length > 0;
  const hasRound1 = Array.isArray(content.round1) && content.round1.length > 0;
  const hasRound2 = Array.isArray(content.round2) && content.round2.length > 0;
  const hasRound3 = Array.isArray(content.round3) && content.round3.length > 0;
  const hasJudges = Array.isArray(content.judges) && content.judges.length > 0;
  const hasConfig = content.config && typeof content.config === "object" && Object.keys(content.config).length > 0;
  const hasClusters = Array.isArray(content.clusters) && content.clusters.length > 0;
  return !hasTeams && !hasRound1 && !hasRound2 && !hasRound3 && !hasJudges && !hasConfig && !hasClusters;
}

/**
 * Converts CSV strings (or parsed row arrays) for each tab into the stored content shape.
 * @param {{
 *   teamsCsv?: string|Array<any>,
 *   round1Csv?: string|Array<any>,
 *   round2Csv?: string|Array<any>,
 *   round3Csv?: string|Array<any>,
 *   judgesCsv?: string|Array<any>,
 *   accountsCsv?: string|Array<any>,
 *   configCsv?: string|Array<any>|Record<string, any>,
 *   round_order?: Record<string, Array<string>>
 * }} param0
 * @returns {{
 *   teams: Array<any>,
 *   round1: Array<any>,
 *   round2: Array<any>,
 *   round3: Array<any>,
 *   judges: Array<any>,
 *   accounts: Array<any>,
 *   round_order: Record<string, Array<string>>,
 *   config: Record<string, any>
 * }}
 */
export function csvToContent({
  teamsCsv = "",
  round1Csv = "",
  round2Csv = "",
  round3Csv = "",
  judgesCsv = "",
  accountsCsv = "",
  configCsv = "",
  clustersCsv = "",
  round_order = {}
} = {}) {
  const teams = toRows(teamsCsv);
  const round1 = toRows(round1Csv);
  const round2 = toRows(round2Csv);
  const round3 = toRows(round3Csv);
  const judges = toRows(judgesCsv);
  const accounts = toRows(accountsCsv);
  const clusters = normaliseClusters(clustersCsv);
  const config = normaliseConfig(configCsv);

  return {
    teams,
    round1,
    round2,
    round3,
    judges,
    accounts,
    clusters,
    round_order: round_order || {},
    config
  };
}

/**
 * Converts stored content shape back into the app's full quiz data structure.
 * When accounts are empty or missing, generates default accounts from judges & teams.
 * When content is empty/missing and sampleFallback is provided, resolves to fallback.
 * @param {any} content
 * @param {any} [sampleFallback]
 * @returns {Record<string, any>}
 */
export function contentToQuizData(content = {}, sampleFallback = null) {
  if (isContentEmpty(content)) {
    if (sampleFallback) {
      return sampleFallback;
    }
  }

  const rawConfig = content && typeof content === "object" ? content.config : {};
  const config = normaliseConfig(rawConfig);
  const allTeams = normaliseTeams(content?.teams || []);
  const round_order = content?.round_order || {};
  const teams = getContestTeams(allTeams, round_order);
  const round1Packages = normaliseRound1(content?.round1 || [], config);
  const round2Questions = normaliseRound2(content?.round2 || [], config);
  const round3Questions = normaliseRound3(content?.round3 || [], config);
  const judges = normaliseJudges(content?.judges || []);
  const clusters = normaliseClusters(content?.clusters || []);

  const rawAccounts = content?.accounts;
  const accounts = resolveAccounts(Array.isArray(rawAccounts) ? rawAccounts : [], { judges, teams: allTeams });

  return {
    config,
    teams,
    allTeams,
    round1Packages,
    round2Questions,
    round3Questions,
    judges,
    accounts,
    clusters,
    round_order,
    scores: {}
  };
}

/**
 * Resolves quiz data: returns quiz data from content if present, or sampleFallback if empty.
 * @param {any} content
 * @param {any} sampleFallback
 * @returns {any}
 */
export function resolveQuizData(content, sampleFallback) {
  if (isContentEmpty(content)) {
    return sampleFallback;
  }
  return contentToQuizData(content, sampleFallback);
}

/**
 * Returns participating teams in the overall contest.
 * If round_order.contest is unset (undefined or null), returns all teams in their default order.
 * If round_order.contest is an array, returns only matching teams in the configured order.
 *
 * @param {Array<{id: string, name?: string}>} allTeams
 * @param {Record<string, Array<string>>|Array<string>} [roundOrder]
 * @returns {Array<any>}
 */
export function getContestTeams(allTeams = [], roundOrder = {}) {
  const teamsList = Array.isArray(allTeams) ? allTeams : [];
  if (!roundOrder || typeof roundOrder !== "object") {
    return teamsList.slice();
  }

  const contestIds = roundOrder.contest;
  if (!Array.isArray(contestIds)) {
    return teamsList.slice();
  }

  const teamMap = new Map(teamsList.map((t) => [String(t.id).trim(), t]));
  const result = [];
  const seen = new Set();

  for (let i = 0; i < contestIds.length; i++) {
    const id = String(contestIds[i]).trim();
    if (seen.has(id)) continue;
    seen.add(id);
    const team = teamMap.get(id);
    if (team) {
      result.push(team);
    }
  }

  return result;
}

/**
 * Checks whether a team participates in the contest.
 *
 * @param {string} teamId
 * @param {Array<{id: string}>} allTeams
 * @param {Record<string, Array<string>>} [roundOrder]
 * @returns {boolean}
 */
export function isTeamInContest(teamId, allTeams = [], roundOrder = {}) {
  if (!teamId) return false;
  const cleanId = String(teamId).trim();
  const contestTeams = getContestTeams(allTeams, roundOrder);
  return contestTeams.some((t) => String(t.id).trim() === cleanId);
}

/**
 * Returns participating teams for a given round in configured order.
 * If round_order is not configured or empty for this round, returns all contest teams in their default order.
 * Any teams not in the contest are automatically excluded (intersection with contest teams).
 *
 * @param {Array<{id: string, name?: string}>} allTeams
 * @param {Record<string, Array<string>>|Array<string>} [roundOrder]
 * @param {string} [roundKey]
 * @returns {Array<any>}
 */
export function getRoundTeams(allTeams = [], roundOrder = {}, roundKey = null) {
  const teamsList = Array.isArray(allTeams) ? allTeams : [];
  const contestTeams = getContestTeams(teamsList, roundOrder);

  if (roundKey === "contest") {
    return contestTeams.map((t, idx) => ({ ...t, orderNumber: idx + 1 }));
  }

  if (!roundOrder) {
    return contestTeams.map((t, idx) => ({ ...t, orderNumber: idx + 1 }));
  }

  let orderedIds = null;
  if (Array.isArray(roundOrder)) {
    orderedIds = roundOrder;
  } else if (typeof roundOrder === "object") {
    if (roundKey && Array.isArray(roundOrder[roundKey])) {
      orderedIds = roundOrder[roundKey];
    } else if (!roundKey && Array.isArray(roundOrder.round1)) {
      orderedIds = roundOrder.round1;
    }
  }

  if (!orderedIds || orderedIds.length === 0) {
    return contestTeams.map((t, idx) => ({ ...t, orderNumber: idx + 1 }));
  }

  const contestMap = new Map(contestTeams.map((t) => [String(t.id).trim(), t]));
  const result = [];
  const seen = new Set();

  for (let i = 0; i < orderedIds.length; i++) {
    const id = String(orderedIds[i]).trim();
    if (seen.has(id)) continue;
    const team = contestMap.get(id);
    if (team) {
      seen.add(id);
      result.push({
        ...team,
        orderNumber: result.length + 1
      });
    }
  }

  return result;
}

export const getParticipatingTeams = getRoundTeams;

/**
 * Checks whether a team participates in a given round.
 *
 * @param {string} teamId
 * @param {Array<{id: string}>} allTeams
 * @param {Record<string, Array<string>>|Array<string>} [roundOrder]
 * @param {string} [roundKey]
 * @returns {boolean}
 */
export function isTeamInRound(teamId, allTeams = [], roundOrder = {}, roundKey = null) {
  if (!teamId) return false;
  const cleanId = String(teamId).trim();
  const participating = getRoundTeams(allTeams, roundOrder, roundKey);
  return participating.some((t) => String(t.id).trim() === cleanId);
}

export const isTeamParticipating = isTeamInRound;

/**
 * Validates content and returns an object indicating validity and Vietnamese error messages.
 * Rejects:
 * - Duplicate team ids
 * - Round 1 package pointing to unknown team
 * - Round 2 question whose correct answer is not one of A-D or whose option is empty
 * - Duplicate round 3 tile numbers
 * - Account linked to unknown team or judge
 * - data: URLs for images (teams, round 1, round 2, round 3)
 * - Round order containing unknown team ids or duplicates
 *
 * @param {any} content
 * @returns {{ valid: boolean, errors: Array<string> }}
 */
export function validateContent(content = {}) {
  const errors = [];

  if (!content || typeof content !== "object") {
    errors.push("Dữ liệu cấu hình không hợp lệ hoặc bị trống.");
    return { valid: false, errors };
  }

  // 1. Teams validation
  const seenTeamIds = new Set();
  const validTeamIds = new Set();

  const teams = Array.isArray(content.teams) ? content.teams : [];
  teams.forEach((t, index) => {
    const id = t?.id !== undefined && t?.id !== null ? String(t.id).trim() : "";
    const name = t?.name !== undefined && t?.name !== null ? String(t.name).trim() : "";

    if (!id) {
      errors.push(`Đội thi thứ ${index + 1} thiếu mã định danh (ID).`);
      return;
    }
    if (!name) {
      errors.push(`Đội thi "${id}" thiếu tên đội.`);
    }
    if (seenTeamIds.has(id)) {
      errors.push(`Mã đội thi "${id}" bị trùng lặp.`);
    } else {
      seenTeamIds.add(id);
      validTeamIds.add(id);
    }

    if (isDataUrl(t?.image_url)) {
      errors.push(`Ảnh của đội thi "${name || id || index + 1}" sử dụng định dạng data: URL không được hỗ trợ. Vui lòng chép ảnh vào thư mục images/ của dự án rồi nhập tên file.`);
    }
  });

  // 2. Judges validation
  const seenJudgeIds = new Set();
  const validJudgeIds = new Set();

  const judges = Array.isArray(content.judges) ? content.judges : [];
  judges.forEach((j, index) => {
    const id = j?.id !== undefined && j?.id !== null ? String(j.id).trim() : "";
    const name = j?.name !== undefined && j?.name !== null ? String(j.name).trim() : "";

    if (!id) {
      errors.push(`Giám khảo thứ ${index + 1} thiếu mã định danh (ID).`);
      return;
    }
    if (!name) {
      errors.push(`Giám khảo "${id}" thiếu họ tên.`);
    }
    if (seenJudgeIds.has(id)) {
      errors.push(`Mã giám khảo "${id}" bị trùng lặp.`);
    } else {
      seenJudgeIds.add(id);
      validJudgeIds.add(id);
    }
  });

  // 3. Round 1 validation
  const round1 = Array.isArray(content.round1) ? content.round1 : [];
  round1.forEach((pkg, index) => {
    const pkgName = pkg?.package !== undefined && pkg?.package !== null ? String(pkg.package).trim() : "";
    const teamId = pkg?.team_id !== undefined && pkg?.team_id !== null ? String(pkg.team_id).trim() : "";
    const question = pkg?.question !== undefined && pkg?.question !== null ? String(pkg.question).trim() : "";

    const label = pkgName ? `Chủ đề "${pkgName}"` : `Chủ đề thứ ${index + 1}`;

    if (!pkgName) {
      errors.push(`${label} của Vòng 1 thiếu tên chủ đề.`);
    }
    if (!teamId) {
      errors.push(`${label} của Vòng 1 thiếu mã đội thi sở hữu.`);
    } else if (!validTeamIds.has(teamId)) {
      errors.push(`${label} của Vòng 1 liên kết với đội thi không tồn tại ("${teamId}").`);
    }
    if (!question) {
      errors.push(`${label} của Vòng 1 thiếu nội dung câu hỏi.`);
    }

    if (isDataUrl(pkg?.image_url)) {
      errors.push(`Ảnh của ${label} Vòng 1 sử dụng định dạng data: URL không được hỗ trợ. Vui lòng chép ảnh vào thư mục images/ của dự án rồi nhập tên file.`);
    }
  });

  // 4. Round 2 validation
  const round2 = Array.isArray(content.round2) ? content.round2 : [];

  round2.forEach((q, index) => {
    const set = q?.set !== undefined && q?.set !== null ? String(q.set).trim() : "1";
    const num = q?.number !== undefined && q?.number !== null ? String(q.number).trim() : String(index + 1);
    const qText = q?.question !== undefined && q?.question !== null ? String(q.question).trim() : "";
    const correct = q?.correct !== undefined && q?.correct !== null ? String(q.correct).trim().toUpperCase() : "";

    const optA = q?.option_a !== undefined && q?.option_a !== null ? String(q.option_a).trim() : "";
    const optB = q?.option_b !== undefined && q?.option_b !== null ? String(q.option_b).trim() : "";
    const optC = q?.option_c !== undefined && q?.option_c !== null ? String(q.option_c).trim() : "";
    const optD = q?.option_d !== undefined && q?.option_d !== null ? String(q.option_d).trim() : "";

    const label = `Câu ${num} (Bộ ${set}) Vòng 2`;

    if (!qText) {
      errors.push(`${label} thiếu nội dung câu hỏi.`);
    }

    if (!optA || !optB) {
      errors.push(`${label} có phương án lựa chọn bị để trống (yêu cầu tối thiểu 2 phương án A và B).`);
    } else if (optD && !optC) {
      errors.push(`${label} có phương án lựa chọn bị để trống (phương án C bị trống khi có D).`);
    }

    const validAnswers = new Set(["A", "B"]);
    if (optC) validAnswers.add("C");
    if (optD) validAnswers.add("D");

    if (!validAnswers.has(correct)) {
      errors.push(`${label} có đáp án đúng "${correct || q?.correct || ''}" không hợp lệ (phải là một trong các phương án có nội dung).`);
    }

    if (isDataUrl(q?.image_url)) {
      errors.push(`Ảnh của ${label} sử dụng định dạng data: URL không được hỗ trợ. Vui lòng chép ảnh vào thư mục images/ của dự án rồi nhập tên file.`);
    }
  });

  // 5. Round 3 validation
  const round3 = Array.isArray(content.round3) ? content.round3 : [];
  const seenTileNumbers = new Set();

  round3.forEach((tile, index) => {
    const rawNum = tile?.number !== undefined && tile?.number !== null ? String(tile.number).trim() : "";
    const question = tile?.question !== undefined && tile?.question !== null ? String(tile.question).trim() : "";
    const num = Number(rawNum);

    if (!rawNum || !Number.isFinite(num) || num <= 0) {
      errors.push(`Ô tình huống thứ ${index + 1} Vòng 3 có số thứ tự không hợp lệ.`);
      return;
    }

    if (seenTileNumbers.has(num)) {
      errors.push(`Ô tình huống số ${num} ở Vòng 3 bị trùng lặp.`);
    } else {
      seenTileNumbers.add(num);
    }

    if (!question) {
      errors.push(`Ô tình huống số ${num} Vòng 3 thiếu nội dung tình huống.`);
    }

    if (isDataUrl(tile?.image_url)) {
      errors.push(`Ảnh của ô tình huống số ${num} Vòng 3 sử dụng định dạng data: URL không được hỗ trợ. Vui lòng chép ảnh vào thư mục images/ của dự án rồi nhập tên file.`);
    }
  });

  // 6. Accounts validation
  const accounts = Array.isArray(content.accounts) ? content.accounts : [];
  const seenUsernames = new Set();
  const validRoles = new Set(["host", "judge", "team", "head_judge"]);

  accounts.forEach((acc, index) => {
    const username = acc?.username !== undefined && acc?.username !== null ? String(acc.username).trim() : "";
    const role = acc?.role !== undefined && acc?.role !== null ? String(acc.role).trim().toLowerCase() : "";
    const refId = acc?.ref_id !== undefined && acc?.ref_id !== null ? String(acc.ref_id).trim() : "";

    const label = username ? `Tài khoản "${username}"` : `Tài khoản thứ ${index + 1}`;

    if (!username) {
      errors.push(`${label} thiếu tên đăng nhập.`);
      return;
    }

    const lower = username.toLowerCase();
    if (seenUsernames.has(lower)) {
      errors.push(`Tên đăng nhập "${username}" bị trùng lặp.`);
    } else {
      seenUsernames.add(lower);
    }

    if (!validRoles.has(role)) {
      errors.push(`${label} có vai trò "${role}" không hợp lệ (phải là host, judge, head_judge hoặc team).`);
      return;
    }

    if (role === "team") {
      if (!refId || !validTeamIds.has(refId)) {
        errors.push(`${label} liên kết với đội thi không tồn tại ("${refId}").`);
      }
    } else if (role === "judge") {
      if (!refId || !validJudgeIds.has(refId)) {
        errors.push(`${label} liên kết với giám khảo không tồn tại ("${refId}").`);
      }
    }
    // Note: head_judge does not require ref_id
  });

  // 7. Round order validation
  if (content.round_order && typeof content.round_order === "object") {
    const roundLabels = {
      contest: "Đội tham gia hội thi",
      round1: "Vòng 1",
      round2: "Vòng 2",
      round3: "Vòng 3"
    };

    for (const [rKey, rLabel] of Object.entries(roundLabels)) {
      const orderList = content.round_order[rKey];
      if (orderList !== undefined && orderList !== null) {
        if (!Array.isArray(orderList)) {
          errors.push(`Thứ tự thi ${rLabel} phải là danh sách.`);
          continue;
        }

        const seenOrderIds = new Set();
        orderList.forEach((teamId, index) => {
          const cleanId = String(teamId ?? "").trim();
          if (!cleanId) {
            errors.push(`Thứ tự thi ${rLabel} tại vị trí thứ ${index + 1} bị trống.`);
            return;
          }
          if (!validTeamIds.has(cleanId)) {
            errors.push(`Thứ tự thi ${rLabel} liên kết với đội thi không tồn tại ("${cleanId}").`);
          }
          if (seenOrderIds.has(cleanId)) {
            errors.push(`Thứ tự thi ${rLabel} chứa đội thi bị trùng lặp ("${cleanId}").`);
          } else {
            seenOrderIds.add(cleanId);
          }
        });
      }
    }
  }

  // 8. Clusters validation
  if (Array.isArray(content.clusters)) {
    const seenClusterIds = new Set();
    content.clusters.forEach((c, index) => {
      const cId = c?.id !== undefined && c?.id !== null ? String(c.id).trim() : "";
      const cName = c?.name !== undefined && c?.name !== null ? String(c.name).trim() : "";
      if (!cId) {
        errors.push(`Cụm thi thứ ${index + 1} thiếu mã định danh (ID).`);
        return;
      }
      if (!cName) {
        errors.push(`Cụm thi "${cId}" thiếu tên cụm.`);
      }
      if (seenClusterIds.has(cId)) {
        errors.push(`Mã cụm thi "${cId}" bị trùng lặp.`);
      } else {
        seenClusterIds.add(cId);
      }
      if (Array.isArray(c.team_ids)) {
        c.team_ids.forEach((tId) => {
          const cleanTId = String(tId || "").trim();
          if (cleanTId && !validTeamIds.has(cleanTId)) {
            errors.push(`Cụm thi "${cName || cId}" chứa đội thi không tồn tại ("${cleanTId}").`);
          }
        });
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Prepares and serializes content for saving to database.
 * Strips accounts property so plaintext passwords/accounts are never saved to database.
 * @param {any} content
 * @returns {Record<string, any>}
 */
export function serializeContentForSave(content = {}) {
  if (!content || typeof content !== "object") {
    return {};
  }
  const copy = { ...content };
  delete copy.accounts;
  return copy;
}

export const prepareContentForSave = serializeContentForSave;

/**
 * Serializes content object to formatted JSON string.
 * @param {any} content
 * @returns {string}
 */
export function exportContentToJson(content) {
  return JSON.stringify(content, null, 2);
}

/**
 * Parses and validates a JSON string as contest content.
 * @param {string} jsonString
 * @returns {{ ok: boolean, content?: any, errors?: Array<string> }}
 */
export function importContentFromJson(jsonString) {
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    return {
      ok: false,
      errors: [`Định dạng tệp JSON không hợp lệ: ${err.message}`]
    };
  }

  const validation = validateContent(parsed);
  if (!validation.valid) {
    return {
      ok: false,
      errors: validation.errors
    };
  }

  return {
    ok: true,
    content: parsed
  };
}

export const ALLOWED_TEAM_CONTENT_KEYS = ["teams", "config", "clusters", "round_order", "judges"];
export const ALLOWED_TEAM_CONTENT_PATHS = ALLOWED_TEAM_CONTENT_KEYS.map((k) => `content/${k}`);

/**
 * Decides which content paths a role loads from the database.
 * Team role loads only allowed children (never round1/round2/round3 question banks).
 * Host, judge, and head_judge load the entire content node.
 *
 * @param {string} role
 * @returns {Array<string>}
 */
export function getContentPathsForRole(role) {
  const cleanRole = String(role || "").trim().toLowerCase();
  if (cleanRole === "team") {
    return [...ALLOWED_TEAM_CONTENT_PATHS];
  }
  return ["content"];
}

/**
 * Builds a content object from separately read children (a team cannot read
 * `content` as a whole). Missing or null children are left out.
 *
 * @param {Record<string, any>} parts  key -> value read from `content/<key>`
 * @returns {Record<string, any>}
 */
export function assembleTeamContent(parts = {}) {
  const out = {};
  for (const key of ALLOWED_TEAM_CONTENT_KEYS) {
    const value = parts?.[key];
    if (value !== undefined && value !== null) out[key] = value;
  }
  return out;
}

