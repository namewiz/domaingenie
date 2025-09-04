import test from 'ava';
import { AffixStrategy } from '../../dist/index.js';

const base = {
  prefixes: ['pre'],
  suffixes: ['suf'],
  supportedTlds: ['com'],
  defaultTld: 'com',
  preferredTlds: [],
  maxSynonyms: 1,
};

test('affix strategy handles single-word query', async t => {
  const strategy = new AffixStrategy();
  const res = await strategy.generate({ ...base, query: 'fast' });
  const domains = res.map(r => r.domain);
  t.true(domains.includes('prefast.com'));
  t.true(domains.includes('fastsuf.com'));
});

test('affix strategy handles multi-word query', async t => {
  const strategy = new AffixStrategy();
  const res = await strategy.generate({ ...base, query: 'fast tech' });
  const domains = res.map(r => r.domain);
  t.true(domains.includes('prefasttech.com'));
  t.true(domains.includes('fasttechsuf.com'));
});
