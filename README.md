# Bargain Bazaar

A playable multilingual bargaining game built with Next.js, TypeScript, Tailwind CSS, and the official `sarvamai` JavaScript SDK.

## Run locally

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and add your Sarvam API key.
3. Start the app with `npm run dev` and open [http://localhost:3000](http://localhost:3000).

Choose English, Hindi, Hinglish, Telugu, Tamil, or Bengali. Each new game picks from 10 products and randomizes the seller, asking price, hidden seller minimum, buyer value, and patience. You know your own value, which is the most you may offer; the seller does not. Enter a whole-rupee offer plus a message on each turn. A deterministic server-side engine decides whether the seller accepts, rejects, counters, or walks away. Seller styles change acceptance thresholds, lowball tolerance, and concession size. Games last at most six rounds. The final card reveals the transaction price, buyer payoff (`buyer value − price`), seller payoff (`price − seller minimum`), and the seller's minimum. A post-game strategy report scores the buyer's captured surplus and explains one concrete bargaining opportunity. A replay shows every offer, private acceptance threshold, counteroffer, patience change, and decision rule; both stay hidden during negotiation.

The browser calls `POST /api/game` to start, `POST /api/game/turn` for each offer, and `GET /api/game?id=…` to restore a session after reload. The server calls Sarvam's `sarvam-105b-conversations` model only to phrase the shopkeeper's reply. The engine owns the decision and price. The API key stays in `.env.local` and is never sent to the browser.

Game sessions and chat transcripts are saved as private JSON files under the ignored `.data/games` directory. The browser keeps only the random session ID. A reload or restart on the same machine restores the game for two hours after its last turn. This local file store is intended for one server process with a persistent writable disk; multi-instance or serverless deployment needs a shared store. No database, login, voice, or payment flow is included. If Sarvam is unavailable, the engine still completes each turn with a short fallback reply.

Run `npm run test`, `npm run lint`, and `npm run build` to check the game.
