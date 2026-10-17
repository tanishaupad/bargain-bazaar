import { createGame, LANGUAGES, publicGame, type Language } from "@/lib/game";
import { getGame, pruneGames, saveGame } from "@/lib/game-store";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "A game id is required." }, { status: 400 });
  const game = await getGame(id);
  if (!game) return Response.json({ error: "This market session expired. Start a new round." }, { status: 404 });
  return Response.json({ game: publicGame(game), turns: game.transcript ?? [] });
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  if (!body || typeof body !== "object") return Response.json({ error: "Invalid request." }, { status: 400 });
  const { language, previousSeller } = body as { language?: unknown; previousSeller?: unknown };
  if (!LANGUAGES.includes(language as Language)) return Response.json({ error: "Choose a supported language." }, { status: 400 });
  await pruneGames();
  const game = createGame(language as Language, typeof previousSeller === "string" ? previousSeller : undefined);
  await saveGame(game);
  return Response.json({ game: publicGame(game) });
}
