import test from 'ava';
import { generateCandidates } from '../dist/index.js';

test('generator produces permutations, hyphenated and affix variants', async t => {
  const candidates = await generateCandidates({
    query: 'fast tech',
    prefixes: ['pre'],
    suffixes: ['suf'],
    supportedTlds: ['com'],
    defaultTld: 'com',
    preferredTlds: [],
    maxSynonyms: 1,
  });
  const domains = candidates.map(c => c.domain);
  t.true(domains.includes('fasttech.com'));
  t.true(domains.includes('techfast.com'));
  t.true(domains.includes('fast-tech.com'));
  t.true(domains.includes('prefasttech.com'));
  t.true(domains.includes('fasttechsuf.com'));
});

test('generator produces alphabetical and tldHack variants', async t => {
  const alpha = await generateCandidates({
    query: 'z a',
    supportedTlds: ['com'],
    defaultTld: 'com',
    preferredTlds: [],
    maxSynonyms: 1,
  });
  t.true(alpha.some(c => c.domain === 'az.com'));

  const hack = await generateCandidates({
    query: 'brandly',
    supportedTlds: ['ly'],
    defaultTld: 'com',
    preferredTlds: [],
    maxSynonyms: 1,
  });
  t.true(hack.some(c => c.domain === 'brand.ly'));
});
