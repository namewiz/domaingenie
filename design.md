# Fast Domain Search Library – Design Document

## 1. Overview

The Fast Domain Search Library is a pure JavaScript/TypeScript module that generates and ranks candidate domain names for user‑supplied queries. It accepts a short text phrase (the query) along with optional parameters such as extra keywords, supported and default top‑level domains (TLDs) and a geographic location. The library returns a ranked list of domain names that combine the query, synonyms/related words and various TLDs. It is intended to provide near‑instant suggestions without hitting external registrars and can be integrated into client‑side web applications or Node.js services.

### Goals

**Low latency search** – generate suggestions and compute rankings quickly in the browser or a serverless function. The algorithm is deterministic and uses in‑memory dictionaries rather than network round‑trips.

**Relevance and quality** – produce domain names that are short, pronounceable and brandable. Industry guidance recommends keeping domain names under about 15 characters, avoiding complex spelling and hyphens, and choosing names that are easy to pronounce to aid memory ("processing fluency").

**Configurability** – allow callers to constrain suggestions to specific TLDs, pass additional seed keywords, override the country for ccTLD suggestions and set a maximum number of results.

**Extensibility** – design the architecture such that external services (e.g. domain availability APIs, AI models) can be plugged in without breaking the core search API. The library should flag when suggestions came from AI models via `includes_ai_generations`.

### Non‑Goals

**Real‑time availability checks** – the library does not perform WHOIS or registrar lookups. It focuses on string generation and ranking. Consumers can integrate availability APIs in the future.

**Full natural‑language understanding** – while synonyms and minor morphology are used to expand the query, the system is not expected to fully understand semantics. Simpler heuristics and dictionaries suffice for the initial version.

## 2. Input and Output Specifications

### 2.1 Input Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | string | Yes | The primary term(s) to search. Should be 1–4 words long. |
| `keywords` | string[] | No | Additional seed keywords. These can include niche words or synonyms provided by the caller for better relevance. |
| `location` | string (ISO‑3166‑1 alpha‑2) | No | Overrides IP‑based location detection and influences ccTLD suggestions. For example "de" suggests .de domains. |
| `supportedTlds` | string[] | No | Limit suggestions to these TLDs only. Accepts second‑level ccTLDs (e.g. "com.ng"). |
| `defaultTld` | string | No | Primary TLD appended when no extension is supplied; always included in results. |
| `preferredTlds` | string[] | No | TLDs generators should prioritise. Can be set from location, language or industry. |
| `limit` | number | No | Maximum number of suggestions to return (default 20). |

All string fields are case‑insensitive. The library normalizes TLDs to lower case and trims whitespace.

### 2.2 Output Schema

The `search()` function returns an object with the following properties:

```typescript
interface DomainSearchResult {
  success: boolean;
  message?: string;        // Information or error message
  includesAiGenerations: boolean;
  results: DomainItem[];   // Ordered by descending score
}

interface DomainItem {
  domain: string;          // Full domain (e.g. "foobar.com")
  suffix: string;          // The TLD suffix (e.g. "com" or "com.ng")
  score: number;           // Internal score used for ranking (not exposed by default)
}
```

`results` always contains at most `limit` items. The `includesAiGenerations` flag is set to false in the initial implementation; it allows future versions to insert AI‑generated names and communicate this to the caller.

## 3. High‑Level Architecture

The library is organised into discrete modules that communicate through well‑defined interfaces. Figure 1 illustrates the overall flow.

*Figure 1 – Major components of the Fast Domain Search Library. A query is parsed, expanded using synonyms and optional keywords, fed into a candidate generator, filtered by supported TLDs and location, ranked and then formatted into the response.*

### Components

**Input Parser** – cleans and tokenises the query, merges it with extra keywords and validates parameters.

**Synonym/Keyword Expansion** – expands each token using a thesaurus to include synonyms and antonyms. NameMesh explicitly highlights the use of Thesaurus algorithms to generate common alternatives via synonyms and antonyms.

