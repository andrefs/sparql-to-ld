# AGENTS.md - Guidelines for Agentic Coding Assistants

## Project Overview

**Name:** sparql-to-ld
**Purpose:** Serve RDF resources' CBDs (Concise Bounded Descriptions) by translating Linked Data requests into SPARQL DESCRIBE queries.
**Status:** Core implementation complete. 30 tests passing.
**Architecture:** TypeScript project usable both as a library (importable module) and as a command-line tool (CLI).

**Tech Stack (Chosen):**
- **Runtime:** Node.js 18+ LTS with ES Modules
- **HTTP Server:** Fastify
- **RDF Library:** n3
- **SPARQL Client:** sparql-http-client
- **Testing:** Vitest
- **Linting:** ESLint (flat config format)
- **Formatting:** Prettier
- **Config Validation:** Zod
- **CLI Framework:** commander
- **Logger:** Pino

---

## Build, Lint, Test Commands

```bash
# Install dependencies
npm install

# Development with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run a single test file
npm test -- path/to/testfile.test.ts

# Lint all files
npm run lint

# Lint and auto-fix
npm run lint:fix

# Format code
npm run format

# Type checking
npm run typecheck
```

---

## Code Style Guidelines

### File Structure

```
sparql-to-ld/
├── src/
│   ├── cli/             # CLI entry point
│   ├── config/          # Configuration loading
│   ├── rdf/             # RDF parsing, serialization, URI translation
│   ├── server/          # Fastify HTTP server
│   ├── sparql/          # SPARQL query construction and client
│   └── types/           # TypeScript type definitions
├── tests/
│   ├── integration/     # Server integration tests
│   └── unit/            # Unit tests
├── dist/                # Compiled output
├── src/index.ts         # Main entry point (exports createServer, loadConfig, UriTranslator)
└── AGENTS.md            # This file
```

### Naming Conventions

- **Files:** kebab-case (`sparql-client.ts`, `uri-translator.ts`)
- **Classes:** PascalCase (`UriTranslator`, `SparqlClient`)
- **Functions & methods:** camelCase (`describeResource`, `translateRequestUri`)
- **Constants:** UPPER_SNAKE_CASE (`DEFAULT_TIMEOUT`, `SUPPORTED_FORMATS`)
- **Types & interfaces:** PascalCase (`UriMapping`, `RdfFormat`)
- **Private members:** Prefix with `_` (`_mappings`, `_base`)

### Imports Organization

1. Node.js built-in modules (`fs`, `path`, `http`)
2. Third-party dependencies (`fastify`, `n3`, `sparql-http-client`, `zod`)
3. Internal modules (`./config`, `../types`)

### Key Implementation Details

- Use `n3` Parser's internal `_prefixes` and `_base` to extract prefix/base metadata
- Use `n3` Writer with `prefixes` constructor option for proper serialization
- Use sparql-http-client's `client.get()` with `response.body` for raw RDF streams
- sparql-http-client option name is `endpointUrl` (not `endpoint`)
- Fuseki SPARQL endpoint format: `http://host:port/dataset/sparql`
- Fastify wildcard route: `/ld/:dsName/*` with access via `req.params['*']`
- URI translation: longest-prefix matching, bidirectional, skips literals and blank nodes
- Translate prefix/base directives in RDF output via `writer._prefixes` and `writer._base`
- Config loaded from: `sparql-to-ld.json` (default), `--config` CLI flag, `.env`, or `process.env`

### HTTP API Design

- Route: `GET /ld/:dsName/{*resourceUri}`
- Query params: `format` (ttl/nt/jsonld/rdfxml), `translateResponse` (true/false)
- Accept header for content negotiation
- Health endpoint: `GET /health`
- Return 400 for malformed URIs, 404 for missing datasets, 500 for server errors

### SPARQL Query Construction

- Use DESCRIBE queries: `DESCRIBE <uri>`
- Set query timeout via `timeout` in SparqlClient constructor
- Use sparql-http-client's `QueryStringClient` for simple endpoint queries

### RDF Handling

- n3 supports: Turtle, N-Triples, RDF/XML, N3 (NOT JSON-LD parsing)
- JSON-LD serialization works but parsing requires `@rdfjs/parser-jsonld`
- Blank nodes left unchanged by URI translator

### Testing Guidelines

- Use **Vitest** for unit and integration tests
- Place test files next to source: `uri-translator.test.ts`
- Mock sparql-http-client with `vi.mock()` or use integration tests with fake responses
- Unit tests: `tests/unit/rdf/uri-translator.test.ts` (13 tests)
- Integration tests: `tests/integration/server.test.ts` (17 tests)

---

## Current Repository State

**Core implementation complete.** All 30 tests pass, typecheck and lint clean.

**TODO:**
- JSON-LD parsing support (requires `@rdfjs/parser-jsonld`)
- Streaming response support for large datasets
- Caching layer for SPARQL responses
- Prometheus metrics endpoint
- Rate limiting
- Authentication/authorization
- Support for CONSTRUCT queries

**Important n3 discoveries:**
- Parser doesn't have an `on()` event emitter API - must use internal `_prefixes` and `_base`
- Writer must receive prefixes via constructor options, not `addPrefixes()` for `quadsToString()`
- JSON-LD parsing is NOT supported by n3
