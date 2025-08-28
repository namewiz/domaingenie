const TLD_REGEX = /^[a-z]{2,}(?:\.[a-z]{2,})?$/i;
const LOCATION_MAP: Record<string, string> = {
  'us': 'us',
  'uk': 'co.uk',
  'ca': 'ca',
  'de': 'de',
  'fr': 'fr',
  'au': 'au',
  'in': 'in',
  'ng': 'ng',
};

export function normalizeTokens(input: string): string[] {
  return (input.toLowerCase().match(/[a-z0-9]+/g) || []);
}

export function normalizeTld(tld: string): string {
  return tld.replace(/^\./, '').toLowerCase();
}

export function isValidTld(tld: string): boolean {
  return TLD_REGEX.test(normalizeTld(tld));
}

export function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

export function getCcTld(location?: string): string | undefined {
  if (!location) return undefined;
  const lower = location.toLowerCase();
  if (/^[a-z]{2}$/.test(lower)) {
    return lower;
  }
  if (LOCATION_MAP[lower]) return LOCATION_MAP[lower];
  return undefined;
}

export function containsNumber(str: string): boolean {
  return /\d/.test(str);
}

export function vowelRatio(str: string): number {
  const letters = str.replace(/[^a-z]/gi, '');
  if (letters.length === 0) return 0;
  const vowels = letters.match(/[aeiou]/gi)?.length || 0;
  return vowels / letters.length;
}