**Candidate Domain Generator** – produces raw domain strings by combining tokens and synonyms in various ways (concatenation, prefix/suffix, alphabet combinations etc.). It also handles TLD hacks, misspellings and exact‑match variants.

**TLD Filter & Localisation** – restricts TLDs to those specified in `supportedTlds` or falls back to the `defaultTld`, any `preferredTlds` and location‑derived ccTLDs. Generic TLDs like .com, .net and .org are widely recognised and trusted, while ccTLDs can boost local SEO and credibility.

**Ranking Engine** – scores each candidate based on relevance, length, pronounceability, hyphen/number penalties and TLD weights. Short, pronounceable names without hyphens/numbers and with popular TLDs rank higher.

**Response Formatter** – sorts candidates by score, truncates to limit, and packages the response object.

## 4. Domain Generation Strategies

Domain generation begins by tokenising the query and merging it with keywords. Each token is lower‑cased and stripped of punctuation. Several strategies are applied to produce candidate labels before adding TLDs:

### 4.1 Synonym and Antonym Expansion

For each token, the library fetches a list of synonyms and antonyms from a local dictionary (e.g. WordNet) or an optional external API. NameMesh notes that generating common alternatives via thesaurus algorithms and synonyms/antonyms can broaden the search space. When keywords are provided by the caller, these are appended to the synonym list.

### 4.2 Concatenation and Word Order

The simplest strategy concatenates query tokens in various orders (e.g., foo + bar, bar + foo) and inserts synonyms in place of tokens. Words are joined without separators for short, memorable names. Hyphenated variants are also generated but receive a negative score penalty (see §5.2).

### 4.3 Prefix/Suffix Modifications

Many popular domain generators attach affixes to a base keyword to produce brandable names. NameMesh mentions mixing words with suffixes and prefixes such as -er, -ify, -ly and others. The library keeps a list of common affixes and applies them to both query tokens and synonyms (e.g., cook → cookify, vegan → veganly).

### 4.4 Alphabet Combinations

NameMesh also describes checking domain names with a single letter before or after the query, such as aweight.com or weightb.com. The library applies this by prepending/appending letters from 'a'–'z' to base words when generating variants. These combinations are capped to avoid an explosion of candidates.

### 4.5 TLD Hacks and "Short" Domains

Short domains overlay part of the keyword with the TLD (e.g., liv.es, bon.us). For each TLD, the generator checks whether the token's end matches the TLD's two‑letter country code or generic extension and splits the word accordingly. This produces TLD hacks like foo.ba (from .ba) or fo.od (from .od if supported). Only supported TLDs are used for hacks.

### 4.6 Alternative and Fun Variants

To provide creative options, the library includes:

**Misspellings / Fun Domains** – NameMesh suggests that AI engines can generate "misspelled" domains for fun. The generator produces near‑miss spellings by dropping or swapping adjacent characters. These are clearly marked as AI‑generated in future versions.

**Exact‑Match Domains (EMD)** – direct concatenations of all tokens (e.g., foobar.com). While search engines penalise spammy exact‑match domains, some users still prefer them. The ranking engine down‑weights EMDs but includes them for completeness.

## 5. TLD Handling and Localisation

Top‑level domains strongly influence trust and memorability. Shopify advises choosing a .com domain when possible because it is the most established and credible extension. Name.com notes that .com, .net and .org are widely recognised generic TLDs and open to everyone. Other gTLDs like .info and .biz are also available but less trusted.

Country‑code TLDs (ccTLDs) help target a website to a specific region and increase credibility among local users. The library determines a default ccTLD based on the caller's IP address (when available) or the location parameter. If `supportedTlds` is supplied, ccTLDs not in this list are ignored.

The `defaultTld` option sets the extension appended when a generated label lacks one. Additional extensions can be passed via `preferredTlds` to prioritise them during generation. If `defaultTld` is omitted, .com is assumed.

## 6. Ranking Engine

The ranking engine assigns each candidate a score in the range 0–1 and sorts results by descending score. The score is a weighted sum of several features:

| Feature | Rationale | Example Weight |
|---------|-----------|----------------|
| **Relevance** | Measures how well the candidate contains query tokens or synonyms. Exact match of tokens is rewarded; partial matches and synonym substitutions receive a smaller boost. | 0.30 |
| **Length** | Shorter names are easier to remember. Experts recommend keeping domain names under 15 characters and note that the top 100,000 websites average 9 characters. The score decreases linearly beyond 15 characters. | 0.20 |
| **Pronounceability** | Names that are easy to pronounce improve "processing fluency" and memorability. A simple heuristic counts vowels and penalises unnatural consonant clusters. | 0.15 |
| **Hyphen and Number Penalty** | Hyphens and numbers increase the risk of typos and are associated with spam. Each hyphen reduces the score. Domains with numbers are penalised similarly. | –0.10 per hyphen/number |
| **TLD Weight** | Popular and trusted TLDs such as .com, .net and .org get a positive weight. Alternative or less trusted TLDs get a smaller or negative weight. ccTLDs matching the user's location gain a bonus. | 0.10 |
| **Brandability** | Unique, non‑generic names that avoid exact matches and ambiguity rank higher. Avoid double letters and ambiguous names (e.g. "therapistfinder.com"). A heuristic rewards names with uncommon character patterns and penalises double letters. | 0.15 |

These weights are illustrative; the library exposes them as configuration options for experimentation. Final scores are clamped between 0 and 1 and normalised for sorting.

## 7. API Interface and Implementation

The library exposes a single entry point:

```typescript
async function search(
  query: string,
  options?: {
    keywords?: string[];
    location?: string;
    supportedTlds?: string[];
    defaultTld?: string;
    preferredTlds?: string[];
    limit?: number;
  }
): Promise<DomainSearchResult>;
```

Internally, the library uses TypeScript interfaces for strong typing. Modules are implemented as pure functions wherever possible to simplify unit testing. The entire pipeline is asynchronous, allowing future integration with network‑based synonym services or AI generators.

### 7.1 Input Parser

- Normalizes query and keywords to lowercase.
- Splits the query into tokens based on whitespace and punctuation.
- Validates ISO‑3166 country codes and TLD formats (e.g. using regex `/^[a-z]{2}(\.[a-z]{2,6})?$/`).
- Sets defaults for `supportedTlds`, `defaultTld`, `preferredTlds` and `limit` when unspecified (e.g. `supportedTlds = ["com", "net", "org"]`, `defaultTld = "com"`, `preferredTlds = []`, `limit = 20`).

### 7.2 Synonym/Keyword Expansion Module

- Maintains a local dictionary mapping words to arrays of synonyms and antonyms. A popular approach is to bundle a compact WordNet dataset or rely on an offline synonyms library.
- Given a token, returns `[token, ...synonyms, ...antonyms]` sorted by closeness; the base token always has the highest priority.
- Deduplicates synonyms and removes entries longer than a configurable length (e.g. > 15 characters).

### 7.3 Candidate Domain Generator

- Accepts an array of tokens and expanded synonyms.
- Applies the strategies described in §4 to produce candidate labels. Each candidate records the transformations used (e.g. `variantType: "prefix-suffix"` or `"alphabet-combo"`) to aid future analytics.
- Appends TLDs from `supportedTlds` along with the `defaultTld` and any `preferredTlds`. For each label that does not already end with a supported TLD, the generator yields `label + "." + tld`. For labels that include a dot (from a TLD hack), the suffix is preserved.
- Ensures uniqueness by storing generated strings in a Set.

### 7.4 TLD Filter & Localisation

- Maps the location country code to its ccTLD (e.g., "ng" → "ng", "us" → "us"). When location is unspecified, the library uses a default (e.g., "com").
- Filters out any candidate whose suffix is not in `supportedTlds` (if provided).
- Adds location‑derived ccTLD suggestions by appending the ccTLD to the candidate label where appropriate. This leverages the advantages of ccTLDs for regional targeting.

### 7.5 Ranking Engine

