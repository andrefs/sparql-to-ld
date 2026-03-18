import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Readable } from 'stream';
import type { FastifyInstance } from 'fastify';
import { createServer, ServerDeps } from '../../src/server/server.js';
import type { ServerConfig } from '../../src/types/Config.js';
import { EndpointError } from '../../src/types/Errors.js';

// Sample RDF responses
const SAMPLE_TURTLE = `
@prefix ex: <http://internal.org/> .
@prefix dc: <http://purl.org/dc/elements/1.1/> .

ex:subject dc:publisher ex:publisher ;
    dc:title "Test Title" ;
    dc:creator ex:creator .
`;

const SAMPLE_JSONLD = `{
  "@context": {
    "ex": "http://internal.org/"
  },
  "@id": "http://internal.org/subject",
  "http://purl.org/dc/elements/1.1/publisher": { "@id": "http://internal.org/publisher" },
  "http://purl.org/dc/elements/1.1/title": "Test Title",
  "http://purl.org/dc/elements/1.1/creator": { "@id": "http://internal.org/creator" }
}`;

const SAMPLE_RDFXML = `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns:ex="http://internal.org/"
         xmlns:dc="http://purl.org/dc/elements/1.1/">
  <rdf:Description rdf:about="http://internal.org/subject">
    <dc:publisher rdf:resource="http://internal.org/publisher"/>
    <dc:title>Test Title</dc:title>
    <dc:creator rdf:resource="http://internal.org/creator"/>
  </rdf:Description>
</rdf:RDF>`;

const SAMPLE_NTRIPLES = `<http://internal.org/subject> <http://purl.org/dc/elements/1.1/publisher> <http://internal.org/publisher> .
<http://internal.org/subject> <http://purl.org/dc/elements/1.1/title> "Test Title" .
<http://internal.org/subject> <http://purl.org/dc/elements/1.1/creator> <http://internal.org/creator> .`;

function toStream(data: string): Readable {
  const stream = new Readable({
    read() {},
  });
  stream.push(data);
  stream.push(null);
  return stream;
}

// Helper to create a mock SparqlClient class that matches the expected interface
function createMockSparqlClientClass(
  response: string,
  _responseFormat: string = 'text/turtle',
  shouldFail: boolean = false
): new (
  endpoint: string,
  options?: { timeout?: number; headers?: Record<string, string> }
) => { describe: (iri: string, format: string) => Promise<Readable> } {
  return class MockSparqlClient {
    lastRequestedIri: string | null = null;
    lastRequestedFormat: string | null = null;
    constructor(
      private endpoint: string,
      private options?: { timeout?: number; headers?: Record<string, string> }
    ) {}
    async describe(resourceIri: string, format: string): Promise<Readable> {
      this.lastRequestedIri = resourceIri;
      this.lastRequestedFormat = format;
      if (shouldFail) {
        throw new EndpointError(
          'Failed to describe resource from SPARQL endpoint',
          500,
          this.endpoint
        );
      }
      if (format.includes('json') || format.includes('ld+json')) {
        return toStream(SAMPLE_JSONLD);
      }
      if (format.includes('rdf+xml') || format.includes('xml')) {
        return toStream(SAMPLE_RDFXML);
      }
      if (format.includes('n-triples') || format.includes('ntriples')) {
        return toStream(SAMPLE_NTRIPLES);
      }
      return toStream(response);
    }
  };
}

function createConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    sparql: {
      endpoint: 'http://mock-sparql:9999/dataset',
      timeout: 30000,
    },
    cors: { origin: '*' },
    port: 0,
    host: '127.0.0.1',
    ...overrides,
  };
}

