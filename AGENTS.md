# AGENTS.md - Guidelines for Agentic Coding Assistants

## Project Overview

**Name:** sparql-to-ld  
**Purpose:** Serve RDF resources' CBDs (Concise Bounded Descriptions) by translating Linked Data requests into SPARQL DESCRIBE queries.  
**Status:** Project bootstrapped with dependencies and configuration. Source code implementation pending.  
**Architecture:** TypeScript project usable both as a library (importable module) and as a command-line tool (CLI).

**Tech Stack (Chosen):**
- **Runtime:** Node.js LTS with ES Modules
- **HTTP Server:** Fastify
- **RDF Library:** n3
- **SPARQL Client:** sparql-http-client
- **Testing:** Vitest
- **Linting:** ESLint (flat config format)
- **Formatting:** Prettier
- **Config Validation:** Zod
- **CLI Framework:** commander (via yargs)
- **Logger:** Pino

**Important:** This document will evolve as the project is implemented. Update this file when significant changes are made to conventions or tooling.

---

## Build, Lint, Test Commands

### Initial Setup (When package.json is created)

```bash
# Install dependencies
npm install

# Development with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Testing

- **Test Framework:** Vitest for unit tests (fast, Vite-based)
- **Integration Tests:** Vitest or separate framework (e.g., Supertest)

```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run a single test file
npm test -- path/to/testfile.test.ts

# Run a single test by name
npm test -- -t "test name pattern"

# Run tests matching a pattern
npm test -- path/to/**/*.test.ts
```

### Linting & Formatting

```bash
# Lint all files
npm run lint

# Lint and auto-fix
npm run lint:fix

# Format code
npm run format

# Type checking
npm run typecheck
```

### ESLint Configuration

Uses ESLint's modern flat config format (`eslint.config.js`) with TypeScript parser. Configuration includes:
- TypeScript-specific rules via `@typescript-eslint`
- Node.js and ES2022 globals
- Staged files pre-commit validation via Husky + lint-staged

---

## Code Style Guidelines

### Language & Runtime

- **Primary Language:** TypeScript (strict mode)
- **Runtime:** Node.js (LTS version)
- **Package Manager:** npm (or yarn/pnpm if preferred)

### TypeScript Configuration

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"]
}
```

### File Structure

```
sparql-to-ld/
├── src/
│   ├── index.ts          # Main entry point
│   ├── server/           # HTTP server logic
│   ├── sparql/           # SPARQL query construction
│   ├── rdf/              # RDF parsing/serialization
│   └── types/            # TypeScript type definitions
├── tests/
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   └── fixtures/         # Test fixtures (RDF data, queries)
├── dist/                 # Compiled output (gitignored)
├── package.json
├── tsconfig.json
├── eslint.config.js
├── .prettierrc
└── AGENTS.md            # This file
```

### Naming Conventions

- **Files:** Use kebab-case for filenames (`sparql-client.ts`, `rdf-parser.ts`)
- **Classes:** PascalCase (`SparqlTranslator`, `RdfResponseParser`)
- **Functions & methods:** camelCase (`describeResource`, `parseTriples`)
- **Constants:** UPPER_SNAKE_CASE (`MAX_RESPONSE_SIZE`, `DEFAULT_TIMEOUT`)
- **Types & interfaces:** PascalCase with `I` prefix optional, but be consistent (`ResourceDescriptor`, `SparqlQueryOptions`)
- **Private members:** Prefix with `_` (`_privateMethod`, `_cache`)

### Imports Organization

1. Node.js built-in modules (`fs`, `path`, `http`)
2. Third-party dependencies (`express`, `n3`, `sparql-client`)
3. Internal modules (`../types`, `../../utils`)

Use absolute imports when possible with `tsconfig.json` `baseUrl` configured.

```typescript
import { Readable } from 'stream';
import express from 'express';
import { parse } from 'n3';
import { ResourceDescriptor } from '@/types';
```

### Formatting

