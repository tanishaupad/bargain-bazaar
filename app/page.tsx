"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { Decision, GameTurn, Language, PublicGame } from "@/lib/game";
import ReplayPanel from "./replay-panel";
import StrategyPanel from "./strategy-panel";

const languages: { value: Language; label: string; hint: string }[] = [
  { value: "English", label: "English", hint: "Hello!" },
  { value: "Hindi", label: "हिन्दी", hint: "नमस्ते!" },
  { value: "Hinglish", label: "Hinglish", hint: "Kya bhaav?" },
  { value: "Telugu", label: "తెలుగు", hint: "నమస్కారం!" },
  { value: "Tamil", label: "தமிழ்", hint: "வணக்கம்!" },
  { value: "Bengali", label: "বাংলা", hint: "নমস্কার!" },
];

const sessionKey = "bargain-bazaar-game-id";
const rupees = (value: number) => `₹${value.toLocaleString("en-IN")}`;

function openingLine(game: PublicGame) {
  const item = game.product.name;
  const price = rupees(game.askingPrice);
  switch (game.language) {
    case "Hindi": return `नमस्ते! यह ${item} ${price} का है। आप क्या दाम देंगे?`;
    case "Hinglish": return `Namaste! Yeh ${item} ${price} ka hai. Aap kya offer karenge?`;
    case "Telugu": return `నమస్కారం! ఈ ${item} ధర ${price}. మీరు ఎంత ఇస్తారు?`;
    case "Tamil": return `வணக்கம்! இந்த ${item} விலை ${price}. நீங்கள் எவ்வளவு தருவீர்கள்?`;
    case "Bengali": return `নমস্কার! এই ${item}-এর দাম ${price}। আপনি কত দেবেন?`;
    default: return `Namaste! Take a look at my ${item}. I'm asking ${price}. What's your offer?`;
  }
}

function decisionStyle(decision: Decision) {
  return decision === "ACCEPT" ? "bg-emerald-100 text-emerald-900 border-emerald-200" :
    decision === "WALK_AWAY" ? "bg-rose-100 text-rose-900 border-rose-200" :
    decision === "REJECT" ? "bg-amber-100 text-amber-900 border-amber-200" :
    "bg-sky-100 text-sky-900 border-sky-200";
}

