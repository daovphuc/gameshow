// Account-based authentication and portal session management (DOM-free).

import { parseCsv } from "./csv.js";

export const DEFAULT_PASSWORD = "122345678910";

export const PORTALS = {
  HOST: "host",
  JUDGE: "judge",
  TEAM: "team",
  HEAD_JUDGE: "head_judge"
};

export const VALID_ROLES = new Set(["host", "judge", "team", "head_judge"]);

export const PORTAL_URLS = {
  host: "./host.html",
  judge: "./judge.html",
  team: "./team.html",
  head_judge: "./judge.html"
};

export const AUTH_STORAGE_KEY = "gameshow_auth_session";

/**
 * Maps a username to its internal hoithi.local email address.
 * Trims and lowercases. Rejects empty, non-string, or invalid characters.
 * @param {string} username
 * @returns {string}
 */
export function usernameToEmail(username) {
  if (typeof username !== "string") {
    throw new Error("Tên đăng nhập không hợp lệ.");
  }
  const clean = username.trim().toLowerCase();
  if (!clean) {
    throw new Error("Tên đăng nhập không được để trống.");
  }
  if (!/^[a-z0-9._-]+$/.test(clean)) {
    throw new Error("Tên đăng nhập chứa ký tự không hợp lệ (chỉ chấp nhận chữ cái, số, dấu chấm, gạch dưới và gạch ngang).");
  }
  return `${clean}@hoithi.local`;
}

/**
 * Extracts username from internal hoithi.local email.
 * @param {string} email
 * @returns {string}
 */
export function emailToUsername(email) {
  if (typeof email !== "string") return "";
  const clean = email.trim().toLowerCase();
  const domain = "@hoithi.local";
  if (clean.endsWith(domain)) {
    return clean.slice(0, -domain.length);
  }
  return clean;
}

/**
 * Checks whether an account role is authorized to access a given portal.
 * - host portal: host only
 * - judge portal: judge and head_judge
 * - team portal: team only
 * Unknown roles or portals are rejected.
 * @param {string} role
 * @param {string} portal
 * @returns {boolean}
 */
export function isRoleAllowedForPortal(role, portal) {
  const cleanRole = String(role || "").trim().toLowerCase();
  const cleanPortal = String(portal || "").trim().toLowerCase();
  if (!cleanRole || !VALID_ROLES.has(cleanRole)) {
    return false;
  }
  if (cleanPortal === "host") {
    return cleanRole === "host";
  }
  if (cleanPortal === "judge") {
    return cleanRole === "judge" || cleanRole === "head_judge";
  }
  if (cleanPortal === "team") {
    return cleanRole === "team";
  }
  return false;
}

/**
 * Checks portal access returning an object with ok flag and Vietnamese error if rejected.
 * @param {string} role
 * @param {string} portal
 * @returns {{ ok: boolean, error?: string }}
 */
export function checkPortalAccess(role, portal) {
  const cleanRole = String(role || "").trim().toLowerCase();
  if (!cleanRole || !VALID_ROLES.has(cleanRole)) {
    return { ok: false, error: "Vai trò tài khoản không hợp lệ hoặc chưa được cấp quyền." };
  }
  if (isRoleAllowedForPortal(cleanRole, portal)) {
    return { ok: true };
  }
  return { ok: false, error: "Tài khoản không có quyền truy cập vào cổng này." };
}

/**
 * Parses and validates bulk account creation data from CSV or row objects.
 * Validates:
 * - missing username
 * - invalid username characters
 * - missing password
 * - password < 6 characters
 * - unknown role
 * - judge/team without ref_id (and optional context check)
 * - duplicate username (within batch or existingUsernames)
 *
 * @param {string|Array<any>} input CSV string or parsed rows
 * @param {{ judges?: Array<any>, teams?: Array<any>, existingUsernames?: Array<string>|Set<string> }} [context]
 * @returns {{ ok: boolean, validAccounts: Array<any>, errors: Array<string>, results: Array<any> }}
 */
