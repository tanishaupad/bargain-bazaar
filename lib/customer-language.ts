import { SarvamAIClient } from "sarvamai";
import type { Language } from "./game.ts";
import { hasOnlyExactPrice } from "./sarvam-dialogue.ts";

type IndicLanguage = "Hindi" | "Telugu" | "Tamil" | "Bengali";
const codes: Record<IndicLanguage, "hi-IN" | "te-IN" | "ta-IN" | "bn-IN"> = {
  Hindi: "hi-IN", Telugu: "te-IN", Tamil: "ta-IN", Bengali: "bn-IN",
};
const byCode: Record<string, IndicLanguage | undefined> = {
  "hi-IN": "Hindi", "te-IN": "Telugu", "ta-IN": "Tamil", "bn-IN": "Bengali",
};
const scripts: { language: IndicLanguage; pattern: RegExp }[] = [
  { language: "Hindi", pattern: /[\u0900-\u097f]/gu },
  { language: "Bengali", pattern: /[\u0980-\u09ff]/gu },
  { language: "Tamil", pattern: /[\u0b80-\u0bff]/gu },
  { language: "Telugu", pattern: /[\u0c00-\u0c7f]/gu },
];

function buyerUnderstands(buyer: Language, spoken: IndicLanguage): boolean {
  return buyer === spoken || (spoken === "Hindi" && buyer === "Hinglish");
}

// Only infer a language when its script dominates; short borrowed phrases remain code switching.
export function dominantIndicScript(message: string): IndicLanguage | null {
  const counts = scripts.map(({ language, pattern }) => ({ language, count: [...message.matchAll(pattern)].length }));
  const total = counts.reduce((sum, item) => sum + item.count, 0);
  const leader = counts.sort((a, b) => b.count - a.count)[0];
  const latin = [...message.matchAll(/[a-z]/giu)].length;
  return leader.count >= 4 && leader.count >= total * 0.65 && (leader.count > latin || leader.count >= 8) ? leader.language : null;
}

export async function incompatibleSellerLanguage(message: string, buyer: Language): Promise<IndicLanguage | null> {
  const scripted = dominantIndicScript(message);
  if (scripted) return buyerUnderstands(buyer, scripted) ? null : scripted;
  // Romanized Indic is ambiguous. Let English and very short phrases through.
  if (!process.env.SARVAM_API_KEY || message.trim().split(/\s+/).length < 4 || /[\u0900-\u0c7f]/u.test(message)) return null;
  try {
    const client = new SarvamAIClient({ apiSubscriptionKey: process.env.SARVAM_API_KEY });
    const detected = await client.text.identifyLanguage({ input: message });
    const spoken = byCode[detected.language_code ?? ""];
    return spoken && !buyerUnderstands(buyer, spoken) ? spoken : null;
  } catch (error) {
    console.error("Sarvam language detection failed:", error);
    return null;
  }
}

export async function romanizeCustomerReply(reply: string, language: Language, exactPrice: number | null): Promise<string | null> {
  if (language !== "Telugu" && language !== "Tamil" && language !== "Bengali") return null;
  const script = scripts.find((item) => item.language === language)!;
  if (!script.pattern.test(reply) || !process.env.SARVAM_API_KEY) return null;
  try {
    const client = new SarvamAIClient({ apiSubscriptionKey: process.env.SARVAM_API_KEY });
    const result = await client.text.transliterate({ input: reply, source_language_code: codes[language], target_language_code: "en-IN" });
    const romanized = result.transliterated_text.trim();
    return romanized && romanized !== reply && hasOnlyExactPrice(romanized, exactPrice) ? romanized.slice(0, 400) : null;
  } catch (error) {
    console.error("Sarvam transliteration failed:", error);
    return null;
  }
}
