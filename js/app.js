// Shared browser runtime wiring: data fetching, score sync, state persistence,
// theme application from config, and collapsible left sidebar.

import {
  DEFAULT_SHEET_ID,
  DEFAULT_WEB_APP_URL,
  SHEET_TABS,
  extractSheetId,
  buildTabUrl
} from "./config.js";
import { resolvePasswordHash, verifyPassword } from "./auth.js";
import { normaliseAllData, resolveImageUrl } from "./data.js";
import { normaliseScores, buildScoresPayload, mergeScores } from "./scores.js";
import { createInitialState, syncStateWithTeams, exportState, importState } from "./state.js";
import { getTeamInitials } from "./leaderboard.js";
import { LIGHT_THEME, mergeTheme, themeToCssVars } from "./theme.js";

export const STORAGE_KEYS = {
  SHEET_ID: "gameshow_sheet_id",
  WEB_APP_URL: "gameshow_web_app_url",
  SIDEBAR_COLLAPSED: "gameshow_sidebar_collapsed",
  STATE: "gameshow_state",
  DATA_CACHE: "gameshow_data_cache",
  AUTH_HASH: "gameshow_auth_hash"
};

export function isPasswordUnlocked(config = {}) {
  try {
    const storedHash = localStorage.getItem(STORAGE_KEYS.AUTH_HASH);
    return Boolean(storedHash) && storedHash === resolvePasswordHash(config);
  } catch {
    return false;
  }
}

export function ensurePasswordUnlocked(config = {}) {
  const targetHash = resolvePasswordHash(config);

  if (isPasswordUnlocked(config)) {
    document.body.classList.add("auth-unlocked");
    document.getElementById("auth-gate-overlay")?.remove();
    return Promise.resolve(true);
  }

  document.body.classList.remove("auth-unlocked");

  return new Promise((resolve) => {
    let overlay = document.getElementById("auth-gate-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "auth-gate-overlay";
      overlay.className = "auth-gate-overlay";
      document.body.appendChild(overlay);
    }

    const showTitle = escapeHtml(config.show_title || "Đấu Trường Tri Thức");

    overlay.innerHTML = `
      <div class="auth-gate-card" role="dialog" aria-modal="true" aria-labelledby="auth-gate-title">
        <div class="auth-gate-icon" aria-hidden="true">🔒</div>
        <h1 id="auth-gate-title" class="auth-gate-title">${showTitle}</h1>
        <p class="auth-gate-subtitle">
          Vui lòng nhập mật khẩu để mở khóa hệ thống trình chiếu.
        </p>
        <form id="auth-gate-form" class="auth-gate-form" novalidate>
          <input
            type="password"
            id="auth-gate-input"
            class="auth-gate-input"
            placeholder="Nhập mật khẩu..."
            autocomplete="current-password"
            aria-label="Mật khẩu truy cập"
            required
          />
          <div id="auth-gate-error" class="auth-gate-error" role="alert" aria-live="polite"></div>
          <button type="submit" id="auth-gate-submit" class="btn btn-primary" style="width: 100%; justify-content: center;">
            Mở khóa
          </button>
        </form>
      </div>
    `;

    const form = document.getElementById("auth-gate-form");
    const input = document.getElementById("auth-gate-input");
    const errorEl = document.getElementById("auth-gate-error");
    const submitBtn = document.getElementById("auth-gate-submit");

    setTimeout(() => {
      input?.focus();
    }, 20);

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!input) return;
      const candidate = input.value;
      if (submitBtn) submitBtn.disabled = true;
      try {
        const ok = await verifyPassword(candidate, config);
        if (ok) {
          try {
            localStorage.setItem(STORAGE_KEYS.AUTH_HASH, targetHash);
          } catch {
            // Ignore storage errors
          }
          document.body.classList.add("auth-unlocked");
          overlay.remove();
          resolve(true);
        } else {
          if (errorEl) {
            errorEl.textContent = "Mật khẩu không chính xác. Vui lòng thử lại.";
          }
          input.select();
          input.focus();
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  });
}

export function lockAppSession(config = {}) {
  try {
    localStorage.removeItem(STORAGE_KEYS.AUTH_HASH);
  } catch {
    // Ignore storage errors
  }
  document.body.classList.remove("auth-unlocked");
  return ensurePasswordUnlocked(config);
}

let currentSyncStatus = {
  state: "idle", // "idle" | "saving" | "saved" | "failed"
  message: "",
  retryFn: null
};
const syncListeners = new Set();

export function onSyncStatusChange(listener) {
  syncListeners.add(listener);
  listener(currentSyncStatus);
  return () => syncListeners.delete(listener);
}

function notifySyncStatus(next) {
  currentSyncStatus = { ...currentSyncStatus, ...next };
  for (const fn of syncListeners) {
    try {
      fn(currentSyncStatus);
    } catch {
      // Ignore listener error
    }
  }
  updateSidebarSyncBadge();
}

export function getSyncStatus() {
  return currentSyncStatus;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function getSheetId() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has("sheet")) {
      const fromUrl = extractSheetId(params.get("sheet") || "");
      localStorage.setItem(STORAGE_KEYS.SHEET_ID, fromUrl);
      sessionStorage.removeItem(STORAGE_KEYS.DATA_CACHE);
      return fromUrl;
    }
    const stored = localStorage.getItem(STORAGE_KEYS.SHEET_ID);
    if (stored !== null) {
      return extractSheetId(stored);
    }
  } catch {
    // Ignore storage errors
  }
  return DEFAULT_SHEET_ID;
}

