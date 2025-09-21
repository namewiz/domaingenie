import test from 'node:test';
import assert from 'node:assert/strict';
import { AffixStrategy } from '../../dist/index.js';

const buildProcessed = (overrides = {}) => ({
  query: 'fast',
  tokens: ['fast'],
  synonyms: { fast: [] },
  orderedTlds: ['com'],
  includeHyphenated: false,
  limit: 50,
  prefixes: ['pre'],
  suffixes: ['suf'],
  ...overrides,
});

test('affix strategy handles single-word query', async () => {
  const strategy = new AffixStrategy();
  const res = await strategy.generate(buildProcessed());
  const domains = res.map(r => r.domain);
  assert.ok(domains.includes('prefast.com'));
  assert.ok(domains.includes('fastsuf.com'));
});

test('affix strategy handles multi-word query', async () => {
  const strategy = new AffixStrategy();
  const res = await strategy.generate(buildProcessed({
    query: 'fast tech',
    tokens: ['fast', 'tech'],
    synonyms: { fast: [], tech: [] },
  }));
  const domains = res.map(r => r.domain);
  assert.ok(domains.includes('prefasttech.com'));
  assert.ok(domains.includes('fasttechsuf.com'));
});
