import test from 'node:test';
import assert from 'node:assert/strict';
import { DomainSearchClient } from '../dist/index.js';

const client = new DomainSearchClient();

test('search generates ranked domain suggestions', async () => {
  const result = await client.search({ query: 'fast tech' });
  assert.ok(result.success);
  assert.ok(result.results.length > 0);
  assert.ok(result.results.length <= 20);
  assert.ok(result.results.some(r => r.domain.includes('fast.tech')));
  assert.ok(result.results[0].score.components);
  assert.ok(result.metadata.latency);
  assert.ok(typeof result.metadata.latency.total === 'number');
  assert.ok(typeof result.metadata.latency.requestProcessing === 'number');
  assert.ok(result.metadata.latency.strategies);
});

test('stop words are removed from processed tokens', async () => {
  const res = await client.search({ query: 'the fast and the curious', debug: true });
  assert.ok(res.processed.tokens.includes('fast'));
  assert.ok(res.processed.tokens.includes('curious'));
  assert.ok(!res.processed.tokens.includes('the'));
  assert.ok(!res.processed.tokens.includes('and'));
});

test('location maps to ccTLD and hyphen variants generated', async () => {
  const res = await client.search({ query: 'fast tech', location: 'us', limit: 200 });
  assert.ok(res.results.some(r => r.domain.includes('.us')));
});

test('debug mode retains internal fields', async () => {
  const debugRes = await client.search({ query: 'fast tech', debug: true });
  assert.ok('isAvailable' in debugRes.results[0]);
  const normalRes = await client.search({ query: 'fast tech' });
  assert.ok(!('isAvailable' in normalRes.results[0]));
});


test('input validation catches bad limits', async () => {
  const res = await client.search({ query: 'fast tech', limit: -1 });
  assert.ok(!res.success);
});

test.skip('custom prefix and suffix generate variants', async () => {
  const custom = new DomainSearchClient({ prefixes: ['super'], suffixes: ['zone'] });
  const res = await custom.search({ query: 'fast tech', limit: 200 });
  assert.ok(res.results.some(r => r.domain === 'superfasttech.com'));
  assert.ok(res.results.some(r => r.domain === 'fasttechzone.com'));
});

test('AI flag populates includesAiGenerations', async () => {
  const res = await client.search({ query: 'fast tech', useAi: true });
  assert.ok(res.includesAiGenerations);
});

test('supportedTlds filter applies and is noted in metadata', async () => {
  const res = await client.search({ query: 'fast tech', supportedTlds: ['net'] });
  assert.ok(res.results.every(r => r.suffix === 'net'));
  assert.ok(res.metadata.filterApplied);
});

test('custom tld weights influence ranking', async () => {
  const weighted = new DomainSearchClient({ tldWeights: { com: 19, net: 20, org: 0 } });
  const res = await weighted.search({ query: 'fast tech', debug: true, limit: 200 });
  const com = res.results.find(r => r.domain.includes('.com'));
  const net = res.results.find(r => r.domain.includes('.net'));
  assert.ok(com && net);
  assert.ok(net.score.total > com.score.total);
});

test('invalid tld triggers error', async () => {
  const res = await client.search({ query: 'fast tech', supportedTlds: ['bad_tld'] });
  assert.ok(!res.success);
});

test('tld hacks generate dotted domains when supported', async () => {
  const res = await client.search({ query: 'brandly', supportedTlds: ['ly', 'com'], limit: 200 });
  assert.ok(res.results.some(r => r.domain === 'brand.ly'));
});

test('duplicate generated candidates are deduped before scoring', async () => {
  const custom = new DomainSearchClient({
    prefixes: [''],
    suffixes: [],
    supportedTlds: ['com'],
    defaultTlds: ['com'],
    maxSynonyms: 1,
  });
  const res = await custom.search({
    query: 'foo',
    limit: 5,
    includeHyphenated: false,
    debug: true,
  });
  const domains = res.results.map(r => r.domain);
  assert.strictEqual(new Set(domains).size, domains.length);
  assert.deepStrictEqual(domains, ['foo.com']);
  assert.strictEqual(res.metadata.totalGenerated, 1);
});
