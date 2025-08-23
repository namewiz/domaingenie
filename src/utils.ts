const TLD_REGEX = /^[a-z]{2,}(?:\.[a-z]{2,})?$/i;

export function normalizeTokens(input: string): string[] {
  return (input.toLowerCase().match(/[a-z0-9]+/g) || []);
}

export function isValidTld(tld: string): boolean {
  return TLD_REGEX.test(tld);
}

export function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

export function getCcTld(location?: string): string | undefined {
  if (!location) return undefined;
  const cc = location.toLowerCase();
  if (/^[a-z]{2}$/.test(cc)) {
    return cc;
  }
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
