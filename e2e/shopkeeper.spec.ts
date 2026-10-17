import { expect, test } from "@playwright/test";

test("shopkeeper sets a price, bargains, sees the hidden budget, and resumes the result", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Shopkeeper Mode" }).click();
  await expect(page.getByRole("heading", { name: "Run your own stall." })).toBeVisible();
  await page.getByRole("button", { name: /Brass chai kettle/ }).click();
  await page.getByLabel("Initial listing price").fill("1800");

  const startResponse = page.waitForResponse((response) => response.url().endsWith("/api/shopkeeper") && response.request().method() === "POST");
  await page.getByRole("button", { name: /Open my stall/ }).click();
  let game = (await (await startResponse).json()).game;
  expect(game.status).toBe("PLAYING");
  expect(game.buyer.style).toBeUndefined();
  expect(game.maxPrice).toBeUndefined();
  await expect(page.getByText("Customer maximum")).toHaveCount(0);
  await expect(page.getByText(`₹${game.initialOffer.toLocaleString("en-IN")}`, { exact: false }).first()).toBeVisible();

  await page.getByLabel("Your counter").fill("100000");
  await page.getByLabel("Your message").fill("Other stalls charge more, and I have another customer waiting.");
  const counterResponse = page.waitForResponse((response) => response.url().endsWith("/api/shopkeeper/turn") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Counteroffer" }).click();
  const counter = await (await counterResponse).json();
  expect(counter.turn.decision).not.toBe("ACCEPT");
  game = counter.game;
  expect(game.maxPrice).toBeUndefined();

  if (game.status === "PLAYING") {
    const acceptResponse = page.waitForResponse((response) => response.url().endsWith("/api/shopkeeper/turn") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Accept Offer" }).click();
    game = (await (await acceptResponse).json()).game;
    expect(game.status).toBe("DEAL");
    expect(game.finalPrice).toBeLessThanOrEqual(game.maxPrice);
    expect(game.realizedProfit).toBe(game.finalPrice - game.purchaseCost);
  }
  await expect(page.getByText("Customer maximum")).toBeVisible();
  await expect(page.getByText("Surplus captured")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Run your own stall." })).toBeVisible();
  await page.getByRole("button", { name: /View result/ }).click();
  await expect(page.getByText("Customer maximum")).toBeVisible();
  await page.getByRole("link", { name: "Customer Mode" }).click();
  await expect(page.getByRole("heading", { name: "Bargain Bazaar" })).toBeVisible();
});

test("shopkeeper can reject and walk away with zero realized profit", async ({ page }) => {
  await page.goto("/shopkeeper");
  await page.getByRole("button", { name: /Open my stall/ }).click();
  await expect(page.getByRole("button", { name: "Reject" })).toBeVisible();
  const rejectResponse = page.waitForResponse((response) => response.url().endsWith("/api/shopkeeper/turn") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Reject" }).click();
  const rejected = await (await rejectResponse).json();
  expect(rejected.turn.decision).toBe("COUNTER");
  expect(rejected.game.maxPrice).toBeUndefined();
  const walkResponse = page.waitForResponse((response) => response.url().endsWith("/api/shopkeeper/turn") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Walk Away" }).click();
  const walked = await (await walkResponse).json();
  expect(walked.game.status).toBe("NO_DEAL");
  expect(walked.game.realizedProfit).toBe(0);
  expect(walked.game.surplusCapturedPercent).toBe(0);
  await expect(page.getByText("Customer maximum")).toBeVisible();
});
