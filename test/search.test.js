import test from 'ava';
import { DomainSearchClient } from '../dist/index.js';

const client = new DomainSearchClient();

test('search generates ranked domain suggestions', async t => {
  const result = await client.search({ query: 'fast tech' });
  t.true(result.success);
  t.true(result.results.length > 0);
  t.true(result.results.length <= 20);
  t.true(result.results.some(r => r.domain === 'fasttech.com'));
  // ensure sorted by score
  for (let i = 1; i < result.results.length; i++) {
    t.true(result.results[i - 1].score >= result.results[i].score);
  }
});

test('location maps to ccTLD and hyphen variants generated', async t => {
  const res = await client.search({ query: 'fast tech', location: 'United States', limit: 200 });
  t.true(res.results.some(r => r.domain === 'fast-tech.us'));
});

test('debug mode retains internal fields', async t => {
  const debugRes = await client.search({ query: 'fast tech', debug: true });
  t.true('isAvailable' in debugRes.results[0]);
  const normalRes = await client.search({ query: 'fast tech' });
  t.false('isAvailable' in normalRes.results[0]);
});

test('ranking penalizes hyphenated domains', async t => {
  const res = await client.search({ query: 'fast tech', debug: true, limit: 200 });
  const fasttech = res.results.find(r => r.domain === 'fasttech.com');
  const fastHyphen = res.results.find(r => r.domain === 'fast-tech.com');
  t.truthy(fasttech && fastHyphen);
  t.true(fasttech.score > fastHyphen.score);
});

test('input validation catches bad limits', async t => {
  const res = await client.search({ query: 'fast tech', limit: -1 });
  t.false(res.success);
});

test('custom prefix and suffix generate variants', async t => {
  const custom = new DomainSearchClient({ prefixes: ['super'], suffixes: ['zone'] });
  const res = await custom.search({ query: 'fast tech', limit: 200 });
  t.true(res.results.some(r => r.domain === 'superfasttech.com'));
  t.true(res.results.some(r => r.domain === 'fasttechzone.com'));
});

test('AI flag populates includesAiGenerations', async t => {
  const res = await client.search({ query: 'fast tech', useAi: true });
  t.true(res.includesAiGenerations);
});

test('supportedTlds filter applies and is noted in metadata', async t => {
  const res = await client.search({ query: 'fast tech', supportedTlds: ['net'] });
  t.true(res.results.every(r => r.suffix === '.net'));
  t.true(res.metadata.filterApplied);
});

test('custom tld weights influence ranking', async t => {
  const weighted = new DomainSearchClient({ tldWeights: { com: 0, net: 50, org: 0 } });
  const res = await weighted.search({ query: 'fast tech', debug: true, limit: 200 });
  const com = res.results.find(r => r.domain === 'fasttech.com');
  const net = res.results.find(r => r.domain === 'fasttech.net');
  t.truthy(com && net);
  t.true(net.score > com.score);
});

test('invalid tld triggers error', async t => {
  const res = await client.search({ query: 'fast tech', supportedTlds: ['bad_tld'] });
  t.false(res.success);
});

test('tld hacks generate dotted domains when supported', async t => {
  const res = await client.search({ query: 'brandly', supportedTlds: ['ly', 'com'], limit: 200 });
  t.true(res.results.some(r => r.domain === 'brand.ly'));
});
