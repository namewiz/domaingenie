import test from 'ava';
import { AlphabeticalStrategy } from '../../dist/index.js';

const opts = {
  query: 'z a',
  supportedTlds: ['com'],
  defaultTld: 'com',
  preferredTlds: [],
  maxSynonyms: 1,
};

test('alphabetical strategy handles multi-word query', async t => {
  const strategy = new AlphabeticalStrategy();
  const res = await strategy.generate(opts);
  t.deepEqual(res.map(r => r.domain), ['az.com']);
});

test('alphabetical strategy returns empty for single-word query', async t => {
  const strategy = new AlphabeticalStrategy();
  const res = await strategy.generate({ ...opts, query: 'solo' });
  t.is(res.length, 0);
});
