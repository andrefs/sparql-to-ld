# Testing Plan: Literal Query Feature

## Overview

The literal query feature allows clients to request all triples where a specific literal appears as the object by encoding the literal in the request path (e.g., `/ld/dataset/"literal value"` or `/ld/dataset/%22literal%22`).

## Test Coverage Required

### 1. Unit Tests

#### `src/sparql/query-builder.test.ts` (new file)

- `buildLiteralQuery(literal)`
  - Simple literal: `"test"`
  - Literal with language: `"test"@en`
  - Literal with datatype: `"test"^^<http://example.org/type>`
  - Empty literal: `""`
  - Literals with special characters: quotes, newlines, Unicode
  - Verify exact SPARQL SELECT query format

#### `src/sparql/client.test.ts` (extend)

- `SparqlClient.literal(literal, format)`
  - Success: returns readable stream of JSON results
  - Sets Accept header to `application/sparql-results+json`
  - Handles HTTP errors (non-200 responses)
  - Handles missing response body
  - Wraps errors in `EndpointError` with proper context

#### `src/sources/manager.test.ts` (extend)

- `parseSparqlJsonResults(jsonString)`
  - Parses SELECT results with URI subjects/predicates/objects
  - Handles blank nodes in subject/predicate/object positions
  - Handles literals with language tags: `{ value: "x", language: "en" }`
  - Handles literals with datatypes: `{ value: "x", datatype: "<type>" }`
  - Returns empty array for empty results
  - Returns empty array for malformed JSON
- `fetchByLiteral(dsName, literal, format)`
  - Single SPARQL endpoint: returns triples, prefixes, base
  - Multiple endpoints: aggregates triples, merges prefixes (first wins), picks first base
  - Partial success: some endpoints fail but still returns results
  - All endpoints fail: throws AggregateError
  - Logs successes and failures appropriately
- `executeLiteralEndpoint(endpoint, literal, format)`
  - Throws error for non-SPARQL endpoints
  - Returns triples, empty prefixes, undefined base

### 2. Integration Tests

#### `tests/integration/server.test.ts` (extend)

- Literal path detection
  - Request `/ld/ds/"literal"` → 200, processed via fetchByLiteral
  - Request `/ld/ds/%22literal%22` → correctly decoded to `"literal"`
  - Request with encoded spaces `%20` → correctly decoded
- Response handling
  - Response includes triples containing the literal
  - Response translation works (literal queries respect translateResponse flag)
  - HTML format works for literal queries
- Error cases
  - Malformed literal → 400 or 404
  - SPARQL endpoint error → 502
- Regression: regular URI paths still work

### 3. Test Data Fixtures

- Sample SPARQL JSON SELECT responses for `literal()` method:
  - Triple with literal in object position
  - Mix of URIs, blank nodes, and literals
  - Literals with language and datatype examples

### 4. Coverage Goals

- 100% coverage for `buildLiteralQuery()`
- > 90% coverage for `SparqlClient.literal()` (including error paths)
- > 90% coverage for `parseSparqlJsonResults()` (all binding types, error handling)
- > 80% coverage for `fetchByLiteral()` and `executeLiteralEndpoint()`
- Integration tests covering full request-response cycle

### 5. Mocking Strategy

- Mock `sparql-http-client` in unit tests
- Mock fetch in integration tests to return SPARQL JSON responses
- Use `Readable.fromWeb()` or Buffer to simulate response streams

## Execution Order

1. Set up new test files for query-builder and extend existing ones
2. Implement fixtures and mocks
3. Run all tests, ensure coverage goals met
4. Verify no regressions in existing functionality (all 41+ tests pass)
