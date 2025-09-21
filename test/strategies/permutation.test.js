import test from 'node:test';
import assert from 'node:assert/strict';
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

test('permutation strategy handles multi-word query', async () => {
  const strategy = new PermutationStrategy();
  const results = await strategy.generate(buildProcessed());
  const domains = results.map(r => r.domain);
  assert.ok(domains.includes('fasttech.com'));
  assert.ok(domains.includes('techfast.com'));
  assert.ok(domains.includes('fast-tech.com'));
});

test('permutation strategy handles single-word query', async () => {
  const strategy = new PermutationStrategy();
  const res = await strategy.generate(buildProcessed({
    query: 'solo',
    tokens: ['solo'],
    synonyms: { solo: [] },
  }));
  assert.deepStrictEqual(res.map(r => r.domain), ['solo.com']);
});