export function setSheetId(rawInput) {
  const clean = extractSheetId(rawInput || "");
  try {
    localStorage.setItem(STORAGE_KEYS.SHEET_ID, clean);
    sessionStorage.removeItem(STORAGE_KEYS.DATA_CACHE);
  } catch {
    // Ignore storage errors
  }
  return clean;
}

export function getWebAppUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has("webapp")) {
      const fromUrl = (params.get("webapp") || "").trim();
      localStorage.setItem(STORAGE_KEYS.WEB_APP_URL, fromUrl);
      return fromUrl;
    }
    const stored = localStorage.getItem(STORAGE_KEYS.WEB_APP_URL);
    if (stored !== null) {
      return stored.trim();
    }
  } catch {
    // Ignore storage errors
  }
  return DEFAULT_WEB_APP_URL;
}

export function setWebAppUrl(rawInput) {
  const clean = String(rawInput || "").trim();
  try {
    localStorage.setItem(STORAGE_KEYS.WEB_APP_URL, clean);
  } catch {
    // Ignore storage errors
  }
  return clean;
}

export function isSidebarCollapsed() {
  try {
    return localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED) === "1";
  } catch {
    return false;
  }
}

export function setSidebarCollapsed(collapsed) {
  try {
    localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, collapsed ? "1" : "0");
  } catch {
    // Ignore storage errors
  }
  document.body.classList.toggle("sidebar-collapsed", Boolean(collapsed));
}

export function applyResolvedTheme(sheetConfig = {}) {
  const resolved = mergeTheme({
    defaults: LIGHT_THEME,
    sheet: sheetConfig,
    local: {}
  });
  const vars = themeToCssVars(resolved);
  const root = document.documentElement;
  root.dataset.theme = resolved.mode;
  for (const [prop, val] of Object.entries(vars)) {
    root.style.setProperty(prop, val);
  }
  return resolved;
}

export async function fetchQuizData({ forceRefresh = false } = {}) {
  const sheetId = getSheetId();

  if (!forceRefresh) {
    try {
      const cachedRaw = sessionStorage.getItem(STORAGE_KEYS.DATA_CACHE);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        if (cached && cached.sheetId === sheetId && cached.data) {
          applyResolvedTheme(cached.data.config);
          await ensurePasswordUnlocked(cached.data.config);
          return { ...cached.data, sheetId, isSample: !sheetId };
        }
      }
    } catch {
      // Ignore cache error
    }
  }

  const fetched = {};
  try {
    await Promise.all(
      SHEET_TABS.map(async (tab) => {
        const url = buildTabUrl(tab, sheetId);
        try {
          const res = await fetch(url, { cache: forceRefresh ? "no-store" : "default" });
          if (!res.ok) {
            if (tab === "scores") {
              fetched.scoresCsv = "";
              return;
            }
            throw new Error("Không thể tải dữ liệu câu hỏi.");
          }
          fetched[`${tab}Csv`] = await res.text();
        } catch (err) {
          if (tab === "scores") {
            fetched.scoresCsv = "";
            return;
          }
          throw err;
        }
      })
    );
  } catch (err) {
    await ensurePasswordUnlocked({});
    throw err;
  }

  const data = normaliseAllData(fetched);
  try {
    sessionStorage.setItem(
      STORAGE_KEYS.DATA_CACHE,
      JSON.stringify({ sheetId, data })
    );
  } catch {
    // Ignore storage quota errors
  }

  applyResolvedTheme(data.config);
  await ensurePasswordUnlocked(data.config);
  return { ...data, sheetId, isSample: !sheetId };
}

