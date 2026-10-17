import type { ReplayReason, ReplayStep } from "@/lib/game";

const rupees = (value: number) => `₹${value.toLocaleString("en-IN")}`;

const explanations: Record<ReplayReason, string> = {
  MET_ASK: "Your offer met the seller's current asking price.",
  MET_THRESHOLD: "Your offer cleared the seller's acceptance threshold for this round.",
  FINAL_ROUND_ACCEPT: "On the last round, the seller accepted an offer above their minimum.",
  LOWBALL: "The seller treated this as a low offer and held their price.",
  COUNTERED: "The offer was below the acceptance threshold, so the seller made a concession.",
  PATIENCE_EXHAUSTED: "A low or repeated offer used the seller's last patience point.",
  FINAL_ROUND_NO_DEAL: "The last round ended without an acceptable offer.",
};

export default function ReplayPanel({ steps }: { steps: ReplayStep[] }) {
  return <section aria-labelledby="replay-heading" className="mt-5 rounded-2xl border border-[#cbd5d2] bg-[#fafbf8] p-4 sm:p-5">
    <p className="text-xs font-black uppercase tracking-[.18em] text-[#8e5d45]">Behind the bargain</p>
    <h3 id="replay-heading" className="font-display mt-1 text-2xl font-black">Negotiation replay</h3>
    <p className="mt-2 text-sm leading-relaxed text-[#5d7072]">Now that the game is over, you can see the seller&apos;s private threshold and how each offer changed the negotiation.</p>
    <ol className="relative mt-5 space-y-3 border-l-2 border-[#cbd5d2] pl-4 sm:pl-6">
      {steps.map((step) => <li key={step.round} className="relative rounded-xl border border-[#dce4df] bg-white p-4 shadow-sm before:absolute before:-left-[22px] before:top-5 before:size-2.5 before:rounded-full before:bg-[#a9492d] sm:before:-left-[30px]">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-black uppercase tracking-widest text-[#8e5d45]">Round {step.round}</span><span className={`rounded-full px-3 py-1 text-xs font-black ${step.decision === "ACCEPT" ? "bg-emerald-100 text-emerald-800" : step.decision === "WALK_AWAY" ? "bg-rose-100 text-rose-800" : step.decision === "REJECT" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"}`}>{step.decision.replace("_", " ")}</span></div>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4"><div><p className="text-xs text-[#62777a]">Your offer</p><p className="font-black">{rupees(step.offer)}</p></div><div><p className="text-xs text-[#62777a]">Seller threshold</p><p className="font-black">{rupees(step.acceptanceThreshold)}</p></div><div><p className="text-xs text-[#62777a]">Seller ask</p><p className="font-black">{rupees(step.askingBefore)} → {rupees(step.askingAfter)}</p></div><div><p className="text-xs text-[#62777a]">Patience</p><p className="font-black">{step.patienceBefore} → {step.patienceAfter}</p></div></div>
        <p className="mt-3 border-t border-[#e1e8e3] pt-3 text-sm leading-relaxed text-[#3e555a]">{explanations[step.reason]}{step.counteroffer !== null && step.decision === "COUNTER" ? ` The counteroffer was ${rupees(step.counteroffer)}.` : ""}</p>
      </li>)}
    </ol>
  </section>;
}
