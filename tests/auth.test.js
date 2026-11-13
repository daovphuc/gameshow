import test from "node:test";
import assert from "node:assert/strict";
import "./rules.test.js";
import {
  DEFAULT_PASSWORD,
  PORTALS,
  authenticate,
  clearActiveSession,
  generateDefaultAccounts,
  getActiveSession,
  getPortalUrl,
  normaliseAccounts,
  resolveAccounts,
  saveActiveSession,
  validateSession,
  usernameToEmail,
  emailToUsername,
  isRoleAllowedForPortal,
  checkPortalAccess,
  parseBulkAccountsCsv
} from "../js/auth.js";
import { serializeContentForSave } from "../js/content.js";

const sampleJudges = [
  { id: "gk-01", name: "Ban Giám khảo 1" },
  { id: "gk-02", name: "Ban Giám khảo 2" },
  { id: "gk-03", name: "Ban Giám khảo 3" }
];

const sampleTeams = [
  { id: "doi-01", name: "Đội Sao Vàng" },
  { id: "doi-02", name: "Đội Hồng Hà" },
  { id: "doi-03", name: "Đội Ba Đình" }
];

test("Role to portal URL mapping", () => {
  assert.equal(getPortalUrl("host"), "./host.html");
  assert.equal(getPortalUrl("HOST"), "./host.html");
  assert.equal(getPortalUrl(PORTALS.HOST), "./host.html");
  assert.equal(getPortalUrl("judge"), "./judge.html");
  assert.equal(getPortalUrl("JUDGE"), "./judge.html");
  assert.equal(getPortalUrl("head_judge"), "./judge.html");
  assert.equal(getPortalUrl(PORTALS.JUDGE), "./judge.html");
  assert.equal(getPortalUrl("team"), "./team.html");
  assert.equal(getPortalUrl("TEAM"), "./team.html");
  assert.equal(getPortalUrl(PORTALS.TEAM), "./team.html");
  assert.equal(getPortalUrl("stage_timer"), "./stage-timer.html");
  assert.equal(getPortalUrl("stage-timer"), "./stage-timer.html");
  assert.equal(getPortalUrl(PORTALS.STAGE_TIMER), "./stage-timer.html");
  assert.equal(getPortalUrl("draw"), "./draw.html");
  assert.equal(getPortalUrl(PORTALS.DRAW), "./draw.html");
  assert.equal(getPortalUrl("unknown"), "./index.html");
});

test("Default accounts generated from judges and teams when accounts tab is missing or empty", () => {
  const defaults = generateDefaultAccounts({ judges: sampleJudges, teams: sampleTeams });
  // 1 host + 3 judges + 1 head_judge + 3 teams = 8 accounts
  assert.equal(defaults.length, 8);

  // Host default
  assert.deepEqual(defaults[0], {
    username: "mc",
    password: DEFAULT_PASSWORD,
    role: "host",
    ref_id: "",
    display_name: "Dẫn chương trình"
  });

  // Judge defaults: gk1, gk2, gk3 with ref_id and display_name
  assert.deepEqual(defaults[1], {
    username: "gk1",
    password: DEFAULT_PASSWORD,
    role: "judge",
    ref_id: "gk-01",
    display_name: "Ban Giám khảo 1"
  });
  assert.deepEqual(defaults[2], {
    username: "gk2",
    password: DEFAULT_PASSWORD,
    role: "judge",
    ref_id: "gk-02",
    display_name: "Ban Giám khảo 2"
  });
  assert.deepEqual(defaults[3], {
    username: "gk3",
    password: DEFAULT_PASSWORD,
    role: "judge",
    ref_id: "gk-03",
    display_name: "Ban Giám khảo 3"
  });

  // Head judge default
  assert.deepEqual(defaults[4], {
    username: "gktong",
    password: DEFAULT_PASSWORD,
    role: "head_judge",
    ref_id: "",
    display_name: "Giám khảo tổng"
  });

  // Team defaults: doi01, doi02, doi03 with ref_id and display_name
  assert.deepEqual(defaults[5], {
    username: "doi01",
    password: DEFAULT_PASSWORD,
    role: "team",
    ref_id: "doi-01",
    display_name: "Đội Sao Vàng"
  });
  assert.deepEqual(defaults[6], {
    username: "doi02",
    password: DEFAULT_PASSWORD,
    role: "team",
    ref_id: "doi-02",
    display_name: "Đội Hồng Hà"
  });
  assert.deepEqual(defaults[7], {
    username: "doi03",
    password: DEFAULT_PASSWORD,
    role: "team",
    ref_id: "doi-03",
    display_name: "Đội Ba Đình"
  });

  // resolveAccounts returns defaults when input is empty
  assert.deepEqual(resolveAccounts([], { judges: sampleJudges, teams: sampleTeams }), defaults);
  assert.deepEqual(resolveAccounts("", { judges: sampleJudges, teams: sampleTeams }), defaults);
});

