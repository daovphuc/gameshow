// Shared browser runtime wiring: data fetching, state persistence,
// theme application, connection status, collapsible left sidebar,
// and right-side live leaderboard drawer with FLIP animation.

import { CONTENT_TABS, SHEET_TABS } from "./config.js";
import { getActiveSession, saveActiveSession, clearActiveSession, validateSession } from "./auth.js";
import { normaliseAllData, resolveImageUrl } from "./data.js";
import { contentToQuizData, isContentEmpty } from "./content.js";
import { createInitialState, syncStateWithTeams, exportState, importState, computeTeamScores } from "./state.js";
import { getTeamInitials, computeLeaderboard, diffLeaderboard } from "./leaderboard.js";
import { LIGHT_THEME, mergeTheme, themeToCssVars } from "./theme.js";
import { initBackend, listen, get, set, getServerTime, getConnectionStatus, onStatusChange } from "./backend.js";

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
 * @returns {any|null}
 */
export function ensurePortalSession(portal = "host", accounts = []) {
  if (typeof window === "undefined") return null;
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
export function logoutUser(role = null) {
  clearActiveSession(undefined, role);
  if (typeof window !== "undefined") {
    window.location.href = "./index.html";
  }
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

/**
 * Fetches contest data from live backend content node or falls back to sample CSVs.
 * @param {{forceRefresh?: boolean, portal?: string}} options
 */
export async function fetchQuizData({ forceRefresh = false, portal = "host" } = {}) {
  await initBackend();

  let remoteContent = null;
  try {
    remoteContent = await get("content");
  } catch {
    // Ignore database read error
  }

  let data;
  let isSample = false;

  if (remoteContent && !isContentEmpty(remoteContent)) {
    data = contentToQuizData(remoteContent);
    isSample = false;
  } else {
    data = await fetchSampleQuizData(forceRefresh);
    isSample = true;
  }

  applyResolvedTheme(data.config);
  const session = portal ? ensurePortalSession(portal, data.accounts) : getActiveSession();
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

  function updateLeaderboardRows(currentScores) {
    const container = document.getElementById("drawer-ranking-list");
    if (!container || !teams || teams.length === 0) return;

    const ranked = computeLeaderboard(teams, currentScores, "total", { tieBreak: true });
    const diff = diffLeaderboard(lastLeaderboardEntries, ranked);

    // FLIP FIRST: record initial DOM bounding rects
    const prevRects = new Map();
    container.querySelectorAll(".drawer-ranking-row").forEach((el) => {
      const id = el.dataset.teamId;
      if (id) {
        prevRects.set(id, el.getBoundingClientRect());
      }
    });

    const changedScoreIds = new Set(diff.changedScores.map((c) => c.id));

    // Render new DOM order
    container.innerHTML = ranked
      .map(
        (entry) => `
        <div
          class="drawer-ranking-row ${changedScoreIds.has(entry.id) ? "score-tick" : ""}"
          data-team-id="${escapeHtml(entry.id)}"
        >
          <span class="drawer-rank ${entry.rank === 1 ? "top-1" : ""}">#${entry.rank}</span>
          ${renderAvatarHtml(entry, "team-avatar-sm")}
          <span class="drawer-team-name" title="${escapeHtml(entry.name)}">${escapeHtml(entry.name)}</span>
          <span class="drawer-team-score">${entry.score}đ</span>
        </div>
      `
      )
      .join("");

    // FLIP LAST & INVERT & PLAY: animate movements smoothly
    if (diff.hasChanged && prevRects.size > 0) {
      container.querySelectorAll(".drawer-ranking-row").forEach((el) => {
        const id = el.dataset.teamId;
        const prevRect = prevRects.get(id);
        if (prevRect) {
          const currentRect = el.getBoundingClientRect();
          const deltaY = prevRect.top - currentRect.top;
          if (deltaY !== 0) {
            el.style.transform = `translateY(${deltaY}px)`;
            el.style.transition = "none";
            requestAnimationFrame(() => {
              el.style.transition = "transform 0.45s cubic-bezier(0.2, 0, 0, 1)";
              el.style.transform = "";
            });
          }
        }
      });
    }

    lastLeaderboardEntries = ranked;
  }

  // Subscribe to live state updates
  listen("live", (liveState) => {
    if (!liveState) return;
    const scores = computeTeamScores({ teams, live: liveState });
    updateLeaderboardRows(scores);
  });
}

/**
 * Renders and wires the collapsible left sidebar, connection status badge,
 * and keyboard shortcuts on host pages.
 */
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
      { id: "home", href: "./host.html", icon: "⌂", label: "Tổng quan" },
      { id: "round1", href: "./round1.html", icon: "①", label: "Vòng 1" },
      { id: "round2", href: "./round2.html", icon: "②", label: "Vòng 2" },
      { id: "round3", href: "./round3.html", icon: "③", label: "Vòng 3" },
      { id: "leaderboard", href: "./leaderboard.html", icon: "★", label: "Bảng xếp hạng" },
      { id: "scores", href: "./scores.html", icon: "✎", label: "Điểm số" }
    ];

    const showTitle = escapeHtml(config.show_title || "Hội thi PCCC và CNCH");
    const session = getActiveSession(undefined, "host");
    const displayName = session?.display_name || session?.username || "Dẫn chương trình";

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

        <!-- Connection Status -->
        <div class="sidebar-conn-wrap">
          <div id="sidebar-conn-badge" class="conn-status-badge local" title="Chế độ thử trên 1 máy">
            <span class="conn-status-dot"></span>
            <span id="sidebar-conn-label">Đang kết nối...</span>
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
          <button
            type="button"
            id="btn-reload-data"
            class="sidebar-link"
            title="Tải lại dữ liệu"
          >
            <span class="sidebar-link-icon">↻</span>
            <span class="sidebar-link-label">Tải lại dữ liệu</span>
          </button>
        </div>
      </div>

      <div class="sidebar-bottom">
        <a
          href="./index.html"
          class="sidebar-link"
          title="Về màn hình chọn cổng"
        >
          <span class="sidebar-link-icon">⌂</span>
          <span class="sidebar-link-label">Đổi cổng</span>
        </a>

        <button
          type="button"
          id="btn-sidebar-logout"
          class="sidebar-link"
          title="Đăng xuất (${escapeHtml(displayName)})"
        >
          <span class="sidebar-link-icon">⏻</span>
          <span class="sidebar-link-label">Đăng xuất</span>
        </button>

        <div class="sidebar-footer-note">
          <span><kbd>Space</kbd> Bắt đầu giờ</span>
          <span><kbd>←</kbd> Quay lại</span>
          <span><kbd>→</kbd> Tiếp tục</span>
        </div>
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

    const reloadBtn = document.getElementById("btn-reload-data");
    if (reloadBtn && typeof onReload === "function") {
      reloadBtn.addEventListener("click", async () => {
        reloadBtn.disabled = true;
        try {
          await onReload();
          showToast("Đã tải lại dữ liệu mới nhất!");
        } catch (err) {
          showToast(err.message || "Không thể tải lại dữ liệu.");
        } finally {
          reloadBtn.disabled = false;
        }
      });
    }

    // Auto update when content changes in backend (unless we are editing on content.html)
    if (activePage !== "content" && typeof onReload === "function") {
      listen("content", async (newContent) => {
        if (newContent) {
          try {
            await onReload();
          } catch {
            // Ignore background reload errors
          }
        }
      });
    }
  }

  // Wire right-side live leaderboard drawer
  if (teams && teams.length > 0) {
    wireLiveLeaderboardPanel({ teams });
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
