// Reusable UI animation and rendering for lottery draws (DOM helper).

import { drawLotteryItem, DRAW_DURATION_MS } from "./draw.js";

/** The number printed on a ball: the first number in its label ("Ô số 13 (30đ)" gives "13"). */
function ballNumber(label) {
  const match = String(label ?? "").match(/\d+/);
  return match ? match[0] : "";
}

/**
 * Runs a faster, prettier lottery draw animation in the DOM.
 * Takes ~4 seconds total and completes automatically without requiring a confirm click.
 *
 * @param {{
 *   items: Array<any>,
 *   title?: string,
 *   subtitle?: string,
 *   exclude?: Array<any>,
 *   excludeRehearsal?: boolean,
 *   getLabel?: (item: any) => string,
 *   onRolling?: (chosenItem: any) => void,
 *   onComplete: (drawnItem: any) => void
 * }} options
 */
export function showLotteryDrawModal({
  items = [],
  title = "BỐC THĂM QUAY SỐ",
  subtitle = "Lồng quay số ngẫu nhiên",
  exclude = [],
  excludeRehearsal = false,
  getLabel = (item) => (item?.label || item?.name || item?.id || String(item)),
  onRolling,
  onComplete
}) {
  const drawnItem = drawLotteryItem(items, { exclude, excludeRehearsal });
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

  const drumBallsHtml = items.slice(0, 16).map((it, i) => {
    const color = ballColors[i % ballColors.length];
    const tumbleClass = `tumble-${(i % 5) + 1}`;
    const rawLabel = getLabel(it);
    const shortLabel = ballNumber(rawLabel) || `${i + 1}`;
    return `<div class="drum-ball ${tumbleClass}" style="--ball-color: ${color};">${escapeHtml(shortLabel)}</div>`;
  }).join("");

  const finalLabel = getLabel(drawnItem);
  const finalShort = ballNumber(finalLabel) || "★";

  modal.innerHTML = `
    <div class="lottery-machine-wrap">
      <div class="lottery-header">
        <span class="meta-pill accent" style="font-size: 0.85rem; letter-spacing: 0.08em; text-transform: uppercase;">LỒNG QUAY SỐ</span>
        <h2 style="font-family: var(--font-serif); font-size: clamp(1.4rem, min(3.2vw, 4.6vh), 2.35rem); margin: 0.35rem 0 0.15rem; color: #FFFFFF; font-weight: 800;">
          ${escapeHtml(title)}
        </h2>
        <p style="color: rgba(255,255,255,0.72); margin: 0; font-size: 1rem;">
          ${escapeHtml(subtitle)}
        </p>
      </div>

      <div class="lottery-drum-housing rolling">
        <div class="lottery-drum-glass-highlight"></div>
        <div class="lottery-drum-cage"></div>
        <div class="lottery-balls-container">
          ${drumBallsHtml}
        </div>
        <div class="lottery-drum-center-hub"></div>
      </div>
      <div class="lottery-pedestal"></div>

      <div id="lottery-drop-zone" class="lottery-reveal-stage" style="display: none;">
        <div id="lottery-split-ball" class="lottery-split-ball-container">
          <div class="ball-half ball-half-left"></div>
          <div class="ball-half ball-half-right"></div>
          <div class="ball-cracked-glow"></div>
          <div class="ball-core-reveal">
            <span class="ball-core-text">${escapeHtml(finalShort)}</span>
          </div>
        </div>

        <div class="lottery-result-card">
          <div class="lottery-result-title">KẾT QUẢ QUAY SỐ</div>
          <div class="lottery-result-name">${escapeHtml(finalLabel)}</div>
        </div>
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

  // Phase 1: Drum stops at 2000ms
  const drumStopTimer = setTimeout(() => {
    const drum = modal.querySelector(".lottery-drum-housing");
    if (drum) {
      drum.classList.remove("rolling");
      drum.classList.add("stopped");
    }
  }, 2000);

  // Phase 2: Ball drops at 2100ms
  const dropTimer = setTimeout(() => {
    const dropZone = document.getElementById("lottery-drop-zone");
    if (dropZone) {
      dropZone.style.display = "flex";
    }
  }, 2100);

  // Phase 3: Ball splits/cracks open at 2700ms
  const crackTimer = setTimeout(() => {
    const splitBall = document.getElementById("lottery-split-ball");
    if (splitBall) {
      splitBall.classList.add("cracked");
    }
  }, 2700);

  // Phase 4: Automatically finishes at DRAW_DURATION_MS (4000ms)
  const completeTimer = setTimeout(() => {
    finishDraw();
  }, DRAW_DURATION_MS);

  // Allow immediate skip via Space/Enter/Escape if desired
  const keyHandler = (e) => {
    if (e.key === " " || e.key === "Enter") {
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
