// Leaderboard ranking, trophy podium slot mapping, Điều 22 tie-break,
// animation diff helper, and team avatar helpers (DOM-free).

import { TEAM_PALETTE } from "./config.js";

export const PODIUM_SLOT_ORDER = [4, 2, 1, 3, 5];

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

  const words = cleaned.split(" ").filter(Boolean);
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
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

  const entries = teams.map((team, index) => {
    const raw = scoresMap[team.id] || {};
    const round1 = Number(raw.round1) || 0;
    const round2 = Number(raw.round2) || 0;
    const round3 = Number(raw.round3) || 0;
    const total = Math.round((round1 + round2 + round3) * 100) / 100;

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
    if (i === 0) {
      entries[i].rank = 1;
    } else {
      const prev = entries[i - 1];
      const curr = entries[i];
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
        } else if (scoreKey === "round3") {
          isIdentical = curr.round3 === prev.round3 && curr.r3Content === prev.r3Content;
        }
      }

      if (isIdentical) {
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
 * - Placement follows sorted order (`slot` = 1..5), while `rank` keeps shared ranks for ties.
 * @param {Array<Record<string, any>>} [rankedEntries]
 * @returns {Array<Record<string, any> & {slot: number, rank: number, trophy: "gold"|"silver"|"bronze"|"clay"}>}
 */
export function buildPodiumSlots(rankedEntries = []) {
  const top = Array.isArray(rankedEntries) ? rankedEntries.slice(0, 5) : [];
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
