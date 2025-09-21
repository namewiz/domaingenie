import test from 'node:test';
import assert from 'node:assert/strict';
import { TldHackStrategy } from '../../dist/index.js';

const buildProcessed = (overrides = {}) => ({
  query: 'brandly',
  tokens: ['brandly'],
  synonyms: { brandly: [] },
  orderedTlds: ['ly'],
  includeHyphenated: false,
  limit: 50,
  prefixes: [],
  suffixes: [],
  ...overrides,
});

test('tld hack strategy handles single-word query', async () => {
  const strategy = new TldHackStrategy();
  const res = await strategy.generate(buildProcessed());
  assert.deepStrictEqual(res.map(r => r.domain), ['brand.ly']);
});

test('tld hack strategy handles multi-word query', async () => {
  const strategy = new TldHackStrategy();
  const res = await strategy.generate(buildProcessed({
    query: 'brand ly',
    tokens: ['brand', 'ly'],
    synonyms: { brand: [], ly: [] },
  }));
  assert.deepStrictEqual(res.map(r => r.domain), ['brand.ly']);
});

test('tld hack strategy returns empty when no match', async () => {
  const strategy = new TldHackStrategy();
  const res = await strategy.generate(buildProcessed({
    query: 'hello world',
    tokens: ['hello', 'world'],
    synonyms: { hello: [], world: [] },
  }));
  assert.deepStrictEqual(res, []);
});
