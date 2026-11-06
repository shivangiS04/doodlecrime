export function normalizeGuess(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:'"()\-_]/g, "")
    .replace(/\s+/g, " ");
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;

  let prev = new Array(bl + 1);
  let curr = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) prev[j] = j;

  for (let i = 1; i <= al; i++) {
    curr[0] = i;
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[bl];
}

export type GuessResult = "correct" | "close" | "wrong";

export function matchGuess(guess: string, answer: string): GuessResult {
  const g = normalizeGuess(guess);
  const a = normalizeGuess(answer);
  if (g.length === 0) return "wrong";
  if (g === a) return "correct";
  const dist = levenshtein(g, a);
  if (dist <= 2 && Math.abs(g.length - a.length) <= 2) return "close";
  return "wrong";
}