export function parseBulkAccountsCsv(input, { judges = [], teams = [], existingUsernames = [] } = {}) {
  const rows = typeof input === "string" ? parseCsv(input) : (Array.isArray(input) ? input : []);
  const validJudges = new Set((judges || []).map((j) => String(j?.id || "").trim()).filter(Boolean));
  const validTeams = new Set((teams || []).map((t) => String(t?.id || "").trim()).filter(Boolean));
  const judgeNames = new Map((judges || []).map((j) => [String(j?.id || "").trim(), String(j?.name || "").trim()]));
  const teamNames = new Map((teams || []).map((t) => [String(t?.id || "").trim(), String(t?.name || "").trim()]));

  const existingSet = new Set(
    Array.from(existingUsernames || []).map((u) => String(u || "").trim().toLowerCase()).filter(Boolean)
  );
  const batchUsernames = new Set();

  const validAccounts = [];
  const errors = [];
  const results = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;
    if (!row || typeof row !== "object") continue;

    const rawUsername = row.username !== undefined && row.username !== null ? String(row.username).trim() : "";
    const rawPassword = row.password !== undefined && row.password !== null ? String(row.password).trim() : "";
    const rawRole = row.role !== undefined && row.role !== null ? String(row.role).trim().toLowerCase() : "";
    const rawRefId = row.ref_id !== undefined && row.ref_id !== null ? String(row.ref_id).trim() : "";
    const rawDisplayName = row.display_name !== undefined && row.display_name !== null ? String(row.display_name).trim() : "";

    const rowErrors = [];

    // Username checks
    if (!rawUsername) {
      rowErrors.push(`Dòng ${rowNum}: Thiếu tên đăng nhập.`);
    } else if (!/^[a-zA-Z0-9._-]+$/.test(rawUsername)) {
      rowErrors.push(`Dòng ${rowNum}: Tên đăng nhập "${rawUsername}" chứa ký tự không hợp lệ.`);
    } else {
      const lower = rawUsername.toLowerCase();
      if (batchUsernames.has(lower) || existingSet.has(lower)) {
        rowErrors.push(`Dòng ${rowNum}: Tên đăng nhập "${rawUsername}" bị trùng lặp.`);
      } else {
        batchUsernames.add(lower);
      }
    }

    // Password checks
    if (!rawPassword) {
      rowErrors.push(`Dòng ${rowNum}: Thiếu mật khẩu.`);
    } else if (rawPassword.length < 6) {
      rowErrors.push(`Dòng ${rowNum}: Mật khẩu của tài khoản "${rawUsername || rowNum}" phải có ít nhất 6 ký tự.`);
    }

    // Role checks
    if (!rawRole) {
      rowErrors.push(`Dòng ${rowNum}: Thiếu vai trò.`);
    } else if (!VALID_ROLES.has(rawRole)) {
      rowErrors.push(`Dòng ${rowNum}: Vai trò "${rawRole}" không hợp lệ (phải là host, judge, head_judge hoặc team).`);
    } else {
      // ref_id checks
      if (rawRole === "judge") {
        if (!rawRefId) {
          rowErrors.push(`Dòng ${rowNum}: Tài khoản giám khảo "${rawUsername || rowNum}" thiếu mã giám khảo liên kết (ref_id).`);
        } else if (validJudges.size > 0 && !validJudges.has(rawRefId)) {
          rowErrors.push(`Dòng ${rowNum}: Mã giám khảo "${rawRefId}" không tồn tại trong danh sách ban giám khảo.`);
        }
      } else if (rawRole === "team") {
        if (!rawRefId) {
          rowErrors.push(`Dòng ${rowNum}: Tài khoản đội thi "${rawUsername || rowNum}" thiếu mã đội liên kết (ref_id).`);
        } else if (validTeams.size > 0 && !validTeams.has(rawRefId)) {
          rowErrors.push(`Dòng ${rowNum}: Mã đội thi "${rawRefId}" không tồn tại trong danh sách đội thi.`);
        }
      }
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      results.push({
        rowNumber: rowNum,
        username: rawUsername,
        role: rawRole,
        ref_id: rawRefId,
        display_name: rawDisplayName,
        ok: false,
        error: rowErrors.join("; "),
        account: null
      });
    } else {
      let displayName = rawDisplayName;
      if (!displayName) {
        if (rawRole === "host") displayName = "Dẫn chương trình";
        else if (rawRole === "head_judge") displayName = "Giám khảo tổng";
        else if (rawRole === "judge") displayName = judgeNames.get(rawRefId) || "Ban Giám khảo";
        else if (rawRole === "team") displayName = teamNames.get(rawRefId) || "Đội thi";
      }

      const acc = {
        username: rawUsername.toLowerCase(),
        password: rawPassword,
        role: rawRole,
        ref_id: (rawRole === "host" || rawRole === "head_judge") ? "" : rawRefId,
        display_name: displayName
      };
      validAccounts.push(acc);
      results.push({
        rowNumber: rowNum,
        username: acc.username,
        role: acc.role,
        ref_id: acc.ref_id,
        display_name: acc.display_name,
        ok: true,
        error: null,
        account: acc
      });
    }
  }

  return {
    ok: errors.length === 0,
    validAccounts,
    rows: validAccounts,
    errors,
    results
  };
}

