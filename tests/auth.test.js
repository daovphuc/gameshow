import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import {
  DEFAULT_PASSWORD_SHA256,
  sha256Hex,
  resolvePasswordHash,
  verifyPassword
} from "../js/auth.js";

test("sha256Hex and verifyPassword match default password and reject wrong passwords", async () => {
  const computedDefault = await sha256Hex("12345678910", webcrypto.subtle);
  assert.equal(computedDefault, DEFAULT_PASSWORD_SHA256);

  const ok = await verifyPassword("12345678910", {}, DEFAULT_PASSWORD_SHA256, webcrypto.subtle);
  assert.equal(ok, true);

  const wrong = await verifyPassword("wrong-password", {}, DEFAULT_PASSWORD_SHA256, webcrypto.subtle);
  assert.equal(wrong, false);

  const empty = await verifyPassword("", {}, DEFAULT_PASSWORD_SHA256, webcrypto.subtle);
  assert.equal(empty, false);
});

test("password_sha256 from config overrides the default hash (case-insensitive hex)", async () => {
  const customHashUpper = (await sha256Hex("mat-khau-moi-2026", webcrypto.subtle)).toUpperCase();
  const config = {
    password_sha256: `  ${customHashUpper}  `
  };

  assert.equal(resolvePasswordHash(config), customHashUpper.toLowerCase());

  // Default password no longer matches when overridden in config
  const defaultAttempt = await verifyPassword("12345678910", config, DEFAULT_PASSWORD_SHA256, webcrypto.subtle);
  assert.equal(defaultAttempt, false);

  // New password matches case-insensitively
  const customAttempt = await verifyPassword("mat-khau-moi-2026", config, DEFAULT_PASSWORD_SHA256, webcrypto.subtle);
  assert.equal(customAttempt, true);
});
