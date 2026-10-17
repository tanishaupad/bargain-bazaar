import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { GameState } from "./game";
import type { ShopkeeperGameState } from "./shopkeeper-game";

type StoredGame = GameState | ShopkeeperGameState;

const directory = join(process.cwd(), ".data", "games");
const lifetime = 2 * 60 * 60 * 1000;
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const busyGames = new Set<string>();

function pathFor(id: string) {
  if (!uuid.test(id)) return null;
  return join(directory, `${id}.json`);
}

export async function saveGame(game: StoredGame) {
  const path = pathFor(game.id);
  if (!path) throw new Error("Invalid game id");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = join(directory, `${game.id}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, JSON.stringify(game), { mode: 0o600 });
    await rename(temporary, path);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
}

export async function getGame(id: string): Promise<StoredGame | null> {
  const path = pathFor(id);
  if (!path) return null;
  try {
    const game = JSON.parse(await readFile(path, "utf8")) as StoredGame;
    if (game.id !== id || !Number.isFinite(game.updatedAt)) return null;
    if (game.updatedAt < Date.now() - lifetime) {
      await unlink(path).catch(() => {});
      return null;
    }
    return game;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function pruneGames() {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const names = await readdir(directory);
  await Promise.all(names.filter((name) => name.endsWith(".json")).map(async (name) => {
    const id = name.slice(0, -5);
    if (pathFor(id)) await getGame(id);
  }));
}

export function lockGame(id: string): boolean {
  if (busyGames.has(id)) return false;
  busyGames.add(id);
  return true;
}

export function unlockGame(id: string) {
  busyGames.delete(id);
}