test("Accounts normalisation: role validation, ref_id must exist for judge/team, duplicate usernames: first wins, blank rows skipped", () => {
  const rawRows = [
    // Valid host account
    { username: " admin ", password: " secret123 ", role: " host ", ref_id: "", display_name: "Quản trị" },
    // Duplicate username with different case: first wins
    { username: "ADMIN", password: "other-password", role: "host", ref_id: "", display_name: "Khác" },
    // Valid head_judge account (does not require ref_id)
    { username: "gktong", password: "passhead", role: "head_judge", ref_id: "", display_name: "Giám khảo tổng" },
    // Valid judge account with matching ref_id
    { username: "gk_truong", password: "pass1", role: "judge", ref_id: "gk-01", display_name: "Trưởng ban GK" },
    // Judge account with invalid ref_id: skipped
    { username: "gk_invalid", password: "pass2", role: "judge", ref_id: "gk-99", display_name: "Sai ref" },
    // Judge account with empty ref_id: skipped
    { username: "gk_noref", password: "pass3", role: "judge", ref_id: "", display_name: "Không có ref" },
    // Valid team account with matching ref_id
    { username: "doi_saovang", password: "pass4", role: "team", ref_id: "doi-01", display_name: "" },
    // Team account with invalid ref_id: skipped
    { username: "doi_invalid", password: "pass5", role: "team", ref_id: "doi-99" },
    // Invalid role: skipped
    { username: "spectator1", password: "pass6", role: "guest", ref_id: "" },
    // Blank rows or missing required fields: skipped
    { username: "", password: "pass7", role: "host" },
    { username: "user_nopass", password: "", role: "host" },
    { username: "   ", password: "   ", role: "   " },
    null,
    undefined
  ];

  const normalised = normaliseAccounts(rawRows, { judges: sampleJudges, teams: sampleTeams });
  assert.equal(normalised.length, 4);

  // 1. Host
  assert.deepEqual(normalised[0], {
    username: "admin",
    password: "secret123",
    role: "host",
    ref_id: "",
    display_name: "Quản trị"
  });

  // 2. Head Judge
  assert.deepEqual(normalised[1], {
    username: "gktong",
    password: "passhead",
    role: "head_judge",
    ref_id: "",
    display_name: "Giám khảo tổng"
  });

  // 3. Judge
  assert.deepEqual(normalised[2], {
    username: "gk_truong",
    password: "pass1",
    role: "judge",
    ref_id: "gk-01",
    display_name: "Trưởng ban GK"
  });

  // 4. Team (display_name defaulted to team name)
  assert.deepEqual(normalised[3], {
    username: "doi_saovang",
    password: "pass4",
    role: "team",
    ref_id: "doi-01",
    display_name: "Đội Sao Vàng"
  });
});

