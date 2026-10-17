import { createGame, LANGUAGES, publicGame, type Language } from "@/lib/game";
import { createSession, readSession } from "@/lib/session-store";
import { limitRequest } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "A game id is required." }, { status: 400 });
  const session = await readSession(id);
  if (!session) return Response.json({ error: "This market session expired. Start a new round." }, { status: 404 });
  return Response.json({ game: publicGame(session.game), turns: session.game.transcript ?? [] });
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  if (!body || typeof body !== "object") return Response.json({ error: "Invalid request." }, { status: 400 });
  const { language, previousSeller } = body as { language?: unknown; previousSeller?: unknown };
  if (!LANGUAGES.includes(language as Language)) return Response.json({ error: "Choose a supported language." }, { status: 400 });
  const limited = await limitRequest(request, "start");
  if (limited) return limited;
  const game = createGame(language as Language, typeof previousSeller === "string" ? previousSeller : undefined);
  await createSession(game);
  return Response.json({ game: publicGame(game) });
}
