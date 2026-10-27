import test from "node:test";
import assert from "node:assert/strict";
import {
  createTimer,
  startTimer,
  tickTimer,
  getRemainingMs,
  getRemainingSeconds,
  formatTimer
} from "../js/timer.js";

test("timer computes remaining time from start and now, never goes below 0, and stays finished once at 0", () => {
  let timer = createTimer(15);
  assert.equal(timer.remainingSeconds, 15);
  assert.equal(timer.finished, false);

  const startMs = 1000;
  timer = startTimer(timer, startMs);
  assert.equal(timer.status, "running");

  // 5 seconds elapsed -> 10s left
  timer = tickTimer(timer, startMs + 5000);
  assert.equal(timer.remainingSeconds, 10);
  assert.equal(timer.finished, false);

  // 14.2 seconds elapsed -> 1s left (ceil)
  timer = tickTimer(timer, startMs + 14200);
  assert.equal(timer.remainingMs, 800);
  assert.equal(timer.remainingSeconds, 1);
  assert.equal(timer.finished, false);

  // Exactly 15 seconds elapsed -> reaches 0 and reports finished
  timer = tickTimer(timer, startMs + 15000);
  assert.equal(timer.remainingMs, 0);
  assert.equal(timer.remainingSeconds, 0);
  assert.equal(timer.finished, true);
  assert.equal(timer.status, "finished");

  // Past 15 seconds (e.g. 25s elapsed) -> never below 0
  assert.equal(getRemainingMs(15, startMs, startMs + 25000), 0);
  assert.equal(getRemainingSeconds(15, startMs, startMs + 25000), 0);

  // Stays finished even if ticked with an earlier timestamp or restarted
  const afterFinish = tickTimer(timer, startMs + 2000);
  assert.equal(afterFinish.remainingSeconds, 0);
  assert.equal(afterFinish.finished, true);

  const restartAttempt = startTimer(timer, startMs + 20000);
  assert.equal(restartAttempt.finished, true);
  assert.equal(restartAttempt.remainingSeconds, 0);
});

test("formatTimer formats MM:SS cleanly", () => {
  assert.equal(formatTimer(15), "00:15");
  assert.equal(formatTimer(0), "00:00");
  assert.equal(formatTimer(75), "01:15");
});
