import { customerCue, playShopkeeperTurn, publicShopkeeperGame, type ShopkeeperAction, type ShopkeeperGameState, type ShopkeeperTurn } from "@/lib/shopkeeper-game";
import { generateDialogue } from "@/lib/sarvam-dialogue";
import { commitSession, readSession, replaceReply } from "@/lib/session-store";
import { limitGlobalTurns, limitRequest } from "@/lib/rate-limit";
import { incompatibleSellerLanguage, romanizeCustomerReply } from "@/lib/customer-language";

const actions: ShopkeeperAction[] = ["ACCEPT", "REJECT", "COUNTER", "WALK_AWAY"];

function officialLine(game: ShopkeeperGameState, action: ShopkeeperAction, decision: ShopkeeperTurn["decision"], sellerPrice: number | null): string {
  if (action === "ACCEPT") return `You accepted the customer's offer of ₹${game.finalPrice}.`;
  if (action === "WALK_AWAY") return "You walked away. No deal.";
  if (decision === "ACCEPT") return `Customer accepted your counteroffer of ₹${sellerPrice}.`;
  if (decision === "COUNTER") return `Customer counters at ₹${game.currentOffer}.`;
  return "The customer walked away. No deal.";
}

function fallbackReply(game: ShopkeeperGameState, decision: ShopkeeperTurn["decision"]): string {
  if (decision === "ACCEPT") return `That works for me. I'll take it for ₹${game.finalPrice}.`;
  if (decision === "COUNTER") return `${customerCue(game)} I can offer ₹${game.currentOffer}.`;
  return "I don't think we can agree today. I'll keep looking.";
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  if (!body || typeof body !== "object") return Response.json({ error: "Invalid request." }, { status: 400 });
  const { gameId, expectedRound, action, sellerPrice, message } = body as { gameId?: unknown; expectedRound?: unknown; action?: unknown; sellerPrice?: unknown; message?: unknown };
  if (typeof gameId !== "string" || typeof expectedRound !== "number" || !Number.isInteger(expectedRound) || expectedRound < 0 || expectedRound >= 6 ||
      !actions.includes(action as ShopkeeperAction) || typeof message !== "string" || message.trim().length > 280 ||
      (action === "COUNTER" && (typeof sellerPrice !== "number" || !Number.isInteger(sellerPrice)))) {
    return Response.json({ error: "Choose an action and enter a valid counteroffer and message." }, { status: 400 });
  }
  const limited = await limitRequest(request, "turn");
  if (limited) return limited;
  const snapshot = await readSession(gameId);
  if (!snapshot || !("mode" in snapshot.game) || snapshot.game.mode !== "shopkeeper") return Response.json({ error: "This shopkeeper session expired." }, { status: 404 });
  const game = snapshot.game;
  if (game.round !== expectedRound || game.status !== "PLAYING") return Response.json({ error: "This negotiation changed in another tab.", game: publicShopkeeperGame(game), turns: game.transcript }, { status: 409 });
  const price = action === "COUNTER" ? sellerPrice as number : null;
  if (action === "COUNTER" && (price === null || price <= game.currentOffer || price > 100000 || !message.trim())) return Response.json({ error: "Counter above the current offer and add a short message." }, { status: 400 });
  if (message.trim() && action !== "WALK_AWAY") {
    const unfamiliar = await incompatibleSellerLanguage(message, game.buyer.language);
    if (unfamiliar) return Response.json({ languageNotice: `Sorry, I don't know ${unfamiliar}. Could you say that in ${game.buyer.language} or English?`, error: "The customer did not understand your message. Rephrase it without using a round." }, { status: 422 });
  }
  const globallyLimited = await limitGlobalTurns();
  if (globallyLimited) return globallyLimited;
  const next = structuredClone(game);
  const decision = playShopkeeperTurn(next, action as ShopkeeperAction, price);
  const bindingPrice = decision === "ACCEPT" ? next.finalPrice : decision === "COUNTER" ? next.currentOffer : null;
  const fallback = fallbackReply(next, decision);
  const turn: ShopkeeperTurn = {
    round: next.round, action: action as ShopkeeperAction, sellerPrice: price, message: message.trim(), decision,
    customerOffer: decision === "COUNTER" ? next.currentOffer : null,
    officialLine: officialLine(next, action as ShopkeeperAction, decision, price), reply: fallback,
  };
  next.transcript.push(turn);
  if (!await commitSession(snapshot, next)) {
    const current = await readSession(gameId);
    return Response.json({ error: "This negotiation changed in another tab.", game: current && "mode" in current.game && current.game.mode === "shopkeeper" ? publicShopkeeperGame(current.game) : null, turns: current && "mode" in current.game && current.game.mode === "shopkeeper" ? current.game.transcript : [] }, { status: 409 });
  }
  const generated = await generateDialogue(
    `You are ${next.buyer.name}, a customer bargaining for ${next.product.name}. Speak primarily in ${next.buyer.language}. ${["Telugu", "Tamil", "Bengali"].includes(next.buyer.language) ? "Write primarily in that language's native script, with occasional English code switching." : "Natural short code-mixed phrases are welcome."} You know ${next.buyer.language} and English; if that language is Hinglish or Hindi, you also know the other. Do not imply you can converse fluently in another Indian language. Respond to the seller's last message naturally, in ONE short reply. Your personality is ${next.buyer.style}, but do not name or reveal this trait, your patience, or your hidden maximum. The deterministic game engine has ALREADY decided ${decision}; this is immutable. ${decision === "ACCEPT" ? `You have agreed at exactly ₹${bindingPrice}.` : decision === "COUNTER" ? `You have countered at exactly ₹${bindingPrice}.` : "You are leaving without a deal."} Do not invent any other price or number, and never claim agreement unless the decision is ACCEPT. Weave in this conversational cue where natural: ${customerCue(next)} No markdown.`,
    `The shopkeeper action was ${action}${price === null ? "" : ` at ₹${price}`}. Their message: ${message.trim() || "No message."}`,
    bindingPrice,
    fallback,
    decision,
  );
  const reply = generated.toLowerCase().includes(next.buyer.style) ? fallback : generated;
  if (reply !== fallback) {
    const romanized = await romanizeCustomerReply(reply, next.buyer.language, bindingPrice);
    if (await replaceReply(gameId, next.round, reply, romanized)) { turn.reply = reply; turn.romanizedReply = romanized; }
  }
  return Response.json({ game: publicShopkeeperGame(next), turn });
}
