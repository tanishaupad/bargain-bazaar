import test from "node:test";
import assert from "node:assert/strict";
import { hasOnlyExactPrice, isDecisionCompatible } from "./sarvam-dialogue.ts";

test("price guard accepts Indian number grouping and Indic digits", () => {
  assert.equal(hasOnlyExactPrice("₹1,250 works", 1250), true);
  assert.equal(hasOnlyExactPrice("₹१२५० मंजूर", 1250), true);
  assert.equal(hasOnlyExactPrice("₹১২৫০ ঠিক আছে", 1250), true);
  assert.equal(hasOnlyExactPrice("₹௧௨௫௦ சரி", 1250), true);
  assert.equal(hasOnlyExactPrice("₹౧౨౫౦ సరే", 1250), true);
  assert.equal(hasOnlyExactPrice("₹1250, not ₹1300", 1250), false);
  assert.equal(hasOnlyExactPrice("₹1250", null), false);
});

test("a counter cannot be narrated as an accepted deal", () => {
  assert.equal(isDecisionCompatible("Arre wah, ₹430 it is, my friend. This beauty is yours for exactly that.", "COUNTER"), false);
  assert.equal(isDecisionCompatible("Can you meet me at ₹440?", "COUNTER"), true);
  assert.equal(isDecisionCompatible("₹430 मंजूर है", "COUNTER"), false);
  assert.equal(isDecisionCompatible("You have a deal at ₹430.", "ACCEPT"), true);
});
