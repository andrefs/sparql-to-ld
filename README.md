# sparql-to-ld

Serve RDF resources' CBDs (Concise Bounded Descriptions) by translating Linked Data requests into SPARQL DESCRIBE queries.

## Features

- Translate external URIs to internal SPARQL endpoint URIs (request translation)
- Translate internal SPARQL responses back to external URIs (response translation)
- Per-dataset SPARQL endpoint configuration
- Content negotiation (Turtle, N-Triples, RDF/XML, JSON-LD*)
- CORS support
- Configurable via JSON file or environment variables
- Usable as both CLI tool and library

*JSON-LD parsing requires additional setup (see TODO below)

## Requirements

- Node.js 18+ (LTS recommended)

## Installation

```bash
npm install
npm run build
```

## Configuration

Create a `sparql-to-ld.json` file:

```json
{
  "server": {
    "host": "0.0.0.0",
    "port": 3000
  },
  "cors": {
    "origin": "*"
  },
  "translateResponse": true,
  "uriMappings": [
    {
      "dsName": "my-dataset",
      "endpoint": "http://localhost:3030/my-dataset/sparql",
      "internalPrefix": "http://internal.data.example.org/",
      "externalPrefix": "http://data.example.org/"
    }
  ]
}
```

Alternatively, use environment variables:

```bash
TRANSLATE_RESPONSE=true
PORT=3000
```

### Configuration Schema

| Field | Type | Description |
|-------|------|-------------|
| `server.host` | string | Server bind address (default: `0.0.0.0`) |
| `server.port` | number | Server port (default: `3000`) |
| `cors.origin` | string | CORS origin (default: `*`) |
| `translateResponse` | boolean | Enable response URI translation (default: `true`) |
| `uriMappings` | array | Array of dataset URI mappings |
| `uriMappings[].dsName` | string | Dataset name for routing |
| `uriMappings[].endpoint` | string | SPARQL endpoint URL (Fuseki format: `http://host:port/dataset/sparql`) |
| `uriMappings[].internalPrefix` | string | Prefix used by the SPARQL endpoint |
| `uriMappings[].externalPrefix` | string | Public-facing prefix for API |

## Usage

### Command Line

```bash
# Start the server
npm start

# With custom config file
npx sparql-to-ld --config /path/to/sparql-to-ld.json

# Development mode with hot reload
npm run dev
```

### Programmatic (Library)

#### Basic Usage

```typescript
import { createServer, loadConfig } from 'sparql-to-ld';

const config = loadConfig('./sparql-to-ld.json');
const server = await createServer(config);
await server.listen({ port: 3000 });
```

#### URI Translation Only

```typescript
import { UriTranslator } from 'sparql-to-ld';

const translator = new UriTranslator([
  { dsName: 'ds', endpoint: 'http://localhost:3030/ds/sparql', internalPrefix: 'http://internal.org/', externalPrefix: 'http://external.org/' }
]);

// Translate request URI (external -> internal)
const internalIri = translator.translateRequestUri('http://external.org/resource');
// Result: 'http://internal.org/resource'

// Translate response dataset (internal -> external)
const translated = translator.translateDataset(dataset);
// IRIs in dataset are now prefixed with external prefix
```

## API

### Endpoints

#### `GET /ld/:dsName/{*resourceUri}`

Retrieve a resource's CBD (Concise Bounded Description) from the specified dataset.

**Query Parameters:**

- `format` - Override content format (`ttl`, `nt`, `jsonld`, `rdfxml`)
- `translateResponse` - Override response translation (`true`, `false`)

**Headers:**

- `Accept` - Content negotiation (e.g., `text/turtle`, `application/ld+json`)

**Example:**

```bash
# Retrieve resource from dataset "my-dataset"
curl http://localhost:3000/ld/my-dataset/http://data.example.org/person/1

# Request as N-Triples
curl http://localhost:3000/ld/my-dataset/http://data.example.org/person/1?format=nt

# Content negotiation via Accept header
curl -H "Accept: application/ld+json" http://localhost:3000/ld/my-dataset/http://data.example.org/person/1

# Disable response URI translation
curl http://localhost:3000/ld/my-dataset/http://data.example.org/person/1?translateResponse=false
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
│   ├── sparql/          # SPARQL query construction and client
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
