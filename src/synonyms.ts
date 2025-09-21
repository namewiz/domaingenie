import synonymsLib from 'synonyms';

const CACHE = new Map<string, string[]>();

export function expandSynonyms(token: string, max = 10, extra: string[] = []): string[] {
  const base = token.toLowerCase();
  let cached = CACHE.get(base);
  if (!cached) {
    const collected = new Set<string>();
    try {
      const syn = synonymsLib(base);
      if (syn) {
        for (const key of Object.keys(syn)) {
          const arr = (syn as any)[key] as string[];
          if (!Array.isArray(arr)) continue;
          for (const word of arr) {
            const normalized = word?.toLowerCase();
            if (!normalized || normalized === base) continue;
            if (normalized.length > 15) continue;
            collected.add(normalized);
          }
        }
      }
    } catch {
      // ignore library errors
    }
    cached = Array.from(collected).sort((a, b) => {
      if (a.length === b.length) return a.localeCompare(b);
      return a.length - b.length;
    });
    CACHE.set(base, cached);
  }

  const extras = extra
    .map(e => e.toLowerCase())
    .filter(e => e && e !== base && e.length <= 15);
  const baseSynonyms = cached ?? [];
  const combined = baseSynonyms.concat(extras);
  // Dedupe and remove single-letter candidates.
  const unique = Array.from(new Set(combined)).filter(a => a.length > 1);
  unique.sort((a, b) => {
    if (a.length === b.length) return a.localeCompare(b);
    return a.length - b.length;
  });
  const limit = Math.max(0, Math.min(max, 10));
  return unique.slice(0, limit);
}
