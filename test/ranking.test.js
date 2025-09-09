import test from 'ava';
import { scoreDomain } from '../dist/index.js';

test('hyphen penalty reduces score', t => {
  const clean = scoreDomain('fasttech', 'com');
  const hyphen = scoreDomain('fast-tech', 'com');
  t.true(hyphen.total < clean.total);
  t.is(hyphen.components.hyphenPenalty, -5);
});

test('tld weights influence score', t => {
  const comScore = scoreDomain('brand', 'com');
  const netScore = scoreDomain('brand', 'net');
  t.true(comScore.total > netScore.total);
  t.is(comScore.components.tldWeight, 20);
  t.is(netScore.components.tldWeight, 10);
});

test('vowel ratio adjusts scoring', t => {
  const vowelRich = scoreDomain('aeiou', 'com');
  const consonantHeavy = scoreDomain('bcdfg', 'com');
  t.true(vowelRich.total > consonantHeavy.total);
  t.true(vowelRich.components.vowelRatio > 0);
  t.is(consonantHeavy.components.lowVowelPenalty, -5);
});
