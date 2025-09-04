import test from 'ava';
import { PermutationStrategy } from '../../dist/index.js';

const opts = {
  query: 'fast tech',
  supportedTlds: ['com'],
  defaultTld: 'com',
  preferredTlds: [],
  maxSynonyms: 1,
};

test('permutation strategy handles multi-word query', async t => {
  const strategy = new PermutationStrategy();
  const results = await strategy.generate(opts);
  const domains = results.map(r => r.domain);
  t.true(domains.includes('fasttech.com'));
  t.true(domains.includes('techfast.com'));
  t.true(domains.includes('fast-tech.com'));
});

test('permutation strategy handles single-word query', async t => {
  const strategy = new PermutationStrategy();
  const res = await strategy.generate({ ...opts, query: 'solo' });
  t.deepEqual(res.map(r => r.domain), ['solo.com']);
});
