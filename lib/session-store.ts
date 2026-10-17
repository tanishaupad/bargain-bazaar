import { Redis } from "@upstash/redis";
import type { GameState } from "./game";
import { getGame, pruneGames, saveGame } from "./game-store.ts";

const ttlSeconds = 2 * 60 * 60;
const compareAndSetScript = `
local current = redis.call("GET", KEYS[1])
if not current then return 0 end
if current ~= ARGV[1] then return 2 end
redis.call("SET", KEYS[1], ARGV[2], "EX", ARGV[3])
return 1
`;

export type SessionSnapshot = { game: GameState; raw: string };
let client: Redis | null = null;

export function sharedRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (Boolean(url) !== Boolean(token)) throw new Error("Both Upstash Redis credentials are required.");
  if (!url || !token) {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_LOCAL_STORE !== "true") {
      throw new Error("Upstash Redis credentials are required in production.");
    }
    return null;
  }
  return client ??= new Redis({ url, token, automaticDeserialization: false });
}

const keyFor = (id: string) => `bargain-bazaar:game:${id}`;

export async function createSession(game: GameState) {
  const redis = sharedRedis();
  if (redis) {
    const result = await redis.set(keyFor(game.id), JSON.stringify(game), { ex: ttlSeconds, nx: true });
    if (result !== "OK") throw new Error("Could not create a unique session.");
  } else {
    await pruneGames();
    await saveGame(game);
  }
}

export async function readSession(id: string): Promise<SessionSnapshot | null> {
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return null;
  const redis = sharedRedis();
  if (redis) {
    const raw = await redis.get<string>(keyFor(id));
    return raw ? { game: JSON.parse(raw) as GameState, raw } : null;
  }
  const game = await getGame(id);
  return game ? { game, raw: JSON.stringify(game) } : null;
}

export async function commitSession(snapshot: SessionSnapshot, next: GameState): Promise<boolean> {
  const redis = sharedRedis();
  if (redis) {
    const result = await redis.eval<[string, string, number], number>(compareAndSetScript, [keyFor(next.id)], [snapshot.raw, JSON.stringify(next), ttlSeconds]);
    return result === 1;
  }
  const current = await getGame(next.id);
  if (!current || JSON.stringify(current) !== snapshot.raw) return false;
  await saveGame(next);
  return true;
}

export async function replaceReply(id: string, round: number, reply: string): Promise<boolean> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const snapshot = await readSession(id);
    if (!snapshot) return false;
    const turn = snapshot.game.transcript?.find((item) => item.round === round);
    if (!turn) return false;
    turn.reply = reply;
    if (await commitSession(snapshot, snapshot.game)) return true;
  }
  return false;
}
