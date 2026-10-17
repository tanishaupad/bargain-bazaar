import { randomUUID } from "node:crypto";

export const MAX_ROUNDS = 6;
export const LANGUAGES = ["English", "Hindi", "Hinglish", "Telugu", "Tamil", "Bengali"] as const;
export type Language = (typeof LANGUAGES)[number];
export type Decision = "ACCEPT" | "REJECT" | "COUNTER" | "WALK_AWAY";
export type GameTurn = { decision: Decision; offer: number; counteroffer: number | null; round: number; officialLine: string; reply: string; message: string };
export type ReplayReason =
  | "MET_ASK" | "MET_THRESHOLD" | "FINAL_ROUND_ACCEPT"
  | "LOWBALL" | "COUNTERED" | "PATIENCE_EXHAUSTED" | "FINAL_ROUND_NO_DEAL";
export type ReplayStep = {
  round: number;
  offer: number;
  askingBefore: number;
  acceptanceThreshold: number;
  counteroffer: number | null;
  askingAfter: number;
  patienceBefore: number;
  patienceAfter: number;
  decision: Decision;
  reason: ReplayReason;
};
export type GameInsights = {
  score: number;
  maxBuyerPayoff: number;
  savingsLeft: number;
  takeaway: string;
};

export const CATALOG = [
  { id: "scarf", name: "Handwoven cotton scarf", category: "Textiles", emoji: "🧣", base: 800, detail: "Soft cotton with a colorful woven border" },
  { id: "chai", name: "Brass chai kettle", category: "Home", emoji: "🫖", base: 1200, detail: "A polished kettle for slow Sunday chai" },
  { id: "juttis", name: "Embroidered juttis", category: "Fashion", emoji: "👞", base: 1500, detail: "Hand-stitched details, made for festive walks" },
  { id: "spices", name: "Masala spice box", category: "Kitchen", emoji: "🧂", base: 950, detail: "Seven fragrant spices in a steel dabba" },
  { id: "bangles", name: "Lac bangle set", category: "Accessories", emoji: "💫", base: 700, detail: "A bright set with delicate mirror work" },
  { id: "pottery", name: "Blue pottery vase", category: "Craft", emoji: "🏺", base: 1800, detail: "Hand-painted floral motifs from Jaipur" },
  { id: "lamp", name: "Carved wooden lamp", category: "Home", emoji: "🪔", base: 2200, detail: "Warm light through a carved lattice" },
  { id: "bag", name: "Block-print tote bag", category: "Textiles", emoji: "👜", base: 900, detail: "Everyday canvas with a bold hand print" },
  { id: "shawl", name: "Wool blend shawl", category: "Textiles", emoji: "🧶", base: 2600, detail: "Cozy drape in deep market colors" },
  { id: "sweets", name: "Festival sweets box", category: "Food", emoji: "🍬", base: 650, detail: "A gift-ready selection of mithai" },
] as const;

const SELLERS = [
  { name: "Meera", personality: "warm storyteller", avatar: "👩🏽", style: "friendly" },
  { name: "Ravi", personality: "playful joker", avatar: "👨🏽", style: "playful" },
  { name: "Farah", personality: "proud craft expert", avatar: "👩🏽‍🎨", style: "firm" },
  { name: "Arjun", personality: "brisk but fair", avatar: "🧑🏽", style: "practical" },
  { name: "Nandini", personality: "charming optimist", avatar: "👩🏽", style: "charming" },
] as const;

type SellerStyle = (typeof SELLERS)[number]["style"];
const STRATEGY: Record<SellerStyle, { firstRoundFloor: number; concession: number; lowballRatio: number }> = {
  friendly: { firstRoundFloor: 0.52, concession: 0.62, lowballRatio: 0.65 },
  playful: { firstRoundFloor: 0.66, concession: 0.48, lowballRatio: 0.7 },
  firm: { firstRoundFloor: 0.82, concession: 0.28, lowballRatio: 0.8 },
  practical: { firstRoundFloor: 0.64, concession: 0.5, lowballRatio: 0.72 },
  charming: { firstRoundFloor: 0.58, concession: 0.56, lowballRatio: 0.68 },
};