test("Login check: right/wrong password, case-insensitive username, trimmed input", () => {
  const accounts = [
    { username: "mc", password: "password123", role: "host", ref_id: "", display_name: "Dẫn chương trình" },
    { username: "gktong", password: "headpass", role: "head_judge", ref_id: "", display_name: "Giám khảo tổng" },
    { username: "gk1", password: "judgepass", role: "judge", ref_id: "gk-01", display_name: "GK 1" },
    { username: "doi01", password: "teampass", role: "team", ref_id: "doi-01", display_name: "Đội 1" }
  ];

  // Correct login: exact match
  const res1 = authenticate("mc", "password123", accounts);
  assert.equal(res1.ok, true);
  assert.equal(res1.account.username, "mc");
  assert.equal(res1.portalUrl, "./host.html");

  // Head judge login -> routes to ./judge.html
  const resHead = authenticate("gktong", "headpass", accounts);
  assert.equal(resHead.ok, true);
  assert.equal(resHead.portalUrl, "./judge.html");

  // Correct login: case-insensitive username & trimmed spaces
  const res2 = authenticate("  MC  ", "  password123  ", accounts);
  assert.equal(res2.ok, true);
  assert.equal(res2.account.username, "mc");

  const resJudge = authenticate("GK1", "judgepass", accounts);
  assert.equal(resJudge.ok, true);
  assert.equal(resJudge.portalUrl, "./judge.html");

  const resTeam = authenticate("Doi01", "teampass", accounts);
  assert.equal(resTeam.ok, true);
  assert.equal(resTeam.portalUrl, "./team.html");

  // Wrong password
  const resWrongPass = authenticate("mc", "wrong-password", accounts);
  assert.equal(resWrongPass.ok, false);
  assert.ok(resWrongPass.error.includes("không chính xác"));

  // Non-existent username
  const resNotFound = authenticate("unknown_user", "password123", accounts);
  assert.equal(resNotFound.ok, false);
  assert.ok(resNotFound.error.includes("không chính xác"));

  // Empty username or password
  assert.equal(authenticate("", "password123", accounts).ok, false);
  assert.equal(authenticate("mc", "", accounts).ok, false);
  assert.equal(authenticate("   ", "   ", accounts).ok, false);
});

test("Stored login invalidated when account disappears or password changes", () => {
  const initialAccounts = [
    { username: "mc", password: "pass-host", role: "host", ref_id: "", display_name: "MC" },
    { username: "gktong", password: "pass-head", role: "head_judge", ref_id: "", display_name: "GKTong" },
    { username: "gk1", password: "pass-judge", role: "judge", ref_id: "gk-01", display_name: "GK1" }
  ];

  const validSession = {
    username: "mc",
    password: "pass-host",
    role: "host",
    ref_id: "",
    display_name: "MC"
  };

  // Valid session matches
  assert.ok(validateSession(validSession, initialAccounts, "host"));
  assert.ok(validateSession(validSession, initialAccounts)); // without role check

  // Head judge session validates for judge portal
  const headSession = {
    username: "gktong",
    password: "pass-head",
    role: "head_judge",
    ref_id: "",
    display_name: "GKTong"
  };
  assert.ok(validateSession(headSession, initialAccounts, "judge"));

  // Role mismatch rejected
  assert.equal(validateSession(validSession, initialAccounts, "judge"), null);

  // Password changed in sheet -> session invalidated
  const accountsWithChangedPass = [
    { username: "mc", password: "new-password-456", role: "host", ref_id: "", display_name: "MC" }
  ];
  assert.equal(validateSession(validSession, accountsWithChangedPass, "host"), null);

  // Account deleted from sheet -> session invalidated
  const accountsWithoutMc = [
    { username: "gk1", password: "pass-judge", role: "judge", ref_id: "gk-01", display_name: "GK1" }
  ];
  assert.equal(validateSession(validSession, accountsWithoutMc, "host"), null);
});

test("Each role keeps its own login slot so one browser can hold host, judge and team tabs", () => {
  const store = new Map();
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };
  saveActiveSession({ username: "mc", password: "x", role: "host" }, storage);
  saveActiveSession({ username: "gk1", password: "x", role: "judge", ref_id: "gk-01" }, storage);

  assert.equal(getActiveSession(storage, "host").username, "mc");
  assert.equal(getActiveSession(storage, "judge").username, "gk1");
  assert.equal(getActiveSession(storage).username, "gk1");

  clearActiveSession(storage, "judge");
  assert.equal(getActiveSession(storage, "judge"), null);
  assert.equal(getActiveSession(storage), null);
  assert.equal(getActiveSession(storage, "host").username, "mc");
});

