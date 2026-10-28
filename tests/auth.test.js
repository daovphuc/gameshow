import test from "node:test";
import assert from "node:assert/strict";
import {
  PORTALS,
  PORTAL_URLS,
  DEFAULT_PASSWORD,
  getPortalUrl,
  normaliseAccounts,
  generateDefaultAccounts,
  resolveAccounts,
  authenticate,
  validateSession,
  getActiveSession,
  saveActiveSession,
  clearActiveSession
} from "../js/auth.js";

const sampleJudges = [
  { id: "gk-01", name: "Ban Giám khảo 1" },
  { id: "gk-02", name: "Ban Giám khảo 2" },
  { id: "gk-03", name: "Ban Giám khảo 3" }
];

const sampleTeams = [
  { id: "doi-01", name: "Đội Sao Vàng" },
  { id: "doi-02", name: "Đội Hồng Hà" },
  { id: "doi-03", name: "Đội Cửu Long" }
];

test("Role to portal URL mapping", () => {
  assert.equal(getPortalUrl("host"), "./host.html");
  assert.equal(getPortalUrl("HOST"), "./host.html");
  assert.equal(getPortalUrl(PORTALS.HOST), "./host.html");
  assert.equal(getPortalUrl("judge"), "./judge.html");
  assert.equal(getPortalUrl("JUDGE"), "./judge.html");
  assert.equal(getPortalUrl(PORTALS.JUDGE), "./judge.html");
  assert.equal(getPortalUrl("team"), "./team.html");
  assert.equal(getPortalUrl("TEAM"), "./team.html");
  assert.equal(getPortalUrl(PORTALS.TEAM), "./team.html");
  assert.equal(getPortalUrl("unknown"), "./index.html");
});

test("Default accounts generated from judges and teams when accounts tab is missing or empty", () => {
  const defaults = generateDefaultAccounts({ judges: sampleJudges, teams: sampleTeams });
  // 1 host + 3 judges + 3 teams = 7 accounts
  assert.equal(defaults.length, 7);

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

  // Team defaults: doi01, doi02, doi03 with ref_id and display_name
  assert.deepEqual(defaults[4], {
    username: "doi01",
    password: DEFAULT_PASSWORD,
    role: "team",
    ref_id: "doi-01",
    display_name: "Đội Sao Vàng"
  });
  assert.deepEqual(defaults[5], {
    username: "doi02",
    password: DEFAULT_PASSWORD,
    role: "team",
    ref_id: "doi-02",
    display_name: "Đội Hồng Hà"
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
  assert.equal(normalised.length, 3);

  // 1. Host
  assert.deepEqual(normalised[0], {
    username: "admin",
    password: "secret123",
    role: "host",
    ref_id: "",
    display_name: "Quản trị"
  });

  // 2. Judge
  assert.deepEqual(normalised[1], {
    username: "gk_truong",
    password: "pass1",
    role: "judge",
    ref_id: "gk-01",
    display_name: "Trưởng ban GK"
  });

  // 3. Team (display_name defaulted to team name)
  assert.deepEqual(normalised[2], {
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
    { username: "gk1", password: "judgepass", role: "judge", ref_id: "gk-01", display_name: "GK 1" },
    { username: "doi01", password: "teampass", role: "team", ref_id: "doi-01", display_name: "Đội 1" }
  ];

  // Correct login: exact match
  const res1 = authenticate("mc", "password123", accounts);
  assert.equal(res1.ok, true);
  assert.equal(res1.account.username, "mc");
  assert.equal(res1.portalUrl, "./host.html");

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
