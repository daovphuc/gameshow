// Pure countdown timer logic (DOM-free).

export const DEFAULT_WARNING_SECONDS = 5;

/**
 * Computes remaining milliseconds from duration, start time, and current time.
 * Never returns below 0.
 * @param {number} durationSeconds
 * @param {number} startTimeMs
 * @param {number} nowMs
 * @returns {number}
 */
export function getRemainingMs(durationSeconds, startTimeMs, nowMs) {
  const durationMs = Math.max(0, (Number(durationSeconds) || 0) * 1000);
  const elapsedMs = Math.max(0, Number(nowMs) - Number(startTimeMs));
  return Math.max(0, durationMs - elapsedMs);
}

/**
 * Computes remaining whole seconds from duration, start time, and current time.
 * Never returns below 0.
 * @param {number} durationSeconds
 * @param {number} startTimeMs
 * @param {number} nowMs
 * @returns {number}
 */
export function getRemainingSeconds(durationSeconds, startTimeMs, nowMs) {
  const remainingMs = getRemainingMs(durationSeconds, startTimeMs, nowMs);
  return Math.ceil(remainingMs / 1000);
}

/**
 * Pure check for whether the timer is in the warning window:
 * true ONLY within the last `warningSeconds` and strictly before 0 (> 0).
 * @param {number} remainingSeconds
 * @param {number} [warningSeconds]
 * @returns {boolean}
 */
export function isTimerWarning(remainingSeconds, warningSeconds = DEFAULT_WARNING_SECONDS) {
  const rem = Number(remainingSeconds) || 0;
  const warn = Math.max(0, Number(warningSeconds) ?? DEFAULT_WARNING_SECONDS);
  return rem > 0 && rem <= warn;
}

/**
 * Creates an idle timer state for a given duration in seconds.
 * @param {number} durationSeconds
 * @param {number} [warningSeconds]
 */
export function createTimer(durationSeconds, warningSeconds = DEFAULT_WARNING_SECONDS) {
  const sec = Math.max(0, Number(durationSeconds) || 0);
  const warnSec = Math.max(0, Number(warningSeconds) ?? DEFAULT_WARNING_SECONDS);
  const durationMs = sec * 1000;
  return {
    durationSeconds: sec,
    durationMs,
    warningSeconds: warnSec,
    startedAt: null,
    remainingMs: durationMs,
    remainingSeconds: Math.ceil(sec),
    status: "idle",
    warning: false,
    finished: false
  };
}

/**
 * Starts the timer at `startTimeMs`.
 * If already finished, stays finished.
 * @param {object} timer
 * @param {number} startTimeMs
 */
export function startTimer(timer, startTimeMs) {
  if (!timer) {
    return createTimer(0);
  }
  const warnSec = timer.warningSeconds ?? DEFAULT_WARNING_SECONDS;
  if (timer.finished || timer.status === "finished") {
    return {
      ...timer,
      remainingMs: 0,
      remainingSeconds: 0,
      status: "finished",
      warning: false,
      finished: true
    };
  }
  if (timer.durationMs <= 0) {
    return {
      ...timer,
      startedAt: startTimeMs,
      remainingMs: 0,
      remainingSeconds: 0,
      status: "finished",
      warning: false,
      finished: true
    };
  }
  const remainingSeconds = Math.ceil(timer.durationMs / 1000);
  return {
    ...timer,
    startedAt: startTimeMs,
    remainingMs: timer.durationMs,
    remainingSeconds,
    status: "running",
    warning: isTimerWarning(remainingSeconds, warnSec),
    finished: false
  };
}

/**
 * Advances the timer to `nowMs`.
 * Once it reaches 0, it reports `finished: true` (`warning: false`) and stays finished.
 * @param {object} timer
 * @param {number} nowMs
 * @param {number} [warningSecondsOverride]
 */
export function tickTimer(timer, nowMs, warningSecondsOverride) {
  if (!timer) {
    return createTimer(0);
  }
  const warnSec =
    warningSecondsOverride !== undefined
      ? Math.max(0, Number(warningSecondsOverride) || 0)
      : timer.warningSeconds ?? DEFAULT_WARNING_SECONDS;

  if (timer.finished || timer.status === "finished") {
    return {
      ...timer,
      warningSeconds: warnSec,
      remainingMs: 0,
      remainingSeconds: 0,
      status: "finished",
      warning: false,
      finished: true
    };
  }
  if (timer.status !== "running" || timer.startedAt === null) {
    return { ...timer, warningSeconds: warnSec, warning: false };
  }

  const remainingMs = getRemainingMs(timer.durationSeconds, timer.startedAt, nowMs);
  const remainingSeconds = Math.ceil(remainingMs / 1000);

  if (remainingMs <= 0) {
    return {
      ...timer,
      warningSeconds: warnSec,
      remainingMs: 0,
      remainingSeconds: 0,
      status: "finished",
      warning: false,
      finished: true
    };
  }

  return {
    ...timer,
    warningSeconds: warnSec,
    remainingMs,
    remainingSeconds,
    status: "running",
    warning: isTimerWarning(remainingSeconds, warnSec),
    finished: false
  };
}

/**
 * Formats seconds as MM:SS for stage display.
 * @param {number} seconds
 * @returns {string}
 */
export function formatTimer(seconds) {
  const safe = Math.max(0, Math.ceil(Number(seconds) || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
