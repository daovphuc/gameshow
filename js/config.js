// Default configuration and Google Sheets URL helpers.

export const DEFAULT_SHEET_ID = "";

export const SHEET_TABS = ["teams", "round1", "round3", "config"];

export const DEFAULT_CONFIG = {
  show_title: "Đấu Trường Tri Thức",
  show_subtitle: "Hội thi tìm hiểu kiến thức tổng hợp",
  round1_name: "Vòng 1: Khởi Động",
  round2_name: "Vòng 2: Vượt Chướng Ngại Vật",
  round3_name: "Vòng 3: Tăng Tốc & Về Đích",
  round1_time_seconds: 15,
  round3_time_seconds: 20,
  round1_default_points: 10,
  round3_default_points: 20,
  round1_packages_offered: 2
};

export const TEAM_PALETTE = [
  "#D97757",
  "#2E7D4F",
  "#3B6E8C",
  "#8C5A3B",
  "#9E3E50",
  "#5D6B38",
  "#2D7B74",
  "#B86B28",
  "#6A4C8C",
  "#B5483A",
  "#3A6680",
  "#7A6334",
  "#4E7A58",
  "#A65638"
];

/**
 * Extracts a Google Sheet ID from either a full Google Sheets URL or a raw ID string.
 * @param {string} input
 * @returns {string}
 */
export function extractSheetId(input) {
  if (!input || typeof input !== "string") {
    return "";
  }
  const trimmed = input.trim();
  if (!trimmed) {
    return "";
  }
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch) {
    return urlMatch[1];
  }
  return trimmed;
}

/**
 * Builds the fetch URL for a given sheet tab.
 * Falls back to relative ./data/sample/<tab>.csv when no sheetId is configured.
 * @param {string} tab
 * @param {string} [sheetId]
 * @returns {string}
 */
export function buildTabUrl(tab, sheetId = DEFAULT_SHEET_ID) {
  const cleanId = extractSheetId(sheetId);
  if (!cleanId) {
    return `./data/sample/${encodeURIComponent(tab)}.csv`;
  }
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(cleanId)}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
}
