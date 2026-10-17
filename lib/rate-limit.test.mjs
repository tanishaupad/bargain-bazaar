import test from "node:test";
import assert from "node:assert/strict";
import { limitRequest } from "./rate-limit.ts";

test("local request limiter blocks excessive game creation", async () => {
  const request = new Request("http://localhost/api/game", { method: "POST" });
  for (let attempt = 0; attempt < 10; attempt += 1) assert.equal(await limitRequest(request, "start"), null);
  const blocked = await limitRequest(request, "start");
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get("Retry-After")) > 0);
});