/**
 * Fetches only the `scores` tab CSV to refresh scores quickly (e.g. every 10s on Leaderboard).
 */
export async function fetchSheetScoresOnly(teams = []) {
  const sheetId = getSheetId();
  const url = buildTabUrl("scores", sheetId);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const csvText = await res.text();
  const scores = normaliseScores(csvText, teams);

  // Update cached data.scores if cache exists
  try {
    const cachedRaw = sessionStorage.getItem(STORAGE_KEYS.DATA_CACHE);
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw);
      if (cached && cached.data) {
        cached.data.scores = scores;
        sessionStorage.setItem(STORAGE_KEYS.DATA_CACHE, JSON.stringify(cached));
      }
    }
  } catch {
    // Ignore cache update error
  }

  return scores;
}

export function loadAppState(teams = [], sheetScores = null) {
  let state;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STATE);
    if (raw) {
      const parsed = importState(raw);
      state = syncStateWithTeams(parsed, teams);
    }
  } catch {
    // Fallback to initial state
  }
  if (!state) {
    state = createInitialState(teams);
  }

  // Merge sheetScores and localScores according to whether a web-app URL is configured
  const webAppUrl = getWebAppUrl();
  if (sheetScores && typeof sheetScores === "object") {
    state.scores = mergeScores({
      teams,
      sheetScores,
      localScores: state.scores,
      webAppUrl
    });
  }

  saveAppState(state);
  return state;
}

export function saveAppState(state) {
  try {
    localStorage.setItem(STORAGE_KEYS.STATE, exportState(state));
  } catch {
    // Ignore storage errors
  }
  return state;
}

/**
 * Posts score updates to the configured score endpoint using text/plain.
 * Keeps local scores on failure and allows retry.
 */
export async function syncScoresToSheet(scoresOrState, teams = []) {
  const webAppUrl = getWebAppUrl();
  if (!webAppUrl) {
    notifySyncStatus({
      state: "saved",
      message: "Đã lưu",
      retryFn: null
    });
    return { ok: true, localOnly: true };
  }

  const payload = buildScoresPayload(scoresOrState, teams);
  const doSend = () => syncScoresToSheet(scoresOrState, teams);

  notifySyncStatus({
    state: "saving",
    message: "Đang lưu…",
    retryFn: null
  });

  try {
    const res = await fetch(webAppUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    let result = { ok: true };
    try {
      const text = await res.text();
      if (text) {
        result = JSON.parse(text);
      }
    } catch {
      // Non-JSON or opaque response is still treated as sent if HTTP 200
    }

    if (result && result.ok === false) {
      throw new Error(result.error || "Không thể lưu điểm");
    }

    // Update cached sheet scores so subsequent reads match immediately
    try {
      const cachedRaw = sessionStorage.getItem(STORAGE_KEYS.DATA_CACHE);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        if (cached?.data) {
          cached.data.scores = normaliseScores(payload.rows, teams);
          sessionStorage.setItem(STORAGE_KEYS.DATA_CACHE, JSON.stringify(cached));
        }
      }
    } catch {
      // Ignore cache update error
    }

    notifySyncStatus({
      state: "saved",
      message: "Đã lưu",
      retryFn: null
    });
    return { ok: true };
  } catch (err) {
    notifySyncStatus({
      state: "failed",
      message: "Chưa lưu được, bấm để thử lại",
      retryFn: doSend
    });
    return { ok: false, error: err };
  }
}

