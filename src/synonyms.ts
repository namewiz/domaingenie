const DICT: Record<string, string[]> = {
  fast: ['quick', 'rapid', 'speedy'],
  tech: ['technology', 'techno'],
  domain: ['site', 'web'],
};

export function expandSynonyms(token: string, extra: string[] = []): string[] {
  const base = token.toLowerCase();
  const list = [base, ...(DICT[base] || []), ...extra.map(e => e.toLowerCase())];
  return Array.from(new Set(list.filter(w => w.length <= 15)));
}
