// Pure countdown timer logic (DOM-free).

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
 * Creates an idle timer state for a given duration in seconds.
 * @param {number} durationSeconds
 */
export function createTimer(durationSeconds) {
  const sec = Math.max(0, Number(durationSeconds) || 0);
  const durationMs = sec * 1000;
  return {
    durationSeconds: sec,
    durationMs,
    startedAt: null,
    remainingMs: durationMs,
    remainingSeconds: Math.ceil(sec),
    status: "idle",
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
  if (timer.finished || timer.status === "finished") {
    return {
      ...timer,
      remainingMs: 0,
      remainingSeconds: 0,
      status: "finished",
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
      finished: true
    };
  }
  return {
    ...timer,
    startedAt: startTimeMs,
    remainingMs: timer.durationMs,
    remainingSeconds: Math.ceil(timer.durationMs / 1000),
    status: "running",
    finished: false
  };
}

/**
 * Advances the timer to `nowMs`.
 * Once it reaches 0, it reports `finished: true` and stays finished on any subsequent tick.
 * @param {object} timer
 * @param {number} nowMs
 */
export function tickTimer(timer, nowMs) {
  if (!timer) {
    return createTimer(0);
  }
  if (timer.finished || timer.status === "finished") {
    return {
      ...timer,
      remainingMs: 0,
      remainingSeconds: 0,
      status: "finished",
      finished: true
    };
  }
  if (timer.status !== "running" || timer.startedAt === null) {
    return { ...timer };
  }

  const remainingMs = getRemainingMs(timer.durationSeconds, timer.startedAt, nowMs);
  const remainingSeconds = Math.ceil(remainingMs / 1000);

  if (remainingMs <= 0) {
    return {
      ...timer,
      remainingMs: 0,
      remainingSeconds: 0,
      status: "finished",
      finished: true
    };
  }

  return {
    ...timer,
    remainingMs,
    remainingSeconds,
    status: "running",
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
