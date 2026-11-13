// Leaderboard ranking, trophy podium slot mapping, Điều 22 tie-break,
// animation diff helper, team name shortening, and team avatar helpers (DOM-free).

import { TEAM_PALETTE } from "./config.js";
import { resolveTeamIcon } from "./data.js";

export const PODIUM_SLOT_ORDER = [4, 2, 1, 3, 5];

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderAvatarHtml(team, sizeClass = "") {
  const initials = escapeHtml(getTeamInitials(team?.name || "?"));
  const color = escapeHtml(team?.color || "#D97757");
  const resolvedUrl = resolveTeamIcon(team);
  const isSvg = Boolean(resolvedUrl && /\.svg(?:$|[?#])/i.test(resolvedUrl));
  const cls = ["team-avatar", sizeClass, isSvg ? "has-svg" : ""].filter(Boolean).join(" ");
  if (resolvedUrl) {
    const imgUrl = escapeHtml(resolvedUrl);
    return `<div class="${cls}" style="--team-color: ${color}; border-color: ${color}; background-color: ${color}">
      <span class="team-avatar-initials">${initials}</span>
      <img class="${isSvg ? "team-avatar-svg" : ""}" src="${imgUrl}" alt="" onload="this.parentElement.classList.add('has-image');if(this.previousElementSibling)this.previousElementSibling.style.display='none'" onerror="this.remove()" />
    </div>`;
  }
  return `<div class="${cls}" style="--team-color: ${color}; border-color: ${color}; background-color: ${color}">${initials}</div>`;
}

/**
 * Shortens Vietnamese police team names for display in narrow lists:
 * - Strips leading "Công an tỉnh ", "Công an TP. ", "Công an thành phố ".
 * - T06 shows "T06".
 * - Team names without these prefixes are left unchanged.
 *
 * @param {string} name
 * @returns {string}
 */
export function shortenTeamName(name) {
  if (!name || typeof name !== "string") {
    return "";
  }
  const trimmed = name.trim();
  if (!trimmed) {
    return "";
  }
  if (/\bT06\b/i.test(trimmed)) {
    return "T06";
  }
  return trimmed.replace(/^công an\s+(?:thành phố|tp\.?|tỉnh)\s+/i, "").trim();
}

/**
 * Formats a duration in seconds with Vietnamese comma decimal and 's' suffix,
 * matching the brief format (e.g. "12,34 s").
 * @param {number} sec
 * @returns {string}
 */
export function formatSeconds(sec) {
  const s = Number(sec) || 0;
  return s.toFixed(2).replace(".", ",") + " s";
}

/**
 * Generates 1-2 character uppercase initials from a Vietnamese team name.
 * Strips common generic prefixes like "Đội" when additional words exist.
 * @param {string} name
 * @returns {string}
 */
export function getTeamInitials(name) {
  if (!name || typeof name !== "string") {
    return "?";
  }
  const cleaned = name
    .trim()
    .replace(/[-–—_/:()[\]]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return "?";
  }

  if (/\bT06\b/i.test(cleaned)) {
    return "T06";
  }

  // Police teams are named "Công an TP. X" / "Công an tỉnh X": use the place name.
  const place = cleaned
    .replace(/^công an\s+(thành phố|tp\.?|tỉnh)\s+/i, "")
    .trim();
  if (place !== cleaned && place) {
    const placeWords = place.split(" ").filter(Boolean);
    if (placeWords.length === 1) {
      return placeWords[0].slice(0, 2).toUpperCase();
    }
    return placeWords.slice(0, 3).map((w) => w[0]).join("").toUpperCase();
  }

  const words = cleaned.split(" ").filter(Boolean);
  if (words.length === 1) {
    return (words[0].length <= 3 ? words[0] : words[0].slice(0, 2)).toUpperCase();
  }

  const prefixes = new Set(["đội", "doi", "team", "nhóm", "nhom"]);
  const filtered =
    words.length > 2 && prefixes.has(words[0].toLowerCase()) ? words.slice(1) : words;

  const first = filtered[0][0] || "";
  const last = filtered[filtered.length - 1][0] || "";
  return (first + last).toUpperCase();
}

function resolveScoreKey(mode) {
  if (mode === 1 || mode === "1" || mode === "round1") return "round1";
  if (mode === 2 || mode === "2" || mode === "round2") return "round2";
  if (mode === 3 || mode === "3" || mode === "round3") return "round3";
  return "total";
}

/**
 * Computes a ranked leaderboard for Round 1, Round 2, Round 3, or Total.
 * Supports Điều 22 tie-breaking when options.tieBreak is true:
 * - Total tie-break: better Round 1 rank/score, then Round 3, then Round 2.
 * - Round 1/3 tie-break (Điều 21): higher content score first.
 * Teams with identical scores and tie-breakers share the same rank.
 *
 * @param {Array<{id: string, name: string, image_url?: string, color?: string}>} teams
 * @param {Record<string, any>} [stateOrScores]
 * @param {"round1"|"round2"|"round3"|"total"|1|2|3} [mode]
 * @param {{
 *   tieBreak?: boolean,
 *   contentScores?: { round1?: Record<string, number>, round3?: Record<string, number> }
 * }} [options]
 */
export function computeLeaderboard(teams = [], stateOrScores = {}, mode = "total", options = {}) {
  const scoresMap =
    stateOrScores && typeof stateOrScores === "object" && stateOrScores.scores && typeof stateOrScores.scores === "object"
      ? stateOrScores.scores
      : stateOrScores || {};

  const scoreKey = resolveScoreKey(mode);
  const tieBreak = Boolean(options && (options.tieBreak || options.useDieu22));
  const r1Content = options?.contentScores?.round1 || {};
  const r3Content = options?.contentScores?.round3 || {};
  const r2Stats = options?.round2Stats || (stateOrScores && stateOrScores.round2Stats) || {};

  const entries = teams.map((team, index) => {
    const raw = scoresMap[team.id] || {};
    const round1 = Number(raw.round1) || 0;
    const round2 = Number(raw.round2) || 0;
    const round3 = Number(raw.round3) || 0;
    const total = Math.round((round1 + round2 + round3) * 100) / 100;

    const r2Stat = r2Stats[team.id] || raw.round2Stats || raw;
    const round2TimeMs = Number(r2Stat.totalCorrectTimeMs ?? r2Stat.round2TimeMs) || 0;
    const round2Fastest = Number(r2Stat.fastestCount ?? r2Stat.round2Fastest) || 0;
    const round2Seconds = r2Stat.round2Seconds !== undefined
      ? Number(r2Stat.round2Seconds)
      : r2Stat.totalCorrectTimeSeconds !== undefined
        ? Number(r2Stat.totalCorrectTimeSeconds)
        : Math.round((round2TimeMs / 1000) * 100) / 100;

    const score =
      scoreKey === "round1"
        ? round1
        : scoreKey === "round2"
          ? round2
          : scoreKey === "round3"
            ? round3
            : total;

    return {
      id: team.id,
      name: team.name,
      image_url: team.image_url || "",
      color: team.color || TEAM_PALETTE[index % TEAM_PALETTE.length],
      initials: getTeamInitials(team.name),
      round1,
      round2,
      round3,
      r1Content: Number(r1Content[team.id]) || 0,
      r3Content: Number(r3Content[team.id]) || 0,
      round2TimeMs,
      round2Fastest,
      round2Seconds,
      total,
      score,
      rank: 1,
      _originalIndex: index
    };
  });

  entries.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    if (tieBreak) {
      if (scoreKey === "total") {
        // Điều 22: Better Round 1 rank/score first
        if (b.round1 !== a.round1) {
          return b.round1 - a.round1;
        }
        if (b.r1Content !== a.r1Content) {
          return b.r1Content - a.r1Content;
        }
        // Then better Round 3 rank/score
        if (b.round3 !== a.round3) {
          return b.round3 - a.round3;
        }
        if (b.r3Content !== a.r3Content) {
          return b.r3Content - a.r3Content;
        }
        // Then better Round 2 rank/score
        if (b.round2 !== a.round2) {
          return b.round2 - a.round2;
        }
      } else if (scoreKey === "round1") {
        if (b.r1Content !== a.r1Content) {
          return b.r1Content - a.r1Content;
        }
      } else if (scoreKey === "round2") {
        // Điều 21.2: most fastest answers first, then shorter total time.
        if (b.round2Fastest !== a.round2Fastest) {
          return b.round2Fastest - a.round2Fastest;
        }
        if (a.round2TimeMs !== b.round2TimeMs) {
          return a.round2TimeMs - b.round2TimeMs;
        }
      } else if (scoreKey === "round3") {
        if (b.r3Content !== a.r3Content) {
          return b.r3Content - a.r3Content;
        }
      }
    }

    if (b.total !== a.total) {
      return b.total - a.total;
    }
    return a._originalIndex - b._originalIndex;
  });

  for (let i = 0; i < entries.length; i++) {
    const curr = entries[i];
    if (curr.score <= 0) {
      curr.rank = null;
    } else if (i === 0) {
      curr.rank = 1;
    } else {
      const prev = entries[i - 1];
      let isIdentical = curr.score === prev.score;

      if (tieBreak && isIdentical) {
        if (scoreKey === "total") {
          isIdentical =
            curr.round1 === prev.round1 &&
            curr.r1Content === prev.r1Content &&
            curr.round3 === prev.round3 &&
            curr.r3Content === prev.r3Content &&
            curr.round2 === prev.round2;
        } else if (scoreKey === "round1") {
          isIdentical = curr.round1 === prev.round1 && curr.r1Content === prev.r1Content;
        } else if (scoreKey === "round2") {
          isIdentical = curr.round2Fastest === prev.round2Fastest && curr.round2TimeMs === prev.round2TimeMs;
        } else if (scoreKey === "round3") {
          isIdentical = curr.round3 === prev.round3 && curr.r3Content === prev.r3Content;
        }
      }

      if (isIdentical && prev.rank !== null) {
        curr.rank = prev.rank;
      } else {
        curr.rank = i + 1;
      }
    }
    delete entries[i]._originalIndex;
  }

  return entries;
}

/**
 * Maps ranked leaderboard entries into left-to-right trophy podium slots (4 - 2 - 1 - 3 - 5).
 * - For fewer than 5 teams (1-4), returns only existing places in that relative left-to-right order.
 * - While nobody has points, returns empty array so podium displays waiting message.
 * - Placement follows sorted order (`slot` = 1..5), while `rank` keeps shared ranks for ties.
 * @param {Array<Record<string, any>>} [rankedEntries]
 * @returns {Array<Record<string, any> & {slot: number, rank: number, trophy: "gold"|"silver"|"bronze"|"clay"}>}
 */
export function buildPodiumSlots(rankedEntries = []) {
  const hasAnyScore = Array.isArray(rankedEntries) && rankedEntries.some((e) => Number(e?.score) > 0);
  if (!hasAnyScore) {
    return [];
  }
  const top = Array.isArray(rankedEntries)
    ? rankedEntries.filter((e) => Number(e?.score) > 0).slice(0, 5)
    : [];
  return PODIUM_SLOT_ORDER
    .filter((slot) => slot <= top.length)
    .map((slot) => {
      const entry = top[slot - 1];
      const rank = entry?.rank ?? slot;
      const trophy =
        slot === 1 ? "gold" : slot === 2 ? "silver" : slot === 3 ? "bronze" : "clay";
      return {
        ...entry,
        slot,
        rank,
        trophy
      };
    });
}

export const mapToPodiumSlots = buildPodiumSlots;
export const getPodiumSlots = buildPodiumSlots;

/**
 * Pure diff helper used by the live leaderboard FLIP animation:
 * Detects which rows moved, their old and new positions, and which scores changed.
 *
 * @param {Array<{id: string, score: number, rank: number}>} prevEntries
 * @param {Array<{id: string, score: number, rank: number}>} nextEntries
 * @returns {{
 *   moved: Array<{id: string, oldIndex: number, newIndex: number, direction: "up"|"down"|"same"}>,
 *   changedScores: Array<{id: string, oldScore: number, newScore: number, delta: number}>,
 *   hasChanged: boolean
 * }}
 */
export function diffLeaderboard(prevEntries = [], nextEntries = []) {
  const prevMap = new Map();
  for (let i = 0; i < prevEntries.length; i++) {
    const item = prevEntries[i];
    if (item && item.id) {
      prevMap.set(item.id, { index: i, score: Number(item.score) || 0, rank: item.rank });
    }
  }

  const moved = [];
  const changedScores = [];
  let hasChanged = false;

  for (let i = 0; i < nextEntries.length; i++) {
    const item = nextEntries[i];
    if (!item || !item.id) continue;
    const prev = prevMap.get(item.id);
    const newScore = Number(item.score) || 0;

    if (!prev) {
      hasChanged = true;
      moved.push({ id: item.id, oldIndex: -1, newIndex: i, direction: "up" });
      changedScores.push({ id: item.id, oldScore: 0, newScore, delta: newScore });
    } else {
      if (prev.index !== i) {
        hasChanged = true;
        const direction = i < prev.index ? "up" : "down";
        moved.push({ id: item.id, oldIndex: prev.index, newIndex: i, direction });
      } else {
        moved.push({ id: item.id, oldIndex: i, newIndex: i, direction: "same" });
      }

      if (prev.score !== newScore) {
        hasChanged = true;
        changedScores.push({
          id: item.id,
          oldScore: prev.score,
          newScore,
          delta: Math.round((newScore - prev.score) * 100) / 100
        });
      }
    }
  }

  return {
    moved,
    changedScores,
    hasChanged
  };
}

/**
 * Computes shared scoreboard rows in rank order.
 * Given teams and scores (including round 2 answer times), it returns rows in rank order
 * with r1, r2, r3, total and round 2 seconds; ties ordered as today.
 *
 * @param {Array<{id: string, name: string, image_url?: string, color?: string}>} teams
 * @param {Record<string, any>} [stateOrScores]
 * @param {{
 *   round2Stats?: Record<string, any>,
 *   mode?: "total"|"round1"|"round2"|"round3",
 *   tieBreak?: boolean
 * }} [options]
 * @returns {Array<Record<string, any>>}
 */
export function buildScoreboardRows(teams = [], stateOrScores = {}, options = {}) {
  const ranked = computeLeaderboard(teams, stateOrScores, options.mode || "total", {
    tieBreak: true,
    ...options
  });
  return ranked.map((entry) => ({
    ...entry,
    team: {
      id: entry.id,
      name: entry.name,
      image_url: entry.image_url,
      color: entry.color,
      initials: entry.initials
    },
    r1: entry.round1,
    r2: entry.round2,
    r3: entry.round3,
    total: entry.total,
    round2Seconds: entry.round2Seconds,
    r2Seconds: entry.round2Seconds
  }));
}

/**
 * Shared scoreboard table renderer used across the leaderboard drawer,
 * leaderboard page, and round 2 stats modal.
 *
 * Structure: rank, team (avatar + name), Vòng 1, Vòng 2, Vòng 3, Tổng,
 * and for round 2 the total answer time in seconds (the tie-breaker).
 *
 * @param {Array<Record<string, any>>} rows - Scoreboard rows from buildScoreboardRows
 * @param {{
 *   tableClass?: string,
 *   wrapClass?: string,
 *   shortenName?: boolean,
 *   highlightMode?: string
 * }} [options]
 * @returns {string} HTML table string
 */
export function renderScoreboardTableHtml(rows = [], options = {}) {
  const {
    tableClass = "scoreboard-table",
    wrapClass = "scoreboard-table-wrap",
    shortenName = false,
    highlightMode = null
  } = options;

  const rowList = Array.isArray(rows) ? rows : [];

  const trs = rowList.map((entry) => {
    const rankStr = entry.rank != null ? `#${entry.rank}` : "–";
    const rankClass = entry.rank === 1 ? "top-1" : entry.rank === 2 ? "top-2" : entry.rank === 3 ? "top-3" : "";
    const teamName = shortenName ? shortenTeamName(entry.name) : (entry.name || "");
    const avatarHtml = renderAvatarHtml(entry, "team-avatar-sm");

    const r1 = entry.r1 ?? entry.round1 ?? 0;
    const r2 = entry.r2 ?? entry.round2 ?? 0;
    const r3 = entry.r3 ?? entry.round3 ?? 0;
    const total = entry.total ?? (r1 + r2 + r3);
    const r2Sec = entry.round2Seconds ?? entry.r2Seconds ?? 0;
    const r2SecHtml = (r2Sec !== undefined && r2Sec !== null && Number(r2Sec) > 0)
      ? ` <span class="scoreboard-r2-time">(${formatSeconds(r2Sec)})</span>`
      : "";

    return `
      <tr class="scoreboard-row ${rankClass}" data-team-id="${escapeHtml(entry.id)}">
        <td class="col-rank">
          <span class="scoreboard-rank-badge ${rankClass}">${rankStr}</span>
        </td>
        <td class="col-team">
          <div class="scoreboard-team-cell">
            ${avatarHtml}
            <span class="scoreboard-team-name" title="${escapeHtml(entry.name)}">${escapeHtml(teamName)}</span>
          </div>
        </td>
        <td class="col-round col-r1 ${highlightMode === "round1" ? "active-col" : ""}">
          <span class="scoreboard-score">${r1}</span>
        </td>
        <td class="col-round col-r2 ${highlightMode === "round2" ? "active-col" : ""}">
          <div class="scoreboard-r2-cell">
            <span class="scoreboard-score">${r2}</span>${r2SecHtml}
          </div>
        </td>
        <td class="col-round col-r3 ${highlightMode === "round3" ? "active-col" : ""}">
          <span class="scoreboard-score">${r3}</span>
        </td>
        <td class="col-total ${highlightMode === "total" ? "active-col" : ""}">
          <strong class="scoreboard-total-score">${total}</strong>
        </td>
      </tr>
    `;
  }).join("");

  return `
    <div class="${wrapClass}">
      <table class="${tableClass}">
        <thead>
          <tr>
            <th class="col-rank">Hạng</th>
            <th class="col-team">Đội thi</th>
            <th class="col-round col-r1">Vòng 1</th>
            <th class="col-round col-r2">Vòng 2</th>
            <th class="col-round col-r3">Vòng 3</th>
            <th class="col-total">Tổng</th>
          </tr>
        </thead>
        <tbody>
          ${trs || `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">Chưa có dữ liệu</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