export function renderAvatarHtml(team, sizeClass = "") {
  const initials = escapeHtml(getTeamInitials(team?.name || "?"));
  const color = escapeHtml(team?.color || "#D97757");
  const cls = ["team-avatar", sizeClass].filter(Boolean).join(" ");
  const resolvedUrl = resolveImageUrl(team?.image_url);
  if (resolvedUrl) {
    const imgUrl = escapeHtml(resolvedUrl);
    return `<div class="${cls}" style="background-color: ${color}">
      <span class="team-avatar-initials">${initials}</span>
      <img src="${imgUrl}" alt="" onload="if(this.previousElementSibling)this.previousElementSibling.style.display='none'" onerror="this.remove()" />
    </div>`;
  }
  return `<div class="${cls}" style="background-color: ${color}">${initials}</div>`;
}

export function showToast(message, durationMs = 2800) {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, durationMs);
}

function updateSidebarSyncBadge() {
  const badge = document.getElementById("sidebar-sync-status");
  if (!badge) return;

  badge.classList.remove("saving", "saved", "failed");
  if (currentSyncStatus.state === "saving") {
    badge.classList.add("saving");
    badge.textContent = currentSyncStatus.message || "Đang lưu…";
  } else if (currentSyncStatus.state === "saved") {
    badge.classList.add("saved");
    badge.textContent = currentSyncStatus.message || "Đã lưu";
  } else if (currentSyncStatus.state === "failed") {
    badge.classList.add("failed");
    badge.innerHTML = `<button type="button" id="btn-sidebar-retry-sync" class="btn btn-sm" style="width:100%;">Chưa lưu được, bấm để thử lại</button>`;
    document.getElementById("btn-sidebar-retry-sync")?.addEventListener("click", () => {
      if (typeof currentSyncStatus.retryFn === "function") {
        currentSyncStatus.retryFn();
      }
    });
  } else {
    badge.classList.add("saved");
    badge.textContent = "Đã lưu";
  }
}

/**
 * Renders and wires the collapsible left sidebar and keyboard shortcuts.
 */
