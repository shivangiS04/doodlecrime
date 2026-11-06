import classic from "./classic.json";
import corporateHell from "./corporate-hell.json";
import adulting from "./adulting.json";
import situationships from "./situationships.json";
import groupChatEnergy from "./group-chat-energy.json";
import millennialTrauma from "./millennial-trauma.json";

export interface PromptPack {
  id: string;
  name: string;
  words: string[];
}

export const PROMPT_PACKS: Record<string, PromptPack> = {
  classic: { id: "classic", name: "Classic", words: classic as string[] },
  "corporate-hell": { id: "corporate-hell", name: "Corporate Hell", words: corporateHell as string[] },
  adulting: { id: "adulting", name: "Adulting", words: adulting as string[] },
  situationships: { id: "situationships", name: "Situationships", words: situationships as string[] },
  "group-chat-energy": { id: "group-chat-energy", name: "Group Chat Energy", words: groupChatEnergy as string[] },
  "millennial-trauma": { id: "millennial-trauma", name: "Millennial Trauma", words: millennialTrauma as string[] },
};

export function listPromptPacks(): { id: string; name: string; count: number }[] {
  return Object.values(PROMPT_PACKS).map((p) => ({ id: p.id, name: p.name, count: p.words.length }));
}

export function getWordPool(packId: string, customWords: string[]): string[] {
  if (packId === "custom" && customWords.length > 0) return customWords;
  const pack = PROMPT_PACKS[packId] ?? PROMPT_PACKS.classic;
  return pack.words;
}

export function pickWordChoices(packId: string, customWords: string[], usedWords: Set<string>, count = 3): string[] {
  const pool = getWordPool(packId, customWords).filter((w) => !usedWords.has(w));
  const source = pool.length >= count ? pool : getWordPool(packId, customWords);
  const shuffled = [...source].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
