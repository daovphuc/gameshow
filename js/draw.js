// Pure logic for lottery draws across Round 1, Round 2, and Round 3 (DOM-free).

export const DRAW_DURATION_MS = 5000;

/**
 * Determines whether a set identifier corresponds to the rehearsal ("Chạy thử") set.
 * @param {any} setIdentifier
 * @returns {boolean}
 */
export function isRehearsalSet(setIdentifier) {
  if (setIdentifier === undefined || setIdentifier === null) return false;
  const str = typeof setIdentifier === "object"
    ? String(setIdentifier.name || setIdentifier.id || setIdentifier.set || "")
    : String(setIdentifier);
  return /^ch[aạ]y\s*th[uử](\s*\d+)?$/i.test(str.trim());
}

/**
 * Contest run mode from the config: "test" (rehearsal, shown as DEMO) or
 * "live" (the real contest, the default). Both modes run the same flow; the
 * mode only changes which Round 2 sets go into the drum.
 * @param {Record<string, any>} [config]
 */
export function isTestMode(config) {
  return String(config?.run_mode ?? "").trim().toLowerCase() === "test";
}

/**
 * The Round 2 sets that go into the drum: the rehearsal ("Chạy thử") sets in
 * test mode, the official sets otherwise (all sets when there is no official one).
 * @param {Array<any>} sets
 * @param {Record<string, any>} [config]
 */
export function getRound2DrawPool(sets = [], config = {}) {
  const list = (Array.isArray(sets) ? sets : []).filter(
    (s) => s !== undefined && s !== null && String(s).trim() !== ""
  );
  if (isTestMode(config)) {
    return list.filter((s) => isRehearsalSet(s));
  }
  const official = list.filter((s) => !isRehearsalSet(s));
  return official.length > 0 ? official : list;
}

/** Display name of a Round 2 set: "Bộ đề số 3", or "Bộ đề thử" for a rehearsal set. */
export function getRound2SetLabel(setKey) {
  if (isRehearsalSet(setKey)) {
    const num = String(setKey).match(/\d+/);
    return num ? `Bộ đề thử ${num[0]}` : "Bộ đề thử";
  }
  return `Bộ đề số ${setKey}`;
}

/**
 * Core lottery draw function.
 * Given available items, filters out excluded items and optionally "Chạy thử" rehearsal set.
 * Uses an injected random source (defaults to Math.random) to pick one item.
 * Returns null if the pool of available items is empty.
 *
 * @template T
 * @param {Array<T>} items - Candidates to pick from
 * @param {{
 *   exclude?: Array<any>|Set<any>,
 *   excludeRehearsal?: boolean,
 *   randomSource?: () => number,
 *   idExtractor?: (item: T) => any
 * }} [options]
 * @returns {T|null}
 */
export function drawLotteryItem(items = [], {
  exclude = [],
  excludeRehearsal = false,
  randomSource = Math.random,
  idExtractor = (item) => (item && typeof item === "object" && "id" in item ? item.id : item)
} = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  const excludeSet = new Set(
    (Array.isArray(exclude) ? exclude : Array.from(exclude || [])).map((x) =>
      x && typeof x === "object" && "id" in x ? x.id : x
    )
  );

  const pool = items.filter((item) => {
    const id = idExtractor(item);
    if (excludeSet.has(id) || excludeSet.has(item)) {
      return false;
    }
    if (excludeRehearsal && isRehearsalSet(idExtractor(item))) {
      return false;
    }
    return true;
  });

  if (pool.length === 0) {
    return null;
  }

  const rndFn = typeof randomSource === "function" ? randomSource : Math.random;
  const rawRnd = rndFn();
  const clamped = Math.max(0, Math.min(0.99999999, Number.isFinite(rawRnd) ? rawRnd : 0));
  const selectedIndex = Math.floor(clamped * pool.length);

  return pool[selectedIndex] ?? null;
}

export const drawLottery = drawLotteryItem;

/**
 * Draws a Round 1 package for a team.
 * Available packages count is taken from the data.
 * Excludes already picked packages.
 */
export function drawRound1Package(packages = [], {
  pickedPackages = [],
  randomSource = Math.random
} = {}) {
  return drawLotteryItem(packages, {
    exclude: pickedPackages,
    randomSource,
    idExtractor: (pkg) => (typeof pkg === "object" && pkg?.id ? pkg.id : pkg)
  });
}

/**
 * Draws a Round 2 question set.
 * 5 official sets (never the "Chạy thử" set).
 */
export function drawRound2Set(sets = [], {
  randomSource = Math.random
} = {}) {
  return drawLotteryItem(sets, {
    excludeRehearsal: true,
    randomSource,
    idExtractor: (s) => (typeof s === "object" && s?.set ? s.set : s)
  });
}

/**
 * Draws a Round 3 tile.
 * 15 balls = 15 tiles; opened tiles are not in the drum.
 */
export function drawRound3Tile(tiles = [], {
  openedTiles = [],
  randomSource = Math.random
} = {}) {
  return drawLotteryItem(tiles, {
    exclude: openedTiles,
    randomSource,
    idExtractor: (t) => (typeof t === "object" && t?.number !== undefined ? Number(t.number) : Number(t))
  });
}
