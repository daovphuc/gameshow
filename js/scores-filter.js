// DOM-free logic for scores table filtering, sorting, and judge score checks.

/**
 * Strips Vietnamese diacritics / accents and converts to lowercase.
 * E.g., "Hà Nội" -> "ha noi", "Đà Nẵng" -> "da nang".
 *
 * @param {string} str
 * @returns {string}
 */
export function removeVietnameseAccents(str) {
  if (str === undefined || str === null) return "";
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

/**
 * Case- and accent-insensitive search match for Vietnamese text.
 *
 * @param {string} text
 * @param {string} query
 * @returns {boolean}
 */
export function matchesSearch(text, query) {
  if (!query || !String(query).trim()) return true;
  const normText = removeVietnameseAccents(text);
  const normQuery = removeVietnameseAccents(query);
  return normText.includes(normQuery);
}

/**
 * Checks which judges have not submitted scores for a team in a round.
 * Returns array of warning strings, e.g. ["Thiếu điểm GK2"].
 *
 * @param {Array<{id: string, name: string}>} judges
 * @param {Record<string, {content?: any, manner?: any, score?: any}>} teamJudgeScores
 * @returns {Array<string>}
 */
export function getMissingJudgeFlags(judges = [], teamJudgeScores = {}) {
  if (!Array.isArray(judges) || judges.length === 0) return [];
  const scores = teamJudgeScores || {};
  const missing = [];

  for (const j of judges) {
    const entry = scores[j.id];
    const hasContent = entry?.content !== undefined && entry?.content !== null && entry?.content !== "";
    const hasManner = entry?.manner !== undefined && entry?.manner !== null && entry?.manner !== "";
    const hasScore = entry?.score !== undefined && entry?.score !== null && entry?.score !== "";

    if (!hasContent && !hasManner && !hasScore) {
      missing.push(`Thiếu điểm ${j.name || j.id}`);
    }
  }

  return missing;
}

/**
 * Filters and sorts score table rows.
 *
 * @param {Array<any>} rows
 * @param {{
 *   search?: string,
 *   onlyRoundTeams?: boolean,
 *   sortBy?: "rank" | "stt" | "name"
 * }} options
 * @returns {Array<any>}
 */
export function filterAndSortScoreRows(rows = [], {
  search = "",
  onlyRoundTeams = false,
  sortBy = "rank"
} = {}) {
  if (!Array.isArray(rows)) return [];

  // 1. Filter
  let filtered = rows.filter((row) => {
    if (onlyRoundTeams && row.inRound === false) {
      return false;
    }
    if (search && String(search).trim()) {
      const matchName = matchesSearch(row.name, search);
      const matchId = matchesSearch(row.id, search);
      if (!matchName && !matchId) {
        return false;
      }
    }
    return true;
  });

  // 2. Sort
  filtered.sort((a, b) => {
    if (sortBy === "stt") {
      const sttA = Number(a.orderNumber) || 9999;
      const sttB = Number(b.orderNumber) || 9999;
      return sttA - sttB;
    }

    if (sortBy === "name") {
      const nameA = String(a.name || "");
      const nameB = String(b.name || "");
      return nameA.localeCompare(nameB, "vi", { sensitivity: "base" });
    }

    // Default: "rank"
    const rankA = Number(a.rank) || 9999;
    const rankB = Number(b.rank) || 9999;
    if (rankA !== rankB) {
      return rankA - rankB;
    }
    // Tie breaker by orderNumber
    const sttA = Number(a.orderNumber) || 9999;
    const sttB = Number(b.orderNumber) || 9999;
    return sttA - sttB;
  });

  return filtered;
}
