// Leaderboard ranking, trophy podium slot mapping, Điều 22 tie-break,
// animation diff helper, team name shortening, and team avatar helpers (DOM-free).

import { TEAM_PALETTE } from "./config.js";

export const PODIUM_SLOT_ORDER = [4, 2, 1, 3, 5];

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

    const r2Stat = r2Stats[team.id] || {};
    const round2TimeMs = Number(r2Stat.totalCorrectTimeMs) || 0;
    const round2Fastest = Number(r2Stat.fastestCount) || 0;
    const round2Seconds = r2Stat.totalCorrectTimeSeconds !== undefined
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
