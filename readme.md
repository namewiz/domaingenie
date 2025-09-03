# AI Domain Generator

A simple TypeScript library for generating and ranking domain name suggestions.

## Features
- Expands queries with synonyms
- Generates permutations with prefixes, suffixes, and hyphen variants
- Filters and ranks domains based on TLD popularity and heuristics

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

### `client.search(params)`

Search for domain names based on a query string.

#### Parameters

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `query` | `string` | – | Search term to expand. |
| `keywords` | `string[]` | – | Additional keywords to combine with the query. |
| `location` | `string` | – | ISO country code used to include a ccTLD. |
| `supportedTlds` | `string[]` | `['com','net','org']` | TLDs allowed in results. |
| `defaultTlds` | `string[]` | `['com']` | TLDs always included when generating names. |
| `limit` | `number` | `20` | Maximum number of domains returned. |
| `debug` | `boolean` | `false` | When `true`, includes extra debug fields. |
| `useAi` | `boolean` | `false` | Expand ideas using AI generation. |

#### Response

| Field | Type | Description |
| --- | --- | --- |
| `results` | `DomainResult[]` | List of generated domains ordered by score. |
| `success` | `boolean` | Indicates whether the search completed successfully. |
| `message` | `string?` | Error message when `success` is `false`. |
| `includesAiGenerations` | `boolean` | Whether AI-generated names were requested. |
| `metadata` | `object` | Runtime details about the search (see below). |

**DomainResult**

| Field | Type | Description |
| --- | --- | --- |
| `domain` | `string` | Fully qualified domain name. |
| `suffix` | `string` | TLD without the leading dot. |
| `score` | `number` | Relative ranking score for the domain. |
| `isAvailable` | `boolean?` | Domain availability flag (only with `debug`). |
| `aiGenerated` | `boolean?` | Marks names produced by AI. |
| `variantTypes` | `string[]?` | Types of permutations used (only with `debug`). |

**Metadata**

| Field | Type | Description |
| --- | --- | --- |
| `searchTime` | `number` | Time in milliseconds spent generating suggestions. |
| `totalGenerated` | `number` | Count of candidates evaluated before limiting. |
| `filterApplied` | `boolean` | Whether a custom `supportedTlds` filter was used. |

## Development
- `npm run build` – build the library
- `npm test` – run the test suite
