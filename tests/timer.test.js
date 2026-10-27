import test from "node:test";
import assert from "node:assert/strict";
import {
  createTimer,
  startTimer,
  tickTimer,
  getRemainingMs,
  getRemainingSeconds,
  isTimerWarning,
  formatTimer
} from "../js/timer.js";

test("timer computes remaining time from start and now, never goes below 0, and stays finished once at 0", () => {
  let timer = createTimer(15, 5);
  assert.equal(timer.remainingSeconds, 15);
  assert.equal(timer.warning, false);
  assert.equal(timer.finished, false);

  const startMs = 1000;
  timer = startTimer(timer, startMs);
  assert.equal(timer.status, "running");
  assert.equal(timer.warning, false);

  // 5 seconds elapsed -> 10s left (not in warning window)
  timer = tickTimer(timer, startMs + 5000);
  assert.equal(timer.remainingSeconds, 10);
  assert.equal(timer.warning, false);
  assert.equal(timer.finished, false);

  // 9.1 seconds elapsed -> 6s left (ceil(5.9s) = 6s, still above 5s warning_seconds)
  timer = tickTimer(timer, startMs + 9100);
  assert.equal(timer.remainingSeconds, 6);
  assert.equal(timer.warning, false);

  // 10.0 seconds elapsed -> 5s left (enters warning window!)
  timer = tickTimer(timer, startMs + 10000);
  assert.equal(timer.remainingSeconds, 5);
  assert.equal(timer.warning, true);
  assert.equal(timer.finished, false);

  // 14.2 seconds elapsed -> 1s left (still in warning window)
  timer = tickTimer(timer, startMs + 14200);
  assert.equal(timer.remainingMs, 800);
  assert.equal(timer.remainingSeconds, 1);
  assert.equal(timer.warning, true);
  assert.equal(timer.finished, false);

  // Exactly 15 seconds elapsed -> reaches 0, finished is true, warning becomes false
  timer = tickTimer(timer, startMs + 15000);
  assert.equal(timer.remainingMs, 0);
  assert.equal(timer.remainingSeconds, 0);
  assert.equal(timer.warning, false);
  assert.equal(timer.finished, true);
  assert.equal(timer.status, "finished");

  // Past 15 seconds (e.g. 25s elapsed) -> never below 0
  assert.equal(getRemainingMs(15, startMs, startMs + 25000), 0);
  assert.equal(getRemainingSeconds(15, startMs, startMs + 25000), 0);

  // Stays finished even if ticked with an earlier timestamp or restarted
  const afterFinish = tickTimer(timer, startMs + 2000);
  assert.equal(afterFinish.remainingSeconds, 0);
  assert.equal(afterFinish.warning, false);
  assert.equal(afterFinish.finished, true);

  const restartAttempt = startTimer(timer, startMs + 20000);
  assert.equal(restartAttempt.finished, true);
  assert.equal(restartAttempt.warning, false);
  assert.equal(restartAttempt.remainingSeconds, 0);
});

test("isTimerWarning is true only within last warning_seconds and strictly before 0", () => {
  assert.equal(isTimerWarning(6, 5), false);
  assert.equal(isTimerWarning(5, 5), true);
  assert.equal(isTimerWarning(3, 5), true);
  assert.equal(isTimerWarning(1, 5), true);
  assert.equal(isTimerWarning(0, 5), false);
  assert.equal(isTimerWarning(-2, 5), false);
});

test("formatTimer formats MM:SS cleanly", () => {
  assert.equal(formatTimer(15), "00:15");
  assert.equal(formatTimer(0), "00:00");
  assert.equal(formatTimer(75), "01:15");
});