- For each candidate domain, computes features (relevance, length, pronounceability, hyphens/numbers, TLD weight, brandability) and multiplies by configurable weights.
- Uses simple heuristics for pronounceability (e.g. ratio of vowels to total letters and penalty for > 2 consonants in a row). This encourages names that can be pronounced easily, improving recall.
- Penalises each occurrence of a hyphen or number by subtracting a fixed amount from the score, reflecting industry advice to avoid hyphens and numbers.
- Applies TLD weights: .com receives a positive bias since it is widely trusted, whereas uncommon or potentially spam‑associated TLDs get lower scores. ccTLDs matching location get a small bonus.
- Enforces a minimum score threshold; candidates below this are discarded.

### 7.6 Response Formatter

- Sorts candidates by descending score.
- Truncates to `limit` entries.
- Removes the internal score field unless debugging is enabled.
- Sets `includesAiGenerations` based on whether any candidates originated from the "fun" or AI‑based variant strategies.

## 8. Error Handling

The library returns `success: false` with an informative message when:

- `query` is empty after normalisation.
- `limit` is zero or negative.
- `supportedTlds` contains invalid TLDs.
- `location` is not a two‑letter country code.

In these cases, `results` is an empty array and `includesAiGenerations` is false.

## 9. Security and Privacy Considerations

**No network calls by default** – synonyms and candidate generation operate on local data. When optional external synonym APIs or AI models are enabled, requests should be proxied through secure HTTPS endpoints and avoid sending personally identifiable information.

**Injection resistance** – tokenisation escapes characters that could result in unintended code execution (e.g. preventing injection of `javascript:` into the results). Only valid domain characters (`[a-z0-9\-]`) are used when constructing candidates.

**Data minimisation** – the library does not store queries or results beyond the lifetime of the request. Logging should be opt‑in.

## 10. Scalability and Performance

**Linear generation** – candidate generation scales linearly with the number of tokens and synonyms. To avoid combinatorial explosion, the library caps the number of synonyms per token (e.g. top 5) and limits the number of prefix/suffix or alphabet combinations.

**Memoisation** – synonyms for previously seen words are cached in memory. This avoids repeated dictionary lookups across calls.

**Web Worker support** – the library can be bundled to run inside a Web Worker, off‑loading computation from the main browser thread.

**Configuration** – the user can set `limit` to manage output size. For high‑throughput applications, it may be useful to run the search asynchronously across multiple queries.

## 11. Testing and Validation

The library should ship with comprehensive unit tests covering:

- Tokenisation of different input strings, including non‑ASCII characters.
- Synonym expansion and deduplication.
- Correct generation of candidate variants (concatenation, affixes, alphabet combos, TLD hacks).
- Filtering by `supportedTlds` and location.
- Ranking function behaviour for various edge cases: hyphenated names, long names, numbers, ambiguous or spammy names.
- Response schema and error handling.

Integration tests should verify that the library returns consistent results across different environments (Node.js vs browser). Performance benchmarks can measure latency with varying input sizes and optimisation parameters.

## 12. Future Enhancements

**Domain availability checks** – integrate a pluggable interface to call WHOIS or registrar APIs and filter out already taken domains. This could update the `includesAiGenerations` flag if AI models are used to suggest alternatives.

**Machine‑learning ranking** – replace the heuristic scoring with a model trained on historical domain sale data. Research on ranking domain names using rating methods suggests that machine‑learning techniques can learn market valuations.

**Multilingual support** – use language‑specific dictionaries to generate synonyms and adjust pronounceability heuristics for non‑English languages.

**User feedback loop** – allow users to 'like' or 'dismiss' suggestions and use this implicit feedback to adjust ranking weights over time.

## 13. Conclusion

This design document outlines a modular, extensible approach to building a fast domain search library. By combining simple linguistic techniques, industry best practices for domain naming and configurable ranking heuristics, the library produces relevant and memorable domain suggestions. The design emphasises short, pronounceable names without hyphens and numbers, favours popular and trusted TLDs, and offers flexibility for regional targeting. A senior engineer can implement this design in modern JavaScript/TypeScript, unit test it thoroughly and iterate on ranking weights or integrate external APIs as needed.