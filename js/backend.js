// Thin backend adapter: Firebase Realtime Database with automatic fallback
// to in-browser Local Mode (BroadcastChannel + localStorage) when databaseURL is empty.
// Implements identical interface for both backends with plain-language connection status.
// Includes Firebase Authentication with role management and per-portal sessions.

import { firebaseConfig } from "./firebase-config.js";
import { createInitialState } from "./state.js";
import { usernameToEmail, getPortalUrl } from "./auth.js";

const LOCAL_STORAGE_KEY = "gameshow_live_db_tree";
const BROADCAST_CHANNEL_NAME = "gameshow_live_sync_channel";

let isInitialized = false;
let isFirebase = false;
let activePortal = "host";
let firebaseApp = null;
let firebaseDb = null;
let fbServerTimestampFn = null;
let serverTimeOffset = 0;

const portalApps = new Map(); // appName -> { app, db, auth }

let currentStatus = {
  code: "local",
  label: "Chế độ thử trên 1 máy"
};
const statusListeners = new Set();
const localListeners = new Map(); // path -> Set of callback functions
let broadcastChannel = null;

function notifyStatus(next) {
  currentStatus = { ...currentStatus, ...next };
  for (const fn of statusListeners) {
    try {
      fn(currentStatus);
    } catch {
      // Ignore listener error
    }
  }
}

function getLocalTree() {
  if (typeof window === "undefined") {
    return { live: createInitialState([]), content: null };
  }
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Ignore storage parse error
  }
  const initial = { live: createInitialState([]), content: null };
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initial));
  } catch {
    // Ignore storage quota error
  }
  return initial;
}

function saveLocalTree(tree) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tree));
  } catch {
    // Ignore storage errors
  }
}

function getPathValue(tree, path = "") {
  if (!path || path === "/") return tree;
  const parts = path.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  let cur = tree;
  for (const p of parts) {
    if (cur === undefined || cur === null || typeof cur !== "object") {
      return null;
    }
    cur = cur[p];
  }
  return cur !== undefined ? cur : null;
}

function setPathValue(tree, path = "", value) {
  if (!path || path === "/") {
    return value && typeof value === "object" ? { ...value } : {};
  }
  const parts = path.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  const root = { ...tree };
  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!cur[p] || typeof cur[p] !== "object") {
      cur[p] = {};
    } else {
      cur[p] = { ...cur[p] };
    }
    cur = cur[p];
  }
  const last = parts[parts.length - 1];
  if (value === null || value === undefined) {
    delete cur[last];
  } else if (typeof value === "object" && !Array.isArray(value)) {
    cur[last] = JSON.parse(JSON.stringify(value));
  } else {
    cur[last] = value;
  }
  return root;
}

function updatePathValue(tree, path = "", data = {}) {
  // Like Firebase update(): each key is a path relative to `path`, so
  // "scores/doi-01/round2" sets a nested value instead of a literal key.
  const base = path.replace(/^\/+|\/+$/g, "");
  let next = tree;
  for (const [k, v] of Object.entries(data || {})) {
    const rel = String(k).replace(/^\/+|\/+$/g, "");
    next = setPathValue(next, base ? `${base}/${rel}` : rel, v);
  }
  return next;
}

function notifyLocalPath(path, tree) {
  const isRoot = !path || path === "/";
  for (const [subPath, callbacks] of localListeners.entries()) {
    if (
      isRoot ||
      subPath === "" ||
      subPath === "/" ||
      subPath === path ||
      path.startsWith(subPath + "/") ||
      subPath.startsWith(path + "/")
    ) {
      const val = getPathValue(tree, subPath);
      for (const cb of callbacks) {
        try {
          cb(val);
        } catch {
          // Ignore subscriber error
        }
      }
    }
  }
}

/**
 * Maps portal name to Firebase App name.
 * @param {string} [portal]
 * @returns {string}
 */
export function getPortalAppName(portal = "host") {
  const p = String(portal || "host").toLowerCase().trim();
  if (p === "judge" || p === "head_judge") return "portal_judge";
  if (p === "team") return "portal_team";
  if (p === "host") return "portal_host";
  return `portal_${p}`;
}

export function detectCurrentPortal() {
  if (typeof window === "undefined") return "host";
  const p = window.location.pathname.toLowerCase();
  if (p.endsWith("judge.html")) return "judge";
  if (p.endsWith("team.html")) return "team";
  if (p.endsWith("index.html") || p === "" || p.endsWith("/")) return "portal_default";
  return "host";
}

/**
 * Gets or initializes a named Firebase App instance for a portal.
 * @param {string} portal
 * @returns {Promise<{ app: any, db: any, auth: any }>}
 */
