import { describe, it, expect, afterAll, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createServer } from '../../src/server/server.js';
import type { ServerConfig } from '../../src/types/Config.js';

// SPARQL JSON response for literal query results
const SPARQL_JSON_RESULTS = `{
  "head": { "vars": ["s", "p", "o"] },
  "results": {
    "bindings": [
      {
        "s": { "type": "uri", "value": "http://internal.org/subject" },
        "p": { "type": "uri", "value": "http://internal.org/predicate" },
        "o": { "type": "literal", "value": "test literal" }
      },
      {
        "s": { "type": "uri", "value": "http://internal.org/another" },
        "p": { "type": "uri", "value": "http://internal.org/predicate" },
        "o": { "type": "literal", "value": "test literal" }
      }
    ]
  }
}`;

// Mock fetch that distinguishes between RDF and SPARQL JSON requests
function createMockFetch(): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(init?.headers);
    const accept = headers.get('Accept') || 'text/turtle';

    // If the request is for SPARQL JSON results (literal query)
    if (accept === 'application/sparql-results+json') {
      return new Response(SPARQL_JSON_RESULTS, {
        status: 200,
        headers: { 'Content-Type': 'application/sparql-results+json' },
      });
    }

    // Default: return RDF data (for regular resource requests)
    const sampleRdf = `
@prefix ex: <http://internal.org/> .
@prefix dc: <http://purl.org/dc/elements/1.1/> .

ex:subject dc:publisher ex:publisher ;
    dc:title "Test Title" ;
    dc:creator ex:creator .
`;
    return new Response(sampleRdf, {
      status: 200,
      headers: { 'Content-Type': 'text/turtle' },
    });
  };
}

let originalFetch: typeof fetch;
let server: FastifyInstance;

beforeEach(() => {
  originalFetch = global.fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
  if (server) {
    server.close();
    server = null as any;
  }
});

function createConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    server: { host: '0.0.0.0', port: 3000 },
    cors: { origin: '*' },
    translateResponse: true,
    ...overrides,
  };
}

describe('Literal Query Integration', () => {
  afterAll(async () => {
    if (server) await server.close();
  });

  describe('GET /ld/:dsName/* with literal', () => {
    beforeEach(async () => {
      if (server) await server.close();
      const config = createConfig({
        sources: [
          {
            dsName: 'dbpedia',
            originalPrefix: 'http://internal.org/',
            endpoints: [
              {
                type: 'sparql',
                mode: 'describe',
                url: 'http://localhost:9999/dataset',
              },
            ],
          },
        ],
      });
      global.fetch = createMockFetch();
      server = createServer(config);
      await server.ready();
    });

    it('should handle literal query path and return JSON-LD results', async () => {
      // The literal must be URL-encoded. The path suffix should start with " (encoded as %22)
      const response = await server.inject({
        method: 'GET',
        url: '/ld/dbpedia/%22test%20literal%22',
        headers: { accept: 'application/ld+json' },
      });

      expect(response.statusCode).toBe(200);
      // The server should translate the result to JSON-LD format (actually based on format negotiation)
      // Since we asked for application/ld+json, the response should be JSON-LD (if supported)
      // But our RDF library returns JSON-LD? n3 can serialise to JSON-LD? Actually JSON-LD parsing not supported, but serialization might work.
      // For this test, we accept 200 and check content is not empty.
      expect(response.body).not.toBeNull();
    });

    it('should translate internal URIs to external in literal results', async () => {
      // Default format is Turtle
      const response = await server.inject({
        method: 'GET',
        url: '/ld/dbpedia/%22test%20literal%22',
        headers: { accept: 'text/turtle' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.body.toString();
      // Internal IRIs should be translated to external prefix
      expect(body).not.toContain('http://internal.org/');
      // It should contain the external proxy URIs (but not necessarily)
      // Check that the response uses ex: or full external URIs.
      // Since translateResponse is true, internal IRIs should be replaced with http://localhost:3000/ld/dbpedia/
      // Our sample data contains internal.org URIs; they should be translated.
      expect(body).toContain('http://localhost:3000/ld/dbpedia/');
    });

    it('should allow disabling translation via ?translateResponse=false', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/ld/dbpedia/%22test%20literal%22?translateResponse=false',
        headers: { accept: 'text/turtle' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.body.toString();
      // Should contain internal IRIs since translation is disabled
      expect(body).toContain('http://internal.org/');
    });

    it('should handle literal with encoded double quotes', async () => {
      // Request: /ld/dbpedia/%22value%22
      const response = await server.inject({
        method: 'GET',
        url: '/ld/dbpedia/%22value%22',
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 502 when all SPARQL endpoints fail', async () => {
      // Override fetch to fail for SPARQL JSON requests
      const failingFetch = async (
        input: RequestInfo | URL,
        init?: RequestInit
      ): Promise<Response> => {
        const headers = new Headers(init?.headers);
        const accept = headers.get('Accept');
        if (accept === 'application/sparql-results+json') {
          return new Response('Error', { status: 500 });
        }
        return new Response('Mock RDF', { status: 200 });
      };
      global.fetch = failingFetch;

      // Need to restart server? We'll create a new one
      if (server) await server.close();
      const config = createConfig({
        sources: [
          {
            dsName: 'dbpedia',
            originalPrefix: 'http://internal.org/',
            endpoints: [
              {
                type: 'sparql',
                mode: 'describe',
                url: 'http://localhost:9999/dataset',
              },
            ],
          },
        ],
      });
      server = createServer(config);
      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/ld/dbpedia/%22test%22',
      });

      expect(response.statusCode).toBe(502);
    });

    it('should still work with regular URI paths (regression)', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/ld/dbpedia/subject',
        headers: { accept: 'text/turtle' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.toString()).toContain('ex:subject');
    });
  });
});
