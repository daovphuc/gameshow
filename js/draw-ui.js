// Reusable UI animation and rendering for lottery draws (DOM helper).

import { drawLotteryItem } from "./draw.js";

/**
 * Runs a lottery draw animation in the DOM with sound/visual effects.
 *
 * @param {{
 *   items: Array<any>,
 *   title?: string,
 *   subtitle?: string,
 *   exclude?: Array<any>,
 *   excludeRehearsal?: boolean,
 *   getLabel?: (item: any) => string,
 *   onRolling?: (chosenItem: any) => void,
 *   onComplete: (drawnItem: any) => void,
 *   onManualOverride?: () => void
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
  onComplete,
  onManualOverride
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
  const ballColors = ["#D97757", "#2E7D4F", "#3B6E8C", "#D99500", "#8551CF", "#C94A38", "#2D7B74"];
  const drumBallsHtml = items.slice(0, 15).map((it, i) => {
    const color = ballColors[i % ballColors.length];
    const tumbleClass = `tumble-${(i % 5) + 1}`;
    const rawLabel = getLabel(it);
    const shortLabel = rawLabel.replace(/[^0-9A-Za-z]/g, "").slice(0, 3) || `${i + 1}`;
    return `<div class="drum-ball ${tumbleClass}" style="background: radial-gradient(circle at 35% 35%, #FFF, ${color} 70%);">${escapeHtml(shortLabel)}</div>`;
  }).join("");

  modal.innerHTML = `
    <div class="lottery-machine-wrap">
      <div style="text-align: center; margin-bottom: 1.25rem;">
        <span class="meta-pill accent" style="font-size: 0.9rem; letter-spacing: 0.06em; text-transform: uppercase;">LỒNG QUAY SỐ</span>
        <h2 style="font-family: var(--font-serif); font-size: clamp(1.8rem, 3.5vw, 2.5rem); margin: 0.5rem 0 0.25rem; color: #FFFFFF;">
          ${escapeHtml(title)}
        </h2>
        <p style="color: rgba(255,255,255,0.7); margin: 0; font-size: 1.05rem;">
          ${escapeHtml(subtitle)}
        </p>
      </div>

      <div class="lottery-drum-housing rolling">
        <div class="lottery-drum-cage"></div>
        <div class="lottery-balls-container">
          ${drumBallsHtml}
        </div>
      </div>
      <div class="lottery-pedestal"></div>

      <div id="lottery-drop-zone" class="lottery-reveal-stage" style="display: none;"></div>

      <div class="lottery-override-bar">
        ${onManualOverride ? `<button type="button" id="btn-lottery-manual" class="btn btn-sm btn-outline" style="color: rgba(255,255,255,0.85); border-color: rgba(255,255,255,0.4); margin-top: 1rem;">
          ⚙ Chọn thủ công
        </button>` : ""}
      </div>
    </div>
  `;
  modal.style.display = "flex";

  if (onRolling) onRolling(drawnItem);

  document.getElementById("btn-lottery-manual")?.addEventListener("click", () => {
    modal.style.display = "none";
    if (onManualOverride) onManualOverride();
  });

  // After 2.4s of rolling, stop drum and drop ball
  setTimeout(() => {
    const drum = modal.querySelector(".lottery-drum-housing");
    if (drum) drum.classList.remove("rolling");

    const dropZone = document.getElementById("lottery-drop-zone");
    if (dropZone) {
      dropZone.style.display = "flex";
      const finalLabel = getLabel(drawnItem);
      dropZone.innerHTML = `
        <div class="lottery-dropped-ball">
          ${escapeHtml(String(finalLabel).slice(0, 4))}
        </div>
        <div class="lottery-result-card">
          <div class="lottery-result-title">KẾT QUẢ BỐC THĂM</div>
          <div class="lottery-result-name">${escapeHtml(finalLabel)}</div>
          <div style="margin-top: 1rem;">
            <button type="button" id="btn-lottery-confirm" class="btn btn-primary btn-lg" style="font-weight: 800; padding: 0.75rem 2rem;">
              Xác nhận kết quả →
            </button>
          </div>
        </div>
      `;

      const confirmBtn = document.getElementById("btn-lottery-confirm");
      confirmBtn?.addEventListener("click", () => {
        modal.style.display = "none";
        onComplete(drawnItem);
      });

      // Auto confirm after 4.5s
      setTimeout(() => {
        if (modal.style.display !== "none") {
          modal.style.display = "none";
          onComplete(drawnItem);
        }
      }, 4500);
    }
  }, 2400);

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
