# sparql-to-ld

⚠️ This is a vibe-coded / experimental project.
Expect breaking changes, rough edges, and incomplete features.

Serve RDF resources' CBDs (Concise Bounded Descriptions) by translating Linked Data requests into SPARQL DESCRIBE queries.

## Features

- Translate external URIs to internal SPARQL endpoint URIs (request translation)
- Translate internal SPARQL responses back to external URIs (response translation)
- Content negotiation (Turtle, N-Triples, RDF/XML, JSON-LD*)
- CORS support
- Configurable via YAML or environment variables

*JSON-LD parsing requires additional setup (see TODO below)

## Requirements

- Node.js 18+ (LTS recommended)

## Installation

```bash
npm install
npm run build
```

## Configuration

Create a `config.yaml` file:

```yaml
server:
  host: "0.0.0.0"
  port: 3000

sparql:
  endpoint: "http://localhost:3030/dataset"
  timeout: 30000

cors:
  origin: "*"

uriMappings:
  - internalPrefix: "http://internal.data.example.org/"
    externalPrefix: "http://data.example.org/"

translateResponse: true
```

Alternatively, use environment variables:

```bash
SPARQL_ENDPOINT=http://localhost:3030/dataset
TRANSLATE_RESPONSE=true
PORT=3000
```

## Usage

### Command Line

```bash
# Start the server
npm start

# With custom config file
npx sparql-to-ld --config /path/to/config.yaml

# Development mode with hot reload
npm run dev
```

### Programmatic (Library)

#### Basic Usage

```typescript
import { createServer } from 'sparql-to-ld';
import { loadConfig } from 'sparql-to-ld';

const config = loadConfig('./config.yaml');
const server = await createServer(config);
await server.listen({ port: 3000 });
```

#### Custom SPARQL Client

```typescript
import { createServer, ServerDeps } from 'sparql-to-ld';
import type { FastifyInstance } from 'fastify';
import { loadConfig } from 'sparql-to-ld';

// Create a custom SPARQL client
class CustomSparqlClient {
  constructor(
    private endpoint: string,
    private options?: { timeout?: number; headers?: Record<string, string> }
  ) {}

  async describe(resourceIri: string, format: string) {
    // Your implementation
    return yourReadableStream;
  }
}

const config = loadConfig('./config.yaml');
const deps: ServerDeps = { SparqlClient: CustomSparqlClient };
const server = await createServer(config, deps);
```

#### URI Translation Only

```typescript
import { UriTranslator } from 'sparql-to-ld';

const translator = new UriTranslator([
  { internalPrefix: 'http://internal.org/', externalPrefix: 'http://external.org/' }
]);

// Translate request URI (external -> internal)
const internalIri = translator.translateRequestUri('http://external.org/resource');
// Result: 'http://internal.org/resource'

// Translate response dataset (internal -> external)
const dataset = [{ subject: 'http://internal.org/resource', predicate: 'http://p', object: { value: 'test' } }];
const translated = translator.translateDataset(dataset);
// IRIs in dataset are now prefixed with external prefix
```

## API

### Endpoints

#### `GET /resource/{iri}`

Retrieve a resource's CBD (Concise Bounded Description).

**Query Parameters:**

- `format` - Override content format (`ttl`, `nt`, `jsonld`, `rdfxml`)
- `translateResponse` - Override response translation (`true`, `false`)

**Headers:**

- `Accept` - Content negotiation (e.g., `text/turtle`, `application/ld+json`)

**Example:**

```bash
curl http://localhost:3000/resource/http://data.example.org/person/1
curl http://localhost:3000/resource/http://data.example.org/person/1?format=nt
curl -H "Accept: application/ld+json" http://localhost:3000/resource/http://data.example.org/person/1
```

#### `GET /health`

Health check endpoint.

```bash
curl http://localhost:3000/health
```

## Supported RDF Formats

| Format | MIME Type | Parser | Writer |
|--------|-----------|--------|---------|
| Turtle | `text/turtle` | ✅ n3 | ✅ n3 |
| N-Triples | `application/n-triples` | ✅ n3 | ✅ n3 |
| RDF/XML | `application/rdf+xml` | ✅ n3 | ✅ n3 |
| JSON-LD | `application/ld+json` | ❌ Requires additional setup | ✅ n3 |

## Project Structure

```
sparql-to-ld/
├── src/
│   ├── cli/             # CLI entry point
│   ├── config/          # Configuration loading
│   ├── rdf/             # RDF parsing, serialization, URI translation
│   ├── server/          # Fastify HTTP server
│   ├── sparql/          # SPARQL query construction
│   └── types/           # TypeScript type definitions
├── tests/
│   ├── integration/     # Server integration tests
│   └── unit/            # Unit tests
└── dist/                # Compiled output
```

## Development

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type checking
npm run typecheck

# Linting
npm run lint

# Format code
npm run format
```

## TODO

- [ ] JSON-LD parsing support (requires `@rdfjs/parser-jsonld` or similar)
- [ ] Streaming response support for large datasets
- [ ] Caching layer for SPARQL responses
- [ ] Prometheus metrics endpoint
- [ ] Rate limiting
- [ ] Authentication/authorization
- [ ] Support for CONSTRUCT queries in addition to DESCRIBE

## License

ISC