export async function getOrCreatePortalInstance(portal = "host") {
  const appName = getPortalAppName(portal);
  if (portalApps.has(appName)) {
    return portalApps.get(appName);
  }

  const { initializeApp, getApps } = await import(
    "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"
  );
  const { getDatabase } = await import(
    "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js"
  );
  const { getAuth } = await import(
    "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"
  );

  const existing = getApps().find((a) => a.name === appName);
  const app = existing || initializeApp(firebaseConfig, appName);
  const db = getDatabase(app);
  const auth = getAuth(app);
  const instance = { app, db, auth };
  portalApps.set(appName, instance);
  return instance;
}

/**
 * Initializes the backend connection. Safe to call multiple times.
 * @param {{ portal?: string }} [options]
 */
export async function initBackend(options = {}) {
  const portal = options?.portal || detectCurrentPortal();
  activePortal = portal;

  const hasFirebaseConfig = Boolean(
    firebaseConfig &&
    firebaseConfig.databaseURL &&
    String(firebaseConfig.databaseURL).trim() !== ""
  );

  if (typeof window !== "undefined" && hasFirebaseConfig) {
    try {
      const {
        ref,
        onValue,
        serverTimestamp: fbServerTimestamp
      } = await import(
        "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js"
      );

      const portalInst = await getOrCreatePortalInstance(portal);
      // Restore the persisted sign-in before any read: the rules deny
      // unauthenticated reads and Firebase cancels a denied listener for good.
      await portalInst.auth.authStateReady();
      firebaseApp = portalInst.app;
      firebaseDb = portalInst.db;
      fbServerTimestampFn = fbServerTimestamp;
      isFirebase = true;

      // Monitor connection state
      const connectedRef = ref(firebaseDb, ".info/connected");
      onValue(connectedRef, (snap) => {
        if (snap.val() === true) {
          notifyStatus({ code: "connected", label: "Đã kết nối" });
        } else {
          notifyStatus({ code: "disconnected", label: "Mất kết nối" });
        }
      });

      // Monitor server time offset
      const offsetRef = ref(firebaseDb, ".info/serverTimeOffset");
      onValue(offsetRef, (snap) => {
        serverTimeOffset = Number(snap.val()) || 0;
      });

      isInitialized = true;
      return { isFirebase: true, status: currentStatus };
    } catch {
      // Fallback to local mode on Firebase initialization error
      isFirebase = false;
    }
  }

  // Local Mode
  isFirebase = false;
  notifyStatus({ code: "local", label: "Chế độ thử trên 1 máy" });

  if (typeof window !== "undefined" && !isInitialized) {
    try {
      if ("BroadcastChannel" in window) {
        broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        broadcastChannel.onmessage = (event) => {
          if (event.data?.type === "SYNC") {
            const tree = getLocalTree();
            notifyLocalPath(event.data.path || "", tree);
          }
        };
      }
    } catch {
      // BroadcastChannel unsupported or blocked
    }

    const resumeSync = () => {
      const tree = getLocalTree();
      notifyLocalPath("", tree);
    };

    window.addEventListener("storage", (e) => {
      if (e.key === LOCAL_STORAGE_KEY) {
        resumeSync();
      }
    });

    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        resumeSync();
      }
    });
    window.addEventListener("focus", resumeSync);
    window.addEventListener("pageshow", resumeSync);
  }

  isInitialized = true;
  return { isFirebase: false, status: currentStatus };
}

/**
 * Returns whether Firebase mode is currently active.
 * @returns {boolean}
 */
export function isFirebaseBackend() {
  return isFirebase;
}

/**
 * Signs in using Firebase Authentication and resolves the user's role record.
 * Handles:
 * - username -> email mapping (<username>@hoithi.local)
 * - Firebase Auth sign in
 * - Reading roles/<uid>
 * - Bootstrap host self-write if roles is empty and username is mc
 * - Sign out if account has no role record
 * - Persistent sign-in to the appropriate portal's Firebase app
 *
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{ ok: boolean, session?: any, error?: string, portalUrl?: string, isLocal?: boolean }>}
 */
