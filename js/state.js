// Pure game state management for Round 1, Round 2, Round 3, judge scores,
// penalties, locks, and live sync (DOM-free).

import { getOfferedPackages } from "./data.js";
import { calculateTeamRoundScore } from "./judges.js";
import { calculateRound2Score } from "./round2.js";

function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

function normaliseRoundKey(round) {
  if (round === 1 || round === "1" || round === "round1") return "round1";
  if (round === 2 || round === "2" || round === "round2") return "round2";
  if (round === 3 || round === "3" || round === "round3") return "round3";
  throw new Error(`Invalid round: ${round}`);
}

function ensureTeamEntry(scores, teamId) {
  if (!scores[teamId]) {
    scores[teamId] = { round1: 0, round2: 0, round3: 0 };
  } else {
    scores[teamId] = {
      round1: Number(scores[teamId].round1) || 0,
      round2: Number(scores[teamId].round2) || 0,
      round3: Number(scores[teamId].round3) || 0
    };
  }
}

/**
 * Creates a fresh initial game state.
 * @param {Array<{id: string}>} [teams]
 */
export function createInitialState(teams = []) {
  const scores = {};
  for (const team of teams) {
    if (team && team.id) {
      scores[String(team.id).trim()] = { round1: 0, round2: 0, round3: 0 };
    }
  }

  return {
    version: 2,
    currentRound: "round1",
    scores,
    answeredQuestions: {},
    judgeScores: {
      round1: {},
      round3: {}
    },
    penalties: {
      round1: {},
      round3: {}
    },
    manualOverrides: {
      round2: {}
    },
    round1: {
      lockedTeams: [],
      pickedPackages: [],
      teamPackages: {},
      activeSession: null
    },
    round2: {
      activeSet: "1",
      currentQuestionIndex: 0,
      activeQuestion: null,
      shownAt: null,
      deadline: null,
      answers: {},
      results: null,
      history: []
    },
    round3: {
      openedTiles: [],
      activeTile: null
    }
  };
}

/**
 * Synchronises an existing state object with a list of teams without losing existing scores or progress.
 * @param {object} state
 * @param {Array<{id: string}>} [teams]
 */
export function syncStateWithTeams(state, teams = []) {
  const next = state ? importState(exportState(state)) : createInitialState(teams);
  for (const team of teams) {
    if (team && team.id) {
      ensureTeamEntry(next.scores, String(team.id).trim());
    }
  }
  return next;
}

/**
 * Checks whether a team has completed Round 1 and is locked.
 * @param {object} state
 * @param {string} teamId
 * @returns {boolean}
 */
export function isTeamLocked(state, teamId) {
  return Boolean(state?.round1?.lockedTeams?.includes(teamId));
}

/**
 * Checks whether a Round 1 package has already been picked.
 * @param {object} state
 * @param {string} packageId
 * @returns {boolean}
 */
export function isPackagePicked(state, packageId) {
  return Boolean(state?.round1?.pickedPackages?.includes(packageId));
}

/**
 * Returns the Round 1 packages available to be offered to `teamId` given current state.
 * @param {object} state
 * @param {Array<any>} packages
 * @param {string} teamId
 * @param {number|null} [limit]
 */
export function getAvailableRound1Packages(state, packages, teamId, limit = null) {
  const picked = state?.round1?.pickedPackages || [];
  return getOfferedPackages(packages, teamId, picked, limit);
}

/**
 * Picks a Round 1 package for a team, locking that package from other teams and starting an active session.
 * @param {object} state
 * @param {string} teamId
 * @param {string} packageId
 */
export function pickRound1Package(state, teamId, packageId) {
  const next = cloneState(state);
  ensureTeamEntry(next.scores, teamId);

  if (next.round1.lockedTeams.includes(teamId)) {
    throw new Error(`Team "${teamId}" is already locked in Round 1.`);
  }

  const alreadyPickedByOther =
    next.round1.pickedPackages.includes(packageId) &&
    next.round1.teamPackages?.[teamId] !== packageId;

  if (alreadyPickedByOther) {
    throw new Error(`Package "${packageId}" has already been picked.`);
  }

  if (!next.round1.pickedPackages.includes(packageId)) {
    next.round1.pickedPackages.push(packageId);
  }
  if (!next.round1.teamPackages) {
    next.round1.teamPackages = {};
  }
  next.round1.teamPackages[teamId] = packageId;

  next.round1.activeSession = {
    teamId,
    packageId,
    questionIndex: 0,
    revealed: false
  };

  return next;
}