test("usernameToEmail maps username to lowercase @hoithi.local email, trims, and rejects empty or invalid chars", () => {
  // Trimming and lowercase
  assert.equal(usernameToEmail("mc"), "mc@hoithi.local");
  assert.equal(usernameToEmail("  mc  "), "mc@hoithi.local");
  assert.equal(usernameToEmail("MC"), "mc@hoithi.local");
  assert.equal(usernameToEmail("GK1"), "gk1@hoithi.local");
  assert.equal(usernameToEmail("  Doi01  "), "doi01@hoithi.local");
  assert.equal(usernameToEmail("gk_truong-01.a"), "gk_truong-01.a@hoithi.local");

  // Rejection of empty or non-string
  assert.throws(() => usernameToEmail(""), /trống|không hợp lệ/i);
  assert.throws(() => usernameToEmail("   "), /trống|không hợp lệ/i);
  assert.throws(() => usernameToEmail(null), /không hợp lệ/i);
  assert.throws(() => usernameToEmail(undefined), /không hợp lệ/i);

  // Rejection of invalid characters
  assert.throws(() => usernameToEmail("user name"), /không hợp lệ/i);
  assert.throws(() => usernameToEmail("user@host"), /không hợp lệ/i);
  assert.throws(() => usernameToEmail("user#123"), /không hợp lệ/i);
  assert.throws(() => usernameToEmail("user$"), /không hợp lệ/i);
  assert.throws(() => usernameToEmail("user/test"), /không hợp lệ/i);

  // emailToUsername helper
  assert.equal(emailToUsername("mc@hoithi.local"), "mc");
  assert.equal(emailToUsername("GK1@HOITHI.LOCAL"), "gk1");
});

test("Portal access check per role: host, judge, head_judge, team; unknown role rejected", () => {
  // Host portal
  assert.equal(isRoleAllowedForPortal("host", "host"), true);
  assert.equal(isRoleAllowedForPortal("HOST", "host"), true);
  assert.equal(isRoleAllowedForPortal("judge", "host"), false);
  assert.equal(isRoleAllowedForPortal("head_judge", "host"), false);
  assert.equal(isRoleAllowedForPortal("team", "host"), false);

  // Judge portal: judge and head_judge allowed
  assert.equal(isRoleAllowedForPortal("judge", "judge"), true);
  assert.equal(isRoleAllowedForPortal("JUDGE", "judge"), true);
  assert.equal(isRoleAllowedForPortal("head_judge", "judge"), true);
  assert.equal(isRoleAllowedForPortal("HEAD_JUDGE", "judge"), true);
  assert.equal(isRoleAllowedForPortal("host", "judge"), false);
  assert.equal(isRoleAllowedForPortal("team", "judge"), false);

  // Team portal: team only
  assert.equal(isRoleAllowedForPortal("team", "team"), true);
  assert.equal(isRoleAllowedForPortal("TEAM", "team"), true);
  assert.equal(isRoleAllowedForPortal("host", "team"), false);
  assert.equal(isRoleAllowedForPortal("judge", "team"), false);
  assert.equal(isRoleAllowedForPortal("head_judge", "team"), false);

  // Stage Timer portal: host and head_judge allowed; judge and team rejected
  assert.equal(isRoleAllowedForPortal("host", "stage_timer"), true);
  assert.equal(isRoleAllowedForPortal("head_judge", "stage_timer"), true);
  assert.equal(isRoleAllowedForPortal("judge", "stage_timer"), false);
  assert.equal(isRoleAllowedForPortal("team", "stage_timer"), false);

  // Draw portal: host and team allowed; judge and head_judge rejected
  assert.equal(isRoleAllowedForPortal("host", "draw"), true);
  assert.equal(isRoleAllowedForPortal("team", "draw"), true);
  assert.equal(isRoleAllowedForPortal("judge", "draw"), false);
  assert.equal(isRoleAllowedForPortal("head_judge", "draw"), false);

  // Unknown role or unknown portal rejected
  assert.equal(isRoleAllowedForPortal("unknown", "host"), false);
  assert.equal(isRoleAllowedForPortal("guest", "judge"), false);
  assert.equal(isRoleAllowedForPortal("", "team"), false);
  assert.equal(isRoleAllowedForPortal("host", "unknown"), false);

  // checkPortalAccess helper
  assert.equal(checkPortalAccess("host", "host").ok, true);
  assert.equal(checkPortalAccess("judge", "judge").ok, true);
  assert.equal(checkPortalAccess("head_judge", "judge").ok, true);
  assert.equal(checkPortalAccess("team", "team").ok, true);
  assert.equal(checkPortalAccess("host", "stage_timer").ok, true);
  assert.equal(checkPortalAccess("head_judge", "stage_timer").ok, true);
  assert.equal(checkPortalAccess("judge", "stage_timer").ok, false);
  assert.equal(checkPortalAccess("team", "stage_timer").ok, false);
  assert.equal(checkPortalAccess("host", "draw").ok, true);
  assert.equal(checkPortalAccess("team", "draw").ok, true);
  assert.equal(checkPortalAccess("judge", "draw").ok, false);
  assert.equal(checkPortalAccess("guest", "host").ok, false);
  assert.equal(checkPortalAccess("team", "host").ok, false);
});

