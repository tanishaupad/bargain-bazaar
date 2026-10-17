import test from "node:test";
import assert from "node:assert/strict";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { createGame, playTurn, publicGame } from "./game.ts";
import { getGame, saveGame } from "./game-store.ts";

test("a saved game and transcript survive a fresh disk read", async () => {
  const game = createGame("Hindi");
  const path = join(process.cwd(), ".data", "games", `${game.id}.json`);
  try {
    await saveGame(game);
    const firstRead = await getGame(game.id);
    assert.notEqual(firstRead, game);
    assert.equal(firstRead.id, game.id);
    assert.equal("reservationPrice" in publicGame(firstRead), false);
    playTurn(firstRead, 1);
    firstRead.transcript.push({ decision: "REJECT", offer: 1, counteroffer: firstRead.currentPrice, round: 1, officialLine: "Offer rejected.", reply: "Too low.", message: "One rupee?" });
    await saveGame(firstRead);
    const resumed = await getGame(game.id);
    assert.equal(resumed.round, 1);
    assert.equal(resumed.transcript[0].message, "One rupee?");
    assert.equal(resumed.history[0].offer, 1);
    assert.equal("insights" in publicGame(resumed), false);
  } finally {
    await unlink(path).catch(() => {});
  }
});

test("expired and invalid session ids cannot be resumed", async () => {
  const game = createGame("Tamil");
  game.updatedAt = Date.now() - 3 * 60 * 60 * 1000;
  await saveGame(game);
  assert.equal(await getGame(game.id), null);
  assert.equal(await getGame("../package.json"), null);
});
