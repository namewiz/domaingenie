import test from 'ava';
import { generateCandidates } from '../dist/index.js';

test('generator produces permutations, hyphenated and affix variants', async t => {
  const candidates = await generateCandidates({
    query: 'fast tech',
    prefixes: ['pre'],
    suffixes: ['suf'],
    supportedTlds: ['com'],
    defaultTlds: [],
    maxSynonyms: 1,
    includeHyphenated: true,
  });
  const domains = candidates.map(c => c.domain);
  t.true(domains.includes('fasttech.com'));
  t.true(domains.includes('techfast.com'));
  t.true(domains.includes('fast-tech.com'));
  t.true(domains.includes('prefasttech.com'));
  t.true(domains.includes('fasttechsuf.com'));
});

test('generator produces tldHack variants', async t => {
  const hack = await generateCandidates({
    query: 'brandly',
    supportedTlds: ['ly'],
    defaultTlds: [],
    maxSynonyms: 1,
  });
  t.true(hack.some(c => c.domain === 'brand.ly'));
});
