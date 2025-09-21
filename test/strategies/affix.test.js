import test from 'ava';
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

test('affix strategy handles single-word query', async t => {
  const strategy = new AffixStrategy();
  const res = await strategy.generate(buildProcessed());
  const domains = res.map(r => r.domain);
  t.true(domains.includes('prefast.com'));
  t.true(domains.includes('fastsuf.com'));
});

test('affix strategy handles multi-word query', async t => {
  const strategy = new AffixStrategy();
  const res = await strategy.generate(buildProcessed({
    query: 'fast tech',
    tokens: ['fast', 'tech'],
    synonyms: { fast: [], tech: [] },
  }));
  const domains = res.map(r => r.domain);
  t.true(domains.includes('prefasttech.com'));
  t.true(domains.includes('fasttechsuf.com'));
});
