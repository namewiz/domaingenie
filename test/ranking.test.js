import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreDomain } from '../dist/index.js';

test('hyphen penalty reduces score', () => {
  const clean = scoreDomain('fasttech', 'com');
  const hyphen = scoreDomain('fast-tech', 'com');
  assert.ok(hyphen.total < clean.total);
  assert.strictEqual(hyphen.components.hyphenPenalty, -5);
});

test('tld weights influence score', () => {
  const comScore = scoreDomain('brand', 'com');
  const netScore = scoreDomain('brand', 'net');
  assert.ok(comScore.total > netScore.total);
  assert.strictEqual(comScore.components.tldWeight, 20);
  assert.strictEqual(netScore.components.tldWeight, 10);
});

test('vowel ratio adjusts scoring', () => {
  const vowelRich = scoreDomain('aeiou', 'com');
  const consonantHeavy = scoreDomain('bcdfg', 'com');
  assert.ok(vowelRich.total > consonantHeavy.total);
  assert.ok(vowelRich.components.vowelRatio > 0);
  assert.strictEqual(consonantHeavy.components.lowVowelPenalty, -5);
});
