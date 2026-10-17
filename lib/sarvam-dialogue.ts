import { SarvamAIClient } from "sarvamai";

function normalizeDigits(value: string): string {
  return [...value.replaceAll(",", "")].map((digit) => {
    const code = digit.codePointAt(0)!;
    for (const zero of [0x30, 0x966, 0x9e6, 0xbe6, 0xc66]) {
      if (code >= zero && code <= zero + 9) return String(code - zero);
    }
    return digit;
  }).join("");
}

export function hasOnlyExactPrice(reply: string, exactPrice: number | null): boolean {
  const numerals = reply.match(/[0-9०-९০-৯௦-௯౦-౯]+(?:,[0-9०-९০-৯௦-௯౦-౯]{3})*/g) ?? [];
  return numerals.every((value) => exactPrice !== null && normalizeDigits(value) === String(exactPrice));
}

export function isDecisionCompatible(reply: string, decision: "ACCEPT" | "REJECT" | "COUNTER" | "WALK_AWAY"): boolean {
  if (decision === "ACCEPT") return !/\b(?:no deal|can't accept|cannot accept|won't buy|won't sell)\b/i.test(reply);
  // Model wording is untrusted: explicit deal language must not override the engine.
  return !/\b(?:deal done|it's a deal|we have a deal|you have a deal|sold|accepted|i accept|i agree|agreed|yours for|it's yours|it is yours|it is,|wrap it up|take it home|you can have it|done at|finali[sz]ed|manzoor|pakka)\b|मंजूर|मंज़ूर|पक्का|ले जाइए|வாங்கிக்கோ|ஒப்புக்கொள்கிறேன்|অমি রাজি|আমি রাজি|ఒప్పుకుంటాను/iu.test(reply);
}

export async function generateDialogue(system: string, user: string, exactPrice: number | null, fallback: string, decision?: "ACCEPT" | "REJECT" | "COUNTER" | "WALK_AWAY"): Promise<string> {
  const key = process.env.SARVAM_API_KEY;
  if (!key) return fallback;
  try {
    const client = new SarvamAIClient({ apiSubscriptionKey: key });
    const result = await client.chat.completions({
      model: "sarvam-105b-conversations",
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    });
    const reply = result.choices[0]?.message.content?.trim();
    if (!reply) return fallback;
    // Dialogue can decorate a decision but must not introduce another numeric price.
    if (!hasOnlyExactPrice(reply, exactPrice)) return fallback;
    if (decision && !isDecisionCompatible(reply, decision)) return fallback;
    return reply.slice(0, 300);
  } catch (error) {
    console.error("Sarvam dialogue failed:", error);
    return fallback;
  }
}
