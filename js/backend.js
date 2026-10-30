// Thin backend adapter: Firebase Realtime Database with automatic fallback
// to in-browser Local Mode (BroadcastChannel + localStorage) when databaseURL is empty.
// Implements identical interface for both backends with plain-language connection status.

import { firebaseConfig } from "./firebase-config.js";
import { createInitialState } from "./state.js";

const LOCAL_STORAGE_KEY = "gameshow_live_db_tree";
const BROADCAST_CHANNEL_NAME = "gameshow_live_sync_channel";

let isInitialized = false;
let isFirebase = false;
let firebaseApp = null;
let firebaseDb = null;
let fbServerTimestampFn = null;
let serverTimeOffset = 0;

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
 * Initializes the backend connection. Safe to call multiple times.
 */
export async function initBackend() {
  if (isInitialized) {
    return { isFirebase, status: currentStatus };
  }

  isInitialized = true;
  const hasFirebaseConfig = Boolean(
    firebaseConfig &&
    firebaseConfig.databaseURL &&
    String(firebaseConfig.databaseURL).trim() !== ""
  );

  if (typeof window !== "undefined" && hasFirebaseConfig) {
    try {
      const { initializeApp } = await import(
        "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"
      );
      const {
        getDatabase,
        ref,
        onValue,
        serverTimestamp: fbServerTimestamp
      } = await import(
        "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js"
      );

      firebaseApp = initializeApp(firebaseConfig);
      firebaseDb = getDatabase(firebaseApp);
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

      return { isFirebase: true, status: currentStatus };
    } catch {
      // Fallback to local mode on Firebase initialization error
      isFirebase = false;
    }
  }

  // Local Mode
  isFirebase = false;
  notifyStatus({ code: "local", label: "Chế độ thử trên 1 máy" });

  if (typeof window !== "undefined") {
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

  return { isFirebase: false, status: currentStatus };
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
 * Updates properties at `path` without overwriting existing sibling fields.
 * @param {string} path
 * @param {Record<string, any>} data
 * @returns {Promise<void>}
 */
export async function update(path = "", data = {}) {
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
