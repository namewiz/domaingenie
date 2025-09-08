# Domain Genie

[![Build](https://github.com/namewiz/domaingenie/actions/workflows/build.yml/badge.svg)](https://github.com/namewiz/domaingenie/actions/workflows/build.yml)
[![Test](https://github.com/namewiz/domaingenie/actions/workflows/test.yml/badge.svg)](https://github.com/namewiz/domaingenie/actions/workflows/test.yml)
[![NPM](http://img.shields.io/npm/v/domaingenie.svg)](https://www.npmjs.com/package/domaingenie)
[![License](https://img.shields.io/npm/l/domaingenie.svg)](https://github.com/namewiz/domaingenie/blob/main/LICENSE)

A library for generating and ranking domain name suggestions including AI-generations.

## Features
- Expands queries with synonyms
- Generates permutations with prefixes, suffixes, and hyphen variants
- Filters and ranks domains based on TLD popularity and heuristics
- Modular generation strategies execute in parallel and tag results with their source

## Installation
```bash
npm install
```

## Usage
```ts
import { DomainSearchClient } from 'ai-domain-generator';

const client = new DomainSearchClient();
const results = await client.search({ query: 'foo bar' });
console.log(results.results);
```

## API

### `new DomainSearchClient(initOptions?)`

Create a client with default search configuration.

#### Init Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `supportedTlds` | `string[]` | all known TLDs | TLDs allowed in results. |
| `defaultTlds` | `string[]` | `['com','ng']` | TLDs always included when generating names. |
| `limit` | `number` | `20` | Maximum number of domains returned. |
| `prefixes` | `string[]` | – | Prefixes used for generating variants. |
| `suffixes` | `string[]` | – | Suffixes used for generating variants. |
| `maxSynonyms` | `number` | `5` | Maximum number of synonyms to expand. |
| `tldWeights` | `Record<string, number>` | – | Weights used when ranking TLDs. |

### `client.search(options)`

Search for domain names. `options` extend the init options so each call can override them.

#### Search Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `query` | `string` | – | Search term to expand. |
| `keywords` | `string[]` | – | Additional keywords to combine with the query. |
| `location` | `string` | – | ISO country code used to include a ccTLD. |
| `debug` | `boolean` | `false` | When `true`, includes extra debug fields. |
| `useAi` | `boolean` | `false` | Expand ideas using AI generation. |
| `supportedTlds` | `string[]` | inherits from init | TLDs allowed in results. |
| `defaultTlds` | `string[]` | inherits from init | TLDs always included when generating names. |
| `limit` | `number` | inherits from init | Maximum number of domains returned. |

#### Response

| Field | Type | Description |
| --- | --- | --- |
| `results` | `DomainCandidate[]` | List of generated domains ordered by score. |
| `success` | `boolean` | Indicates whether the search completed successfully. |
| `message` | `string?` | Error message when `success` is `false`. |
| `includesAiGenerations` | `boolean` | Whether AI-generated names were requested. |
| `metadata` | `object` | Runtime details about the search (see below). |

**DomainCandidate**

| Field | Type | Description |
| --- | --- | --- |
| `domain` | `string` | Fully qualified domain name. |
| `suffix` | `string` | TLD without the leading dot. |
| `score` | `number` | Relative ranking score for the domain. |
| `isAvailable` | `boolean?` | Domain availability flag (only with `debug`). |
| `aiGenerated` | `boolean?` | Marks names produced by AI. |
| `variantTypes` | `string[]?` | Types of permutations used (only with `debug`). |
| `strategy` | `string?` | Strategy that generated the domain. |

**Metadata**

| Field | Type | Description |
| --- | --- | --- |
| `searchTime` | `number` | Time in milliseconds spent generating suggestions. |
| `totalGenerated` | `number` | Count of candidates evaluated before limiting. |
| `filterApplied` | `boolean` | Whether a custom `supportedTlds` filter was used. |

## Development
- `npm run build` – build the library
- `npm test` – run the test suite
