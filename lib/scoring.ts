// Faster correct guesses earn more points. Drawer earns points per correct guesser.

const MAX_GUESS_POINTS = 100;
const MIN_GUESS_POINTS = 20;
const DRAWER_POINTS_PER_GUESSER = 25;

export function guessPoints(elapsedMs: number, totalMs: number): number {
  const frac = Math.max(0, Math.min(1, elapsedMs / totalMs));
  const points = MAX_GUESS_POINTS - frac * (MAX_GUESS_POINTS - MIN_GUESS_POINTS);
  return Math.round(points);
}

export function drawerPoints(correctGuessers: number): number {
  return correctGuessers * DRAWER_POINTS_PER_GUESSER;
}