- **Prettier** for code formatting
- **Line length:** 80-100 characters
- **Indentation:** 2 spaces (no tabs)
- **Semicolons:** Required
- **Trailing commas:** ES5+ style (`[1, 2, 3]`)
- **Quotes:** Single quotes for strings, double quotes for JSX/HTML attributes

### Error Handling

- Use `try/catch` for async operations
- Create custom error classes extending `Error` for domain-specific errors
- Log errors with context using a structured logger (e.g., `pino`, `winston`)
- Return appropriate HTTP status codes:
  - `400` for malformed requests
  - `404` for missing resources
  - `500` for server errors
- Never expose internal error details to clients in production

```typescript
class SparqlError extends Error {
  constructor(
    message: string,
    public query: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'SparqlError';
  }
}
```

### HTTP API Design

- RESTful endpoints: `GET /resource/:id`
- Accept `Accept` header for content negotiation (`text/turtle`, `application/ld+json`, etc.)
- Query parameter for format override: `?format=ttl`
- Use proper HTTP caching headers (`ETag`, `Last-Modified`, `Cache-Control`)
- Implement CORS headers for cross-origin requests

### SPARQL Query Construction

- Use parameterized queries to prevent SPARQL injection
- Sanitize any user input that appears in queries
- Construct DESCRIBE queries: `DESCRIBE ?resource WHERE { ?resource <uri> }`
- Support for FedBox/CBD patterns with property paths
- Set query timeouts and limits to prevent DoS

### RDF Handling

- Use `n3` or `rdf-ext` for parsing/serializing
- Support common RDF serializations: Turtle, N-Triples, JSON-LD
- Validate input RDF data when necessary
- Normalize IRIs and blank node identifiers consistently

### Testing Guidelines

- Use **Vitest** for unit/integration tests (fast, Vite-based)
- Place test files next to source: `foo.test.ts` or `foo.spec.ts`
- Mock external SPARQL endpoints with `vi.mock()` or similar
- Use test fixtures for sample RDF data (keep small)
- Aim for high coverage of SPARQL query generation logic
- Integration tests should spin up test server and make real HTTP requests

```typescript
// Example test structure
import { describeResource } from '../src/sparql/translator';

describe('SparqlTranslator', () => {
  it('should generate DESCRIBE query for given URI', () => {
    const query = describeResource('http://example.org/resource');
    expect(query).toContain('DESCRIBE');
    expect(query).toContain('<http://example.org/resource>');
  });
});
```

### Documentation

- Use TSDoc for public APIs
- Document complex algorithms and SPARQL patterns
- Keep README.md updated with usage examples, API docs, and setup instructions

---

## Cursor / Copilot Rules

No `.cursorrules`, `.cursor/rules/`, or `.github/copilot-instructions.md` files exist yet. If you add them, ensure they align with this AGENTS.md document.

---

## Notes for Agents

- **Before making changes:** Check if package.json and other config files exist. If not, propose initial project setup.
- **Follow TypeScript strict mode:** All new code must pass `tsc --noEmit` without errors.
- **Test-driven development:** Write tests before implementation when adding new features.
- **Update this document:** When choosing specific tools (Express, Fastify, Jest, Vitest, ESLint, Prettier), update AGENTS.md with the actual commands and configurations.
- **Security:** Validate and sanitize all user inputs. Use HTTPS in production. Follow OWASP recommendations.
- **Performance:** Cache SPARQL query results when appropriate. Use streaming for large RDF responses.
- **Compatibility:** Ensure SPARQL 1.1 compliance. Support standard RDF serializations.

---

## Current Repository State

**⚠️ WARNING:** This repository contains only a README.md file. No source code, build scripts, or test suites exist. Any task requiring execution of `npm` commands will fail until the project is initialized.

**Next steps for bootstrapping:**
1. Choose framework (Express, Fastify, Koa)
2. Initialize with `npm init -y`
3. Install TypeScript and core dependencies
4. Set up tsconfig.json, ESLint, Prettier
5. Create basic folder structure
6. Implement minimal server with one endpoint
7. Write first tests
8. Update this AGENTS.md with actual commands