export type GameState = {
  id: string;
  product: (typeof CATALOG)[number];
  seller: (typeof SELLERS)[number];
  language: Language;
  askingPrice: number;
  reservationPrice: number;
  buyerValue: number;
  currentPrice: number;
  initialPatience: number;
  patience: number;
  round: number;
  status: "PLAYING" | "DEAL" | "NO_DEAL";
  finalPrice: number | null;
  lastOffer: number | null;
  history: ReplayStep[];
  transcript: GameTurn[];
  processing: boolean;
  updatedAt: number;
};

export type PublicGame = {
  id: string;
  product: { id: string; name: string; category: string; emoji: string; detail: string };
  seller: { name: string; personality: string; avatar: string };
  language: Language;
  askingPrice: number;
  buyerValue: number;
  currentPrice: number;
  patience: number;
  initialPatience: number;
  round: number;
  maxRounds: number;
  status: GameState["status"];
  finalPrice: number | null;
  reservationPrice?: number;
  buyerPayoff?: number;
  sellerProfit?: number;
  replay?: ReplayStep[];
  insights?: GameInsights;
};

export type TurnResult = { decision: Decision; counteroffer: number | null; offer: number; round: number };

const random = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const roundToTen = (value: number) => Math.round(value / 10) * 10;

export function createGame(language: Language, previousSeller?: string): GameState {
  const product = CATALOG[random(0, CATALOG.length - 1)];
  const sellerChoices = SELLERS.filter((seller) => seller.name !== previousSeller);
  const seller = sellerChoices[random(0, sellerChoices.length - 1)];
  const askingPrice = roundToTen(product.base * (random(85, 120) / 100));
  const reservationPrice = roundToTen(askingPrice * (random(55, 72) / 100));
  // The buyer knows this private value; the seller and Sarvam never receive it.
  const buyerValue = roundToTen(askingPrice * (random(78, 108) / 100));
  const patience = random(2, 4);
  return {
    id: randomUUID(), product, seller, language, askingPrice, reservationPrice, buyerValue,
    currentPrice: askingPrice, initialPatience: patience, patience, round: 0,
    status: "PLAYING", finalPrice: null, lastOffer: null, history: [], transcript: [], processing: false, updatedAt: Date.now(),
  };
}

export function publicGame(game: GameState): PublicGame {
  const finished = game.status !== "PLAYING";
  return {
    id: game.id,
    product: { id: game.product.id, name: game.product.name, category: game.product.category, emoji: game.product.emoji, detail: game.product.detail },
    seller: { name: game.seller.name, personality: game.seller.personality, avatar: game.seller.avatar },
    language: game.language, askingPrice: game.askingPrice, buyerValue: game.buyerValue, currentPrice: game.currentPrice,
    patience: game.patience, initialPatience: game.initialPatience, round: game.round,
    maxRounds: MAX_ROUNDS, status: game.status, finalPrice: game.finalPrice,
    ...(finished ? {
      reservationPrice: game.reservationPrice,
      buyerPayoff: game.finalPrice === null ? 0 : game.buyerValue - game.finalPrice,
      sellerProfit: game.finalPrice === null ? 0 : game.finalPrice - game.reservationPrice,
      replay: game.history.map((step) => ({ ...step })),
      insights: gameInsights(game),
    } : {}),
  };
}

