/**
 * Google Apps Script Web App for Game Show Score Sync.
 *
 * Setup steps:
 * 1. Open your Google Sheet -> Extensions (Tiện ích mở rộng) -> Apps Script.
 * 2. Paste this entire file into Code.gs and click Save.
 * 3. Click Deploy (Triển khai) -> New deployment (Tạo triển khai mới).
 * 4. Select type: Web app (Ứng dụng web).
 *    - Execute as (Thực thi dưới dạng): Me (Tôi)
 *    - Who has access (Ai có quyền truy cập): Anyone (Bất kỳ ai)
 * 5. Copy the Web app URL and paste it into the sidebar Settings on the website.
 */

var SCORES_SHEET_NAME = "scores";
var SCORES_HEADERS = ["team_id", "round1", "round2", "round3", "updated_at"];

function safeScore(value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return 0;
  }
  var num = Number(String(value).trim());
  return isFinite(num) ? num : 0;
}

/**
 * Pure 2D sheet row upsert function (mirrors js/scores.js upsertScoreRows).
 */
function upsertScoreRows(existingTable, incomingRows, nowIso) {
  existingTable = existingTable || [];
  incomingRows = incomingRows || [];
  nowIso = nowIso || new Date().toISOString();

  var dataRows = [];
  var indexByTeamId = {};

  for (var i = 0; i < existingTable.length; i++) {
    var r = existingTable[i];
    if (!r || !r.length) continue;
    var col0 = String(r[0] !== undefined && r[0] !== null ? r[0] : "").trim();
    if (!col0 || col0.toLowerCase() === "team_id") continue;

    var cleanRow = [
      col0,
      safeScore(r[1]),
      safeScore(r[2]),
      safeScore(r[3]),
      r[4] !== undefined && r[4] !== null && String(r[4]).trim() !== ""
        ? String(r[4]).trim()
        : nowIso
    ];

    if ( Object.prototype.hasOwnProperty.call(indexByTeamId, col0) ) {
      dataRows[indexByTeamId[col0]] = cleanRow;
    } else {
      indexByTeamId[col0] = dataRows.length;
      dataRows.push(cleanRow);
    }
  }

  var list = Array.isArray(incomingRows) ? incomingRows : [incomingRows];
  for (var j = 0; j < list.length; j++) {
    var item = list[j];
    if (!item || typeof item !== "object") continue;
    var teamId = String(item.team_id || item.teamId || "").trim();
    if (!teamId) continue;

    var updatedRow = [
      teamId,
      safeScore(item.round1),
      safeScore(item.round2),
      safeScore(item.round3),
      item.updated_at ? String(item.updated_at).trim() : nowIso
    ];

    if ( Object.prototype.hasOwnProperty.call(indexByTeamId, teamId) ) {
      dataRows[indexByTeamId[teamId]] = updatedRow;
    } else {
      indexByTeamId[teamId] = dataRows.length;
      dataRows.push(updatedRow);
    }
  }

  return [SCORES_HEADERS.slice()].concat(dataRows);
}

function getOrCreateScoresSheet(spreadsheet) {
  var sheet = spreadsheet.getSheetByName(SCORES_SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SCORES_SHEET_NAME);
    sheet.getRange(1, 1, 1, SCORES_HEADERS.length).setValues([SCORES_HEADERS]);
  }
  return sheet;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function doGet() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateScoresSheet(ss);
    var values = sheet.getDataRange().getValues();
    return jsonResponse({ ok: true, rows: values });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function doPost(e) {
  try {
    var rawBody = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    var payload = JSON.parse(rawBody);
    var nowIso = payload.updated_at || new Date().toISOString();
    var incomingRows = payload.rows || (payload.team_id ? [payload] : []);

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateScoresSheet(ss);
    var existing = sheet.getDataRange().getValues();
    var updated = upsertScoreRows(existing, incomingRows, nowIso);

    sheet.clearContents();
    sheet.getRange(1, 1, updated.length, SCORES_HEADERS.length).setValues(updated);
    SpreadsheetApp.flush();

    return jsonResponse({
      ok: true,
      updated_at: nowIso,
      count: updated.length - 1
    });
  } catch (err) {
    return jsonResponse({
      ok: false,
      error: String(err && err.message ? err.message : err)
    });
  }
}
