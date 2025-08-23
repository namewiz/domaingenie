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
