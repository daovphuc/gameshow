// Leaderboard ranking, trophy podium slot mapping, and team avatar helpers (DOM-free).

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
 * Ties share the same rank; teams without scores are included with 0.
 * @param {Array<{id: string, name: string, image_url?: string, color?: string}>} teams
 * @param {Record<string, any>} [stateOrScores]
 * @param {"round1"|"round2"|"round3"|"total"|1|2|3} [mode]
 */
export function computeLeaderboard(teams = [], stateOrScores = {}, mode = "total") {
  const scoresMap =
    stateOrScores && typeof stateOrScores === "object" && stateOrScores.scores && typeof stateOrScores.scores === "object"
      ? stateOrScores.scores
      : stateOrScores || {};

  const scoreKey = resolveScoreKey(mode);

  const entries = teams.map((team, index) => {
    const raw = scoresMap[team.id] || {};
    const round1 = Number(raw.round1) || 0;
    const round2 = Number(raw.round2) || 0;
    const round3 = Number(raw.round3) || 0;
    const total = round1 + round2 + round3;

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
    if (b.total !== a.total) {
      return b.total - a.total;
    }
    return a._originalIndex - b._originalIndex;
  });

  for (let i = 0; i < entries.length; i++) {
    if (i > 0 && entries[i].score === entries[i - 1].score) {
      entries[i].rank = entries[i - 1].rank;
    } else {
      entries[i].rank = i + 1;
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
