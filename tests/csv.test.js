import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv, parseCsvRows } from "../js/csv.js";

test("parseCsv handles UTF-8 Vietnamese text, header mapping, and trailing empty lines", () => {
  const csv = [
    "\uFEFFid,name,color",
    "doi-1,Đội Ánh Dương,#D97757",
    "doi-2,Đội Trường Sơn,#2E7D4F",
    "",
    "   "
  ].join("\r\n");

  const records = parseCsv(csv);
  assert.equal(records.length, 2);
  assert.deepEqual(records[0], {
    id: "doi-1",
    name: "Đội Ánh Dương",
    color: "#D97757"
  });
  assert.deepEqual(records[1], {
    id: "doi-2",
    name: "Đội Trường Sơn",
    color: "#2E7D4F"
  });
});

test("parseCsv handles quoted fields with commas, escaped quotes, and embedded newlines", () => {
  const csv = [
    "number,question,answer,points",
    '1,"Câu hỏi có dấu phẩy, và ""dấu ngoặc kép"" bên trong?","Đáp án dòng 1\nĐáp án dòng 2, có phẩy",20',
    '2,"Đỉnh ""Fansipan"" cao bao nhiêu?","3.147,3m",30',
    ""
  ].join("\n");

  const rows = parseCsvRows(csv);
  assert.equal(rows.length, 3);

  const records = parseCsv(csv);
  assert.equal(records.length, 2);
  assert.equal(
    records[0].question,
    'Câu hỏi có dấu phẩy, và "dấu ngoặc kép" bên trong?'
  );
  assert.equal(records[0].answer, "Đáp án dòng 1\nĐáp án dòng 2, có phẩy");
  assert.equal(records[0].points, "20");

  assert.equal(records[1].question, 'Đỉnh "Fansipan" cao bao nhiêu?');
  assert.equal(records[1].answer, "3.147,3m");
  assert.equal(records[1].points, "30");
});

test("parseCsv returns empty array for empty or header-only input", () => {
  assert.deepEqual(parseCsv(""), []);
  assert.deepEqual(parseCsv("id,name\n"), []);
});
