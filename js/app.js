// Shared browser runtime wiring: sheet fetching, localStorage persistence, theme application, and stage header.

import { DEFAULT_SHEET_ID, SHEET_TABS, extractSheetId, buildTabUrl } from "./config.js";
import { normaliseAllData } from "./data.js";
import { createInitialState, syncStateWithTeams, exportState, importState } from "./state.js";
import { getTeamInitials } from "./leaderboard.js";
import { LIGHT_THEME, mergeTheme, themeToCssVars } from "./theme.js";

export const STORAGE_KEYS = {
  SHEET_ID: "gameshow_sheet_id",
  STATE: "gameshow_state",
  DATA_CACHE: "gameshow_data_cache",
  THEME: "gameshow_theme"
};

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

export function getLocalTheme() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.THEME);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    }
  } catch {
    // Ignore invalid JSON
  }
  return {};
}

export function saveLocalTheme(overrides = {}) {
  try {
    localStorage.setItem(STORAGE_KEYS.THEME, JSON.stringify(overrides));
  } catch {
    // Ignore storage errors
  }
}

export function clearLocalTheme() {
  try {
    localStorage.removeItem(STORAGE_KEYS.THEME);
  } catch {
    // Ignore storage errors
  }
}

export function applyResolvedTheme(sheetConfig = {}) {
  const local = getLocalTheme();
  const resolved = mergeTheme({
    defaults: LIGHT_THEME,
    sheet: sheetConfig,
    local
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
          return { ...cached.data, sheetId, isSample: !sheetId };
        }
      }
    } catch {
      // Ignore cache error
    }
  }

  const fetched = {};
  await Promise.all(
    SHEET_TABS.map(async (tab) => {
      const url = buildTabUrl(tab, sheetId);
      const res = await fetch(url, { cache: forceRefresh ? "no-store" : "default" });
      if (!res.ok) {
        throw new Error(`Không thể tải tab "${tab}" (${res.status})`);
      }
      fetched[`${tab}Csv`] = await res.text();
    })
  );

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
  return { ...data, sheetId, isSample: !sheetId };
}

export function loadAppState(teams = []) {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STATE);
    if (raw) {
      const parsed = importState(raw);
      const synced = syncStateWithTeams(parsed, teams);
      saveAppState(synced);
      return synced;
    }
  } catch {
    // Fallback to initial state if corrupted
  }
  const initial = createInitialState(teams);
  saveAppState(initial);
  return initial;
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
  if (team?.image_url) {
    const imgUrl = escapeHtml(team.image_url);
    const alt = escapeHtml(team.name || "");
    return `<div class="${cls}" style="background-color: ${color}" data-initials="${initials}">
      <img src="${imgUrl}" alt="${alt}" onerror="this.parentElement.textContent = this.parentElement.dataset.initials;" />
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

/**
 * Wires up the standard stage header (Back top-left, Continue top-right, Reload Data, and keyboard shortcuts).
 */
export function wireStageHeader({
  config = {},
  onBack,
  onContinue,
  onReload,
  onSpace
} = {}) {
  const titleEl = document.getElementById("header-show-title");
  if (titleEl && config.show_title) {
    titleEl.textContent = config.show_title;
  }

  const backBtn = document.getElementById("btn-header-back");
  if (backBtn && typeof onBack === "function") {
    backBtn.onclick = (e) => {
      e.preventDefault();
      onBack();
    };
  }

  const continueBtn = document.getElementById("btn-header-continue");
  if (continueBtn && typeof onContinue === "function") {
    continueBtn.onclick = (e) => {
      e.preventDefault();
      onContinue();
    };
  }

  const reloadBtn = document.getElementById("btn-reload-data");
  if (reloadBtn && typeof onReload === "function") {
    reloadBtn.onclick = async (e) => {
      e.preventDefault();
      reloadBtn.disabled = true;
      try {
        await onReload();
        showToast("Đã tải lại dữ liệu câu hỏi & cấu hình (giữ nguyên điểm số).");
      } catch (err) {
        showToast(`Lỗi tải dữ liệu: ${err.message || err}`);
      } finally {
        reloadBtn.disabled = false;
      }
    };
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
