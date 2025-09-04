import test from 'ava';
import { TldHackStrategy } from '../../dist/index.js';

const base = {
  supportedTlds: ['ly'],
  defaultTld: 'com',
  preferredTlds: [],
  maxSynonyms: 1,
};

test('tld hack strategy handles single-word query', async t => {
  const strategy = new TldHackStrategy();
  const res = await strategy.generate({ ...base, query: 'brandly' });
  t.deepEqual(res.map(r => r.domain), ['brand.ly']);
});

test('tld hack strategy handles multi-word query', async t => {
  const strategy = new TldHackStrategy();
  const res = await strategy.generate({ ...base, query: 'brand ly' });
  t.deepEqual(res.map(r => r.domain), ['brand.ly']);
});

test('tld hack strategy returns empty when no match', async t => {
  const strategy = new TldHackStrategy();
  const res = await strategy.generate({ ...base, query: 'hello world' });
  t.deepEqual(res, []);
});
