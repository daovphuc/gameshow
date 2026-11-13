// Shared browser runtime wiring: data fetching, state persistence,
// theme application, connection status, collapsible left sidebar,
// and right-side live leaderboard drawer with FLIP animation.

import { CONTENT_TABS, SHEET_TABS } from "./config.js";
import { getActiveSession, saveActiveSession, clearActiveSession, validateSession, isRoleAllowedForPortal } from "./auth.js";
import { normaliseAllData, resolveImageUrl, resolveTeamIcon } from "./data.js";
import { contentToQuizData, isContentEmpty, getContestTeams, ALLOWED_TEAM_CONTENT_KEYS, assembleTeamContent } from "./content.js";
import { createInitialState, syncStateWithTeams, exportState, importState, computeTeamScores } from "./state.js";
import {
  getTeamInitials,
  computeLeaderboard,
  diffLeaderboard,
  shortenTeamName,
  buildScoreboardRows,
  renderScoreboardTableHtml
} from "./leaderboard.js";
import { LIGHT_THEME, mergeTheme, themeToCssVars } from "./theme.js";
import {
  initBackend,
  listen,
  get,
  set,
  getServerTime,
  getConnectionStatus,
  onStatusChange,
  isFirebaseBackend,
  waitForAuth,
  signOutPortal,
  changePassword
} from "./backend.js";

export const STORAGE_KEYS = {
  SIDEBAR_COLLAPSED: "gameshow_sidebar_collapsed",
  STATE: "gameshow_state",
  DATA_CACHE: "gameshow_data_cache_v4",
  AUTH_SESSION: "gameshow_auth_session",
  LEADERBOARD_DRAWER_OPEN: "gameshow_lb_panel_open"
};

/**
 * Ensures user has an active, valid session for the requested portal role.
 * If invalid, redirects immediately to index.html and clears storage.
 * @param {"host"|"judge"|"team"|string} portal
 * @param {Array<any>} [accounts]
 * @returns {Promise<any|null>}
 */
export async function ensurePortalSession(portal = "host", accounts = []) {
  if (typeof window === "undefined") return null;

  const isFb = isFirebaseBackend();
  if (isFb) {
    const user = await waitForAuth(portal);
    if (!user) {
      clearActiveSession(undefined, portal);
      window.location.href = "./index.html";
      return null;
    }
    const session = getActiveSession(undefined, portal);
    if (!session || !isRoleAllowedForPortal(session.role, portal)) {
      clearActiveSession(undefined, portal);
      window.location.href = "./index.html";
      return null;
    }
    document.body.classList.add("auth-unlocked");
    return session;
  }

  // Local Mode
  const session = getActiveSession(undefined, portal);
  const validAccount = validateSession(session, accounts, portal);
  if (!validAccount) {
    clearActiveSession(undefined, portal);
    window.location.href = "./index.html";
    return null;
  }
  // Valid login: reveal the page (css hides .app-shell until then).
  document.body.classList.add("auth-unlocked");
  // Refresh display_name if updated
  if (validAccount.display_name && session.display_name !== validAccount.display_name) {
    session.display_name = validAccount.display_name;
    saveActiveSession(session);
  }
  return session;
}

/**
 * Logs out the current session and redirects to index.html.
 */
export async function logoutUser(role = null) {
  const portal = (role === "head_judge" || role === "judge") ? "judge" : (role === "team" ? "team" : "host");
  try {
    await signOutPortal(portal);
  } catch {
    // Ignore sign out error
  }
  clearActiveSession(undefined, role);
  if (typeof window !== "undefined") {
    window.location.href = "./index.html";
  }
}

/**
 * Opens a clean modal dialog allowing any signed-in user to change their password.
 * @param {string} [portal]
 */
