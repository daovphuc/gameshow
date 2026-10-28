import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import {
  DEFAULT_PASSWORD_SHA256,
  PORTALS,
  sha256Hex,
  resolvePortalPasswordHash,
  resolvePasswordHash,
  verifyPortalPassword,
  verifyPassword
} from "../js/auth.js";

test("sha256Hex and verifyPassword match default password 122345678910 and reject wrong passwords", async () => {
  const computedDefault = await sha256Hex("122345678910", webcrypto.subtle);
  assert.equal(computedDefault, DEFAULT_PASSWORD_SHA256);

  const ok = await verifyPassword("122345678910", {}, DEFAULT_PASSWORD_SHA256, webcrypto.subtle);
  assert.equal(ok, true);

  const wrong = await verifyPassword("wrong-password", {}, DEFAULT_PASSWORD_SHA256, webcrypto.subtle);
  assert.equal(wrong, false);

  const empty = await verifyPassword("", {}, DEFAULT_PASSWORD_SHA256, webcrypto.subtle);
  assert.equal(empty, false);
});

test("Per-portal password check: default 122345678910 unlocks each portal; a config override for one portal does not change the others", async () => {
  // All three portals unlock with default password
  for (const portal of [PORTALS.HOST, PORTALS.JUDGE, PORTALS.TEAM]) {
    const ok = await verifyPortalPassword("122345678910", portal, {}, DEFAULT_PASSWORD_SHA256, webcrypto.subtle);
    assert.equal(ok, true, `Default password should unlock ${portal} portal`);
  }

  // Override only judge portal
  const customJudgeHash = await sha256Hex("giamkhao2026", webcrypto.subtle);
  const configWithJudgeOverride = {
    password_judge_sha256: customJudgeHash
  };

  // Judge portal requires new password
  const judgeWithNew = await verifyPortalPassword("giamkhao2026", PORTALS.JUDGE, configWithJudgeOverride, DEFAULT_PASSWORD_SHA256, webcrypto.subtle);
  assert.equal(judgeWithNew, true);

  const judgeWithDefault = await verifyPortalPassword("122345678910", PORTALS.JUDGE, configWithJudgeOverride, DEFAULT_PASSWORD_SHA256, webcrypto.subtle);
  assert.equal(judgeWithDefault, false);

  // Host and Team portals are unchanged and still unlock with default password
  const hostWithDefault = await verifyPortalPassword("122345678910", PORTALS.HOST, configWithJudgeOverride, DEFAULT_PASSWORD_SHA256, webcrypto.subtle);
  assert.equal(hostWithDefault, true);

  const teamWithDefault = await verifyPortalPassword("122345678910", PORTALS.TEAM, configWithJudgeOverride, DEFAULT_PASSWORD_SHA256, webcrypto.subtle);
  assert.equal(teamWithDefault, true);

  // Override host and team with different passwords
  const customHostHash = await sha256Hex("mc-host-pass", webcrypto.subtle);
  const customTeamHash = await sha256Hex("doithi-pass", webcrypto.subtle);
  const multiConfig = {
    password_host_sha256: customHostHash,
    password_judge_sha256: customJudgeHash,
    password_team_sha256: customTeamHash
  };

  assert.equal(await verifyPortalPassword("mc-host-pass", PORTALS.HOST, multiConfig, DEFAULT_PASSWORD_SHA256, webcrypto.subtle), true);
  assert.equal(await verifyPortalPassword("giamkhao2026", PORTALS.JUDGE, multiConfig, DEFAULT_PASSWORD_SHA256, webcrypto.subtle), true);
  assert.equal(await verifyPortalPassword("doithi-pass", PORTALS.TEAM, multiConfig, DEFAULT_PASSWORD_SHA256, webcrypto.subtle), true);

  // Cross-portal rejection
  assert.equal(await verifyPortalPassword("mc-host-pass", PORTALS.JUDGE, multiConfig, DEFAULT_PASSWORD_SHA256, webcrypto.subtle), false);
  assert.equal(await verifyPortalPassword("doithi-pass", PORTALS.HOST, multiConfig, DEFAULT_PASSWORD_SHA256, webcrypto.subtle), false);
});