test("Bulk-create CSV parsing/validation with Vietnamese error messages", () => {
  const context = {
    judges: [
      { id: "gk-01", name: "Ban Giám khảo 1" },
      { id: "gk-02", name: "Ban Giám khảo 2" }
    ],
    teams: [
      { id: "doi-01", name: "Đội 1" },
      { id: "doi-02", name: "Đội 2" }
    ],
    existingUsernames: ["mc"]
  };

  // 1. Missing password
  const csvMissingPass = `username,password,role,ref_id,display_name
gk1,,judge,gk-01,Ban Giám khảo 1`;
  const resMissingPass = parseBulkAccountsCsv(csvMissingPass, context);
  assert.equal(resMissingPass.ok, false);
  assert.ok(
    resMissingPass.errors.some((e) => e.includes("Thiếu mật khẩu")),
    `Expected Vietnamese missing password error, got: ${JSON.stringify(resMissingPass.errors)}`
  );

  // 2. Password < 6 chars
  const csvShortPass = `username,password,role,ref_id,display_name
gk1,12345,judge,gk-01,Ban Giám khảo 1`;
  const resShortPass = parseBulkAccountsCsv(csvShortPass, context);
  assert.equal(resShortPass.ok, false);
  assert.ok(
    resShortPass.errors.some((e) => e.includes("ít nhất 6 ký tự")),
    `Expected Vietnamese short password error, got: ${JSON.stringify(resShortPass.errors)}`
  );

  // 3. Unknown role
  const csvUnknownRole = `username,password,role,ref_id,display_name
user1,password123,moderator,,Người điều phối`;
  const resUnknownRole = parseBulkAccountsCsv(csvUnknownRole, context);
  assert.equal(resUnknownRole.ok, false);
  assert.ok(
    resUnknownRole.errors.some((e) => e.includes("không hợp lệ") && e.includes("moderator")),
    `Expected Vietnamese unknown role error, got: ${JSON.stringify(resUnknownRole.errors)}`
  );

  // 4. Judge without ref_id
  const csvJudgeNoRef = `username,password,role,ref_id,display_name
gk1,password123,judge,,Ban Giám khảo 1`;
  const resJudgeNoRef = parseBulkAccountsCsv(csvJudgeNoRef, context);
  assert.equal(resJudgeNoRef.ok, false);
  assert.ok(
    resJudgeNoRef.errors.some((e) => e.includes("ref_id") || e.includes("liên kết")),
    `Expected Vietnamese judge ref_id required error, got: ${JSON.stringify(resJudgeNoRef.errors)}`
  );

  // 5. Team without ref_id
  const csvTeamNoRef = `username,password,role,ref_id,display_name
doi01,password123,team,,Đội 1`;
  const resTeamNoRef = parseBulkAccountsCsv(csvTeamNoRef, context);
  assert.equal(resTeamNoRef.ok, false);
  assert.ok(
    resTeamNoRef.errors.some((e) => e.includes("ref_id") || e.includes("liên kết")),
    `Expected Vietnamese team ref_id required error, got: ${JSON.stringify(resTeamNoRef.errors)}`
  );

  // 6. Duplicate username within CSV
  const csvDuplicateWithin = `username,password,role,ref_id,display_name
gk1,password123,judge,gk-01,Ban Giám khảo 1
GK1,password456,judge,gk-02,Ban Giám khảo 2`;
  const resDuplicateWithin = parseBulkAccountsCsv(csvDuplicateWithin, context);
  assert.equal(resDuplicateWithin.ok, false);
  assert.ok(
    resDuplicateWithin.errors.some((e) => e.includes("trùng lặp")),
    `Expected Vietnamese duplicate username error, got: ${JSON.stringify(resDuplicateWithin.errors)}`
  );

  // 7. Duplicate with existing username
  const csvDuplicateExisting = `username,password,role,ref_id,display_name
mc,password123,host,,Dẫn chương trình`;
  const resDuplicateExisting = parseBulkAccountsCsv(csvDuplicateExisting, context);
  assert.equal(resDuplicateExisting.ok, false);
  assert.ok(
    resDuplicateExisting.errors.some((e) => e.includes("trùng lặp")),
    `Expected Vietnamese existing duplicate error, got: ${JSON.stringify(resDuplicateExisting.errors)}`
  );

  // 8. Valid bulk CSV parsing
  const validCsv = `username,password,role,ref_id,display_name
gk1,password123,judge,gk-01,Ban Giám khảo 1
gktong,password123,head_judge,,Giám khảo tổng
doi01,password123,team,doi-01,Đội 1`;
  const resValid = parseBulkAccountsCsv(validCsv, context);
  assert.equal(resValid.ok, true);
  assert.equal(resValid.validAccounts.length, 3);
  assert.equal(resValid.errors.length, 0);
  assert.deepEqual(resValid.validAccounts[0], {
    username: "gk1",
    password: "password123",
    role: "judge",
    ref_id: "gk-01",
    display_name: "Ban Giám khảo 1"
  });
  assert.deepEqual(resValid.validAccounts[1], {
    username: "gktong",
    password: "password123",
    role: "head_judge",
    ref_id: "",
    display_name: "Giám khảo tổng"
  });
});

test("content serialisation for save no longer includes accounts", () => {
  const content = {
    teams: [{ id: "doi-01", name: "Đội 1" }],
    round_order: { contest: ["doi-01"] },
    round1: [],
    round2: [],
    round3: [],
    judges: [{ id: "gk-01", name: "Giám khảo 1" }],
    accounts: [
      { username: "mc", password: "plaintext_secret_password", role: "host", ref_id: "", display_name: "MC" },
      { username: "gk1", password: "plaintext_secret_password", role: "judge", ref_id: "gk-01", display_name: "GK1" }
    ],
    config: { show_title: "Hội thi PCCC" }
  };

  const serialized = serializeContentForSave(content);

  // accounts property must NOT exist in the serialized object for save
  assert.equal("accounts" in serialized, false, "Serialized content must not contain 'accounts'");
  assert.equal(serialized.accounts, undefined);

  // Other properties must be preserved
  assert.deepEqual(serialized.teams, content.teams);
  assert.deepEqual(serialized.round_order, content.round_order);
  assert.deepEqual(serialized.judges, content.judges);
  assert.deepEqual(serialized.config, content.config);
});

