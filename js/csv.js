// RFC 4180 compliant CSV parser supporting UTF-8 Vietnamese text, quoted fields,
// escaped quotes, embedded newlines, and header mapping.

/**
 * Parses CSV text into an array of row arrays (strings).
 * Ignores trailing empty lines and completely empty rows.
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsvRows(text) {
  if (!text || typeof text !== "string") {
    return [];
  }

  // Strip optional UTF-8 BOM
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows = [];
  let currentRow = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < src.length && src[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += ch;
      }
      continue;
    }

    if (ch === '"' && currentField.length === 0) {
      inQuotes = true;
    } else if (ch === ",") {
      currentRow.push(currentField);
      currentField = "";
    } else if (ch === "\r") {
      if (i + 1 < src.length && src[i + 1] === "\n") {
        i++;
      }
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = "";
    } else if (ch === "\n") {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = "";
    } else {
      currentField += ch;
    }
  }

  // Push final field/row if there is remaining content
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  // Filter out completely blank rows (e.g. trailing empty line)
  return rows.filter((row) => row.some((cell) => cell.trim() !== ""));
}

/**
 * Parses CSV text into an array of objects keyed by the lowercase header row.
 * @param {string} text
 * @returns {Record<string, string>[]}
 */
export function parseCsv(text) {
  const rows = parseCsvRows(text);
  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const records = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row.some((cell) => cell.trim() !== "")) {
      continue;
    }
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c];
      if (!key) continue;
      const val = c < row.length ? row[c].trim() : "";
      obj[key] = val;
    }
    records.push(obj);
  }

  return records;
}
