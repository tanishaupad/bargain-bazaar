"use client";

import { useEffect, useRef, useState } from "react";
import ModeTabs from "../mode-tabs";
import type { PublicShopkeeperGame, ShopkeeperAction, ShopkeeperTurn } from "@/lib/shopkeeper-game";

type CatalogItem = { id: string; name: string; category: string; emoji: string; detail: string; purchaseCost: number; suggestedListing: number };
const sessionKey = "bargain-bazaar-shopkeeper-id";
const rupees = (value: number) => `₹${value.toLocaleString("en-IN")}`;

export default function ShopkeeperPage() {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [listingPrice, setListingPrice] = useState("");
  const [game, setGame] = useState<PublicShopkeeperGame | null>(null);
  const [turns, setTurns] = useState<ShopkeeperTurn[]>([]);
  const [saved, setSaved] = useState<{ game: PublicShopkeeperGame; turns: ShopkeeperTurn[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [counterPrice, setCounterPrice] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const transcriptEnd = useRef<HTMLDivElement>(null);

  useEffect(() => { if (turns.length) transcriptEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [turns]);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch("/api/shopkeeper", { cache: "no-store" });
        if (!response.ok) throw new Error("Could not load the market catalog.");
        const data = await response.json() as { catalog: CatalogItem[] };
        if (active) { setCatalog(data.catalog); setSelectedId(data.catalog[0]?.id ?? ""); setListingPrice(String(data.catalog[0]?.suggestedListing ?? "")); }
        const id = window.localStorage.getItem(sessionKey);
        if (!id) return;
        const savedResponse = await fetch(`/api/shopkeeper?id=${encodeURIComponent(id)}`, { cache: "no-store" });
        if (savedResponse.status === 404) { window.localStorage.removeItem(sessionKey); return; }
        const session = await savedResponse.json();
        if (!savedResponse.ok) throw new Error(session.error || "Could not load your saved shop.");
        if (active) setSaved({ game: session.game, turns: session.turns ?? [] });
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : "Could not open the market."); }
      finally { if (active) setLoading(false); }
    }
    load();
    return () => { active = false; };
  }, []);

  const selected = catalog.find((item) => item.id === selectedId);

  function chooseProduct(item: CatalogItem) { setSelectedId(item.id); setListingPrice(String(item.suggestedListing)); setError(""); }
  function continueSaved() { if (!saved) return; setGame(saved.game); setTurns(saved.turns); setSaved(null); setError(""); }

  async function startGame() {
    if (!selected || busy) return;
    const price = Number(listingPrice);
    if (!Number.isInteger(price) || price < selected.purchaseCost + 10 || price > 100000) { setError(`List above your cost of ${rupees(selected.purchaseCost)} in whole rupees.`); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/shopkeeper", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: selected.id, listingPrice: price }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not open your stall.");
      setGame(data.game); setTurns([]); setSaved(null); setCounterPrice(""); setMessage("");
      window.localStorage.setItem(sessionKey, data.game.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Something went wrong."); }
    finally { setBusy(false); }
  }

  async function sendAction(action: ShopkeeperAction) {
    if (!game || busy || game.status !== "PLAYING") return;
    const price = action === "COUNTER" ? Number(counterPrice) : null;
    if (action === "COUNTER" && (!Number.isInteger(price) || price === null || price <= game.currentOffer || price > 100000 || !message.trim())) {
      setError(`Enter a whole rupee counter above ${rupees(game.currentOffer)} and add a message.`); return;
    }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/shopkeeper/turn", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gameId: game.id, expectedRound: game.round, action, sellerPrice: price, message: message.trim() }) });
      const data = await response.json();
      if (response.status === 409 && data.game) { setGame(data.game); setTurns(data.turns ?? []); throw new Error(data.error || "The negotiation changed in another tab."); }
      if (!response.ok) throw new Error(data.error || "The turn could not be played.");
      setGame(data.game); setTurns((current) => [...current, data.turn]); setCounterPrice(""); setMessage("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Something went wrong."); }
    finally { setBusy(false); }
  }

  function resetGame() { setGame(null); setTurns([]); setSaved(null); setError(""); window.localStorage.removeItem(sessionKey); }

  return <main className="bazaar min-h-screen text-[#1e3035]">
    <div className="bazaar-lights" aria-hidden="true" />
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-7 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#cbd5d2] bg-[#f8f9f6]/95 px-5 py-4 shadow-[0_8px_0_#1b33301a] sm:px-7">
        <div className="flex items-center gap-3"><div className="font-display grid size-12 place-items-center rounded-xl bg-[#a9492d] text-2xl font-black text-[#f5f3e9]">ब</div><div><p className="text-[10px] font-black uppercase tracking-[.25em] text-[#8a5135]">The marketplace game</p><h1 className="font-display text-2xl font-black leading-tight sm:text-3xl">Bargain Bazaar</h1></div></div>
        <div className="rounded-full border border-[#cad5d1] bg-white px-4 py-2 text-xs font-bold text-[#50646a]">YOUR STALL · THEIR OFFER</div>
      </header>
      <ModeTabs active="shopkeeper" />

      {!game ? <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="rounded-2xl border border-[#cbd5d2] bg-[#fbfcf9] p-5 shadow-[0_12px_30px_#1b333012] sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#8e5d45]">Shopkeeper Mode</p>
          <h2 className="font-display mt-2 text-4xl font-black sm:text-5xl">Run your own stall.</h2>
          <p className="mt-3 max-w-2xl text-[#52666a]">Pick an item, set a listing price, and bargain with a customer whose budget you do not know. Listen closely: their story may shift as the rounds pass.</p>
          {saved && <div className="mt-6 rounded-xl border border-[#abc0b7] bg-[#e8f0ec] p-4"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#3d6558]">Your last stall</p><p className="font-display mt-1 text-xl font-bold">{saved.game.product.name} with {saved.game.buyer.name}</p><button onClick={continueSaved} className="mt-2 text-sm font-bold text-[#8e422d] underline underline-offset-4">{saved.game.status === "PLAYING" ? "Continue negotiation →" : "View result →"}</button></div>}
          <h3 className="mt-8 text-xs font-black uppercase tracking-[.18em] text-[#855a44]">Choose a product</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{catalog.map((item) => <button key={item.id} type="button" onClick={() => chooseProduct(item)} aria-pressed={selectedId === item.id} className={`flex min-h-28 items-center gap-3 rounded-xl border p-4 text-left transition ${selectedId === item.id ? "border-[#a9492d] bg-[#f6ebe2] ring-1 ring-[#a9492d]" : "border-[#d8e1dc] bg-white hover:border-[#a9492d]"}`}><span className="text-4xl" aria-hidden="true">{item.emoji}</span><span><span className="block font-display text-lg font-bold leading-tight">{item.name}</span><span className="mt-1 block text-xs text-[#61757a]">Cost {rupees(item.purchaseCost)}</span></span></button>)}</div>
        </section>
        <aside className="h-fit rounded-2xl border border-[#cbd5d2] bg-[#344e52] p-6 text-[#f7f7f0] shadow-[0_12px_30px_#1b333012]">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#d9bf94]">Your price board</p>
          <p className="font-display mt-4 text-2xl font-bold">{selected?.name ?? "Choose an item"}</p>
          <div className="mt-5 border-y border-[#78908b] py-4"><p className="text-xs uppercase tracking-widest text-[#c3d2cb]">Purchase cost</p><p className="font-display mt-1 text-3xl">{selected ? rupees(selected.purchaseCost) : "—"}</p></div>
          <label htmlFor="listing-price" className="mt-5 block text-sm font-bold">Initial listing price</label>
          <div className="relative mt-2"><span className="absolute left-4 top-3.5 font-bold text-[#8e5d45]">₹</span><input id="listing-price" type="number" min={selected ? selected.purchaseCost + 10 : 1} max="100000" step="1" value={listingPrice} onChange={(event) => setListingPrice(event.target.value)} className="w-full rounded-lg border border-[#bdcbc5] bg-white px-4 py-3 pl-9 font-bold text-[#1e3035] outline-none focus:ring-2 focus:ring-[#d9bf94]" /></div>
          <p className="mt-3 text-xs leading-relaxed text-[#c3d2cb]">The customer opens with an offer. Their maximum and temperament stay hidden until the result.</p>
          {error && <p role="alert" className="mt-4 text-sm font-bold text-[#ffe0ca]">{error}</p>}
          <button onClick={startGame} disabled={loading || busy || !selected} className="mt-6 w-full rounded-xl bg-[#d9bf94] px-4 py-3.5 font-black text-[#263b40] hover:bg-[#e7cfaa] disabled:opacity-50">{busy ? "Opening your stall…" : "Open my stall →"}</button>
        </aside>
      </div> : <div className="mt-7 grid gap-6 lg:grid-cols-[330px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <section className="overflow-hidden rounded-xl border border-[#cbd5d2] bg-[#f8f9f6] shadow-[0_12px_30px_#1b333012]"><div className="relative grid h-40 place-items-center bg-[#d9e2dd] text-8xl"><div className="absolute inset-x-0 top-0 h-6 bazaar-awning" /><span>{game.product.emoji}</span></div><div className="p-5"><p className="text-xs font-black uppercase tracking-widest text-[#80533c]">{game.product.category}</p><h2 className="font-display mt-2 text-2xl font-black">{game.product.name}</h2><p className="mt-2 text-sm text-[#5f7072]">{game.product.detail}</p><div className="mt-4 grid grid-cols-2 gap-4 border-t border-[#d7dfd9] pt-4"><div><p className="text-xs uppercase text-[#687a7b]">Your cost</p><p className="font-display text-2xl font-bold">{rupees(game.purchaseCost)}</p></div><div><p className="text-xs uppercase text-[#687a7b]">Listing</p><p className="font-display text-2xl font-bold">{rupees(game.listingPrice)}</p></div></div></div></section>
          <section className="rounded-xl border border-[#abc0b7] bg-[#e8f0ec] p-5"><p className="text-xs font-black uppercase tracking-[.18em] text-[#3d6558]">Customer&apos;s current offer</p><p className="font-display mt-2 text-4xl font-black text-[#244a42]">{rupees(game.currentOffer)}</p><p className="mt-2 text-sm text-[#546e65]">Their maximum is private. You can accept this offer or ask for more.</p></section>
          <section className="rounded-xl border border-[#cbd5d2] bg-white p-5"><div className="flex items-center gap-3"><span className="grid size-12 place-items-center rounded-xl bg-[#e6d9be] text-3xl">{game.buyer.avatar}</span><div><p className="font-display text-xl font-bold">{game.buyer.name}</p><p className="text-xs font-semibold text-[#61757a]">Customer · {game.buyer.language}</p></div></div><p className="mt-4 border-t border-[#dce3df] pt-4 text-xs font-black uppercase tracking-wider text-[#62777a]">Round {Math.min(game.round + (game.status === "PLAYING" ? 1 : 0), game.maxRounds)} of {game.maxRounds}</p><div className="mt-2 flex gap-1.5">{Array.from({ length: game.maxRounds }, (_, i) => <span key={i} className={`h-2 flex-1 rounded-full ${i < game.round ? "bg-[#a9492d]" : "bg-[#dce4df]"}`} />)}</div><p className="mt-3 text-xs text-[#64777a]">Read their words carefully. Their claims may change.</p></section>
        </aside>
        <section className="flex min-h-[520px] flex-col overflow-hidden rounded-xl border border-[#cbd5d2] bg-[#fafbf8] shadow-[0_12px_30px_#1b333012]"><div className="flex items-center justify-between border-b border-[#d9e1dc] bg-[#e7eeea] px-5 py-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#755a48]">Your stall</p><h2 className="font-display text-xl font-bold">You & {game.buyer.name}</h2></div><span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#53686c]">{game.buyer.language}</span></div>
          <div className="chat-scroll flex min-h-[230px] flex-1 flex-col gap-5 overflow-y-auto p-5 sm:p-7"><div className="max-w-[90%] self-start rounded-2xl rounded-tl-sm bg-white px-5 py-4 shadow-sm"><p className="mb-1 text-xs font-black uppercase tracking-wider text-[#8a5b44]">{game.buyer.name} offers {rupees(game.initialOffer)}</p><p>{game.openingReply}</p></div>
            {turns.map((turn) => <div key={turn.round} className="contents"><div className="max-w-[90%] self-end rounded-2xl rounded-tr-sm bg-[#28464a] px-5 py-4 text-white shadow-sm"><p className="mb-1 text-xs font-black uppercase tracking-wider text-[#c8d8cf]">You {turn.action === "COUNTER" ? `countered at ${rupees(turn.sellerPrice!)}` : turn.action === "ACCEPT" ? "accepted" : turn.action === "REJECT" ? "rejected" : "walked away"}</p>{turn.message && <p>{turn.message}</p>}</div><div className="max-w-[92%] self-start"><p className={`mb-2 rounded-xl border px-4 py-2 text-sm font-bold ${turn.decision === "ACCEPT" ? "border-emerald-200 bg-emerald-100 text-emerald-900" : turn.decision === "WALK_AWAY" ? "border-rose-200 bg-rose-100 text-rose-900" : "border-sky-200 bg-sky-100 text-sky-900"}`}>{turn.officialLine}</p><div className="rounded-2xl rounded-tl-sm bg-white px-5 py-4 shadow-sm"><p className="mb-1 text-xs font-black uppercase tracking-wider text-[#8a5b44]">{game.buyer.name}</p><p>{turn.reply}</p></div></div></div>)}
            {busy && <p className="self-start rounded-xl bg-white px-4 py-3 text-sm text-[#657b7d]">{game.buyer.name} is thinking…</p>}<div ref={transcriptEnd} />
          </div>
          {game.status === "PLAYING" ? <div className="border-t border-[#d9e1dc] bg-white p-5 sm:p-6"><p className="text-sm font-bold">What will you do with {game.buyer.name}&apos;s {rupees(game.currentOffer)} offer?</p><div className="mt-4 grid gap-3 sm:grid-cols-[150px_1fr]"><div><label htmlFor="counter-price" className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#62777a]">Your counter</label><div className="relative"><span className="absolute left-4 top-3 font-bold text-[#8e5d45]">₹</span><input id="counter-price" type="number" min={game.currentOffer + 1} max="100000" step="1" value={counterPrice} onChange={(event) => setCounterPrice(event.target.value)} placeholder="Your price" className="w-full rounded-lg border border-[#bdcbc5] py-3 pl-9 pr-3 outline-none focus:ring-2 focus:ring-[#a9492d]" /></div></div><div><label htmlFor="seller-message" className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#62777a]">Your message</label><input id="seller-message" maxLength={280} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Why is your price fair?" className="w-full rounded-lg border border-[#bdcbc5] px-4 py-3 outline-none focus:ring-2 focus:ring-[#a9492d]" /></div></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><button disabled={busy} onClick={() => sendAction("ACCEPT")} className="rounded-lg bg-[#2f6653] px-3 py-3 text-sm font-bold text-white disabled:opacity-50">Accept Offer</button><button disabled={busy} onClick={() => sendAction("COUNTER")} className="rounded-lg bg-[#a9492d] px-3 py-3 text-sm font-bold text-white disabled:opacity-50">Counteroffer</button><button disabled={busy} onClick={() => sendAction("REJECT")} className="rounded-lg border border-[#bdcbc5] px-3 py-3 text-sm font-bold disabled:opacity-50">Reject</button><button disabled={busy} onClick={() => sendAction("WALK_AWAY")} className="rounded-lg border border-[#bdcbc5] px-3 py-3 text-sm font-bold disabled:opacity-50">Walk Away</button></div>{error && <p role="alert" className="mt-3 text-sm font-bold text-red-700">{error}</p>}</div> : <div className="border-t border-[#d9e1dc] bg-white p-5 sm:p-6"><div className={`rounded-xl border p-5 ${game.status === "DEAL" ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}><p className="text-xs font-black uppercase tracking-widest">{game.status === "DEAL" ? "Deal made" : "No deal today"}</p><h3 className="font-display mt-2 text-3xl font-black">{game.status === "DEAL" ? `Sold for ${rupees(game.finalPrice!)}` : "The negotiation ended"}</h3><div className="mt-4 grid grid-cols-2 gap-4 border-t border-current/15 pt-4 text-sm sm:grid-cols-4"><div><p className="opacity-70">Your cost</p><p className="font-black">{rupees(game.purchaseCost)}</p></div><div><p className="opacity-70">Realized profit</p><p className="font-black">{rupees(game.realizedProfit ?? 0)}</p></div><div><p className="opacity-70">Customer maximum</p><p className="font-black">{rupees(game.maxPrice!)}</p></div><div><p className="opacity-70">Surplus captured</p><p className="font-black">{game.surplusCapturedPercent}%</p></div></div></div><p className="mt-4 text-sm text-[#52666a]">{game.buyer.name} was a <strong>{game.buyer.style}</strong> customer. Possible seller surplus: {rupees(game.availableSurplus ?? 0)}.</p><button onClick={resetGame} className="mt-5 w-full rounded-xl bg-[#263d42] px-5 py-3.5 font-black text-white hover:bg-[#1b3035]">Open another stall →</button></div>}
        </section>
      </div>}
      <footer className="mt-10 text-center text-xs font-semibold text-[#637679]">A playful market simulation · No real purchases or payments</footer>
    </div>
  </main>;
}