/**
 * Updates the active Round 1 session (e.g. moving to next question or revealing answer).
 * @param {object} state
 * @param {Partial<{questionIndex: number, revealed: boolean}>} patch
 */
export function updateRound1Session(state, patch = {}) {
  const next = cloneState(state);
  if (!next.round1.activeSession) {
    return next;
  }
  next.round1.activeSession = {
    ...next.round1.activeSession,
    ...patch
  };
  return next;
}

/**
 * Cancels the active Round 1 question session and returns to the team list
 * without locking the team (releasing the picked package).
 * @param {object} state
 * @param {{releasePackage?: boolean}} [options]
 */
export function cancelRound1Session(state, { releasePackage = true } = {}) {
  const next = cloneState(state);
  const session = next.round1.activeSession;
  if (!session) {
    return next;
  }
  if (releasePackage && session.packageId) {
    next.round1.pickedPackages = next.round1.pickedPackages.filter(
      (p) => p !== session.packageId
    );
    if (next.round1.teamPackages && session.teamId) {
      delete next.round1.teamPackages[session.teamId];
    }
  }
  next.round1.activeSession = null;
  return next;
}

/**
 * Clears an unstarted/aborted Round 1 team selection before a package is finished,
 * or finishes the package and locks the team.
 * @param {object} state
 * @param {string} [teamId]
 */
export function finishRound1Package(state, teamId) {
  const next = cloneState(state);
  const targetTeamId = teamId || next.round1.activeSession?.teamId;
  if (!targetTeamId) {
    return next;
  }

  ensureTeamEntry(next.scores, targetTeamId);
  if (!next.round1.lockedTeams.includes(targetTeamId)) {
    next.round1.lockedTeams.push(targetTeamId);
  }

  if (next.round1.activeSession?.teamId === targetTeamId) {
    next.round1.activeSession = null;
  }

  return next;
}

/**
 * Checks whether a Round 3 tile is marked opened.
 * @param {object} state
 * @param {number} tileNumber
 * @returns {boolean}
 */
export function isTileOpened(state, tileNumber) {
  const num = Number(tileNumber);
  return Boolean(state?.round3?.openedTiles?.includes(num));
}

/**
 * Opens a Round 3 tile and marks it opened.
 * @param {object} state
 * @param {number} tileNumber
 * @param {string|null} [selectedTeamId]
 */
export function openRound3Tile(state, tileNumber, selectedTeamId = null) {
  const next = cloneState(state);
  const num = Number(tileNumber);
  if (!Number.isFinite(num)) {
    throw new Error(`Invalid tile number: ${tileNumber}`);
  }

  if (!next.round3.openedTiles.includes(num)) {
    next.round3.openedTiles.push(num);
  }

  next.round3.activeTile = {
    number: num,
    selectedTeamId: selectedTeamId || null,
    revealed: false
  };

  return next;
}

/**
 * Updates the active Round 3 tile session (e.g. changing answering team or revealing answer).
 * @param {object} state
 * @param {Partial<{selectedTeamId: string|null, revealed: boolean}>} patch
 */
export function updateRound3TileSession(state, patch = {}) {
  const next = cloneState(state);
  if (!next.round3.activeTile) {
    return next;
  }
  next.round3.activeTile = {
    ...next.round3.activeTile,
    ...patch
  };
  return next;
}

/**
 * Closes the active Round 3 tile view (keeping the tile marked opened).
 * @param {object} state
 */
export function closeRound3Tile(state) {
  const next = cloneState(state);
  next.round3.activeTile = null;
  return next;
}

