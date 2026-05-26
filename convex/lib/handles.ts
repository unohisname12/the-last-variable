// Minimal slur/profanity guard for a minors product. Expand BANNED over time.
const BANNED = ["fuck", "shit", "bitch", "nigg", "fag", "cunt", "rape", "porn", "sex", "dick", "pussy", "slut", "whore"];

export function cleanHandle(raw: string): string | null {
  const stripped = String(raw).replace(/[^\x20-\x7E]/g, "").trim().slice(0, 16);
  if (!stripped) return null;
  const low = stripped.toLowerCase();
  if (BANNED.some((b) => low.includes(b))) return null;
  return stripped;
}
