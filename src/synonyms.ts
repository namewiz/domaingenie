import synonymsLib from 'synonyms';

const CACHE = new Map<string, string[]>();

export function expandSynonyms(token: string, max = 5, extra: string[] = []): string[] {
  const base = token.toLowerCase();
  if (CACHE.has(base)) {
    return CACHE.get(base)!;
  }
  let list: string[] = [base];
  try {
    const syn = synonymsLib(base);
    if (syn) {
      for (const key of Object.keys(syn)) {
        const arr = (syn as any)[key] as string[];
        if (Array.isArray(arr)) list.push(...arr);
      }
    }
  } catch {
    // ignore library errors
  }
  list.push(...extra.map(e => e.toLowerCase()));
  const uniqueList = Array.from(new Set(list.filter(w => w && w.length <= 15))).slice(0, max);
  CACHE.set(base, uniqueList);
  return uniqueList;
}