/**
 * Records a Correct/Wrong answer for a team in a given round.
 * @param {object} state
 * @param {{round: number|string, teamId: string, points: number, correct: boolean, questionKey?: string}} params
 */
export function recordAnswer(state, { round, teamId, points, correct, questionKey } = {}) {
  if (!teamId) {
    throw new Error("teamId is required to record an answer.");
  }
  const roundKey = normaliseRoundKey(round);
  const numericPoints = Number(points) || 0;
  const isCorrect = Boolean(correct);

  const next = cloneState(state);
  ensureTeamEntry(next.scores, teamId);
  if (!next.answeredQuestions) {
    next.answeredQuestions = {};
  }

  if (questionKey !== undefined && questionKey !== null && String(questionKey) !== "") {
    const key = String(questionKey);
    const prev = next.answeredQuestions[key];
    if (prev && prev.correct && prev.teamId && prev.roundKey) {
      ensureTeamEntry(next.scores, prev.teamId);
      next.scores[prev.teamId][prev.roundKey] -= Number(prev.points) || 0;
    }

    if (isCorrect) {
      next.scores[teamId][roundKey] += numericPoints;
    }

    next.answeredQuestions[key] = {
      roundKey,
      teamId,
      points: numericPoints,
      correct: isCorrect
    };
  } else {
    if (isCorrect) {
      next.scores[teamId][roundKey] += numericPoints;
    }
  }

  return next;
}

/**
 * Sets a team's score for a specific round (1, 2, or 3).
 * @param {object} state
 * @param {string} teamId
 * @param {number|string} round
 * @param {number} score
 */
export function setRoundScore(state, teamId, round, score) {
  const roundKey = normaliseRoundKey(round);
  const next = cloneState(state);
  ensureTeamEntry(next.scores, teamId);
  next.scores[teamId][roundKey] = Number(score) || 0;
  return next;
}

/**
 * Convenience helper to set a team's manual Round 2 score.
 * @param {object} state
 * @param {string} teamId
 * @param {number} score
 */
export function setRound2Score(state, teamId, score) {
  const next = setRoundScore(state, teamId, 2, score);
  if (!next.manualOverrides) next.manualOverrides = {};
  if (!next.manualOverrides.round2) next.manualOverrides.round2 = {};
  next.manualOverrides.round2[teamId] = Number(score) || 0;
  return next;
}

/**
 * Adjusts a team's score in a round by a delta (+ or -).
 * @param {object} state
 * @param {string} teamId
 * @param {number|string} round
 * @param {number} delta
 */
export function adjustRoundScore(state, teamId, round, delta) {
  const roundKey = normaliseRoundKey(round);
  const next = cloneState(state);
  ensureTeamEntry(next.scores, teamId);
  next.scores[teamId][roundKey] += Number(delta) || 0;
  return next;
}

/**
 * Sets a judge score for a team in Round 1 or Round 3.
 * @param {object} state
 * @param {{
 *   round: "round1"|"round3"|1|3,
 *   teamId: string,
 *   judgeId: string,
 *   content: number,
 *   manner: number
 * }} params
 */
export function setJudgeScore(state, { round, teamId, judgeId, content, manner }) {
  const roundKey = normaliseRoundKey(round);
  const next = cloneState(state);
  if (!next.judgeScores) next.judgeScores = { round1: {}, round3: {} };
  if (!next.judgeScores[roundKey]) next.judgeScores[roundKey] = {};
  if (!next.judgeScores[roundKey][teamId]) next.judgeScores[roundKey][teamId] = {};

  next.judgeScores[roundKey][teamId][judgeId] = {
    content: Number(content) || 0,
    manner: Number(manner) || 0
  };

  return next;
}

/**
 * Sets a team's penalty for overtime or infractions (Điều 19).
 * @param {object} state
 * @param {{
 *   round: "round1"|"round3"|1|3,
 *   teamId: string,
 *   penalty: number
 * }} params
 */
