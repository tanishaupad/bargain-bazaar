import { SarvamAIClient } from "sarvamai";
import { playTurn, publicGame, type Decision, type GameState, type TurnResult } from "@/lib/game";
import { getGame, lockGame, saveGame, unlockGame } from "@/lib/game-store";

const fallback: Record<Decision, string> = {
  ACCEPT: "You have a deal! I hope you enjoy it.",
  REJECT: "That offer is too low for this piece. Try a little closer to my price.",
  COUNTER: "You bargain well! Here is my best counteroffer for now.",
  WALK_AWAY: "I am sorry, we cannot make a deal today. Maybe next time!",
};

function officialLine(turn: TurnResult): string {
  switch (turn.decision) {
    case "ACCEPT": return `Deal accepted at ₹${turn.offer}.`;
    case "REJECT": return `Offer rejected. Seller stays at ₹${turn.counteroffer}.`;
    case "COUNTER": return `Seller counters at ₹${turn.counteroffer}.`;
    case "WALK_AWAY": return "The seller walks away. No deal.";
  }
}

async function shopkeeperReply(game: GameState, turn: TurnResult, message: string): Promise<string> {
  const key = process.env.SARVAM_API_KEY;
  if (!key) return fallback[turn.decision];
  const price = turn.decision === "ACCEPT" ? turn.offer : turn.counteroffer;
  try {
    const client = new SarvamAIClient({ apiSubscriptionKey: key });
    const result = await client.chat.completions({
      model: "sarvam-105b-conversations",
      messages: [
        { role: "system", content: `You are ${game.seller.name}, a ${game.seller.personality} at an Indian bazaar, selling ${game.product.name}. Write ONE short, lively shopkeeper reaction in ${game.language}. The game's deterministic engine has ALREADY made an immutable decision: ${turn.decision}. The exact official price is ${price === null ? "none" : `₹${price}`}. Never change this decision or price, never invent another price, and never claim a purchase was completed unless the decision is ACCEPT. If REJECT, you reject the player's offer. If COUNTER, you make a counteroffer at the exact official price. If WALK_AWAY, you leave without a deal. If ACCEPT, you agree at the player's exact offer. Do not explain the game engine. No markdown.` },
        { role: "user", content: `The player's offer is ₹${turn.offer}. Their message: ${message}` },
      ],
    });
    const reply = result.choices[0]?.message.content?.trim();
    if (!reply) return fallback[turn.decision];
    // A reply containing an unexpected numeral can misstate the binding price.
    const numerals = reply.match(/[0-9०-९০-৯௦-௯౦-౯]+/g) ?? [];
    if (numerals.some((value) => value !== String(price))) return fallback[turn.decision];
    return reply.slice(0, 300);
  } catch (error) {
    console.error("Sarvam shopkeeper reply failed:", error);
    return fallback[turn.decision];
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  if (!body || typeof body !== "object") return Response.json({ error: "Invalid request." }, { status: 400 });
  const { gameId, offer, message } = body as { gameId?: unknown; offer?: unknown; message?: unknown };
  if (typeof gameId !== "string" || typeof offer !== "number" || !Number.isInteger(offer) || offer < 1 || offer > 100000 ||
      typeof message !== "string" || message.trim().length < 1 || message.trim().length > 280) {
    return Response.json({ error: "Enter a whole rupee offer and a short message." }, { status: 400 });
  }
  if (!lockGame(gameId)) return Response.json({ error: "The shopkeeper is still answering." }, { status: 409 });
  try {
    const game = await getGame(gameId);
    if (!game) return Response.json({ error: "This market session expired. Start a new round." }, { status: 404 });
    if (game.status !== "PLAYING") return Response.json({ error: "This round is already finished." }, { status: 409 });
    if (offer > game.buyerValue) return Response.json({ error: "That offer exceeds your walk-away value." }, { status: 400 });
    const turn = playTurn(game, offer);
    const reply = await shopkeeperReply(game, turn, message.trim());
    const completedTurn = { ...turn, officialLine: officialLine(turn), reply, message: message.trim() };
    game.transcript ??= [];
    game.transcript.push(completedTurn);
    await saveGame(game);
    return Response.json({ game: publicGame(game), turn: completedTurn });
  } finally {
    unlockGame(gameId);
  }
}
