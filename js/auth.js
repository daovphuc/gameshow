// Password gate verification using Web Crypto SHA-256 (DOM-free).
// Plain-text default password is never stored in source code; only its SHA-256 hex digest is kept.

import { DEFAULT_PASSWORD_SHA256 } from "./config.js";

export { DEFAULT_PASSWORD_SHA256 };

export const PORTALS = {
  HOST: "host",
  JUDGE: "judge",
  TEAM: "team"
};

function getSubtleCrypto(customSubtle) {
  if (customSubtle) return customSubtle;
  if (globalThis.crypto && globalThis.crypto.subtle) {
    return globalThis.crypto.subtle;
  }
  throw new Error("Web Crypto API (crypto.subtle) is not available.");
}

/**
 * Computes the lowercase hex SHA-256 digest of a string using Web Crypto.
 * @param {string} text
 * @param {SubtleCrypto} [subtleCrypto]
 * @returns {Promise<string>}
 */
export async function sha256Hex(text, subtleCrypto) {
  const subtle = getSubtleCrypto(subtleCrypto);
  const bytes = new TextEncoder().encode(String(text ?? ""));
  const digestBuffer = await subtle.digest("SHA-256", bytes);
  const hashArray = Array.from(new Uint8Array(digestBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Resolves the active SHA-256 password hash for a specific portal:
 * Checks `config.password_<portal>_sha256`, falls back to `config.password_sha256`, falls back to `defaultHash`.
 * Normalises to lowercase trimmed hex.
 * @param {"host"|"judge"|"team"|string} portal
 * @param {Record<string, any>} [config]
 * @param {string} [defaultHash]
 * @returns {string}
 */
export function resolvePortalPasswordHash(portal = "host", config = {}, defaultHash = DEFAULT_PASSWORD_SHA256) {
  const portalKey = `password_${String(portal).toLowerCase()}_sha256`;
  const portalOverride =
    config && config[portalKey] !== undefined && config[portalKey] !== null
      ? String(config[portalKey]).trim().toLowerCase()
      : "";
  if (portalOverride) {
    return portalOverride;
  }

  const generalOverride =
    config && config.password_sha256 !== undefined && config.password_sha256 !== null
      ? String(config.password_sha256).trim().toLowerCase()
      : "";
  if (generalOverride) {
    return generalOverride;
  }

  return String(defaultHash || DEFAULT_PASSWORD_SHA256).trim().toLowerCase();
}

/**
 * Resolves the active SHA-256 password hash (defaults to host portal).
 * @param {Record<string, any>} [config]
 * @param {string} [defaultHash]
 * @returns {string}
 */
export function resolvePasswordHash(config = {}, defaultHash = DEFAULT_PASSWORD_SHA256) {
  return resolvePortalPasswordHash("host", config, defaultHash);
}

/**
 * Checks whether a candidate password matches the expected SHA-256 hash for a specific portal.
 * @param {string} candidatePassword
 * @param {"host"|"judge"|"team"|string} portal
 * @param {Record<string, any>} [config]
 * @param {string} [defaultHash]
 * @param {SubtleCrypto} [subtleCrypto]
 * @returns {Promise<boolean>}
 */
export async function verifyPortalPassword(
  candidatePassword,
  portal = "host",
  config = {},
  defaultHash = DEFAULT_PASSWORD_SHA256,
  subtleCrypto
) {
  if (typeof candidatePassword !== "string" || candidatePassword.length === 0) {
    return false;
  }
  const expected = resolvePortalPasswordHash(portal, config, defaultHash);
  const actual = await sha256Hex(candidatePassword, subtleCrypto);
  return actual.toLowerCase() === expected.toLowerCase();
}

/**
 * Checks whether a candidate password matches the expected SHA-256 hash (defaults to host portal).
 * @param {string} candidatePassword
 * @param {Record<string, any>} [config]
 * @param {string} [defaultHash]
 * @param {SubtleCrypto} [subtleCrypto]
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(
  candidatePassword,
  config = {},
  defaultHash = DEFAULT_PASSWORD_SHA256,
  subtleCrypto
) {
  return verifyPortalPassword(candidatePassword, "host", config, defaultHash, subtleCrypto);
}
