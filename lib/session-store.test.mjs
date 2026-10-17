import test from "node:test";
import assert from "node:assert/strict";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { createGame, playTurn } from "./game.ts";
import { commitSession, createSession, readSession, replaceReply } from "./session-store.ts";

test("a stale turn cannot overwrite an already committed turn", async () => {
  const game = createGame("English");
  const path = join(process.cwd(), ".data", "games", `${game.id}.json`);
  try {
    await createSession(game);
    const first = await readSession(game.id);
    const stale = await readSession(game.id);
    const next = structuredClone(first.game);
    playTurn(next, 1);
    next.transcript.push({ decision: "REJECT", offer: 1, counteroffer: next.currentPrice, round: 1, officialLine: "Rejected.", reply: "Try again.", message: "One rupee" });
    assert.equal(await commitSession(first, next), true);
    const duplicate = structuredClone(stale.game);
    playTurn(duplicate, 1);
    assert.equal(await commitSession(stale, duplicate), false);
    assert.equal((await readSession(game.id)).game.round, 1);
    assert.equal(await replaceReply(game.id, 1, "A new reply."), true);
    assert.equal((await readSession(game.id)).game.transcript[0].reply, "A new reply.");
  } finally {
    await unlink(path).catch(() => {});
  }
});
