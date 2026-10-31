// Report CSV builder (DOM-free): builds UTF-8 BOM CSV for Excel with full team
// breakdown and round-2 question-by-question response details (Điều 15.5d).

import { calculateTeamRoundScore } from "./judges.js";
import { computeLeaderboard } from "./leaderboard.js";
import { buildQuestionKey, calculateRound2QuestionScore, computeRound2Ranking } from "./round2.js";

function escapeCsvField(val) {
  if (val === undefined || val === null) {
    return "";
  }
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatRow(fields) {
  return fields.map(escapeCsvField).join(",");
}

/**
 * Builds the complete contest report as a CSV string formatted for Excel with UTF-8 BOM.
 *
 * @param {{
 *   title?: string,
 *   rankedEntries?: Array<Record<string, any>>,
 *   round2Details?: Array<Record<string, any>>,
 *   teams?: Array<{id: string, name: string}>,
 *   judges?: Array<{id: string, name: string}>,
 *   gameState?: Record<string, any>,
 *   round2Questions?: Array<Record<string, any>>,
 *   allAnswers?: Record<string, Record<string, any>>,
 *   config?: Record<string, any>
 * }} params
 * @returns {string}
 */
export function buildReportCsv({
  title = "BÁO CÁO KẾT QUẢ HỘI THI",
  rankedEntries = [],
  round2Details = [],
  teams = [],
  judges = [],
  gameState = {},
  round2Questions = [],
  allAnswers = {},
  config = {}
} = {}) {
  let actualRanked = rankedEntries;
  let actualR2Details = round2Details;

  if ((!actualRanked || actualRanked.length === 0) && teams && teams.length > 0) {
    const cfg = config || {};
    const leaderboard = computeLeaderboard(teams, gameState, "total", { tieBreak: true });

    actualRanked = leaderboard.map((entry) => {
      const tId = entry.id;
      const r1Judges = gameState?.judgeScores?.round1?.[tId] || {};
      const r1Penalty = gameState?.penalties?.round1?.[tId] || 0;
      const r1Calc = calculateTeamRoundScore({
        judgeScores: r1Judges,
        penalty: r1Penalty,
        maxContent: Number(cfg.round1_max_content) || 45,
        maxManner: Number(cfg.round1_max_manner) || 5
      });

      const r3Judges = gameState?.judgeScores?.round3?.[tId] || {};
      const r3Penalty = gameState?.penalties?.round3?.[tId] || 0;
      const r3Calc = calculateTeamRoundScore({
        judgeScores: r3Judges,
        penalty: r3Penalty,
        maxContent: Number(cfg.round3_max_content) || 25,
        maxManner: Number(cfg.round3_max_manner) || 5
      });

      const r2SoftwarePoints = gameState?.round2Stats?.[tId]?.softwarePoints ?? 0;

      return {
        rank: entry.rank,
        id: entry.id,
        name: entry.name,
        r1Content: r1Calc.avgContent,
        r1Manner: r1Calc.avgManner,
        r1Penalty: r1Calc.penalty,
        round1: entry.round1,
        r2SoftwarePoints,
        round2: entry.round2,
        r3Content: r3Calc.avgContent,
        r3Manner: r3Calc.avgManner,
        r3Penalty: r3Calc.penalty,
        round3: entry.round3,
        total: entry.total
      };
    });
  }

  if (
    (!actualR2Details || actualR2Details.length === 0) &&
    round2Questions &&
    round2Questions.length > 0 &&
    teams &&
    teams.length > 0
  ) {
    actualR2Details = [];
    const questionsMeta = gameState?.round2?.questionsMeta || {};
    // Question keys use the position inside each set, not across all sets.
    const positionInSet = {};
    for (const q of round2Questions) {
      const setKey = String(q.set ?? "1");
      const idx = positionInSet[setKey] ?? 0;
      positionInSet[setKey] = idx + 1;
      const qKey = buildQuestionKey(setKey, idx);
      const answersForQ = allAnswers[qKey] || gameState?.round2?.answersByQuestion?.[qKey] || {};
      const meta = questionsMeta[qKey] || {};
      const shownAt = meta.shownAt ?? q.shownAt ?? 0;
      const durationSeconds = Number(q.time_seconds) || 30;
      const ptsPerCorrect = Number(config?.round2_points_per_correct) || 2;

      if (Object.keys(answersForQ).length === 0 && !meta.shownAt) {
        continue;
      }

      for (const t of teams) {
        const record = answersForQ[t.id];
        const rawAns = record?.answer ? String(record.answer).trim().toUpperCase() : "";
        const isCorrect = rawAns && rawAns === String(q.correct || "").trim().toUpperCase();
        const answeredAt = Number(record?.answeredAt) || 0;
        const timeSeconds = answeredAt && shownAt ? Math.max(0, (answeredAt - shownAt) / 1000) : 0;
        const points = calculateRound2QuestionScore({
          isCorrect,
          answeredAt,
          shownAt,
          durationSeconds,
          pointsPerCorrect: ptsPerCorrect
        });

        actualR2Details.push({
          teamId: t.id,
          teamName: t.name,
          set: q.set,
          questionNumber: q.number,
          choice: rawAns || "Không trả lời",
          correct: q.correct,
          isCorrect,
          timeSeconds,
          points
        });
      }
    }
  }

  const lines = [];

  // Title block
  lines.push(formatRow([title]));
  lines.push(formatRow([`Thời gian xuất báo cáo: ${new Date().toLocaleString("vi-VN")}`]));
  lines.push("");

  // SECTION 1: Summary Table
  lines.push(formatRow(["BẢNG TỔNG HỢP KẾT QUẢ ĐIỂM CÁC VÒNG THI"]));
  lines.push(
    formatRow([
      "Thứ hạng",
      "Mã đội",
      "Tên đội",
      "V1 Nội dung",
      "V1 Hình thức",
      "V1 Điểm trừ",
      "V1 Tổng điểm",
      "V2 Điểm phần mềm",
      "V2 Điểm quy đổi",
      "V3 Nội dung",
      "V3 Hình thức",
      "V3 Điểm trừ",
      "V3 Tổng điểm",
      "TỔNG ĐIỂM"
    ])
  );

  for (const entry of actualRanked) {
    lines.push(
      formatRow([
        entry.rank ?? "",
        entry.id ?? "",
        entry.name ?? "",
        entry.r1Content ?? 0,
        entry.r1Manner ?? 0,
        entry.r1Penalty ?? 0,
        entry.round1 ?? 0,
        entry.r2SoftwarePoints ?? 0,
        entry.round2 ?? 0,
        entry.r3Content ?? 0,
        entry.r3Manner ?? 0,
        entry.r3Penalty ?? 0,
        entry.round3 ?? 0,
        entry.total ?? 0
      ])
    );
  }

  // SECTION 2: Thống kê Vòng 2
  let contestTeams = teams;
  if ((!contestTeams || contestTeams.length === 0) && actualRanked && actualRanked.length > 0) {
    contestTeams = actualRanked.map((e) => ({ id: e.id, name: e.name }));
  }

  if (contestTeams && contestTeams.length > 0) {
    const r2StatsMap = {};
    for (const t of contestTeams) {
      r2StatsMap[t.id] = {
        points: gameState?.round2Stats?.[t.id]?.points ?? 0,
        correctCount: gameState?.round2Stats?.[t.id]?.correctCount ?? 0,
        totalCorrectTimeMs: gameState?.round2Stats?.[t.id]?.totalCorrectTimeMs ?? 0
      };
    }

    const hasLiveStats = Object.values(r2StatsMap).some((s) => s.points > 0 || s.correctCount > 0);
    if (!hasLiveStats && actualR2Details && actualR2Details.length > 0) {
      for (const item of actualR2Details) {
        if (!r2StatsMap[item.teamId]) {
          r2StatsMap[item.teamId] = { points: 0, correctCount: 0, totalCorrectTimeMs: 0 };
        }
        if (item.isCorrect) {
          r2StatsMap[item.teamId].points += Number(item.points) || 0;
          r2StatsMap[item.teamId].correctCount += 1;
          r2StatsMap[item.teamId].totalCorrectTimeMs += Math.round((Number(item.timeSeconds) || 0) * 1000);
        }
      }
    }

    const r2Ranking = computeRound2Ranking(contestTeams, r2StatsMap);
    lines.push("");
    lines.push("");
    lines.push(formatRow(["THỐNG KÊ VÒNG 2 (TRẮC NGHIỆM)"]));
    lines.push(
      formatRow([
        "Thứ hạng",
        "Mã đội",
        "Tên đội",
        "Điểm số",
        "Số câu đúng",
        "Tổng thời gian đúng (s)"
      ])
    );
    for (const r of r2Ranking) {
      lines.push(
        formatRow([
          r.rank ?? "",
          r.id ?? "",
          r.name ?? "",
          r.points ?? 0,
          r.correctCount ?? 0,
          (Number(r.totalCorrectTimeSeconds) || 0).toFixed(2)
        ])
      );
    }
  }

  lines.push("");
  lines.push("");

  // SECTION 3: Round 2 Details (Điều 15.5d)
  lines.push(formatRow(["CHI TIẾT ĐÁP ÁN VÒNG 2 (TRẮC NGHIỆM)"]));
  lines.push(
    formatRow([
      "Mã đội",
      "Tên đội",
      "Bộ đề",
      "Câu số",
      "Đáp án chọn",
      "Đáp án đúng",
      "Kết quả",
      "Thời gian trả lời (s)",
      "Điểm phần mềm"
    ])
  );

  for (const item of actualR2Details) {
    lines.push(
      formatRow([
        item.teamId ?? "",
        item.teamName ?? "",
        item.set ?? "1",
        item.questionNumber ?? "",
        item.choice ?? "Không trả lời",
        item.correct ?? "",
        item.isCorrect ? "Đúng" : "Sai",
        item.timeSeconds !== undefined && item.timeSeconds !== null ? Number(item.timeSeconds).toFixed(2) : "0.00",
        item.points ?? 0
      ])
    );
  }

  // Prepend UTF-8 Byte Order Mark for Excel
  return "\uFEFF" + lines.join("\r\n");
}