export const validateBulkAccounts = parseBulkAccountsCsv;

/**
 * Maps an account role to its corresponding portal entry URL.
 * @param {"host"|"judge"|"team"|"head_judge"|string} role
 * @returns {string}
 */
export function getPortalUrl(role) {
  const cleanRole = String(role || "").toLowerCase().trim();
  return PORTAL_URLS[cleanRole] || "./index.html";
}

/**
 * Normalises raw accounts from sheet rows or parsed CSV.
 * - Role must be "host", "judge", "team", or "head_judge".
 * - If role is "judge", ref_id must exist in judges list.
 * - If role is "team", ref_id must exist in teams list.
 * - If role is "head_judge", ref_id is not required (empty).
 * - Blank/empty rows or rows missing username or password are skipped.
 * - Duplicate usernames (case-insensitive): first valid row wins.
 * - Trims strings.
 * - display_name defaults if empty.
 * @param {Array<Record<string, any>>} rows
 * @param {{ judges?: Array<any>, teams?: Array<any> }} [context]
 * @returns {Array<{username: string, password: string, role: "host"|"judge"|"team"|"head_judge", ref_id: string, display_name: string}>}
 */
export function normaliseAccounts(rows = [], { judges = [], teams = [] } = {}) {
  const validJudges = new Set((judges || []).map((j) => String(j?.id || "").trim()).filter(Boolean));
  const validTeams = new Set((teams || []).map((t) => String(t?.id || "").trim()).filter(Boolean));
  const judgeNames = new Map((judges || []).map((j) => [String(j?.id || "").trim(), String(j?.name || "").trim()]));
  const teamNames = new Map((teams || []).map((t) => [String(t?.id || "").trim(), String(t?.name || "").trim()]));

  const accounts = [];
  const seenUsernames = new Set();

  for (const row of rows || []) {
    if (!row || typeof row !== "object") continue;
    const rawUsername = row.username !== undefined && row.username !== null ? String(row.username).trim() : "";
    const rawPassword = row.password !== undefined && row.password !== null ? String(row.password).trim() : "";
    const rawRole = row.role !== undefined && row.role !== null ? String(row.role).trim().toLowerCase() : "";
    const rawRefId = row.ref_id !== undefined && row.ref_id !== null ? String(row.ref_id).trim() : "";
    const rawDisplayName = row.display_name !== undefined && row.display_name !== null ? String(row.display_name).trim() : "";

    // Blank rows or missing required fields skipped
    if (!rawUsername || !rawPassword || !rawRole) {
      continue;
    }

    // Role validation
    if (!VALID_ROLES.has(rawRole)) {
      continue;
    }

    // ref_id validation
    if (rawRole === "judge") {
      if (!rawRefId || !validJudges.has(rawRefId)) {
        continue;
      }
    } else if (rawRole === "team") {
      if (!rawRefId || !validTeams.has(rawRefId)) {
        continue;
      }
    }

    // Duplicate username check: first wins (case-insensitive)
    const lowerUsername = rawUsername.toLowerCase();
    if (seenUsernames.has(lowerUsername)) {
      continue;
    }
    seenUsernames.add(lowerUsername);

    let displayName = rawDisplayName;
    if (!displayName) {
      if (rawRole === "host") {
        displayName = "Dẫn chương trình";
      } else if (rawRole === "judge") {
        displayName = judgeNames.get(rawRefId) || "Ban Giám khảo";
      } else if (rawRole === "head_judge") {
        displayName = "Giám khảo tổng";
      } else if (rawRole === "team") {
        displayName = teamNames.get(rawRefId) || "Đội thi";
      }
    }

    accounts.push({
      username: rawUsername,
      password: rawPassword,
      role: rawRole,
      ref_id: (rawRole === "host" || rawRole === "head_judge") ? "" : rawRefId,
      display_name: displayName
    });
  }

  return accounts;
}

