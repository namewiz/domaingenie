import test from 'node:test';
import assert from 'node:assert/strict';
import { DomainSearchClient } from '../dist/index.js';

const client = new DomainSearchClient();

test('offset paginates ranked results consistently', async () => {
  const query = 'fast tech';
  const pageSize = 10;

  // Baseline set large enough to compare slices
  const baseline = await client.search({ query, debug: true, limit: 50 });
  assert.ok(baseline.results.length >= 20);

  const page1 = await client.search({ query, debug: true, limit: pageSize, offset: 0 });
  const page2 = await client.search({ query, debug: true, limit: pageSize, offset: pageSize });

  assert.strictEqual(page1.results.length, pageSize);
  assert.strictEqual(page2.results.length, pageSize);

  const baseSlice1 = baseline.results.slice(0, pageSize).map(r => r.domain);
  const baseSlice2 = baseline.results.slice(pageSize, pageSize * 2).map(r => r.domain);

  assert.deepStrictEqual(page1.results.map(r => r.domain), baseSlice1);
  assert.deepStrictEqual(page2.results.map(r => r.domain), baseSlice2);
});
