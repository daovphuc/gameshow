import test from "node:test";
import assert from "node:assert/strict";
import { dropUndefined } from "../js/backend.js";

test("dropUndefined removes undefined fields Firebase would reject", () => {
  assert.deepEqual(
    dropUndefined({ status: "revealed", results: { "doi-01": { answer: "B", responseTimeMs: null } }, stats: undefined }),
    { status: "revealed", results: { "doi-01": { answer: "B", responseTimeMs: null } } }
  );
  assert.deepEqual(dropUndefined([1, undefined, { a: undefined, b: 2 }]), [1, null, { b: 2 }]);
  assert.equal(dropUndefined(undefined), null);
  assert.deepEqual(dropUndefined({ answeredAt: { ".sv": "timestamp" } }), { answeredAt: { ".sv": "timestamp" } });
  assert.equal(dropUndefined(0), 0);
});