export function setTeamPenalty(state, { round, teamId, penalty }) {
  const roundKey = normaliseRoundKey(round);
  const next = cloneState(state);
  if (!next.penalties) next.penalties = { round1: {}, round3: {} };
  if (!next.penalties[roundKey]) next.penalties[roundKey] = {};
  next.penalties[roundKey][teamId] = Math.max(0, Number(penalty) || 0);
  return next;
}

/**
 * Unlocks a locked Round 1 team (and optionally unlocks the package they picked).
 * @param {object} state
 * @param {string} teamId
 * @param {{unlockPackage?: boolean}} [options]
 */
export function unlockRound1Team(state, teamId, { unlockPackage = false } = {}) {
  const next = cloneState(state);
  next.round1.lockedTeams = next.round1.lockedTeams.filter((id) => id !== teamId);

  if (unlockPackage && next.round1.teamPackages?.[teamId]) {
    const pkgId = next.round1.teamPackages[teamId];
    next.round1.pickedPackages = next.round1.pickedPackages.filter((p) => p !== pkgId);
    delete next.round1.teamPackages[teamId];
  }

  return next;
}

/**
 * Unlocks a picked Round 1 package so it returns to the pool.
 * @param {object} state
 * @param {string} packageId
 */
export function unlockRound1Package(state, packageId) {
  const next = cloneState(state);
  next.round1.pickedPackages = next.round1.pickedPackages.filter((p) => p !== packageId);
  if (next.round1.teamPackages) {
    for (const [tId, pId] of Object.entries(next.round1.teamPackages)) {
      if (pId === packageId) {
        delete next.round1.teamPackages[tId];
      }
    }
  }
  return next;
}

/**
 * Unlocks an opened Round 3 tile.
 * @param {object} state
 * @param {number} tileNumber
 */
export function unlockRound3Tile(state, tileNumber) {
  const num = Number(tileNumber);
  const next = cloneState(state);
  next.round3.openedTiles = next.round3.openedTiles.filter((t) => t !== num);
  if (next.round3.activeTile?.number === num) {
    next.round3.activeTile = null;
  }
  return next;
}

/**
 * Resets the entire game state back to initial.
 * @param {Array<{id: string}>} [teams]
 */
export function resetState(teams = []) {
  return createInitialState(teams);
}

/**
 * Serialises state to JSON string for backup/export.
 * @param {object} state
 * @returns {string}
 */
export function exportState(state) {
  return JSON.stringify(state, null, 2);
}

/**
 * Restores and validates a game state from a JSON string.
 * @param {string} jsonString
 */
export function importState(jsonString) {
  if (typeof jsonString !== "string" || !jsonString.trim()) {
    throw new Error("Invalid state JSON: input must be a non-empty string.");
  }
  const parsed = JSON.parse(jsonString);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid state JSON: root must be an object.");
  }

  const scores = {};
  if (parsed.scores && typeof parsed.scores === "object") {
    for (const [teamId, entry] of Object.entries(parsed.scores)) {
      scores[teamId] = {
        round1: Number(entry?.round1) || 0,
        round2: Number(entry?.round2) || 0,
        round3: Number(entry?.round3) || 0
      };
    }
  }

  return {
    version: Number(parsed.version) || 2,
    currentRound: parsed.currentRound || "round1",
    scores,
    answeredQuestions:
      parsed.answeredQuestions && typeof parsed.answeredQuestions === "object"
        ? { ...parsed.answeredQuestions }
        : {},
    judgeScores:
      parsed.judgeScores && typeof parsed.judgeScores === "object"
        ? { ...parsed.judgeScores }
        : { round1: {}, round3: {} },
    penalties:
      parsed.penalties && typeof parsed.penalties === "object"
        ? { ...parsed.penalties }
        : { round1: {}, round3: {} },
    manualOverrides:
      parsed.manualOverrides && typeof parsed.manualOverrides === "object"
        ? { ...parsed.manualOverrides }
        : { round2: {} },
    round1: {
      lockedTeams: Array.isArray(parsed.round1?.lockedTeams)
        ? parsed.round1.lockedTeams.map(String)
        : [],
      pickedPackages: Array.isArray(parsed.round1?.pickedPackages)
        ? parsed.round1.pickedPackages.map(String)
        : [],
      teamPackages:
        parsed.round1?.teamPackages && typeof parsed.round1.teamPackages === "object"
          ? { ...parsed.round1.teamPackages }
          : {},
      activeSession: parsed.round1?.activeSession || null
    },
    round2: {
      activeSet: String(parsed.round2?.activeSet || "1"),
      currentQuestionIndex: Number(parsed.round2?.currentQuestionIndex) || 0,
      activeQuestion: parsed.round2?.activeQuestion || null,
      shownAt: parsed.round2?.shownAt || null,
      deadline: parsed.round2?.deadline || null,
      answers: parsed.round2?.answers || {},
      results: parsed.round2?.results || null,
      history: Array.isArray(parsed.round2?.history) ? parsed.round2.history : []
    },
    round3: {
      openedTiles: Array.isArray(parsed.round3?.openedTiles)
        ? parsed.round3.openedTiles.map(Number).filter(Number.isFinite)
        : [],
      activeTile: parsed.round3?.activeTile || null
    }
  };
}

