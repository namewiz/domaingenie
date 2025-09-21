import test from 'ava';
import { generateCandidates } from '../dist/index.js';

const buildProcessed = (overrides = {}) => ({
  query: 'fast tech',
  tokens: ['fast', 'tech'],
  synonyms: { fast: [], tech: [] },
  orderedTlds: ['com'],
  includeHyphenated: false,
  limit: 50,
  prefixes: [],
  suffixes: [],
  ...overrides,
});

test('generator produces permutations, hyphenated and affix variants', async t => {
  const candidates = await generateCandidates(buildProcessed({
    includeHyphenated: true,
    prefixes: ['pre'],
    suffixes: ['suf'],
  }));
  const domains = candidates.map(c => c.domain);
  t.true(domains.includes('fasttech.com'));
  t.true(domains.includes('techfast.com'));
  t.true(domains.includes('fast-tech.com'));
  t.true(domains.includes('prefasttech.com'));
  t.true(domains.includes('fasttechsuf.com'));
});

test('generator produces tldHack variants', async t => {
  const hack = await generateCandidates(buildProcessed({
    query: 'brandly',
    tokens: ['brandly'],
    synonyms: { brandly: [] },
    orderedTlds: ['ly'],
    prefixes: [],
    suffixes: [],
  }));
  t.true(hack.some(c => c.domain === 'brand.ly'));
});