export function wireStageLayout({
  activePage = "home",
  config = {},
  onBack,
  onContinue,
  onReload,
  onSpace
} = {}) {
  const collapsed = isSidebarCollapsed();
  document.body.classList.toggle("sidebar-collapsed", collapsed);

  const sidebar = document.getElementById("app-sidebar");
  if (sidebar) {
    const navItems = [
      { id: "home", href: "./index.html", icon: "⌂", label: "Trang chủ" },
      { id: "round1", href: "./round1.html", icon: "①", label: "Vòng 1" },
      { id: "round3", href: "./round3.html", icon: "③", label: "Vòng 3" },
      { id: "leaderboard", href: "./leaderboard.html", icon: "★", label: "Bảng xếp hạng" },
      { id: "scores", href: "./scores.html", icon: "✎", label: "Điểm số" }
    ];

    const sheetIdVal = escapeHtml(getSheetId());
    const webAppVal = escapeHtml(getWebAppUrl());
    const showTitle = escapeHtml(config.show_title || "Đấu Trường Tri Thức");

    sidebar.innerHTML = `
      <div class="sidebar-top">
        <div class="sidebar-brand-row">
          <div id="sidebar-show-title" class="sidebar-show-title" title="${showTitle}">
            ${showTitle}
          </div>
          <button
            type="button"
            id="btn-sidebar-toggle"
            class="sidebar-toggle-btn"
            title="Thu gọn / Mở rộng thanh bên"
            aria-label="Thu gọn hoặc mở rộng thanh bên"
          >
            ${collapsed ? "»" : "«"}
          </button>
        </div>

        <nav class="sidebar-nav" aria-label="Điều hướng chính">
          ${navItems
            .map(
              (item) => `
              <a
                href="${item.href}"
                class="sidebar-link ${item.id === activePage ? "active" : ""}"
                title="${item.label}"
              >
                <span class="sidebar-link-icon">${item.icon}</span>
                <span class="sidebar-link-label">${item.label}</span>
              </a>
            `
            )
            .join("")}
        </nav>

        <div class="sidebar-settings-section">
          <details class="sidebar-details">
            <summary>
              <span>⚙ Cài đặt &amp; Dữ liệu</span>
              <span style="font-size: 0.75rem; color: var(--text-muted);">▾</span>
            </summary>
            <div class="sidebar-settings-body">
              <div>
                <label class="sidebar-field-label" for="sidebar-sheet-id">Link Google Sheet</label>
                <input
                  type="text"
                  id="sidebar-sheet-id"
                  class="sidebar-input"
                  value="${sheetIdVal}"
                  placeholder="Dán link Google Sheet..."
                />
              </div>

              <div>
                <label class="sidebar-field-label" for="sidebar-webapp-url">Link ghi điểm</label>
                <input
                  type="url"
                  id="sidebar-webapp-url"
                  class="sidebar-input"
                  value="${webAppVal}"
                  placeholder="Dán link ghi điểm..."
                />
              </div>

              <button type="button" id="btn-sidebar-save" class="btn btn-primary btn-sm" style="width: 100%;">
                Lưu cài đặt
              </button>

              <button type="button" id="btn-reload-data" class="btn btn-sm" style="width: 100%;">
                ↻ Tải lại dữ liệu
              </button>

              <div id="sidebar-sync-status" class="sidebar-sync-badge"></div>
            </div>
          </details>
        </div>
      </div>

      <div class="sidebar-bottom" style="display: flex; flex-direction: column; gap: 0.65rem; padding-top: 1rem;">
        <button
          type="button"
          id="btn-sidebar-lock"
          class="sidebar-link"
          style="width: 100%; border: 1px solid var(--border); background: var(--surface); cursor: pointer; text-align: left;"
          title="Khóa màn hình (yêu cầu nhập lại mật khẩu)"
        >
          <span class="sidebar-link-icon">🔒</span>
          <span class="sidebar-link-label">Khóa</span>
        </button>

        <div class="sidebar-footer-note" style="font-size: 0.76rem; color: var(--text-muted);">
          Phím tắt: <strong>Space</strong> (Bắt đầu giờ), <strong>←</strong> (Quay lại), <strong>→</strong> (Tiếp tục)
        </div>
      </div>
    `;

    updateSidebarSyncBadge();

    document.getElementById("btn-sidebar-lock")?.addEventListener("click", () => {
      lockAppSession(config);
    });

    document.getElementById("btn-sidebar-toggle")?.addEventListener("click", () => {
      const nextCollapsed = !document.body.classList.contains("sidebar-collapsed");
      setSidebarCollapsed(nextCollapsed);
      const toggleBtn = document.getElementById("btn-sidebar-toggle");
      if (toggleBtn) {
        toggleBtn.textContent = nextCollapsed ? "»" : "«";
      }
    });

    document.getElementById("btn-sidebar-save")?.addEventListener("click", async () => {
      const rawSheet = document.getElementById("sidebar-sheet-id")?.value || "";
      const rawWebApp = document.getElementById("sidebar-webapp-url")?.value || "";
      const cleanSheet = setSheetId(rawSheet);
      const cleanWebApp = setWebAppUrl(rawWebApp);
      const sheetInput = document.getElementById("sidebar-sheet-id");
      const webAppInput = document.getElementById("sidebar-webapp-url");
      if (sheetInput) sheetInput.value = cleanSheet;
      if (webAppInput) webAppInput.value = cleanWebApp;
      updateSidebarSyncBadge();
      if (typeof onReload === "function") {
        try {
          await onReload();
          showToast("Đã lưu cài đặt và tải lại dữ liệu!");
        } catch (err) {
          showToast(err.message || "Không thể tải dữ liệu, vui lòng kiểm tra lại đường dẫn.");
        }
      } else {
        showToast("Đã lưu cài đặt!");
      }
    });

    const reloadBtn = document.getElementById("btn-reload-data");
    if (reloadBtn && typeof onReload === "function") {
      reloadBtn.addEventListener("click", async () => {
        reloadBtn.disabled = true;
        try {
          await onReload();
          showToast("Đã tải lại dữ liệu!");
        } catch (err) {
          showToast(err.message || "Không thể tải dữ liệu.");
        } finally {
          reloadBtn.disabled = false;
        }
      });
    }
  }

  window.onkeydown = (e) => {
    const tag = (e.target?.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select" || e.target?.isContentEditable) {
      return;
    }
    if (e.code === "Space" && typeof onSpace === "function") {
      const handled = onSpace();
      if (handled !== false) {
        e.preventDefault();
      }
    } else if (e.code === "ArrowRight" && typeof onContinue === "function") {
      e.preventDefault();
      onContinue();
    } else if (e.code === "ArrowLeft" && typeof onBack === "function") {
      e.preventDefault();
      onBack();
    }
  };
}