function gameInsights(game: GameState): GameInsights {
  const maxBuyerPayoff = Math.max(0, game.buyerValue - game.reservationPrice);
  const buyerPayoff = game.finalPrice === null ? 0 : Math.max(0, game.buyerValue - game.finalPrice);
  const savingsLeft = game.finalPrice === null ? maxBuyerPayoff : Math.max(0, game.finalPrice - game.reservationPrice);
  const score = maxBuyerPayoff === 0 ? 0 : Math.round(100 * buyerPayoff / maxBuyerPayoff);
  const last = game.history.at(-1);
  let takeaway: string;
  if (game.status === "DEAL") {
    const lowestAcceptedThatRound = last ? Math.min(last.askingBefore, last.acceptanceThreshold) : game.reservationPrice;
    takeaway = game.finalPrice === game.reservationPrice
      ? "You reached the seller's minimum and captured all available buyer surplus."
      : game.finalPrice !== null && game.finalPrice > lowestAcceptedThatRound
        ? `In the final round, an offer of ₹${lowestAcceptedThatRound.toLocaleString("en-IN")} would also have been accepted. A smaller step could have saved you ₹${(game.finalPrice - lowestAcceptedThatRound).toLocaleString("en-IN")}.`
        : "You reached a deal at the lowest price the seller would have accepted in that round.";
  } else if (maxBuyerPayoff === 0) {
    takeaway = "Your value was at or below the seller's minimum, so there was no positive surplus to split.";
  } else if (game.history.some((step) => step.reason === "LOWBALL" || step.reason === "PATIENCE_EXHAUSTED")) {
    takeaway = "A deal was possible in principle, but low or repeated offers used up the seller's patience. Try moving toward their counteroffer sooner.";
  } else {
    takeaway = "A deal was possible in principle, but your offers never cleared the seller's threshold before time ran out.";
  }
  return { score, maxBuyerPayoff, savingsLeft, takeaway };
}

export function playTurn(game: GameState, offer: number): TurnResult {
  if (game.status !== "PLAYING" || game.round >= MAX_ROUNDS) throw new Error("Game already finished");
  if (!Number.isInteger(offer) || offer < 1 || offer > 100000) throw new Error("Offer must be a whole rupee amount");
  if (offer > game.buyerValue) throw new Error("Offer exceeds your walk-away value");

  game.round += 1;
  const askingBefore = game.currentPrice;
  const patienceBefore = game.patience;
  const strategy = STRATEGY[game.seller.style];
  const openingGap = game.askingPrice - game.reservationPrice;
  const timePressure = (game.round - 1) / (MAX_ROUNDS - 1);
  const acceptanceFloor = roundToTen(game.reservationPrice + openingGap * strategy.firstRoundFloor * (1 - timePressure));
  const finalRound = game.round === MAX_ROUNDS;
  const repeatedOrLower = game.lastOffer !== null && offer <= game.lastOffer;
  game.lastOffer = offer;

  let decision: Decision;
  let counteroffer: number | null = null;
  let reason: ReplayReason;
  if (offer >= game.reservationPrice && (offer >= game.currentPrice || offer >= acceptanceFloor || finalRound)) {
    decision = "ACCEPT";
    reason = offer >= askingBefore ? "MET_ASK" : offer >= acceptanceFloor ? "MET_THRESHOLD" : "FINAL_ROUND_ACCEPT";
    game.status = "DEAL";
    game.finalPrice = offer;
  } else {
    const lowball = offer < game.reservationPrice * strategy.lowballRatio;
    game.patience = Math.max(0, game.patience - (lowball || repeatedOrLower ? 1 : 0));
    if (finalRound || game.patience === 0) {
      decision = "WALK_AWAY";
      reason = finalRound ? "FINAL_ROUND_NO_DEAL" : "PATIENCE_EXHAUSTED";
      game.status = "NO_DEAL";
    } else if (lowball) {
      decision = "REJECT";
      reason = "LOWBALL";
      counteroffer = game.currentPrice;
    } else {
      decision = "COUNTER";
      reason = "COUNTERED";
      // Seller concessions shrink the gap while never crossing their minimum.
      const concessionGap = game.currentPrice - Math.max(offer, game.reservationPrice);
      const target = Math.max(game.reservationPrice, roundToTen(game.currentPrice - concessionGap * strategy.concession));
      game.currentPrice = Math.min(game.currentPrice, target);
      counteroffer = game.currentPrice;
    }
  }
  game.history.push({
    round: game.round, offer, askingBefore, acceptanceThreshold: acceptanceFloor,
    counteroffer, askingAfter: game.currentPrice, patienceBefore, patienceAfter: game.patience,
    decision, reason,
  });
  game.updatedAt = Date.now();
  return { decision, counteroffer, offer, round: game.round };
}
