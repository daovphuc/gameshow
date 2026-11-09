import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("firebase/database.rules.json policy assertion", () => {
  const rulesPath = path.resolve("firebase/database.rules.json");
  const raw = fs.readFileSync(rulesPath, "utf8");
  const parsed = JSON.parse(raw);

  assert.ok(parsed && parsed.rules, "Rules JSON must contain a root 'rules' object");

  // Root .read must not be true
  assert.notEqual(parsed.rules[".read"], true, "Root .read must not be true");

  // No .write anywhere in the entire JSON tree may be the literal true
  function assertNoLiteralTrueWrite(node, currentPath = "rules") {
    if (!node || typeof node !== "object") return;
    for (const [key, value] of Object.entries(node)) {
      const childPath = `${currentPath}.${key}`;
      if (key === ".write") {
        assert.notEqual(
          value,
          true,
          `Found literal true for .write at ${childPath}, which is disallowed`
        );
      }
      if (typeof value === "object" && value !== null) {
        assertNoLiteralTrueWrite(value, childPath);
      }
    }
  }

  assertNoLiteralTrueWrite(parsed.rules);

  // answers/$questionKey/$teamId/.write conditions
  const answerWriteRule = parsed.rules?.answers?.["$questionKey"]?.["$teamId"]?.[".write"];
  assert.ok(
    typeof answerWriteRule === "string" && answerWriteRule.length > 0,
    "answers/$questionKey/$teamId/.write must be defined as a non-empty string"
  );

  assert.ok(
    answerWriteRule.includes("live/round2/questionKey"),
    "Rule must contain condition for live/round2/questionKey"
  );
  assert.ok(
    answerWriteRule.includes("status"),
    "Rule must contain condition for status"
  );
  assert.ok(
    answerWriteRule.includes("deadline"),
    "Rule must contain condition for deadline"
  );
  assert.ok(
    answerWriteRule.includes("answeredAt") && answerWriteRule.includes("now"),
    "Rule must contain condition for answeredAt === now"
  );
  assert.ok(
    answerWriteRule.includes("ref_id"),
    "Rule must contain condition for ref_id"
  );
});

test("only host and head judge may write overtime penalties", () => {
  const parsed = JSON.parse(fs.readFileSync(path.resolve("firebase/database.rules.json"), "utf8"));
  const rule = parsed.rules?.live?.penalties?.["$round"]?.["$team"]?.[".write"];
  assert.ok(typeof rule === "string", "live/penalties/$round/$team/.write must exist");
  assert.ok(rule.includes("'host'") && rule.includes("'head_judge'"));
  assert.ok(!rule.includes("'judge'") && !rule.includes("'team'"));
});
