import test from 'ava';
import { generateLabels } from '../dist/index.js';

const find = (labels, label) => labels.find(l => l.label === label);

test('generator produces permutations, hyphenated and affix variants', t => {
  const labels = generateLabels(['fast', 'tech'], [], [], {
    prefixes: ['pre'],
    suffixes: ['suf'],
  });
  t.true(find(labels, 'fasttech').types.includes('base'));
  t.true(find(labels, 'techfast').types.includes('permutation'));
  t.true(find(labels, 'fast-tech').types.includes('hyphenated'));
  t.true(find(labels, 'prefasttech').types.includes('prefix'));
  t.true(find(labels, 'fasttechsuf').types.includes('suffix'));
});

test('generator produces alphabetical and tldHack variants', t => {
  const alphaLabels = generateLabels(['z', 'a']);
  t.true(find(alphaLabels, 'az').types.includes('alphabetical'));

  const hackLabels = generateLabels(['brandly'], [], ['ly']);
  t.true(find(hackLabels, 'brand.ly').types.includes('tldHack'));
});