export async function signInAndResolveRole(username, password) {
  if (!isFirebase) {
    return { ok: false, isLocal: true };
  }

  let email;
  try {
    email = usernameToEmail(username);
  } catch (err) {
    return { ok: false, error: err.message };
  }

  const { initializeApp, deleteApp } = await import(
    "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"
  );
  const { getAuth, signInWithEmailAndPassword, signOut } = await import(
    "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"
  );
  const { getDatabase, ref, get: fbGet, set: fbSet } = await import(
    "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js"
  );

  const probeAppName = `probe_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const probeApp = initializeApp(firebaseConfig, probeAppName);
  const probeAuth = getAuth(probeApp);
  const probeDb = getDatabase(probeApp);

  let userCred;
  try {
    userCred = await signInWithEmailAndPassword(probeAuth, email, password);
  } catch (err) {
    try { await deleteApp(probeApp); } catch {}
    if (
      err.code === "auth/invalid-credential" ||
      err.code === "auth/wrong-password" ||
      err.code === "auth/user-not-found"
    ) {
      return { ok: false, error: "Tên đăng nhập hoặc mật khẩu không chính xác." };
    }
    if (err.code === "auth/too-many-requests") {
      return { ok: false, error: "Đã thử đăng nhập sai quá nhiều lần. Vui lòng thử lại sau ít phút." };
    }
    return { ok: false, error: `Lỗi đăng nhập: ${err.message}` };
  }

  const uid = userCred.user.uid;
  let roleRecord = null;

  try {
    const roleRef = ref(probeDb, `roles/${uid}`);
    const snap = await fbGet(roleRef);
    roleRecord = snap.val();

    // Host bootstrap check: when roles does not exist at all and user is mc
    if (!roleRecord) {
      const cleanUser = username.trim().toLowerCase();
      if (cleanUser === "mc") {
        const bootstrap = {
          username: "mc",
          role: "host",
          ref_id: "",
          display_name: "Dẫn chương trình"
        };
        try {
          await fbSet(roleRef, bootstrap);
          roleRecord = bootstrap;
        } catch {
          // Self-write rejected because roles already exists
          roleRecord = null;
        }
      }
    }
  } catch {
    roleRecord = null;
  }

  // Account has no role: sign out and reject
  if (!roleRecord || !roleRecord.role) {
    try {
      await signOut(probeAuth);
      await deleteApp(probeApp);
    } catch {}
    return {
      ok: false,
      error: "Tài khoản chưa được cấp quyền."
    };
  }

  // Sign into the designated portal's Firebase app
  const role = roleRecord.role;
  const targetPortal = (role === "judge" || role === "head_judge") ? "judge" : (role === "team" ? "team" : "host");
  const portalInst = await getOrCreatePortalInstance(targetPortal);
  try {
    await signInWithEmailAndPassword(portalInst.auth, email, password);
  } catch {
    // Ignore secondary sign in error if already signed in
  }

  // Clean up probe app
  try {
    await signOut(probeAuth);
    await deleteApp(probeApp);
  } catch {}

  const session = {
    uid,
    username: roleRecord.username || username.trim().toLowerCase(),
    role: roleRecord.role,
    ref_id: roleRecord.ref_id || "",
    display_name: roleRecord.display_name || ""
  };

  return {
    ok: true,
    session,
    portalUrl: getPortalUrl(roleRecord.role),
    role: roleRecord.role
  };
}

/**
 * Signs out of Firebase Auth for the given portal.
 * @param {string} portal
 */
export async function signOutPortal(portal = "host") {
  if (isFirebase) {
    try {
      const portalInst = await getOrCreatePortalInstance(portal);
      const { signOut } = await import(
        "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"
      );
      await signOut(portalInst.auth);
    } catch {
      // Ignore
    }
  }
}

/**
 * Waits for Firebase Auth state to be ready on the specified portal.
 * @param {string} portal
 * @returns {Promise<any|null>}
 */
export async function waitForAuth(portal = "host") {
  if (!isFirebase) return null;
  const portalInst = await getOrCreatePortalInstance(portal);
  const { onAuthStateChanged } = await import(
    "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"
  );
  if (portalInst.auth.currentUser) {
    return portalInst.auth.currentUser;
  }
  return new Promise((resolve) => {
    let resolved = false;
    const unsub = onAuthStateChanged(portalInst.auth, (user) => {
      unsub();
      if (!resolved) {
        resolved = true;
        resolve(user);
      }
    });
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(portalInst.auth.currentUser || null);
      }
    }, 3000);
  });
}

/**
 * Returns the current signed-in Firebase user for the specified portal.
 * @param {string} portal
 * @returns {any|null}
 */
export function getCurrentUser(portal = "host") {
  const appName = getPortalAppName(portal);
  const inst = portalApps.get(appName);
  return inst?.auth?.currentUser || null;
}

/**
 * Changes password for the currently signed-in user on a portal.
 * Verifies current password first, then updates to new password.
 *
 * @param {string} currentPassword
 * @param {string} newPassword
 * @param {string} [portal]
 * @returns {Promise<void>}
 */
export async function changePassword(currentPassword, newPassword, portal = "host") {
  if (!isFirebase) {
    throw new Error("Chức năng đổi mật khẩu chỉ khả dụng khi kết nối Firebase Authentication.");
  }
  const portalInst = await getOrCreatePortalInstance(portal);
  const user = portalInst.auth.currentUser;
  if (!user || !user.email) {
    throw new Error("Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.");
  }
  if (!newPassword || newPassword.length < 6) {
    throw new Error("Mật khẩu mới phải có ít nhất 6 ký tự.");
  }

  const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } = await import(
    "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"
  );

  try {
    const cred = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, cred);
  } catch (err) {
    if (
      err.code === "auth/wrong-password" ||
      err.code === "auth/invalid-credential"
    ) {
      throw new Error("Mật khẩu hiện tại không chính xác.");
    }
    throw new Error(`Xác thực thất bại: ${err.message}`);
  }

  try {
    await updatePassword(user, newPassword);
  } catch (err) {
    if (err.code === "auth/weak-password") {
      throw new Error("Mật khẩu mới quá yếu (phải có ít nhất 6 ký tự).");
    }
    throw new Error(`Cập nhật mật khẩu thất bại: ${err.message}`);
  }
}

/**
 * Creates an account in Firebase Authentication using a secondary temporary app,
 * so the host stays signed in.
 *
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{ uid: string, email: string, username: string }>}
 */
export async function createUserWithSecondaryApp(username, password) {
  if (!isFirebase) {
    throw new Error("Tạo tài khoản Firebase chỉ khả dụng khi kết nối Firebase.");
  }
  const raw = String(username || "").trim().toLowerCase();
  const email = raw.endsWith("@hoithi.local") ? raw : usernameToEmail(raw);
  if (!password || password.length < 6) {
    throw new Error("Mật khẩu phải có ít nhất 6 ký tự.");
  }

  const { initializeApp, deleteApp } = await import(
    "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"
  );
  const { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } = await import(
    "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"
  );

  const secAppName = `sec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const secApp = initializeApp(firebaseConfig, secAppName);
  try {
    const secAuth = getAuth(secApp);
    const cred = await createUserWithEmailAndPassword(secAuth, email, password);
    const uid = cred.user.uid;
    try {
      await signOut(secAuth);
    } catch {}
    return { uid, email, username: email.replace("@hoithi.local", "") };
  } catch (err) {
    if (err.code === "auth/email-already-in-use") {
      // The Auth user exists (created in the console or by an earlier run):
      // with the right password we can still recover its uid and grant a role.
      try {
        const cred = await signInWithEmailAndPassword(getAuth(secApp), email, password);
        const uid = cred.user.uid;
        try {
          await signOut(getAuth(secApp));
        } catch {}
        return { uid, email, username: email.replace("@hoithi.local", ""), existed: true };
      } catch {
        // Wrong password for the existing user: report it as already existing.
      }
      const customErr = new Error(`Tài khoản "${username}" đã tồn tại trên Firebase Authentication.`);
      customErr.code = "auth/email-already-in-use";
      throw customErr;
    }
    if (err.code === "auth/weak-password") {
      throw new Error("Mật khẩu quá yếu (phải có ít nhất 6 ký tự).");
    }
    throw new Error(`Lỗi tạo tài khoản: ${err.message}`);
  } finally {
    try {
      await deleteApp(secApp);
    } catch {}
  }
}