/**
 * Generates default accounts when accounts tab is missing or empty.
 * Defaults:
 * - mc (host, ref_id: "")
 * - gk1, gk2, ... per judge (ref_id: judge.id)
 * - gktong (head_judge, ref_id: "")
 * - doi01, doi02, ... per team (ref_id: team.id)
 * All with password: 122345678910
 * @param {{ judges?: Array<any>, teams?: Array<any> }} [context]
 * @returns {Array<{username: string, password: string, role: string, ref_id: string, display_name: string}>}
 */
export function generateDefaultAccounts({ judges = [], teams = [] } = {}) {
  const accounts = [
    {
      username: "mc",
      password: DEFAULT_PASSWORD,
      role: "host",
      ref_id: "",
      display_name: "Dẫn chương trình"
    }
  ];

  (judges || []).forEach((j, idx) => {
    if (!j || !j.id) return;
    const num = idx + 1;
    accounts.push({
      username: `gk${num}`,
      password: DEFAULT_PASSWORD,
      role: "judge",
      ref_id: String(j.id).trim(),
      display_name: String(j.name || `Ban Giám khảo ${num}`).trim()
    });
  });

  // Head judge account
  accounts.push({
    username: "gktong",
    password: DEFAULT_PASSWORD,
    role: "head_judge",
    ref_id: "",
    display_name: "Giám khảo tổng"
  });

  (teams || []).forEach((t, idx) => {
    if (!t || !t.id) return;
    const num = String(idx + 1).padStart(2, "0");
    accounts.push({
      username: `doi${num}`,
      password: DEFAULT_PASSWORD,
      role: "team",
      ref_id: String(t.id).trim(),
      display_name: String(t.name || `Đội ${idx + 1}`).trim()
    });
  });

  return accounts;
}

export const createDefaultAccounts = generateDefaultAccounts;

/**
 * Resolves accounts: normalises input; if empty or null, falls back to default accounts.
 * @param {Array<any>|string} rawInput
 * @param {{ judges?: Array<any>, teams?: Array<any> }} [context]
 * @returns {Array<any>}
 */
export function resolveAccounts(rawInput = [], { judges = [], teams = [] } = {}) {
  let rows = rawInput;
  if (typeof rawInput === "string") {
    // If passed a CSV string, parse it using toRows
    try {
      const lines = rawInput.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length <= 1) {
        return generateDefaultAccounts({ judges, teams });
      }
    } catch {
      return generateDefaultAccounts({ judges, teams });
    }
  }
  const normalised = normaliseAccounts(rows, { judges, teams });
  if (normalised && normalised.length > 0) {
    return normalised;
  }
  return generateDefaultAccounts({ judges, teams });
}

/**
 * Verifies username and password against accounts list.
 * Username comparison is case-insensitive and trimmed.
 * Password comparison is trimmed.
 * @param {string} username
 * @param {string} password
 * @param {Array<any>} accounts
 * @returns {{ ok: boolean, account?: any, error?: string, portalUrl?: string }}
 */
