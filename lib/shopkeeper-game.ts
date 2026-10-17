import { randomUUID } from "node:crypto";
import { CATALOG, LANGUAGES, MAX_ROUNDS, type Language } from "./game.ts";

export type ShopkeeperAction = "ACCEPT" | "REJECT" | "COUNTER" | "WALK_AWAY";
export type CustomerDecision = "ACCEPT" | "COUNTER" | "WALK_AWAY";
type BuyerStyle = "hurried" | "comparison shopper" | "careful" | "contradictory";

export type ShopkeeperTurn = {
  round: number;
  action: ShopkeeperAction;
  sellerPrice: number | null;
  message: string;
  decision: CustomerDecision;
  customerOffer: number | null;
  officialLine: string;
  reply: string;
};

export type ShopkeeperGameState = {
  mode: "shopkeeper";
  id: string;
  product: (typeof CATALOG)[number];
  purchaseCost: number;
  listingPrice: number;
  buyer: { name: string; avatar: string; style: BuyerStyle; language: Language; maxPrice: number; initialOffer: number; patience: number; tactic: string };
  currentOffer: number;
  patience: number;
  round: number;
  status: "PLAYING" | "DEAL" | "NO_DEAL";
  finalPrice: number | null;
  openingReply: string;
  transcript: ShopkeeperTurn[];
  updatedAt: number;
};

export type PublicShopkeeperGame = {
  mode: "shopkeeper";
  id: string;
  product: { id: string; name: string; category: string; emoji: string; detail: string };
  purchaseCost: number;
  listingPrice: number;
  buyer: { name: string; avatar: string; language: Language; style?: BuyerStyle };
  initialOffer: number;
  currentOffer: number;
  round: number;
  maxRounds: number;
  status: ShopkeeperGameState["status"];
  finalPrice: number | null;
  openingReply: string;
  maxPrice?: number;
  realizedProfit?: number;
  availableSurplus?: number;
  surplusCapturedPercent?: number;
};

const BUYERS: { name: string; avatar: string }[] = [
  { name: "Aditi", avatar: "👩🏽" }, { name: "Kabir", avatar: "👨🏽" },
  { name: "Sana", avatar: "👩🏽" }, { name: "Dev", avatar: "🧑🏽" },
  { name: "Tara", avatar: "👩🏽" }, { name: "Imran", avatar: "👨🏽" },
];
const STYLES: BuyerStyle[] = ["hurried", "comparison shopper", "careful", "contradictory"];
const random = (low: number, high: number) => Math.floor(Math.random() * (high - low + 1)) + low;
const roundTen = (value: number) => Math.round(value / 10) * 10;

export function purchaseCostFor(productId: string): number | null {
  const product = CATALOG.find((item) => item.id === productId);
  return product ? roundTen(product.base * 0.62) : null;
}

export function catalogForShopkeeper() {
  return CATALOG.map(({ id, name, category, emoji, detail, base }) => ({ id, name, category, emoji, detail, purchaseCost: roundTen(base * 0.62), suggestedListing: base }));
}

export function customerCue(game: ShopkeeperGameState): string {
  if (game.buyer.style === "hurried") return game.round >= 2 ? "I said I was in a hurry, but now I can wait for another shop if needed." : "I need to finish shopping soon, so give me a quick answer.";
  if (game.buyer.style === "comparison shopper") return game.round >= 2 ? "I checked another stall again; their price might be lower, though I am not certain." : "I saw something similar at another stall and am comparing prices.";
  if (game.buyer.style === "contradictory") return game.round >= 2 ? "Earlier I said this was only for myself, but I may be buying it for a friend after all." : "This is just for me, so I am keeping to a strict budget.";
  return game.round >= 2 ? "I like it, but I need to think about the value before spending more." : "I like the item, but I am watching what I spend.";
}

