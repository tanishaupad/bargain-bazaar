import { createHash } from "node:crypto";
import { sharedRedis } from "./session-store.ts";

const incrementScript = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then redis.call("EXPIRE", KEYS[1], ARGV[1]) end
return {count, redis.call("TTL", KEYS[1])}
`;
const localCounts = new Map<string, { count: number; expiresAt: number }>();

async function increment(key: string, seconds: number): Promise<{ count: number; retryAfter: number }> {
  const redis = sharedRedis();
  if (redis) {
    const [count, retryAfter] = await redis.eval<[number], [number, number]>(incrementScript, [key], [seconds]);
    return { count, retryAfter: Math.max(1, retryAfter) };
  }
  const now = Date.now();
  const previous = localCounts.get(key);
  const next = previous && previous.expiresAt > now
    ? { count: previous.count + 1, expiresAt: previous.expiresAt }
    : { count: 1, expiresAt: now + seconds * 1000 };
  localCounts.set(key, next);
  return { count: next.count, retryAfter: Math.max(1, Math.ceil((next.expiresAt - now) / 1000)) };
}

export async function limitRequest(request: Request, action: "start" | "turn"): Promise<Response | null> {
  // Vercel sets this header at its trusted edge. Ignore caller-supplied forwarding headers elsewhere.
  const ip = process.env.VERCEL ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() : null;
  const identity = createHash("sha256").update(ip || "anonymous").digest("hex");
  const perIp = await increment(`bargain-bazaar:limit:${action}:${identity}`, 3600);
  const limit = action === "start" ? 10 : 60;
  if (perIp.count > limit) return Response.json({ error: "Too many requests. Please try again later." }, { status: 429, headers: { "Retry-After": String(perIp.retryAfter) } });
  return null;
}

export async function limitGlobalTurns(): Promise<Response | null> {
  const global = await increment("bargain-bazaar:limit:turns:global", 3600);
  if (global.count > 300) return Response.json({ error: "The bazaar is busy. Please try again later." }, { status: 429, headers: { "Retry-After": String(global.retryAfter) } });
  return null;
}
