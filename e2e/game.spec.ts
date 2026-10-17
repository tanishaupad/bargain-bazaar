import { expect, test } from "@playwright/test";

type Game = {
  id: string;
  status: "PLAYING" | "DEAL" | "NO_DEAL";
  round: number;
  buyerValue: number;
  finalPrice: number | null;
  reservationPrice?: number;
};

test("plays a deal, restores it after reload, and starts a new stall", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "हिन्दी" }).click();

  const startResponse = page.waitForResponse((response) => response.url().endsWith("/api/game") && response.request().method() === "POST");
  await page.getByRole("button", { name: /Enter the bazaar/ }).click();
  let game = ((await (await startResponse).json()) as { game: Game }).game;
  expect(game.status).toBe("PLAYING");
  await expect(page.getByText("The seller’s minimum stays secret until this game ends.")).toBeVisible();
  await expect(page.getByText("Hidden minimum")).toHaveCount(0);

  async function offer(amount: number) {
    await page.getByLabel("Your offer").fill(String(amount));
    await page.getByLabel("Bargaining message").fill("Bhaiya, please consider this price.");
    const response = page.waitForResponse((item) => item.url().endsWith("/api/game/turn") && item.request().method() === "POST");
    await page.getByRole("button", { name: /Make my offer/ }).click();
    const result = await response;
    expect(result.ok()).toBeTruthy();
    game = ((await result.json()) as { game: Game }).game;
  }

  await offer(1);
  expect(game.round).toBe(1);
  await page.reload();
  await expect(page.getByRole("heading", { name: /A good bargain starts with a conversation/ })).toBeVisible();
  await page.getByRole("button", { name: /Continue game/ }).click();
  await expect(page.getByText("You offered ₹1")).toBeVisible();
  await expect(page.getByText("Hidden minimum")).toHaveCount(0);

  for (const fraction of [0.82, 0.89, 0.96, 1]) {
    if (game.status !== "PLAYING") break;
    await offer(Math.round(game.buyerValue * fraction));
  }
  expect(game.status).toBe("DEAL");
  expect(game.finalPrice).not.toBeNull();
  await expect(page.getByText("Deal price")).toBeVisible();
  const price = `₹${game.finalPrice!.toLocaleString("en-IN")}`;
  await expect(page.getByText("Deal price").locator("..")).toContainText(price);
  await expect(page.getByText("Hidden minimum")).toBeVisible();
  await expect(page.getByText("The seller’s minimum and strategy are revealed in your results.")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: /A good bargain starts with a conversation/ })).toBeVisible();
  await page.getByRole("button", { name: /View result/ }).click();
  await expect(page.getByText("Deal price").locator("..")).toContainText(price);
  await expect(page.getByText("Hidden minimum")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: /Play again with a new shopkeeper/ })).toBeVisible();
  const nextResponse = page.waitForResponse((response) => response.url().endsWith("/api/game") && response.request().method() === "POST");
  await page.getByRole("button", { name: /Play again with a new shopkeeper/ }).click();
  const next = ((await (await nextResponse).json()) as { game: Game }).game;
  expect(next.id).not.toBe(game.id);
  await expect(page.getByText("Hidden minimum")).toHaveCount(0);
});

test("rejects a stale turn without advancing the session", async ({ request }) => {
  const start = await request.post("/api/game", { data: { language: "English" } });
  expect(start.ok()).toBeTruthy();
  const game = ((await start.json()) as { game: Game }).game;
  const turn = { gameId: game.id, expectedRound: 0, offer: 1, message: "Can you do better?" };
  const first = await request.post("/api/game/turn", { data: turn });
  expect(first.ok()).toBeTruthy();
  const stale = await request.post("/api/game/turn", { data: turn });
  expect(stale.status()).toBe(409);
  const state = await request.get(`/api/game?id=${encodeURIComponent(game.id)}`);
  const restored = (await state.json()) as { game: Game; turns: unknown[] };
  expect(restored.game.round).toBe(1);
  expect(restored.turns).toHaveLength(1);
});