/**
 * Subscribes to auth state changes on a portal.
 * @param {string} portal
 * @param {(user: any) => void} callback
 * @returns {() => void}
 */
export function onPortalAuthStateChanged(portal = "host", callback) {
  if (!isFirebase) return () => {};
  let unsub = () => {};
  getOrCreatePortalInstance(portal).then(({ auth }) => {
    import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js").then(
      ({ onAuthStateChanged }) => {
        unsub = onAuthStateChanged(auth, callback);
      }
    );
  });
  return () => unsub();
}

/**
 * Subscribes to live data updates at `path`.
 * @param {string} path
 * @param {(value: any) => void} callback
 * @returns {() => void} unsubscribe function
 */
export function listen(path = "", callback) {
  if (typeof callback !== "function") return () => {};

  if (isFirebase && firebaseDb) {
    let unsubscribe = () => {};
    import("https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js").then(
      ({ ref, onValue, off }) => {
        const r = ref(firebaseDb, path || "/");
        const listener = onValue(r, (snap) => {
          callback(snap.val());
        });
        unsubscribe = () => off(r, "value", listener);
      }
    );
    return () => unsubscribe();
  }

  // Local Mode
  const cleanPath = path.replace(/^\/+|\/+$/g, "");
  if (!localListeners.has(cleanPath)) {
    localListeners.set(cleanPath, new Set());
  }
  localListeners.get(cleanPath).add(callback);

  // Deliver current local value immediately
  const tree = getLocalTree();
  callback(getPathValue(tree, cleanPath));

  return () => {
    const set = localListeners.get(cleanPath);
    if (set) {
      set.delete(callback);
      if (set.size === 0) localListeners.delete(cleanPath);
    }
  };
}