export function authenticate(username, password, accounts = []) {
  const u = String(username ?? "").trim();
  const p = String(password ?? "").trim();

  if (!u || !p) {
    return {
      ok: false,
      error: "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu."
    };
  }

  const uLower = u.toLowerCase();
  const match = (accounts || []).find(
    (acc) => String(acc.username).trim().toLowerCase() === uLower
  );

  if (!match || String(match.password).trim() !== p) {
    return {
      ok: false,
      error: "Tên đăng nhập hoặc mật khẩu không chính xác."
    };
  }

  return {
    ok: true,
    account: match,
    portalUrl: getPortalUrl(match.role)
  };
}

/**
 * Checks whether an active session is valid against the current accounts list and optional required role.
 * Returns the matching account if valid, or null if invalid.
 * @param {any} session
 * @param {Array<any>} accounts
 * @param {"host"|"judge"|"team"|"head_judge"|string} [requiredRole]
 * @returns {any|null}
 */
export function validateSession(session, accounts = [], requiredRole = null) {
  if (!session || typeof session !== "object") {
    return null;
  }
  const u = String(session.username ?? "").trim();
  const p = String(session.password ?? "").trim();
  if (!u || !p) {
    return null;
  }

  const uLower = u.toLowerCase();
  const match = (accounts || []).find(
    (acc) => String(acc.username).trim().toLowerCase() === uLower
  );

  // Account disappeared
  if (!match) {
    return null;
  }

  // Password changed
  if (String(match.password).trim() !== p) {
    return null;
  }

  // Role changed
  if (match.role !== session.role) {
    return null;
  }

  // Required role check: head_judge is allowed when accessing judge portal
  if (requiredRole) {
    const req = String(requiredRole).toLowerCase().trim();
    if (req === "judge") {
      if (match.role !== "judge" && match.role !== "head_judge") {
        return null;
      }
    } else if (match.role !== req) {
      return null;
    }
  }

  // ref_id changed for judge or team
  if ((match.role === "judge" || match.role === "team") && match.ref_id !== session.ref_id) {
    return null;
  }

  return match;
}

// Each role has its own slot so one browser can hold host, judge and team
// logins in separate tabs (single-machine testing). The plain key holds the
// most recent login, used by the home page.
function sessionKey(role) {
  return role ? `${AUTH_STORAGE_KEY}_${String(role).trim().toLowerCase()}` : AUTH_STORAGE_KEY;
}

/**
 * Reads stored session from storage: the login for `role`, or the latest login.
 * @param {Storage} [storage]
 * @param {string} [role]
 * @returns {any|null}
 */
export function getActiveSession(storage = globalThis.localStorage, role = null) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(sessionKey(role));
    if (raw) return JSON.parse(raw);
    // If looking for judge role and not found, check head_judge slot
    if (role && String(role).toLowerCase().trim() === "judge") {
      const headRaw = storage.getItem(sessionKey("head_judge"));
      if (headRaw) return JSON.parse(headRaw);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Saves active session to storage, in its role slot and as the latest login.
 * @param {any} session
 * @param {Storage} [storage]
 */
export function saveActiveSession(session, storage = globalThis.localStorage) {
  if (!storage) return;
  try {
    const raw = JSON.stringify(session);
    storage.setItem(AUTH_STORAGE_KEY, raw);
    if (session?.role) {
      storage.setItem(sessionKey(session.role), raw);
      if (session.role === "head_judge") {
        storage.setItem(sessionKey("judge"), raw);
      }
    }
  } catch {
    // Ignore storage quota error
  }
}

/**
 * Clears the session for `role` (or the latest login when no role is given).
 * @param {Storage} [storage]
 * @param {string} [role]
 */
export function clearActiveSession(storage = globalThis.localStorage, role = null) {
  if (!storage) return;
  try {
    const latest = getActiveSession(storage);
    const target = role || latest?.role || null;
    if (target) {
      storage.removeItem(sessionKey(target));
      if (String(target).toLowerCase().trim() === "judge") {
        storage.removeItem(sessionKey("head_judge"));
      }
    }
    if (!role || latest?.role === target) storage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Ignore storage error
  }
}
