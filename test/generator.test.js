import test from 'node:test';
import assert from 'node:assert/strict';
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

test('generator produces permutations, hyphenated and affix variants', async () => {
  const candidates = await generateCandidates(buildProcessed({
    includeHyphenated: true,
    prefixes: ['pre'],
    suffixes: ['suf'],
  }));
  const domains = candidates.map(c => c.domain);
  assert.ok(domains.includes('fasttech.com'));
  assert.ok(domains.includes('techfast.com'));
  assert.ok(domains.includes('fast-tech.com'));
  assert.ok(domains.includes('prefasttech.com'));
  assert.ok(domains.includes('fasttechsuf.com'));
});

test('generator produces tldHack variants', async () => {
  const hack = await generateCandidates(buildProcessed({
    query: 'brandly',
    tokens: ['brandly'],
    synonyms: { brandly: [] },
    orderedTlds: ['ly'],
    prefixes: [],
    suffixes: [],
  }));
  assert.ok(hack.some(c => c.domain === 'brand.ly'));
});