export function openChangePasswordModal(portal = "host") {
  if (typeof document === "undefined") return;
  let modal = document.getElementById("change-pwd-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "change-pwd-modal";
    modal.className = "login-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.innerHTML = `
      <div class="login-modal-card" style="max-width: 420px;">
        <button type="button" id="btn-change-pwd-close" class="login-modal-close" aria-label="Đóng">✕</button>
        <div class="login-modal-header">
          <div class="login-modal-icon">🔑</div>
          <h2 class="login-modal-title">Đổi Mật Khẩu</h2>
        </div>
        <form id="change-pwd-form" class="login-form" novalidate>
          <div class="login-field">
            <label for="pwd-current" class="login-label">Mật khẩu hiện tại</label>
            <input type="password" id="pwd-current" class="login-input" placeholder="Nhập mật khẩu hiện tại..." autocomplete="current-password" required />
          </div>
          <div class="login-field">
            <label for="pwd-new" class="login-label">Mật khẩu mới (ít nhất 6 ký tự)</label>
            <input type="password" id="pwd-new" class="login-input" placeholder="Nhập mật khẩu mới..." autocomplete="new-password" minlength="6" required />
          </div>
          <div class="login-field">
            <label for="pwd-confirm" class="login-label">Xác nhận mật khẩu mới</label>
            <input type="password" id="pwd-confirm" class="login-input" placeholder="Nhập lại mật khẩu mới..." autocomplete="new-password" required />
          </div>
          <div id="pwd-error" class="login-error" role="alert" aria-live="polite"></div>
          <button type="submit" id="btn-submit-change-pwd" class="btn btn-primary btn-lg" style="width: 100%; justify-content: center; margin-top: 0.5rem;">
            Cập nhật mật khẩu
          </button>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    const closeBtn = document.getElementById("btn-change-pwd-close");
    closeBtn?.addEventListener("click", () => {
      modal.style.display = "none";
    });
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.style.display = "none";
    });

    const form = document.getElementById("change-pwd-form");
    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const currentInp = document.getElementById("pwd-current");
      const newInp = document.getElementById("pwd-new");
      const confirmInp = document.getElementById("pwd-confirm");
      const errorEl = document.getElementById("pwd-error");
      const submitBtn = document.getElementById("btn-submit-change-pwd");

      const curVal = currentInp?.value || "";
      const newVal = newInp?.value || "";
      const confVal = confirmInp?.value || "";

      if (errorEl) errorEl.textContent = "";

      if (!curVal) {
        if (errorEl) errorEl.textContent = "Vui lòng nhập mật khẩu hiện tại.";
        currentInp?.focus();
        return;
      }
      if (!newVal || newVal.length < 6) {
        if (errorEl) errorEl.textContent = "Mật khẩu mới phải có ít nhất 6 ký tự.";
        newInp?.focus();
        return;
      }
      if (newVal !== confVal) {
        if (errorEl) errorEl.textContent = "Xác nhận mật khẩu mới không khớp.";
        confirmInp?.focus();
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Đang cập nhật...";
      }

      try {
        await changePassword(curVal, newVal, portal);
        modal.style.display = "none";
        showToast("✓ Đổi mật khẩu thành công!");
        form.reset();
      } catch (err) {
        if (errorEl) errorEl.textContent = err.message || "Không thể đổi mật khẩu.";
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Cập nhật mật khẩu";
        }
      }
    });
  }

  const errEl = document.getElementById("pwd-error");
  if (errEl) errEl.textContent = "";
  const form = document.getElementById("change-pwd-form");
  if (form) form.reset();
  modal.style.display = "flex";
  document.getElementById("pwd-current")?.focus();
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

