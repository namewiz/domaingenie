import test from 'ava';
import { PermutationStrategy } from '../../dist/index.js';

const buildProcessed = (overrides = {}) => ({
  query: 'fast tech',
  tokens: ['fast', 'tech'],
  synonyms: { fast: [], tech: [] },
  orderedTlds: ['com'],
  includeHyphenated: true,
  limit: 50,
  prefixes: [],
  suffixes: [],
  ...overrides,
});

test('permutation strategy handles multi-word query', async t => {
  const strategy = new PermutationStrategy();
  const results = await strategy.generate(buildProcessed());
  const domains = results.map(r => r.domain);
  t.true(domains.includes('fasttech.com'));
  t.true(domains.includes('techfast.com'));
  t.true(domains.includes('fast-tech.com'));
});

test('permutation strategy handles single-word query', async t => {
  const strategy = new PermutationStrategy();
  const res = await strategy.generate(buildProcessed({
    query: 'solo',
    tokens: ['solo'],
    synonyms: { solo: [] },
  }));
  t.deepEqual(res.map(r => r.domain), ['solo.com']);
});
