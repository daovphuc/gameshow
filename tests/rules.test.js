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

test("content root read excludes team and grants read only on allowed children", () => {
  const parsed = JSON.parse(fs.readFileSync(path.resolve("firebase/database.rules.json"), "utf8"));
  const contentRule = parsed.rules?.content?.[".read"];
  assert.ok(typeof contentRule === "string" && contentRule.length > 0, "content/.read must exist");
  assert.ok(contentRule.includes("'host'"), "content/.read must allow host");
  assert.ok(contentRule.includes("'head_judge'"), "content/.read must allow head_judge");
  assert.ok(contentRule.includes("'judge'"), "content/.read must allow judge");
  assert.ok(!contentRule.includes("'team'"), "content/.read must exclude team");

  const allowedChildren = ["teams", "config", "clusters", "round_order", "judges"];
  for (const child of allowedChildren) {
    const childRead = parsed.rules?.content?.[child]?.[".read"];
    assert.ok(typeof childRead === "string", `content/${child}/.read must exist`);
    assert.ok(childRead.includes("'team'"), `content/${child}/.read must grant read to team`);
  }

  const forbiddenChildren = ["round1", "round2", "round3"];
  for (const child of forbiddenChildren) {
    const childNode = parsed.rules?.content?.[child];
    const childRead = childNode?.[".read"];
    assert.ok(
      !childRead || !childRead.includes("'team'"),
      `content/${child}/.read must not grant read to team`
    );
  }
});

test("answers root read excludes team and allows matching team ref_id per question", () => {
  const parsed = JSON.parse(fs.readFileSync(path.resolve("firebase/database.rules.json"), "utf8"));
  const answersRule = parsed.rules?.answers?.[".read"];
  assert.ok(typeof answersRule === "string" && answersRule.length > 0, "answers/.read must exist");
  assert.ok(answersRule.includes("'host'"), "answers/.read must allow host");
  assert.ok(answersRule.includes("'head_judge'"), "answers/.read must allow head_judge");
  assert.ok(answersRule.includes("'judge'"), "answers/.read must allow judge");
  assert.ok(!answersRule.includes("'team'"), "answers/.read must exclude team");

  const teamReadRule = parsed.rules?.answers?.["$questionKey"]?.["$teamId"]?.[".read"];
  assert.ok(
    typeof teamReadRule === "string" && teamReadRule.length > 0,
    "answers/$questionKey/$teamId/.read must exist"
  );
  assert.ok(teamReadRule.includes("'team'"), "must check role === 'team'");
  assert.ok(teamReadRule.includes("ref_id"), "must check ref_id");
  assert.ok(teamReadRule.includes("$teamId"), "must match $teamId");
});

test("draw request write policy allows host and active stage team only, excludes other teams and judges; live remains unwritable by teams", () => {
  const parsed = JSON.parse(fs.readFileSync(path.resolve("firebase/database.rules.json"), "utf8"));

  // Teams cannot write to live
  const liveWrite = parsed.rules?.live?.[".write"];
  assert.ok(typeof liveWrite === "string", "live/.write must exist");
  assert.ok(liveWrite.includes("'host'"), "live/.write must allow host");
  assert.ok(!liveWrite.includes("'team'"), "live/.write must not allow team");

  // Nor can teams write any live subpath
  function assertNoTeamWrite(node, currentPath = "live") {
    if (!node || typeof node !== "object") return;
    for (const [key, value] of Object.entries(node)) {
      if (key === ".write" && typeof value === "string") {
        assert.ok(!value.includes("'team'"), `Found team in .write at ${currentPath}`);
      } else if (typeof value === "object" && value !== null) {
        assertNoTeamWrite(value, `${currentPath}.${key}`);
      }
    }
  }
  assertNoTeamWrite(parsed.rules?.live);

  // drawRequest
  const drawRule = parsed.rules?.drawRequest;
  assert.ok(drawRule, "rules.drawRequest must exist");

  const drawRead = drawRule?.[".read"];
  assert.ok(typeof drawRead === "string", "drawRequest/.read must exist");
  assert.ok(drawRead.includes("'host'"), "drawRequest/.read must allow host");
  assert.ok(!drawRead.includes("'team'") && !drawRead.includes("'judge'"), "drawRequest/.read must exclude team/judge");

  const drawWrite = drawRule?.[".write"];
  assert.ok(typeof drawWrite === "string", "drawRequest/.write must exist");
  assert.ok(drawWrite.includes("'host'"), "drawRequest/.write must allow host");
  assert.ok(drawWrite.includes("'team'"), "drawRequest/.write must allow team");
  assert.ok(drawWrite.includes("ref_id"), "drawRequest/.write must check ref_id");
  assert.ok(drawWrite.includes("stageTeamId"), "drawRequest/.write must check against stageTeamId");
  assert.ok(drawWrite.includes("live/currentRound').val() === 'round2'"), "drawRequest/.write must let any team request the round 2 set draw");
  assert.ok(!drawWrite.includes("'judge'"), "drawRequest/.write must exclude judge");

  // Validated shape
  const drawValidate = drawRule?.[".validate"];
  assert.ok(typeof drawValidate === "string" && drawValidate.length > 0, "drawRequest/.validate must exist");
  assert.ok(drawValidate.includes("requestedAt"), "drawRequest/.validate must check requestedAt");
});
