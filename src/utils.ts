import stopwords from './stopwords.json' assert { type: 'json' };

const TLD_REGEX = /^[a-z]{2,}(?:\.[a-z]{2,})?$/i;
const STOP_WORDS = new Set<string>((stopwords as string[]).map(word => word.toLowerCase()));
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

/**
 * Breaks an input string into lowercase alphanumeric tokens.
 */
export function normalizeTokens(input: string): string[] {
  const tokens = input.toLowerCase().match(/[a-z0-9]+/g) || [];
  return tokens.filter(token => !STOP_WORDS.has(token));
}

/**
 * Normalizes a TLD by removing any leading dot and lowercasing.
 */
export function normalizeTld(tld: string): string {
  return tld.replace(/^\./, '').toLowerCase();
}

/**
 * Checks if a TLD string is syntactically valid.
 */
export function isValidTld(tld: string): boolean {
  return TLD_REGEX.test(normalizeTld(tld));
}

/**
 * Returns a deduplicated array preserving original order.
 */
export function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

/**
 * Maps a location string to a country-code TLD, if known.
 */
export function getCcTld(location?: string): string | undefined {
  if (!location) return undefined;
  const lower = location.toLowerCase();
  if (/^[a-z]{2}$/.test(lower)) {
    return lower;
  }
  if (LOCATION_MAP[lower]) return LOCATION_MAP[lower];
  return undefined;
}

/**
 * Determines if the given string contains any numeric characters.
 */
export function containsNumber(str: string): boolean {
  return /\d/.test(str);
}

/**
 * Calculates the ratio of vowels to total alphabetic characters in a string.
 */
export function vowelRatio(str: string): number {
  const letters = str.replace(/[^a-z]/gi, '');
  if (letters.length === 0) return 0;
  const vowels = letters.match(/[aeiou]/gi)?.length || 0;
  return vowels / letters.length;
}

/**
 * Produces all combinations by choosing one element from each list and joining
 * them with an optional separator.
 */
export function combine(lists: string[][], joiner = ''): string[] {
  const results: string[] = [];
  function helper(prefix: string, idx: number) {
    if (idx === lists.length) {
      results.push(prefix);
      return;
    }
    for (const token of lists[idx]) {
      const next = prefix ? prefix + joiner + token : token;
      helper(next, idx + 1);
    }
  }
  if (lists.length) helper('', 0);
  return results;
}

/**
 * Generates every permutation of the provided array.
 */
export function permute<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  const result: T[][] = [];
  arr.forEach((item, idx) => {
    const rest = [...arr.slice(0, idx), ...arr.slice(idx + 1)];
    for (const p of permute(rest)) {
      result.push([item, ...p]);
    }
  });
  return result;
}
