import type { GameInsights } from "@/lib/game";

const rupees = (value: number) => `₹${value.toLocaleString("en-IN")}`;

export default function StrategyPanel({ insights, madeDeal }: { insights: GameInsights; madeDeal: boolean }) {
  return <section aria-labelledby="strategy-heading" className="mt-5 rounded-2xl border border-[#cbd5d2] bg-[#f7f9f5] p-5">
    <p className="text-xs font-black uppercase tracking-[.18em] text-[#80533c]">Your strategy report</p>
    <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
      <div><h3 id="strategy-heading" className="font-display text-2xl font-black">Bargain score</h3><p className="mt-1 text-sm text-[#5d7072]">Share of the possible buyer surplus you kept</p></div>
      <p className="font-display text-4xl font-black text-[#a9492d]">{insights.score}<span className="text-lg text-[#62777a]">/100</span></p>
    </div>
    <div role="img" aria-label={`Bargain score ${insights.score} out of 100`} className="mt-4 h-3 overflow-hidden rounded-full bg-[#d8e1dc]"><div className="h-full rounded-full bg-[#a9492d]" style={{ width: `${insights.score}%` }} /></div>
    <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-white/80 p-3"><p className="text-xs text-[#62777a]">Best possible buyer payoff</p><p className="mt-1 font-black">{rupees(insights.maxBuyerPayoff)}</p></div><div className="rounded-xl bg-white/80 p-3"><p className="text-xs text-[#62777a]">{madeDeal ? "Surplus left with seller" : "Possible surplus lost"}</p><p className="mt-1 font-black">{rupees(insights.savingsLeft)}</p></div></div>
    <p className="mt-4 border-t border-[#d9e1dc] pt-4 text-sm leading-relaxed text-[#3e555a]">{insights.takeaway}</p>
    <p className="mt-3 text-xs text-[#637679]">Score = buyer payoff ÷ (your value − seller minimum). No deal scores zero.</p>
  </section>;
}
