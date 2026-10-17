import { catalogForShopkeeper, createShopkeeperGame, customerCue, publicShopkeeperGame } from "@/lib/shopkeeper-game";
import { generateDialogue } from "@/lib/sarvam-dialogue";
import { commitSession, createSession, readSession } from "@/lib/session-store";
import { limitRequest } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ catalog: catalogForShopkeeper() });
  const snapshot = await readSession(id);
  if (!snapshot || !("mode" in snapshot.game) || snapshot.game.mode !== "shopkeeper") return Response.json({ error: "This shopkeeper session expired." }, { status: 404 });
  return Response.json({ game: publicShopkeeperGame(snapshot.game), turns: snapshot.game.transcript });
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  if (!body || typeof body !== "object") return Response.json({ error: "Invalid request." }, { status: 400 });
  const { productId, listingPrice } = body as { productId?: unknown; listingPrice?: unknown };
  if (typeof productId !== "string" || typeof listingPrice !== "number") return Response.json({ error: "Choose a product and enter a listing price." }, { status: 400 });
  const limited = await limitRequest(request, "start");
  if (limited) return limited;
  let game;
  try { game = createShopkeeperGame(productId, listingPrice); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Invalid listing." }, { status: 400 }); }
  await createSession(game);
  const fallback = game.openingReply;
  const generated = await generateDialogue(
    `You are ${game.buyer.name}, a customer bargaining for ${game.product.name} in an Indian market. Speak in ${game.buyer.language}; natural code-mixing and romanized text are welcome. Do not name or reveal your personality, patience, or private maximum. Make ONE short opening offer at exactly ₹${game.currentOffer}. Treat this price as immutable. Do not state any other number. Express this conversational cue naturally: ${customerCue(game)} No markdown.`,
    `The shopkeeper listed the item at ₹${game.listingPrice}. Open the negotiation.`,
    game.currentOffer,
    fallback,
  );
  const reply = generated.toLowerCase().includes(game.buyer.style) ? fallback : generated;
  if (reply !== fallback) {
    const snapshot = await readSession(game.id);
    if (snapshot && "mode" in snapshot.game && snapshot.game.mode === "shopkeeper") {
      const next = structuredClone(snapshot.game);
      next.openingReply = reply;
      if (await commitSession(snapshot, next)) game = next;
    }
  }
  return Response.json({ game: publicShopkeeperGame(game), turns: [] });
}