export function applyResolvedTheme(config = {}) {
  const resolved = mergeTheme({
    defaults: LIGHT_THEME,
    sheet: config,
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

/**
 * Loads default contest data from local sample CSV files.
 * @param {boolean} forceRefresh
 * @returns {Promise<Record<string, any>>}
 */
export async function fetchSampleQuizData(forceRefresh = false) {
  const fetched = {};
  await Promise.all(
    CONTENT_TABS.map(async (tab) => {
      const res = await fetch(`./data/sample/${encodeURIComponent(tab)}.csv`, {
        cache: forceRefresh ? "no-store" : "default"
      });
      if (!res.ok) {
        throw new Error(`Không thể tải dữ liệu mẫu tab "${tab}".`);
      }
      fetched[`${tab}Csv`] = await res.text();
    })
  );
  return normaliseAllData(fetched);
}

// True once a whole-`content` read was denied (team accounts): read and listen per allowed child.
let contentRestricted = false;

/**
 * Reads `content`; when the rules deny the whole node (team role), reads only
 * the children a team may see and assembles them.
 * @returns {Promise<object|null>}
 */
export async function readContent() {
  try {
    const whole = await get("content");
    contentRestricted = false;
    return whole;
  } catch {
    // Denied for this role (or offline): fall back to the allowed children.
  }
  contentRestricted = true;
  const parts = {};
  await Promise.all(
    ALLOWED_TEAM_CONTENT_KEYS.map(async (key) => {
      try {
        parts[key] = await get(`content/${key}`);
      } catch {
        parts[key] = null;
      }
    })
  );
  const assembled = assembleTeamContent(parts);
  return Object.keys(assembled).length ? assembled : null;
}

/**
 * Subscribes to content changes using the same paths `readContent` could read.
 * @param {(content: object|null) => void} callback
 * @returns {() => void}
 */
export function listenContent(callback) {
  if (!contentRestricted) return listen("content", callback);
  const latest = {};
  const seen = new Set();
  const unsubs = ALLOWED_TEAM_CONTENT_KEYS.map((key) =>
    listen(`content/${key}`, (value) => {
      latest[key] = value;
      seen.add(key);
      if (seen.size === ALLOWED_TEAM_CONTENT_KEYS.length) callback(assembleTeamContent(latest));
    })
  );
  return () => unsubs.forEach((u) => u());
}

/**
 * Fetches contest data from live backend content node or falls back to sample CSVs.
 * @param {{forceRefresh?: boolean, portal?: string}} options
 */
export async function fetchQuizData({ forceRefresh = false, portal = "host" } = {}) {
  await initBackend({ portal });

  const remoteContent = await readContent();

  let data;
  let isSample = false;

  if (remoteContent && !isContentEmpty(remoteContent)) {
    data = contentToQuizData(remoteContent);
    isSample = false;
  } else {
    data = await fetchSampleQuizData(forceRefresh);
    isSample = true;
    if (!data.allTeams) {
      data.allTeams = data.teams;
    }
    data.teams = getContestTeams(data.allTeams, data.round_order);
  }

  applyResolvedTheme(data.config);
  const session = portal ? await ensurePortalSession(portal, data.accounts) : getActiveSession();
  return { ...data, isSample, session };
}

export function loadAppState(teams = []) {
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

export { renderAvatarHtml } from "./leaderboard.js";

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

// -----------------------------------------------------------------------------
// Live Leaderboard Side Panel (Host screens) with FLIP animation
// -----------------------------------------------------------------------------

let lastLeaderboardEntries = [];

/**
 * Wires the collapsible right-side live leaderboard drawer on host screens.
 */
export function wireLiveLeaderboardPanel({ teams = [], getLiveScores } = {}) {
  if (typeof document === "undefined") return;

  let toggleBtn = document.getElementById("btn-toggle-live-leaderboard");
  if (!toggleBtn) {
    toggleBtn = document.createElement("button");
    toggleBtn.id = "btn-toggle-live-leaderboard";
    toggleBtn.type = "button";
    toggleBtn.className = "btn-toggle-live-leaderboard";
    toggleBtn.setAttribute("aria-label", "Mở hoặc đóng bảng điểm trực tiếp bên phải");
    toggleBtn.innerHTML = `<span>★ Bảng điểm</span>`;
    document.body.appendChild(toggleBtn);
  }

  let drawer = document.getElementById("live-leaderboard-drawer");
  if (!drawer) {
    drawer = document.createElement("aside");
    drawer.id = "live-leaderboard-drawer";
    drawer.className = "live-leaderboard-drawer";
    drawer.setAttribute("aria-label", "Bảng điểm trực tiếp");
    drawer.innerHTML = `
      <div class="drawer-header">
        <h2 class="drawer-title">★ Bảng Điểm Trực Tiếp</h2>
        <button type="button" id="btn-drawer-close" class="drawer-close-btn" aria-label="Đóng">✕</button>
      </div>
      <div class="drawer-body">
        <div id="drawer-ranking-list" class="drawer-ranking-list"></div>
      </div>
    `;
    document.body.appendChild(drawer);

    document.getElementById("btn-drawer-close")?.addEventListener("click", () => {
      setDrawerOpen(false);
    });
  }

  function isDrawerOpen() {
    try {
      return localStorage.getItem(STORAGE_KEYS.LEADERBOARD_DRAWER_OPEN) === "1";
    } catch {
      return false;
    }
  }

  function setDrawerOpen(open) {
    try {
      localStorage.setItem(STORAGE_KEYS.LEADERBOARD_DRAWER_OPEN, open ? "1" : "0");
    } catch {
      // Ignore storage errors
    }
    drawer.classList.toggle("open", Boolean(open));
  }

  setDrawerOpen(isDrawerOpen());

  toggleBtn.onclick = () => {
    setDrawerOpen(!drawer.classList.contains("open"));
  };

  function updateLeaderboardRows(currentScores, liveState) {
    const container = document.getElementById("drawer-ranking-list");
    if (!container || !teams || teams.length === 0) return;

    const rows = buildScoreboardRows(teams, currentScores, {
      round2Stats: liveState?.round2Stats || {}
    });

    container.innerHTML = renderScoreboardTableHtml(rows, {
      tableClass: "scoreboard-table drawer-scoreboard-table",
      wrapClass: "scoreboard-table-wrap drawer-scoreboard-wrap",
      shortenName: true
    });
  }

  // Subscribe to live state updates
  listen("live", (liveState) => {
    if (!liveState) return;
    const scores = computeTeamScores({ teams, live: liveState });
    updateLeaderboardRows(scores, liveState);
  });
}

/**
 * Renders and wires the collapsible left sidebar, connection status badge,
 * and keyboard shortcuts on host pages.
 */
let contentListenerStarted = false;
let contentReloadHandler = null;
let lastContentJson = null;

export function wireStageLayout({
  activePage = "home",
  config = {},
  teams = [],
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
      { id: "intro", href: "./intro.html", icon: "✦", label: "Giới thiệu" },
      { id: "home", href: "./host.html", icon: "⌂", label: "Tổng quan" },
      { id: "round1", href: "./round1.html", icon: "①", label: "Vòng 1" },
      { id: "round2", href: "./round2.html", icon: "②", label: "Vòng 2" },
      { id: "round3", href: "./round3.html", icon: "③", label: "Vòng 3" },
      { id: "leaderboard", href: "./leaderboard.html", icon: "★", label: "Bảng xếp hạng" }
    ];

    const showTitle = escapeHtml(config.show_title || "Hội thi PCCC và CNCH");
    const showSubtitle = escapeHtml(config.show_subtitle || "");
    const session = getActiveSession(undefined, "host");
    const displayName = session?.display_name || session?.username || "Dẫn chương trình";

    sidebar.innerHTML = `
      <div class="sidebar-top">
        <div class="sidebar-header-card">
          <div class="sidebar-brand-row">
            <div id="sidebar-show-title" class="sidebar-show-title" title="${showTitle}">
              <div class="sidebar-title-main">${showTitle}</div>
              ${showSubtitle ? `<div class="sidebar-show-subtitle" title="${showSubtitle}">${showSubtitle}</div>` : ""}
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

          <!-- Connection Status -->
          <div class="sidebar-conn-wrap">
            <div id="sidebar-conn-badge" class="conn-status-badge local" title="Chế độ thử trên 1 máy">
              <span class="conn-status-dot"></span>
              <span id="sidebar-conn-label">Đang kết nối...</span>
            </div>
          </div>
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
          <div class="sidebar-section-title" style="padding: 0.5rem 0.85rem 0.25rem; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">
            Cài đặt &amp; Dữ liệu
          </div>
          <a
            href="./content.html"
            class="sidebar-link ${activePage === "content" ? "active" : ""}"
            title="Cấu hình nội dung"
          >
            <span class="sidebar-link-icon">⚙</span>
            <span class="sidebar-link-label">Cấu hình nội dung</span>
          </a>
        </div>
      </div>

      <div class="sidebar-bottom">
        <button
          type="button"
          id="btn-sidebar-change-pwd"
          class="sidebar-link"
          title="Đổi mật khẩu"
        >
          <span class="sidebar-link-icon">🔑</span>
          <span class="sidebar-link-label">Đổi mật khẩu</span>
        </button>

        <button
          type="button"
          id="btn-sidebar-logout"
          class="sidebar-link"
          title="Đăng xuất (${escapeHtml(displayName)})"
        >
          <span class="sidebar-link-icon">⏻</span>
          <span class="sidebar-link-label">Đăng xuất</span>
        </button>
      </div>
    `;

    // Wire connection status display
    const connBadge = document.getElementById("sidebar-conn-badge");
    const connLabel = document.getElementById("sidebar-conn-label");
    onStatusChange((status) => {
      if (!connBadge || !connLabel) return;
      connBadge.className = `conn-status-badge ${status.code || "local"}`;
      connBadge.title = status.label || "Chế độ thử trên 1 máy";
      connLabel.textContent = status.label || "Chế độ thử trên 1 máy";
    });

    document.getElementById("btn-sidebar-change-pwd")?.addEventListener("click", () => {
      openChangePasswordModal("host");
    });

    document.getElementById("btn-sidebar-logout")?.addEventListener("click", () => {
      logoutUser("host");
    });

    document.getElementById("btn-sidebar-toggle")?.addEventListener("click", () => {
      const nextCollapsed = !document.body.classList.contains("sidebar-collapsed");
      setSidebarCollapsed(nextCollapsed);
      const toggleBtn = document.getElementById("btn-sidebar-toggle");
      if (toggleBtn) {
        toggleBtn.textContent = nextCollapsed ? "»" : "«";
      }
    });

    // Auto update when content changes in backend (unless we are editing on content.html).
    // Subscribe once per page: onReload re-renders and calls wireStageLayout again.
    if (activePage !== "content" && typeof onReload === "function") {
      contentReloadHandler = onReload;
      if (!contentListenerStarted) {
        contentListenerStarted = true;
        listenContent(async (newContent) => {
          const serialized = JSON.stringify(newContent ?? null);
          if (lastContentJson === null) {
            // First callback carries the content this page was just rendered from.
            lastContentJson = serialized;
            return;
          }
          if (serialized === lastContentJson || !newContent) return;
          lastContentJson = serialized;
          try {
            await contentReloadHandler?.();
          } catch {
            // Ignore background reload errors
          }
        });
      }
    }
  }

  // Wire right-side live leaderboard drawer
  if (teams && teams.length > 0) {
    wireLiveLeaderboardPanel({ teams });
  }
}
