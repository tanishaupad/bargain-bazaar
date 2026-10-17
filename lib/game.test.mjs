import test from "node:test";
import assert from "node:assert/strict";
import { createGame, MAX_ROUNDS, playTurn, publicGame } from "./game.ts";

test("minimum price stays private until the game ends", () => {
  const game = createGame("Tamil");
  assert.equal("reservationPrice" in publicGame(game), false);
  assert.equal("replay" in publicGame(game), false);
  assert.equal("insights" in publicGame(game), false);
  game.buyerValue = game.askingPrice;
  playTurn(game, game.askingPrice);
  assert.equal(publicGame(game).reservationPrice, game.reservationPrice);
  assert.equal(publicGame(game).replay.length, 1);
  assert.equal(publicGame(game).insights.score, Math.round(100 * (game.buyerValue - game.askingPrice) / (game.buyerValue - game.reservationPrice)));
});

test("accepted deals and seller counters never go below the minimum", () => {
  for (let i = 0; i < 100; i++) {
    const game = createGame("English");
    while (game.status === "PLAYING") {
      const result = playTurn(game, Math.max(1, game.reservationPrice - 10));
      if (result.counteroffer !== null) assert.ok(result.counteroffer >= game.reservationPrice);
    }
    assert.ok(game.round <= MAX_ROUNDS);
    if (game.status === "DEAL") assert.ok(game.finalPrice >= game.reservationPrice);
  }
});

test("a persistent low offer ends the game with no deal", () => {
  const game = createGame("Bengali");
  while (game.status === "PLAYING") playTurn(game, 1);
  assert.equal(game.status, "NO_DEAL");
  assert.equal(publicGame(game).buyerPayoff, 0);
  assert.equal(publicGame(game).sellerProfit, 0);
  assert.equal(publicGame(game).insights.score, 0);
  assert.equal(publicGame(game).replay.length, game.round);
  assert.equal(publicGame(game).replay.at(-1).decision, "WALK_AWAY");
});

test("buyer payoff uses private value and offers cannot exceed it", () => {
  const game = createGame("English");
  Object.assign(game, { askingPrice: 1500, currentPrice: 1500, reservationPrice: 800, buyerValue: 1300 });
  game.seller = { name: "Meera", personality: "warm storyteller", avatar: "👩🏽", style: "friendly" };
  assert.throws(() => playTurn(game, 1301), /walk-away value/);
  assert.equal(game.round, 0);
  const result = playTurn(game, 1300);
  assert.equal(result.decision, "ACCEPT");
  assert.equal(publicGame(game).buyerPayoff, 0);
  assert.equal(publicGame(game).sellerProfit, 500);
  assert.deepEqual({ score: publicGame(game).insights.score, maximum: publicGame(game).insights.maxBuyerPayoff, left: publicGame(game).insights.savingsLeft }, { score: 0, maximum: 500, left: 500 });
});

test("seller style changes acceptance and concession at identical prices", () => {
  const base = createGame("English");
  Object.assign(base, { askingPrice: 1500, currentPrice: 1500, reservationPrice: 800, buyerValue: 1300, patience: 4 });
  const friendly = structuredClone(base);
  friendly.seller = { name: "Meera", personality: "warm storyteller", avatar: "👩🏽", style: "friendly" };
  const firm = structuredClone(base);
  firm.seller = { name: "Farah", personality: "proud craft expert", avatar: "👩🏽‍🎨", style: "firm" };
  assert.equal(playTurn(friendly, 1200).decision, "ACCEPT");
  assert.equal(playTurn(firm, 1200).decision, "COUNTER");

  const friendlyCounter = structuredClone(base);
  friendlyCounter.seller = friendly.seller;
  const firmCounter = structuredClone(base);
  firmCounter.seller = firm.seller;
  const first = playTurn(friendlyCounter, 1000);
  const second = playTurn(firmCounter, 1000);
  assert.equal(first.decision, "COUNTER");
  assert.equal(second.decision, "COUNTER");
  assert.ok(first.counteroffer < second.counteroffer);
});

test("replay records private thresholds and exact state changes only after completion", () => {
  const game = createGame("English");
  Object.assign(game, { askingPrice: 1500, currentPrice: 1500, reservationPrice: 800, buyerValue: 1300, patience: 4, initialPatience: 4 });
  game.seller = { name: "Farah", personality: "proud craft expert", avatar: "👩🏽‍🎨", style: "firm" };
  const first = playTurn(game, 1000);
  assert.equal(first.decision, "COUNTER");
  assert.equal("replay" in publicGame(game), false);
  assert.equal("insights" in publicGame(game), false);
  assert.deepEqual(game.history[0], {
    round: 1, offer: 1000, askingBefore: 1500, acceptanceThreshold: 1370,
    counteroffer: 1360, askingAfter: 1360, patienceBefore: 4, patienceAfter: 4,
    decision: "COUNTER", reason: "COUNTERED",
  });
  playTurn(game, 1300);
  assert.equal(game.status, "DEAL");
  const replay = publicGame(game).replay;
  assert.equal(replay.length, 2);
  assert.equal(replay[1].reason, "MET_THRESHOLD");
  replay[0].offer = 1;
  assert.equal(game.history[0].offer, 1000);
});

test("strategy report scores captured surplus and cites an offer accepted in the final round", () => {
  const game = createGame("English");
  Object.assign(game, { askingPrice: 1500, currentPrice: 1500, reservationPrice: 800, buyerValue: 1300 });
  game.seller = { name: "Meera", personality: "warm storyteller", avatar: "👩🏽", style: "friendly" };
  playTurn(game, 1250);
  const { insights } = publicGame(game);
  assert.equal(insights.score, 10);
  assert.equal(insights.maxBuyerPayoff, 500);
  assert.equal(insights.savingsLeft, 450);
  assert.match(insights.takeaway, /₹1,160/);
  assert.match(insights.takeaway, /₹90/);
});
