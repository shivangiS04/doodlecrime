// Generates short, funny, non-mean judge verdicts for The Trial.
// Uses the Anthropic API when ANTHROPIC_API_KEY is set; otherwise falls back
// to canned silly verdicts so the feature still works out of the box.

export interface TrialDefendantInput {
  playerId: string;
  nickname: string;
  word: string;
  defenseText: string;
}

export interface TrialVerdictResult {
  playerId: string;
  nickname: string;
  verdict: string;
  sentence: string;
}

const FALLBACK_VERDICTS = [
  (nickname: string, word: string) =>
    `The court finds ${nickname}'s rendition of "${word}" to be a crime against perspective, but the jury laughed, so it's basically fine.`,
  (nickname: string, word: string) =>
    `${nickname} was clearly going for abstract expressionism when asked to draw "${word}". Technically legal. Artistically felonious.`,
  (nickname: string, word: string) =>
    `Exhibit A shows ${nickname} interpreted "${word}" as a Rorschach test. The court is concerned, but entertained.`,
  (nickname: string, word: string) =>
    `${nickname}'s "${word}" looked more like a ransom note drawn with the wrong hand. Charges stand.`,
];

const FALLBACK_SENTENCES = [
  "Sentenced to doodle with their non-dominant hand for one round.",
  "Sentenced to a stern public reading of their own drawing's description.",
  "Sentenced to community service: guessing everyone else's terrible drawings correctly.",
  "Sentenced to time served — the embarrassment was punishment enough.",
];

function fallbackVerdict(d: TrialDefendantInput, i: number): TrialVerdictResult {
  return {
    playerId: d.playerId,
    nickname: d.nickname,
    verdict: FALLBACK_VERDICTS[i % FALLBACK_VERDICTS.length](d.nickname, d.word),
    sentence: FALLBACK_SENTENCES[i % FALLBACK_SENTENCES.length],
  };
}

export async function generateVerdicts(defendants: TrialDefendantInput[]): Promise<TrialVerdictResult[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || defendants.length === 0) {
    return defendants.map(fallbackVerdict);
  }

  try {
    const prompt = `You are a theatrical but good-natured judge presiding over "The Trial" at the end of a Pictionary-style party game called Doodle Crimes. For each defendant below, write a short, funny, NEVER mean-spirited judge's verdict (1-2 sentences) about their bad drawing, plus a silly, harmless "sentence" (punishment, 1 sentence). Keep it playful, PG-13, never insulting anyone's intelligence or appearance.

Defendants:
${defendants.map((d, i) => `${i + 1}. ${d.nickname} drew "${d.word}". Their defense: "${d.defenseText || "(offered no defense)"}"`).join("\n")}

Respond ONLY with a JSON array, one object per defendant in the same order, each shaped exactly as:
{"verdict": "...", "sentence": "..."}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-5-5",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
    const data = await res.json();
    const text: string = data?.content?.[0]?.text ?? "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array in response");

    const parsed = JSON.parse(jsonMatch[0]) as { verdict: string; sentence: string }[];
    if (parsed.length !== defendants.length) throw new Error("Verdict count mismatch");

    return defendants.map((d, i) => ({
      playerId: d.playerId,
      nickname: d.nickname,
      verdict: String(parsed[i].verdict).slice(0, 400),
      sentence: String(parsed[i].sentence).slice(0, 200),
    }));
  } catch (err) {
    console.error("generateVerdicts: falling back to canned verdicts —", err);
    return defendants.map(fallbackVerdict);
  }
}
