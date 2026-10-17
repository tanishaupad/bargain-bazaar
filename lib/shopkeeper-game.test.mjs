import test from "node:test";
import assert from "node:assert/strict";
import { createShopkeeperGame, customerCue, playShopkeeperTurn, publicShopkeeperGame, purchaseCostFor } from "./shopkeeper-game.ts";

test("buyer maximum and personality stay private until a deal ends", () => {
  const cost = purchaseCostFor("scarf");
  const game = createShopkeeperGame("scarf", cost + 300);
  const before = publicShopkeeperGame(game);
  assert.equal("maxPrice" in before, false);
  assert.equal("style" in before.buyer, false);
  assert.ok(before.initialOffer < game.buyer.maxPrice);
  assert.equal(playShopkeeperTurn(game, "ACCEPT", null), "ACCEPT");
  const result = publicShopkeeperGame(game);
  assert.equal(result.finalPrice, before.initialOffer);
  assert.equal(result.maxPrice, game.buyer.maxPrice);
  assert.equal(result.realizedProfit, result.finalPrice - cost);
  assert.equal(result.surplusCapturedPercent, Math.max(0, Math.min(100, Math.round(100 * result.realizedProfit / result.availableSurplus))));
  assert.equal(result.buyer.style, game.buyer.style);
});

test("a customer never accepts a counter above their private maximum", () => {
  const game = createShopkeeperGame("pottery", 2500);
  let decision;
  while (game.status === "PLAYING") {
    decision = playShopkeeperTurn(game, "COUNTER", game.buyer.maxPrice + 500);
    assert.ok(game.currentOffer <= game.buyer.maxPrice);
    assert.notEqual(decision, "ACCEPT");
  }
  assert.equal(decision, "WALK_AWAY");
  assert.equal(publicShopkeeperGame(game).realizedProfit, 0);
  assert.equal(publicShopkeeperGame(game).surplusCapturedPercent, 0);
});

test("customer can accept a fair counter as rounds progress", () => {
  const game = createShopkeeperGame("chai", 1600);
  Object.assign(game.buyer, { maxPrice: 1400, initialOffer: 700, style: "careful" });
  Object.assign(game, { currentOffer: 900, round: 3, patience: 3 });
  assert.equal(playShopkeeperTurn(game, "COUNTER", 1000), "ACCEPT");
  assert.equal(game.finalPrice, 1000);
  assert.throws(() => playShopkeeperTurn(game, "REJECT", null), /finished/);
});

test("buyer tactics include an inferable change of story", () => {
  const game = createShopkeeperGame("bag", 1100);
  game.buyer.style = "contradictory";
  assert.match(customerCue(game), /just for me/);
  game.round = 2;
  assert.match(customerCue(game), /friend after all/);
});
