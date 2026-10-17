import Link from "next/link";

export default function ModeTabs({ active }: { active: "customer" | "shopkeeper" }) {
  return <nav aria-label="Game mode" className="mt-6 flex w-fit flex-wrap gap-1 rounded-xl border border-[#cbd5d2] bg-[#f8f9f6] p-1.5 shadow-sm">
    <Link href="/" aria-current={active === "customer" ? "page" : undefined} className={`rounded-lg px-4 py-2.5 text-sm font-bold transition ${active === "customer" ? "bg-[#28464a] text-white" : "text-[#50646a] hover:bg-[#e7eeea]"}`}>Customer Mode</Link>
    <Link href="/shopkeeper" aria-current={active === "shopkeeper" ? "page" : undefined} className={`rounded-lg px-4 py-2.5 text-sm font-bold transition ${active === "shopkeeper" ? "bg-[#28464a] text-white" : "text-[#50646a] hover:bg-[#e7eeea]"}`}>Shopkeeper Mode</Link>
  </nav>;
}