/**
 * Reads data at `path` once.
 * @param {string} path
 * @returns {Promise<any>}
 */
export async function get(path = "") {
  if (isFirebase && firebaseDb) {
    const { ref, get: fbGet } = await import(
      "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js"
    );
    const snap = await fbGet(ref(firebaseDb, path || "/"));
    return snap.val();
  }
  const tree = getLocalTree();
  return getPathValue(tree, path.replace(/^\/+|\/+$/g, ""));
}

/**
 * Writes data at `path` replacing its value.
 * @param {string} path
 * @param {any} value
 * @returns {Promise<void>}
 */
export async function set(path = "", value) {
  value = dropUndefined(value);
  if (isFirebase && firebaseDb) {
    const { ref, set: fbSet } = await import(
      "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js"
    );
    return fbSet(ref(firebaseDb, path || "/"), value);
  }

  // Local Mode
  const cleanPath = path.replace(/^\/+|\/+$/g, "");
  const tree = getLocalTree();
  const nextTree = setPathValue(tree, cleanPath, value);
  saveLocalTree(nextTree);
  notifyLocalPath(cleanPath, nextTree);
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type: "SYNC", path: cleanPath });
    } catch {
      // Ignore broadcast errors
    }
  }
}

/**
 * Firebase rejects a whole write when any value inside it is `undefined`
 * (local mode silently accepted it), so drop such fields in both modes:
 * object keys are removed, array slots become null.
 * @param {any} value
 * @returns {any}
 */
export function dropUndefined(value) {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map((v) => (v === undefined ? null : dropUndefined(v)));
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) out[k] = dropUndefined(v);
    }
    return out;
  }
  return value;
}

/**
 * Updates properties at `path` without overwriting existing sibling fields.
 * @param {string} path
 * @param {Record<string, any>} data
 * @returns {Promise<void>}
 */
export async function update(path = "", data = {}) {
  data = dropUndefined(data) ?? {};
  if (isFirebase && firebaseDb) {
    const { ref, update: fbUpdate } = await import(
      "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js"
    );
    return fbUpdate(ref(firebaseDb, path || "/"), data);
  }

  // Local Mode
  const cleanPath = path.replace(/^\/+|\/+$/g, "");
  const tree = getLocalTree();
  const nextTree = updatePathValue(tree, cleanPath, data);
  saveLocalTree(nextTree);
  notifyLocalPath(cleanPath, nextTree);
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type: "SYNC", path: cleanPath });
    } catch {
      // Ignore broadcast errors
    }
  }
}

/**
 * Returns current authoritative server timestamp.
 * In Firebase: calibrated with serverTimeOffset.
 * In Local mode: Date.now().
 * @returns {number}
 */
export function getServerTime() {
  return Date.now() + (isFirebase ? serverTimeOffset : 0);
}

/**
 * Returns a server timestamp placeholder for writing to the database:
 * In Firebase: returns Firebase's serverTimestamp() sentinel value (which evaluates to `now`).
 * In Local mode: returns Date.now().
 * @returns {any}
 */
export function serverTimestamp() {
  if (isFirebase && fbServerTimestampFn) {
    try {
      return fbServerTimestampFn();
    } catch {
      return Date.now();
    }
  }
  return Date.now();
}

/**
 * Returns current connection status.
 * @returns {{code: "local"|"connected"|"disconnected", label: string}}
 */
export function getConnectionStatus() {
  return currentStatus;
}

/**
 * Subscribes to connection status changes.
 * @param {(status: {code: string, label: string}) => void} callback
 * @returns {() => void} unsubscribe function
 */
export function onStatusChange(callback) {
  statusListeners.add(callback);
  callback(currentStatus);
  return () => statusListeners.delete(callback);
}

/**
 * Clears the entire live contest state and answers for everyone (with confirm on UI).
 * @param {Array<{id: string}>} [teams]
 */
export async function resetLiveState(teams = []) {
  const fresh = createInitialState(teams);
  await set("live", fresh);
  await set("answers", null);
  return fresh;
}
