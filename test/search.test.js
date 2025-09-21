import test from 'ava';
import { DomainSearchClient } from '../dist/index.js';

const client = new DomainSearchClient();

test('search generates ranked domain suggestions', async t => {
  const result = await client.search({ query: 'fast tech' });
  t.true(result.success);
  t.true(result.results.length > 0);
  t.true(result.results.length <= 20);
  t.true(result.results.some(r => r.domain.includes('fast.tech')));
  t.truthy(result.results[0].score.components);
  t.truthy(result.metadata.latency);
  t.true(typeof result.metadata.latency.total === 'number');
  t.true(typeof result.metadata.latency.requestProcessing === 'number');
  t.truthy(result.metadata.latency.strategies);
});

test('stop words are removed from processed tokens', async t => {
  const res = await client.search({ query: 'the fast and the curious', debug: true });
  t.true(res.processed.tokens.includes('fast'));
  t.true(res.processed.tokens.includes('curious'));
  t.false(res.processed.tokens.includes('the'));
  t.false(res.processed.tokens.includes('and'));
});

test('location maps to ccTLD and hyphen variants generated', async t => {
  const res = await client.search({ query: 'fast tech', location: 'us', limit: 200 });
  t.true(res.results.some(r => r.domain.includes('.us')));
});

test('debug mode retains internal fields', async t => {
  const debugRes = await client.search({ query: 'fast tech', debug: true });
  t.true('isAvailable' in debugRes.results[0]);
  const normalRes = await client.search({ query: 'fast tech' });
  t.false('isAvailable' in normalRes.results[0]);
});


test('input validation catches bad limits', async t => {
  const res = await client.search({ query: 'fast tech', limit: -1 });
  t.false(res.success);
});

test.skip('custom prefix and suffix generate variants', async t => {
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
  t.true(res.results.every(r => r.suffix === 'net'));
  t.true(res.metadata.filterApplied);
});

test('custom tld weights influence ranking', async t => {
  const weighted = new DomainSearchClient({ tldWeights: { com: 19, net: 20, org: 0 } });
  const res = await weighted.search({ query: 'fast tech', debug: true, limit: 200 });
  const com = res.results.find(r => r.domain.includes('.com'));
  const net = res.results.find(r => r.domain.includes('.net'));
  t.truthy(com && net);
  t.true(net.score.total > com.score.total);
});

test('invalid tld triggers error', async t => {
  const res = await client.search({ query: 'fast tech', supportedTlds: ['bad_tld'] });
  t.false(res.success);
});

test('tld hacks generate dotted domains when supported', async t => {
  const res = await client.search({ query: 'brandly', supportedTlds: ['ly', 'com'], limit: 200 });
  t.true(res.results.some(r => r.domain === 'brand.ly'));
});

test('duplicate generated candidates are deduped before scoring', async t => {
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
  t.is(new Set(domains).size, domains.length);
  t.deepEqual(domains, ['foo.com']);
  t.is(res.metadata.totalGenerated, 1);
});

