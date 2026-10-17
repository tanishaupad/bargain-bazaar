import test from "node:test";
import assert from "node:assert/strict";
import { hasOnlyExactPrice } from "./sarvam-dialogue.ts";

test("price guard accepts Indian number grouping and Indic digits", () => {
  assert.equal(hasOnlyExactPrice("₹1,250 works", 1250), true);
  assert.equal(hasOnlyExactPrice("₹१२५० मंजूर", 1250), true);
  assert.equal(hasOnlyExactPrice("₹১২৫০ ঠিক আছে", 1250), true);
  assert.equal(hasOnlyExactPrice("₹௧௨௫௦ சரி", 1250), true);
  assert.equal(hasOnlyExactPrice("₹౧౨౫౦ సరే", 1250), true);
  assert.equal(hasOnlyExactPrice("₹1250, not ₹1300", 1250), false);
  assert.equal(hasOnlyExactPrice("₹1250", null), false);
});
