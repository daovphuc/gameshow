// Reusable UI animation and rendering for lottery draws (DOM helper).

import { drawLotteryItem, DRAW_DURATION_MS } from "./draw.js";

/** The number printed on a ball: the first number in its label ("Ô số 13 (30đ)" gives "13"). */
function ballNumber(label) {
  const match = String(label ?? "").match(/\d+/);
  return match ? match[0] : "";
}

/**
 * Runs the lottery draw animation in the DOM.
 * Sized ~70-80% of screen height, centered golden ball in middle of drum,
 * holds opened result for ~1s before completing automatically at DRAW_DURATION_MS (~5000ms).
 *
 * @param {{
 *   items: Array<any>,
 *   fixedItem?: any,
 *   title?: string,
 *   exclude?: Array<any>,
 *   excludeRehearsal?: boolean,
 *   getLabel?: (item: any) => string,
 *   onRolling?: (chosenItem: any) => void,
 *   onComplete?: (drawnItem: any) => void
 * }} options
 */
export function showLotteryDrawModal({
  items = [],
  fixedItem = null,
  title = "BỐC THĂM QUAY SỐ",
  exclude = [],
  excludeRehearsal = false,
  getLabel = (item) => (item?.label || item?.name || item?.id || String(item)),
  onRolling,
  onComplete
}) {
  const drawnItem = fixedItem || drawLotteryItem(items, { exclude, excludeRehearsal });
  if (!drawnItem) return null;

  let modal = document.getElementById("lottery-draw-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "lottery-draw-modal";
    modal.className = "lottery-backdrop";
    document.body.appendChild(modal);
  }

  // Generate ball elements inside the drum
  const ballColors = [
    "#D97757",
    "#2E7D4F",
    "#3B6E8C",
    "#D99500",
    "#8551CF",
    "#C94A38",
    "#2D7B74",
    "#E65100",
    "#1E88E5",
    "#43A047"
  ];

  const poolToRender = items && items.length > 0 ? items : [drawnItem];
  const drumBallsHtml = poolToRender.slice(0, 18).map((it, i) => {
    const color = ballColors[i % ballColors.length];
    const tumbleClass = `tumble-${(i % 6) + 1}`;
    const rawLabel = getLabel(it);
    const shortLabel = ballNumber(rawLabel) || `${i + 1}`;
    // Balls that share one of the 6 paths start at a different point of it,
    // so every ball stays visible (15 balls in round 3).
    const phaseDelay = -(Math.floor(i / 6) * 0.35).toFixed(2);
    return `<div class="drum-ball ${tumbleClass}" style="--ball-color: ${color}; animation-delay: ${phaseDelay}s;">${escapeHtml(shortLabel)}</div>`;
  }).join("");

  const finalLabel = getLabel(drawnItem);
  const finalShort = ballNumber(finalLabel) || "★";

  modal.innerHTML = `
    <div class="lottery-machine-wrap">
      <div class="lottery-header">
        <h2 class="lottery-title">
          ${escapeHtml(title)}
        </h2>
      </div>

      <div class="lottery-stage-container">
        <div class="lottery-drum-housing rolling">
          <div class="lottery-drum-glass-highlight"></div>
          <div class="lottery-drum-cage"></div>
          <div class="lottery-balls-container">
            ${drumBallsHtml}
          </div>
          <div class="lottery-drum-center-hub"></div>

          <!-- Centred golden ball in the middle of the drum -->
          <div id="lottery-drop-zone" class="lottery-center-zone" style="display: none;">
            <div id="lottery-split-ball" class="lottery-split-ball-container">
              <div class="ball-half ball-half-left"></div>
              <div class="ball-half ball-half-right"></div>
              <div class="ball-cracked-glow"></div>
              <div class="ball-core-reveal">
                <span class="ball-core-text">${escapeHtml(finalShort)}</span>
                <span class="ball-core-label">${escapeHtml(finalLabel)}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="lottery-pedestal"></div>
      </div>
    </div>
  `;
  modal.style.display = "flex";

  if (onRolling) onRolling(drawnItem);

  let finished = false;
  const finishDraw = () => {
    if (finished) return;
    finished = true;
    modal.style.display = "none";
    if (onComplete) onComplete(drawnItem);
  };

  // Phase 1: Drum stops at 2200ms
  const drumStopTimer = setTimeout(() => {
    const drum = modal.querySelector(".lottery-drum-housing");
    if (drum) {
      drum.classList.remove("rolling");
      drum.classList.add("stopped");
    }
  }, 2200);

  // Phase 2: Golden ball appears in the middle of the drum at 2300ms
  const dropTimer = setTimeout(() => {
    const dropZone = document.getElementById("lottery-drop-zone");
    if (dropZone) {
      dropZone.style.display = "flex";
    }
  }, 2300);

  // Phase 3: Ball splits open at 3500ms
  const crackTimer = setTimeout(() => {
    const splitBall = document.getElementById("lottery-split-ball");
    if (splitBall) {
      splitBall.classList.add("cracked");
    }
  }, 3500);

  // Phase 4: Holds the opened result ~1.5s then finishes at DRAW_DURATION_MS (5000ms)
  const completeTimer = setTimeout(() => {
    finishDraw();
  }, DRAW_DURATION_MS);

  // Allow immediate skip via Space/Enter/Escape if desired
  const keyHandler = (e) => {
    if (e.key === " " || e.key === "Enter" || e.key === "Escape") {
      clearTimeout(drumStopTimer);
      clearTimeout(dropTimer);
      clearTimeout(crackTimer);
      clearTimeout(completeTimer);
      window.removeEventListener("keydown", keyHandler);
      finishDraw();
    }
  };
  window.addEventListener("keydown", keyHandler, { once: true });

  return drawnItem;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