describe('Server Integration', () => {
  let server: FastifyInstance;
  let baseConfig: ServerConfig;
  let MockSparqlClient: new (
    endpoint: string,
    options?: { timeout?: number; headers?: Record<string, string> }
  ) => { describe: (iri: string, format: string) => Promise<Readable> };

  beforeAll(() => {
    baseConfig = createConfig({
      uriMappings: [
        {
          dsName: 'dbpedia',
          endpoint: 'http://localhost:9999/dataset',
          internalPrefix: 'http://internal.org/',
          externalPrefix: 'http://localhost:3000/ld/dbpedia/',
        },
      ],
      translateResponse: true,
    });
    MockSparqlClient = createMockSparqlClientClass(SAMPLE_TURTLE);
  });

  afterAll(async () => {
    if (server) {
      await server.close();
    }
  });

  describe('GET /ld/:dsName/*', () => {
    it('should return RDF data without translation when no mappings configured', async () => {
      const config = createConfig({ uriMappings: undefined });
      const deps: ServerDeps = { SparqlClient: createMockSparqlClientClass(SAMPLE_TURTLE) };
      server = createServer(config, deps);
      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/ld/dbpedia/example',
        headers: { accept: 'text/turtle' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/turtle');
      expect(response.body.toString()).toContain('http://internal.org/');
    });

    it('should translate response dataset from internal to external', async () => {
      const deps: ServerDeps = { SparqlClient: MockSparqlClient };
      server = createServer(baseConfig, deps);
      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/ld/dbpedia/subject',
        headers: { accept: 'text/turtle' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.toString()).not.toContain('http://internal.org/');
    });

    it('should preserve prefixes with translated IRIs', async () => {
      const deps: ServerDeps = { SparqlClient: MockSparqlClient };
      server = createServer(baseConfig, deps);
      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/ld/dbpedia/subject',
        headers: { accept: 'text/turtle' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.toString()).toContain('@prefix ex:');
      expect(response.body.toString()).toContain('ex:subject');
    });

    it('should allow disabling translation via ?translateResponse=false', async () => {
      const deps: ServerDeps = { SparqlClient: MockSparqlClient };
      server = createServer(baseConfig, deps);
      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/ld/dbpedia/subject?translateResponse=false',
        headers: { accept: 'text/turtle' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.toString()).toContain('http://internal.org/');
      expect(response.body.toString()).not.toContain('http://external.org/');
    });

    it('should use config.translateResponse default when true', async () => {
      const config = createConfig({
        translateResponse: true,
        uriMappings: baseConfig.uriMappings,
      });
      const deps: ServerDeps = { SparqlClient: MockSparqlClient };
      server = createServer(config, deps);
      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/ld/dbpedia/subject',
        headers: { accept: 'text/turtle' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.toString()).toContain('http://localhost:3000/ld/dbpedia/');
    });

    it('should use config.translateResponse default when false', async () => {
      const config = createConfig({
        translateResponse: false,
        uriMappings: baseConfig.uriMappings,
      });
      const deps: ServerDeps = { SparqlClient: MockSparqlClient };
      server = createServer(config, deps);
      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/ld/dbpedia/subject',
        headers: { accept: 'text/turtle' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.toString()).toContain('http://internal.org/');
    });

    it('should return 400 for missing IRI', async () => {
      const deps: ServerDeps = { SparqlClient: MockSparqlClient };
      server = createServer(baseConfig, deps);
      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/ld/dbpedia/',
        headers: { accept: 'text/turtle' },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toContain('Resource IRI is required');
    });

    it('should handle SPARQL endpoint errors', async () => {
      const FailingMock = createMockSparqlClientClass('', '', true);
      const deps: ServerDeps = { SparqlClient: FailingMock };
      server = createServer(baseConfig, deps);
      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/ld/dbpedia/subject',
        headers: { accept: 'text/turtle' },
      });

      expect(response.statusCode).toBe(502);
      expect(response.json().error).toContain('Failed to describe resource from SPARQL endpoint');
    });

    describe('format negotiation', () => {
      it('should accept ?format=ttl query parameter', async () => {
        const deps: ServerDeps = { SparqlClient: MockSparqlClient };
        server = createServer(baseConfig, deps);
        await server.ready();

        const response = await server.inject({
          method: 'GET',
          url: '/ld/dbpedia/subject?format=ttl',
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toContain('text/turtle');
      });

      it('should respect Accept header for JSON-LD', async () => {
        const deps: ServerDeps = { SparqlClient: MockSparqlClient };
        server = createServer(baseConfig, deps);
        await server.ready();

        const response = await server.inject({
          method: 'GET',
          url: '/ld/dbpedia/subject?translateResponse=false',
          headers: { accept: 'application/ld+json' },
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toContain('application/ld+json');
        expect(() => JSON.parse(response.body.toString())).not.toThrow();
      });

      it('should default to Turtle when no format specified', async () => {
        const deps: ServerDeps = { SparqlClient: MockSparqlClient };
        server = createServer(baseConfig, deps);
        await server.ready();

        const response = await server.inject({
          method: 'GET',
          url: '/ld/dbpedia/subject',
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toContain('text/turtle');
      });

      it('should accept n-triples format', async () => {
        const deps: ServerDeps = { SparqlClient: MockSparqlClient };
        server = createServer(baseConfig, deps);
        await server.ready();

        const response = await server.inject({
          method: 'GET',
          url: '/ld/dbpedia/subject?format=nt',
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toContain('application/n-triples');
      });
    });

    describe('multiple URI mappings', () => {
      it('should apply multiple mappings correctly', async () => {
        const config = createConfig({
          uriMappings: [
            {
              dsName: 'test1',
              endpoint: 'http://localhost:9999/test1',
              internalPrefix: 'http://internal.org/',
              externalPrefix: 'http://external1.org/',
            },
            {
              dsName: 'test2',
              endpoint: 'http://localhost:9999/test2',
              internalPrefix: 'http://internal.org/',
              externalPrefix: 'http://external2.org/',
            },
          ],
        });
        const deps: ServerDeps = { SparqlClient: MockSparqlClient };
        server = createServer(config, deps);
        await server.ready();

        const response = await server.inject({
          method: 'GET',
          url: '/ld/dbpedia/subject',
          headers: { accept: 'text/turtle' },
        });

        expect(response.statusCode).toBe(200);
        expect(response.body.toString()).not.toContain('http://internal.org/');
      });

      it('should choose longest prefix match', async () => {
        const config = createConfig({
          uriMappings: [
            {
              dsName: 'other',
              endpoint: 'http://localhost:9999/other',
              internalPrefix: 'http://internal.org/',
              externalPrefix: 'http://other.org/',
            },
            {
              dsName: 'ext',
              endpoint: 'http://localhost:9999/ext',
              internalPrefix: 'http://internal.org/',
              externalPrefix: 'http://external.org/',
            },
          ],
        });
        const deps: ServerDeps = { SparqlClient: MockSparqlClient };
        server = createServer(config, deps);
        await server.ready();

        const response = await server.inject({
          method: 'GET',
          url: '/ld/dbpedia/subject',
          headers: { accept: 'text/turtle' },
        });

        expect(response.statusCode).toBe(200);
        expect(response.body.toString()).not.toContain('http://internal.org/');
      });
    });

    describe('CORS', () => {
      it('should include CORS headers when configured', async () => {
        const config = createConfig({ cors: { origin: '*' } });
        const deps: ServerDeps = { SparqlClient: MockSparqlClient };
        server = createServer(config, deps);
        await server.ready();

        const response = await server.inject({
          method: 'GET',
          url: '/ld/dbpedia/subject',
          headers: { accept: 'text/turtle' },
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers['access-control-allow-origin']).toBe('*');
      });
    });

    describe('health check', () => {
      it('should return health status', async () => {
        const deps: ServerDeps = { SparqlClient: MockSparqlClient };
        server = createServer(baseConfig, deps);
        await server.ready();

        const response = await server.inject({
          method: 'GET',
          url: '/health',
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({
          status: 'ok',
          timestamp: expect.any(String),
        });
      });
    });

    describe('404 handling', () => {
      it('should return 404 for unknown routes', async () => {
        const deps: ServerDeps = { SparqlClient: MockSparqlClient };
        server = createServer(baseConfig, deps);
        await server.ready();

        const response = await server.inject({
          method: 'GET',
          url: '/unknown',
        });

        expect(response.statusCode).toBe(404);
        expect(response.json()).toEqual({ error: 'Not found' });
      });
    });
  });
});