export default function Home() {
  const [language, setLanguage] = useState<Language>("Hinglish");
  const [game, setGame] = useState<PublicGame | null>(null);
  const [turns, setTurns] = useState<GameTurn[]>([]);
  const [restoring, setRestoring] = useState(true);
  const [offer, setOffer] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const transcriptEnd = useRef<HTMLDivElement>(null);

  useEffect(() => { if (turns.length > 0) transcriptEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [turns, busy]);

  useEffect(() => {
    let active = true;
    async function restoreGame() {
      try {
        const id = window.localStorage.getItem(sessionKey);
        if (!id) return;
        const response = await fetch(`/api/game?id=${encodeURIComponent(id)}`, { cache: "no-store" });
        if (response.status === 404) {
          window.localStorage.removeItem(sessionKey);
          return;
        }
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not restore your game.");
        if (active) { setGame(data.game); setTurns(data.turns); setLanguage(data.game.language); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Could not restore your game.");
      } finally {
        if (active) setRestoring(false);
      }
    }
    restoreGame();
    return () => { active = false; };
  }, []);

  async function startGame() {
    if (busy || restoring) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/game", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, previousSeller: game?.seller.name }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not open the stall.");
      setGame(data.game); setTurns([]); setOffer(""); setMessage("");
      window.localStorage.setItem(sessionKey, data.game.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Something went wrong."); }
    finally { setBusy(false); }
  }

  async function submitOffer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!game || busy || game.status !== "PLAYING") return;
    const amount = Number(offer);
    const words = message.trim();
    if (!Number.isInteger(amount) || amount < 1 || amount > game.buyerValue || !words) {
      setError(`Enter a whole rupee offer up to your value of ${rupees(game.buyerValue)}, plus a short message.`); return;
    }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/game/turn", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: game.id, offer: amount, message: words, expectedRound: game.round }),
      });
      const data = await response.json();
      if (response.status === 409 && data.game) {
        setGame(data.game);
        setTurns(data.turns ?? []);
        throw new Error(data.error || "This negotiation changed. Please review the latest turn.");
      }
      if (!response.ok) throw new Error(data.error || "The turn could not be played.");
      setGame(data.game);
      setTurns((current) => [...current, { ...data.turn, message: words }]);
      setOffer(""); setMessage("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Something went wrong."); }
    finally { setBusy(false); }
  }

  const suggested = game ? [...new Set([0.55, 0.7, 0.85].map((ratio) => Math.min(game.buyerValue, Math.max(10, Math.round(game.currentPrice * ratio / 10) * 10))))] : [];

  return <main className="bazaar min-h-screen text-[#2b1b16]">
    <div className="bazaar-lights" aria-hidden="true" />
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-7 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-[1.7rem] border border-[#eec690] bg-[#fff9ec]/95 px-5 py-4 shadow-[0_8px_0_#5c271b18] sm:px-7">
        <div className="flex items-center gap-3"><div className="grid size-12 place-items-center rounded-2xl bg-[#d54828] text-2xl shadow-inner">🪔</div><div><p className="text-[10px] font-black uppercase tracking-[.25em] text-[#a24925]">The marketplace game</p><h1 className="font-display text-2xl font-black leading-tight sm:text-3xl">Bargain Bazaar</h1></div></div>
        <div className="flex items-center gap-2 rounded-full border border-[#efce9d] bg-white px-4 py-2 text-xs font-bold text-[#7b4630]"><span className="size-2 rounded-full bg-emerald-500" /> SIX ROUNDS · ONE GOOD DEAL</div>
      </header>

      {!game ? <div className="mt-8 grid gap-8 lg:grid-cols-[1.15fr_.85fr] lg:items-center">
        <section className="rounded-[2rem] border border-[#edc895] bg-[#fff9eb] p-6 shadow-[0_16px_40px_#732e1d1c] sm:p-10">
          <p className="mb-4 inline-flex rounded-full bg-[#fbe2bd] px-4 py-2 text-xs font-black uppercase tracking-widest text-[#a64525]">Step into the bazaar</p>
          <h2 className="font-display max-w-xl text-5xl font-black leading-[1.03] tracking-tight sm:text-6xl">A good bargain starts with a <span className="text-[#d34827]">conversation.</span></h2>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-[#795748]">Meet a new shopkeeper, make your offer, and charm your way to a deal. Every stall has its own price, personality, and patience.</p>
          <div className="mt-8"><p className="mb-3 text-xs font-black uppercase tracking-[.18em] text-[#9a5639]">Choose your conversation</p><div className="flex flex-wrap gap-2">{languages.map((item) => <button key={item.value} type="button" onClick={() => setLanguage(item.value)} aria-pressed={language === item.value} className={`rounded-full border px-4 py-2 text-sm font-bold transition ${language === item.value ? "border-[#ca4825] bg-[#ca4825] text-white shadow-md" : "border-[#e8c99e] bg-white hover:border-[#ca4825]"}`}>{item.label}</button>)}</div><p className="mt-3 text-sm text-[#8c6857]">{languages.find((item) => item.value === language)?.hint} · You can write in your own words.</p></div>
          {error && <p role="alert" className="mt-4 font-medium text-red-700">{error}</p>}
          <button onClick={startGame} disabled={busy || restoring} className="mt-8 rounded-2xl bg-[#d54828] px-8 py-4 text-lg font-black text-white shadow-[0_6px_0_#8e2d20] transition hover:-translate-y-0.5 disabled:opacity-60">{restoring ? "Restoring your game…" : busy ? "Opening a stall…" : "Enter the bazaar →"}</button>
        </section>
        <aside className="relative overflow-hidden rounded-[2rem] border-4 border-[#6e3024] bg-[#e76b3b] p-6 text-center shadow-[0_18px_0_#6e302430] sm:p-9"><div className="absolute inset-x-0 top-0 h-7 bazaar-awning" /><p className="mt-7 text-xs font-black uppercase tracking-[.3em] text-[#fff1cf]">Today at the market</p><div className="mt-7 grid grid-cols-2 gap-3">{[["🧣","Textiles"],["🏺","Handcrafts"],["🫖","Home finds"],["💫","Little treasures"]].map(([emoji,label]) => <div key={label} className="rounded-2xl border border-[#ffd69a] bg-[#fff4d8] px-3 py-5 shadow-[0_5px_0_#8c332555]"><div className="text-5xl">{emoji}</div><p className="mt-3 font-display text-lg font-black">{label}</p></div>)}</div><p className="mt-7 text-sm font-semibold text-white">10 finds · fresh prices every game</p></aside>
      </div> : <div className="mt-7 grid gap-6 lg:grid-cols-[330px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <section className="overflow-hidden rounded-[1.8rem] border border-[#e9bb82] bg-[#fff9ea] shadow-[0_12px_30px_#67301619]"><div className="relative grid h-44 place-items-center bg-[#f9c773] text-8xl"><div className="absolute inset-x-0 top-0 h-6 bazaar-awning" /><span className="drop-shadow-lg">{game.product.emoji}</span></div><div className="p-6"><span className="rounded-full bg-[#fce6c5] px-3 py-1 text-xs font-black uppercase tracking-widest text-[#9c4b27]">{game.product.category}</span><h2 className="font-display mt-3 text-2xl font-black">{game.product.name}</h2><p className="mt-2 text-sm leading-relaxed text-[#795c4c]">{game.product.detail}</p><div className="mt-5 flex items-end justify-between border-t border-[#eacfa9] pt-4"><div><p className="text-xs font-bold uppercase tracking-wider text-[#8d6959]">Original ask</p><p className="font-display text-2xl font-black line-through decoration-[#c84728] decoration-2">{rupees(game.askingPrice)}</p></div><div className="text-right"><p className="text-xs font-bold uppercase tracking-wider text-[#8d6959]">Seller says</p><p className="font-display text-3xl font-black text-[#c84728]">{rupees(game.currentPrice)}</p></div></div></div></section>
          <section className="rounded-[1.6rem] border border-[#a6c5b4] bg-[#edf7ef] p-5"><p className="text-xs font-black uppercase tracking-[.18em] text-[#37694e]">Your private value</p><p className="font-display mt-2 text-3xl font-black text-[#244d37]">{rupees(game.buyerValue)}</p><p className="mt-2 text-sm leading-relaxed text-[#4d6b58]">This is the most the item is worth to you. The seller cannot see it. Your payoff is this value minus the price you pay.</p></section>
          <section className="rounded-[1.6rem] border border-[#e9bb82] bg-white/90 p-5"><div className="flex items-center gap-3"><div className="grid size-14 place-items-center rounded-2xl bg-[#fbe2bd] text-3xl">{game.seller.avatar}</div><div><p className="font-display text-xl font-black">{game.seller.name}&apos;s stall</p><p className="text-sm capitalize text-[#805b48]">{game.seller.personality}</p></div></div><div className="mt-5 border-t border-[#eddec9] pt-4"><div className="flex justify-between text-xs font-black uppercase tracking-wider text-[#8a624f]"><span>Round {Math.min(game.round + (game.status === "PLAYING" ? 1 : 0), 6)} of 6</span><span>Patience {game.patience}/{game.initialPatience}</span></div><div className="mt-3 flex gap-1.5">{Array.from({ length: 6 }, (_, i) => <span key={i} className={`h-2 flex-1 rounded-full ${i < game.round ? "bg-[#d54828]" : "bg-[#ead7bd]"}`} />)}</div><p className="mt-4 text-xs leading-relaxed text-[#806251]">The seller&apos;s minimum stays secret until this game ends.</p></div></section>
        </aside>
        <section className="flex min-h-[620px] flex-col overflow-hidden rounded-[1.8rem] border border-[#e9bb82] bg-[#fffaf0] shadow-[0_12px_30px_#67301619]"><div className="flex items-center justify-between border-b border-[#efd8b5] bg-[#f9e6c7] px-5 py-4"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#a35c38]">Live bargaining</p><h2 className="font-display text-xl font-black">You & {game.seller.name}</h2></div><span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#844c32]">{game.language}</span></div>
          <div className="chat-scroll flex min-h-[330px] flex-1 flex-col gap-5 overflow-y-auto p-5 sm:p-7"><div className="max-w-[88%] self-start rounded-2xl rounded-tl-sm bg-white px-5 py-4 shadow-sm"><p className="mb-1 text-xs font-black uppercase tracking-wider text-[#b04d2d]">{game.seller.name}</p><p className="leading-relaxed">{openingLine(game)}</p></div>
            {turns.map((turn) => <div key={turn.round} className="contents"><div className="max-w-[88%] self-end rounded-2xl rounded-tr-sm bg-[#a73e2c] px-5 py-4 text-white shadow-sm"><p className="mb-1 text-xs font-black uppercase tracking-wider text-[#ffdbac]">You offered {rupees(turn.offer)}</p><p className="leading-relaxed">{turn.message}</p></div><div className="max-w-[92%] self-start"><div className={`mb-2 rounded-xl border px-4 py-2 text-sm font-black ${decisionStyle(turn.decision)}`}>{turn.officialLine}</div><div className="rounded-2xl rounded-tl-sm bg-white px-5 py-4 shadow-sm"><p className="mb-1 text-xs font-black uppercase tracking-wider text-[#b04d2d]">{game.seller.name}</p><p className="leading-relaxed">{turn.reply}</p></div></div></div>)}
            {busy && <div className="self-start rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-[#98705b]">{game.seller.name} is thinking…</div>}
            <div ref={transcriptEnd} />
          </div>
          {game.status === "PLAYING" ? <form onSubmit={submitOffer} className="border-t border-[#efd8b5] bg-white p-5 sm:p-6"><div className="mb-3 flex items-center justify-between gap-3"><label htmlFor="offer" className="text-sm font-black">Your offer</label><span className="text-xs text-[#8c6956]">Whole rupees · maximum {rupees(game.buyerValue)}</span></div><div className="flex flex-wrap gap-2">{suggested.map((amount) => <button key={amount} type="button" onClick={() => setOffer(String(amount))} className="rounded-full border border-[#e3c19d] bg-[#fff8eb] px-4 py-1.5 text-sm font-bold hover:border-[#c84728]">{rupees(amount)}</button>)}</div><div className="mt-4 grid gap-3 sm:grid-cols-[140px_1fr] lg:grid-cols-[140px_1fr]"><div className="relative"><span className="absolute left-4 top-3 text-lg font-bold text-[#975439]">₹</span><input id="offer" type="number" inputMode="numeric" min="1" max={game.buyerValue} step="1" value={offer} onChange={(event) => setOffer(event.target.value)} placeholder="Your price" className="w-full rounded-xl border border-[#ddb991] bg-[#fffdf8] py-3 pl-9 pr-3 outline-none focus:ring-2 focus:ring-[#d54828]" /></div><input aria-label="Bargaining message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={280} placeholder="Tell the shopkeeper why your offer is fair…" className="min-w-0 rounded-xl border border-[#ddb991] bg-[#fffdf8] px-4 py-3 outline-none focus:ring-2 focus:ring-[#d54828]" /></div>{error && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p>}<button disabled={busy || !offer || !message.trim()} className="mt-4 w-full rounded-xl bg-[#d54828] px-5 py-3.5 font-black text-white shadow-[0_4px_0_#8e2d20] hover:bg-[#ba3d23] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Waiting for the shopkeeper…" : "Make my offer →"}</button></form> : <div className="border-t border-[#efd8b5] bg-white p-5 sm:p-6"><div className={`rounded-2xl border p-5 ${game.status === "DEAL" ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}><p className="text-xs font-black uppercase tracking-[.18em]">{game.status === "DEAL" ? "🤝 Deal made" : "👣 No deal today"}</p><h3 className="font-display mt-2 text-3xl font-black">{game.status === "DEAL" ? `You paid ${rupees(game.finalPrice!)}` : "The seller walked away"}</h3><div className="mt-4 grid grid-cols-3 gap-3 border-t border-current/15 pt-4 text-sm"><div><p className="text-xs opacity-70">Buyer payoff <span className="font-normal">(value − price)</span></p><p className="font-black">{rupees(game.buyerPayoff ?? 0)}</p></div><div><p className="text-xs opacity-70">Seller payoff <span className="font-normal">(profit)</span></p><p className="font-black">{rupees(game.sellerProfit ?? 0)}</p></div><div><p className="text-xs opacity-70">Hidden minimum</p><p className="font-black">{rupees(game.reservationPrice!)}</p></div></div></div>{game.insights && <StrategyPanel insights={game.insights} madeDeal={game.status === "DEAL"} />}<ReplayPanel steps={game.replay ?? []} /><button onClick={startGame} disabled={busy} className="mt-4 w-full rounded-xl bg-[#2f4338] px-5 py-3.5 font-black text-white hover:bg-[#213529] disabled:opacity-50">{busy ? "Opening another stall…" : "Play again with a new shopkeeper →"}</button>{error && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p>}</div>}
        </section>
      </div>}
      <footer className="mt-10 text-center text-xs font-semibold text-[#875e46]">A playful market simulation · No real purchases or payments</footer>
    </div>
  </main>;
}
