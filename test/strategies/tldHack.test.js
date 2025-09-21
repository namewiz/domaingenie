import test from 'ava';
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

test('tld hack strategy handles single-word query', async t => {
  const strategy = new TldHackStrategy();
  const res = await strategy.generate(buildProcessed());
  t.deepEqual(res.map(r => r.domain), ['brand.ly']);
});

test('tld hack strategy handles multi-word query', async t => {
  const strategy = new TldHackStrategy();
  const res = await strategy.generate(buildProcessed({
    query: 'brand ly',
    tokens: ['brand', 'ly'],
    synonyms: { brand: [], ly: [] },
  }));
  t.deepEqual(res.map(r => r.domain), ['brand.ly']);
});

test('tld hack strategy returns empty when no match', async t => {
  const strategy = new TldHackStrategy();
  const res = await strategy.generate(buildProcessed({
    query: 'hello world',
    tokens: ['hello', 'world'],
    synonyms: { hello: [], world: [] },
  }));
  t.deepEqual(res, []);
});
