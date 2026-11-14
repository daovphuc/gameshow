// Sound effects synthesised with the Web Audio API (no audio files, no
// network): a tense countdown for the last seconds of a timer, a buzzer at
// zero, and looping fanfare music for the award ceremony. Browser-only page
// helper; logic modules and tests do not import it.

const MUTE_KEY = "gameshow_sound_muted";
const COUNTDOWN_FROM = 5;

let ctx = null;
let master = null;

function getContext() {
  if (typeof window === "undefined") return null;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;
  if (!ctx) {
    ctx = new AudioCtor();
    master = ctx.createGain();
    master.gain.value = isSoundMuted() ? 0 : 0.9;
    master.connect(ctx.destination);
  }
  return ctx;
}

/** Browsers start audio only after a click or key press; call this from one. */
export function unlockAudio() {
  const ac = getContext();
  if (ac && ac.state === "suspended") ac.resume().catch(() => {});
}

if (typeof document !== "undefined") {
  const unlock = () => unlockAudio();
  document.addEventListener("pointerdown", unlock, { capture: true });
  document.addEventListener("keydown", unlock, { capture: true });
}

export function isSoundMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSoundMuted(muted) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // Storage blocked: the setting lasts for this page only.
  }
  if (master && ctx) {
    master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.02);
  }
}

function tone({ freq, type = "sine", start = 0, duration = 0.2, volume = 0.3, endFreq = null }) {
  const ac = getContext();
  if (!ac || ac.state !== "running") return;
  const t0 = ac.currentTime + start;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + duration);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

function noiseBurst({ start = 0, duration = 0.12, volume = 0.2, highpass = 1200 }) {
  const ac = getContext();
  if (!ac || ac.state !== "running") return;
  const t0 = ac.currentTime + start;
  const length = Math.max(1, Math.floor(ac.sampleRate * duration));
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = highpass;
  const gain = ac.createGain();
  gain.gain.value = volume;
  src.connect(filter).connect(gain).connect(master);
  src.start(t0);
}

/** One beat of the final countdown: a heartbeat thump and a beep that rises as time runs out. */
export function playCountdownTick(secondsLeft) {
  const step = Math.max(0, COUNTDOWN_FROM - Number(secondsLeft));
  tone({ freq: 95, endFreq: 45, type: "sine", duration: 0.28, volume: 0.7 });
  tone({ freq: 90, endFreq: 45, type: "sine", start: 0.16, duration: 0.24, volume: 0.45 });
  tone({ freq: 660 * Math.pow(1.122, step), type: "square", duration: 0.13, volume: 0.12 });
}

/** Time is up: a buzzer. */
export function playTimeUp() {
  tone({ freq: 196, endFreq: 98, type: "sawtooth", duration: 0.9, volume: 0.32 });
  tone({ freq: 207, endFreq: 104, type: "sawtooth", duration: 0.9, volume: 0.22 });
  noiseBurst({ duration: 0.35, volume: 0.15, highpass: 300 });
}

/**
 * Watches a countdown and plays the effects once per second: ticks from 5 s
 * down, the buzzer when it reaches 0 while running. Call `update` on every
 * timer refresh; `reset` when a new countdown starts.
 */
export function createCountdownSound() {
  let lastSecond = null;
  return {
    update(remainingSeconds, running) {
      const sec = Math.max(0, Math.ceil(Number(remainingSeconds) || 0));
      if (sec === lastSecond) return;
      const previous = lastSecond;
      lastSecond = sec;
      if (!running && sec !== 0) return;
      if (sec > 0 && sec <= COUNTDOWN_FROM && previous !== null && previous > sec) {
        playCountdownTick(sec);
      } else if (sec === 0 && previous !== null && previous > 0) {
        playTimeUp();
      }
    },
    reset() {
      lastSecond = null;
    }
  };
}

// --- Award ceremony music -------------------------------------------------

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
// Bar chords (MIDI roots) and a bright melody over them: C - F - G - C, then Am - F - G - C.
const PROGRESSION = [
  [60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67],
  [57, 60, 64], [65, 69, 72], [67, 71, 74], [60, 64, 67, 72]
];
const MELODY = [
  [72, 76, 79, 76], [77, 76, 74, 72], [74, 79, 77, 74], [76, 72, 79, 84],
  [76, 72, 69, 72], [77, 81, 77, 72], [79, 77, 76, 74], [72, 76, 79, 84]
];

let awardTimer = null;
let awardBar = 0;
let awardNextTime = 0;

function scheduleAwardBar(t0, barIndex) {
  const beat = 0.42;
  const chord = PROGRESSION[barIndex % PROGRESSION.length];
  const melody = MELODY[barIndex % MELODY.length];
  const ac = getContext();
  const rel = t0 - ac.currentTime;
  for (const n of chord) {
    tone({ freq: NOTE(n - 12), type: "triangle", start: rel, duration: beat * 3.8, volume: 0.07 });
  }
  tone({ freq: NOTE(chord[0] - 24), type: "sine", start: rel, duration: beat * 1.8, volume: 0.22 });
  tone({ freq: NOTE(chord[0] - 24), type: "sine", start: rel + beat * 2, duration: beat * 1.8, volume: 0.18 });
  melody.forEach((n, i) => {
    tone({ freq: NOTE(n), type: "square", start: rel + i * beat, duration: beat * 0.9, volume: 0.06 });
    tone({ freq: NOTE(n + 12), type: "sine", start: rel + i * beat, duration: beat * 0.6, volume: 0.03 });
  });
  for (let i = 0; i < 4; i++) {
    noiseBurst({ start: rel + i * beat + beat / 2, duration: 0.05, volume: 0.05, highpass: 6000 });
  }
  noiseBurst({ start: rel + beat, duration: 0.12, volume: 0.09, highpass: 1500 });
  noiseBurst({ start: rel + beat * 3, duration: 0.12, volume: 0.09, highpass: 1500 });
  return beat * 4;
}

export function isAwardMusicPlaying() {
  return awardTimer !== null;
}

/** Starts the looping ceremony music (needs a prior click on the page). */
export function startAwardMusic() {
  const ac = getContext();
  if (!ac) return false;
  unlockAudio();
  if (awardTimer) return true;
  awardBar = 0;
  awardNextTime = ac.currentTime + 0.1;
  const pump = () => {
    if (ac.state !== "running") return;
    while (awardNextTime < ac.currentTime + 1.2) {
      awardNextTime += scheduleAwardBar(awardNextTime, awardBar);
      awardBar += 1;
    }
  };
  pump();
  awardTimer = setInterval(pump, 250);
  return true;
}

export function stopAwardMusic() {
  if (awardTimer) {
    clearInterval(awardTimer);
    awardTimer = null;
  }
}