/**
 * Pure function deriving each team's round1, round2, round3, and total scores
 * from the authoritative live data:
 * - Round 1: average of judges who scored (content + manner) minus penalty (or existing score if no judges)
 * - Round 2: stored round-2 score unless manual override exists
 * - Round 3: average of judges who scored (content + manner) minus penalty (or existing score if no judges)
 * - Total: round1 + round2 + round3
 *
 * @param {{
 *   teams?: Array<{id: string, name?: string}>,
 *   live?: Record<string, any>,
 *   config?: Record<string, any>
 * }} params
 * @returns {Record<string, {round1: number, round2: number, round3: number, total: number}>}
 */
export function computeTeamScores({ teams = [], live = {}, config = {} } = {}) {
  const result = {};
  const cfg = config || {};
  const maxContentR1 = Number(cfg.round1_max_content) || 45;
  const maxMannerR1 = Number(cfg.round1_max_manner) || 5;
  const maxContentR3 = Number(cfg.round3_max_content) || 25;
  const maxMannerR3 = Number(cfg.round3_max_manner) || 5;

  for (const team of teams) {
    if (!team || !team.id) continue;
    const teamId = team.id;

    // Round 1
    const r1Judges = live?.judgeScores?.round1?.[teamId] || {};
    const r1Penalty = Number(live?.penalties?.round1?.[teamId]) || 0;
    const r1Calc = calculateTeamRoundScore({
      judgeScores: r1Judges,
      penalty: r1Penalty,
      maxContent: maxContentR1,
      maxManner: maxMannerR1
    });

    let r1Final = r1Calc.finalScore;
    if (r1Calc.judgeCount === 0 && r1Penalty === 0 && live?.scores?.[teamId]?.round1 !== undefined) {
      r1Final = Number(live.scores[teamId].round1) || 0;
    }

    // Round 2: manual override takes precedence over stored round2 score
    let r2Final = Number(live?.scores?.[teamId]?.round2) || 0;
    const r2Override = live?.manualOverrides?.round2?.[teamId];
    if (r2Override !== undefined && r2Override !== null && String(r2Override).trim() !== "") {
      r2Final = Number(r2Override) || 0;
    }

    // Round 3
    const r3Judges = live?.judgeScores?.round3?.[teamId] || {};
    const r3Penalty = Number(live?.penalties?.round3?.[teamId]) || 0;
    const r3Calc = calculateTeamRoundScore({
      judgeScores: r3Judges,
      penalty: r3Penalty,
      maxContent: maxContentR3,
      maxManner: maxMannerR3
    });

    let r3Final = r3Calc.finalScore;
    if (r3Calc.judgeCount === 0 && r3Penalty === 0 && live?.scores?.[teamId]?.round3 !== undefined) {
      r3Final = Number(live.scores[teamId].round3) || 0;
    }

    const total = Math.round((r1Final + r2Final + r3Final) * 100) / 100;

    result[teamId] = {
      round1: r1Final,
      round2: r2Final,
      round3: r3Final,
      total
    };
  }

  return result;
}
