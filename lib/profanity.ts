// Minimal profanity filter toggle — masks common slurs/curses, not exhaustive.
const BLOCKLIST = [
  "fuck", "shit", "bitch", "cunt", "asshole", "nigger", "nigga", "faggot", "retard",
  "whore", "slut", "dick", "pussy", "cock",
];

const PATTERN = new RegExp(`\\b(${BLOCKLIST.join("|")})\\b`, "gi");

export function filterProfanity(text: string, enabled: boolean): string {
  if (!enabled) return text;
  return text.replace(PATTERN, (m) => m[0] + "*".repeat(Math.max(1, m.length - 1)));
}