export function createShopkeeperGame(productId: string, listingPrice: number): ShopkeeperGameState {
  const product = CATALOG.find((item) => item.id === productId);
  const purchaseCost = purchaseCostFor(productId);
  if (!product || purchaseCost === null || !Number.isInteger(listingPrice) || listingPrice < purchaseCost + 10 || listingPrice > 100000) throw new Error("Choose a product and a listing price above its cost.");
  const name = BUYERS[random(0, BUYERS.length - 1)];
  const maxPrice = roundTen(Math.max(purchaseCost + 40, product.base * random(82, 125) / 100));
  const initialOffer = Math.max(10, Math.min(maxPrice - 10, roundTen(Math.min(listingPrice * random(58, 73) / 100, maxPrice * random(58, 73) / 100))));
  const style = STYLES[random(0, STYLES.length - 1)];
  const language = LANGUAGES[random(0, LANGUAGES.length - 1)];
  const buyer = { ...name, style, language, maxPrice, initialOffer, patience: random(2, 5), tactic: style };
  const game: ShopkeeperGameState = {
    mode: "shopkeeper", id: randomUUID(), product, purchaseCost, listingPrice, buyer,
    currentOffer: initialOffer, patience: buyer.patience, round: 0, status: "PLAYING",
    finalPrice: null, openingReply: "", transcript: [], updatedAt: Date.now(),
  };
  game.openingReply = `${customerCue(game)} Would you consider ₹${initialOffer}?`;
  return game;
}

export function publicShopkeeperGame(game: ShopkeeperGameState): PublicShopkeeperGame {
  const finished = game.status !== "PLAYING";
  const availableSurplus = Math.max(0, game.buyer.maxPrice - game.purchaseCost);
  const realizedProfit = game.finalPrice === null ? 0 : game.finalPrice - game.purchaseCost;
  return {
    mode: "shopkeeper", id: game.id,
    product: { id: game.product.id, name: game.product.name, category: game.product.category, emoji: game.product.emoji, detail: game.product.detail },
    purchaseCost: game.purchaseCost, listingPrice: game.listingPrice,
    buyer: { name: game.buyer.name, avatar: game.buyer.avatar, language: game.buyer.language, ...(finished ? { style: game.buyer.style } : {}) },
    initialOffer: game.buyer.initialOffer,
    currentOffer: game.currentOffer, round: game.round, maxRounds: MAX_ROUNDS, status: game.status,
    finalPrice: game.finalPrice, openingReply: game.openingReply,
    ...(finished ? { maxPrice: game.buyer.maxPrice, realizedProfit, availableSurplus,
      surplusCapturedPercent: availableSurplus === 0 || game.finalPrice === null ? 0 : Math.max(0, Math.min(100, Math.round(100 * realizedProfit / availableSurplus))) } : {}),
  };
}

export function playShopkeeperTurn(game: ShopkeeperGameState, action: ShopkeeperAction, sellerPrice: number | null): CustomerDecision {
  if (game.status !== "PLAYING" || game.round >= MAX_ROUNDS) throw new Error("Game already finished");
  if (action === "COUNTER" && (!Number.isInteger(sellerPrice) || sellerPrice === null || sellerPrice <= game.currentOffer || sellerPrice > 100000)) throw new Error("Counter above the current offer with a whole rupee price.");
  game.round += 1;
  let decision: CustomerDecision;
  if (action === "ACCEPT") {
    game.status = "DEAL";
    game.finalPrice = game.currentOffer;
    decision = "ACCEPT";
  } else if (action === "WALK_AWAY") {
    game.status = "NO_DEAL";
    decision = "WALK_AWAY";
  } else {
    const max = game.buyer.maxPrice;
    const progress = game.round / MAX_ROUNDS;
    const pace = game.buyer.style === "hurried" ? 1.15 : game.buyer.style === "comparison shopper" ? 0.75 : game.buyer.style === "contradictory" ? 0.8 : 0.95;
    const threshold = Math.min(max, roundTen(game.buyer.initialOffer + (max - game.buyer.initialOffer) * progress * pace));
    if (action === "COUNTER" && sellerPrice !== null && sellerPrice <= max && (sellerPrice <= threshold || game.round === MAX_ROUNDS)) {
      game.status = "DEAL";
      game.finalPrice = sellerPrice;
      decision = "ACCEPT";
    } else {
      game.patience -= action === "REJECT" || (sellerPrice !== null && sellerPrice > max) ? 1 : 0;
      const ceiling = action === "COUNTER" && sellerPrice !== null ? Math.min(max, sellerPrice - 10) : max;
      const increment = Math.max(10, roundTen((ceiling - game.currentOffer) * (0.24 + progress * 0.22) * pace));
      const nextOffer = Math.min(ceiling, game.currentOffer + increment);
      if (game.round === MAX_ROUNDS || game.patience <= 0 || nextOffer <= game.currentOffer) {
        game.status = "NO_DEAL";
        decision = "WALK_AWAY";
      } else {
        game.currentOffer = nextOffer;
        decision = "COUNTER";
      }
    }
  }
  game.updatedAt = Date.now();
  return decision;
}
