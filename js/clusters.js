// Pure logic for cluster definitions and contest cluster application (DOM-free).

import { parseCsv } from "./csv.js";

function toRows(input) {
  if (typeof input === "string") {
    return parseCsv(input);
  }
  return Array.isArray(input) ? input : [];
}

/**
 * Normalises rows from clusters CSV/data.
 * Columns: id, name, venue, date, subtitle, team_ids.
 *
 * @param {Array<Record<string, any>>|string} input
 * @returns {Array<{
 *   id: string,
 *   name: string,
 *   venue: string,
 *   date: string,
 *   subtitle: string,
 *   team_ids: Array<string>
 * }>}
 */
export function normaliseClusters(input = []) {
  const rows = toRows(input);
  const results = [];
  const seenIds = new Set();

  for (const row of rows) {
    const id = row?.id !== undefined && row?.id !== null ? String(row.id).trim() : "";
    const name = row?.name !== undefined && row?.name !== null ? String(row.name).trim() : "";
    if (!id || !name || seenIds.has(id)) {
      continue;
    }
    seenIds.add(id);

    const venue = row?.venue !== undefined && row?.venue !== null ? String(row.venue).trim() : "";
    const date = row?.date !== undefined && row?.date !== null ? String(row.date).trim() : "";
    let subtitle = row?.subtitle !== undefined && row?.subtitle !== null ? String(row.subtitle).trim() : "";
    if (!subtitle) {
      if (date && venue) {
        subtitle = `${name} – Ngày ${date} tại ${venue}`;
      } else if (venue) {
        subtitle = `${name} – tại ${venue}`;
      } else {
        subtitle = name;
      }
    }

    let teamIds = [];
    if (Array.isArray(row?.team_ids)) {
      teamIds = row.team_ids.map((s) => String(s || "").trim()).filter(Boolean);
    } else if (row?.team_ids !== undefined && row?.team_ids !== null) {
      teamIds = String(row.team_ids)
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }

    results.push({
      id,
      name,
      venue,
      date,
      subtitle,
      team_ids: teamIds
    });
  }

  return results;
}

/**
 * Applies a cluster to contest round_order and config.
 * - Sets round_order.contest and each round's order (round1, round2, round3) to exactly the cluster's teams.
 * - If cluster has empty team_ids (e.g. Chung kết), leaves round_order untouched for manual selection.
 * - Sets config.show_subtitle to the cluster subtitle.
 *
 * @param {string|Record<string, any>} clusterOrId
 * @param {{
 *   round_order?: Record<string, Array<string>>,
 *   config?: Record<string, any>,
 *   clusters?: Array<Record<string, any>>
 * }} [context]
 * @returns {{
 *   round_order: Record<string, Array<string>>,
 *   config: Record<string, any>,
 *   appliedCluster: Record<string, any>|null
 * }}
 */
export function applyCluster(clusterOrId, { round_order = {}, config = {}, clusters = [] } = {}) {
  let cluster = null;
  if (typeof clusterOrId === "string") {
    const cleanId = clusterOrId.trim().toLowerCase();
    cluster =
      clusters.find(
        (c) =>
          String(c.id).trim().toLowerCase() === cleanId ||
          String(c.name).trim().toLowerCase() === cleanId
      ) || null;
  } else if (clusterOrId && typeof clusterOrId === "object") {
    cluster = clusterOrId;
  }

  const nextConfig = { ...(config || {}) };
  const nextRoundOrder = { ...(round_order || {}) };

  if (!cluster) {
    return {
      round_order: nextRoundOrder,
      config: nextConfig,
      appliedCluster: null
    };
  }

  if (cluster.subtitle) {
    nextConfig.show_subtitle = cluster.subtitle;
  }

  if (Array.isArray(cluster.team_ids) && cluster.team_ids.length > 0) {
    const list = cluster.team_ids.slice();
    nextRoundOrder.contest = list.slice();
    nextRoundOrder.round1 = list.slice();
    nextRoundOrder.round2 = list.slice();
    nextRoundOrder.round3 = list.slice();
  }

  return {
    round_order: nextRoundOrder,
    config: nextConfig,
    appliedCluster: cluster
  };
}
