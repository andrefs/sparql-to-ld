import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SourceManager } from '../../../src/sources/manager.js';
import { parseSparqlJsonResults } from '../../../src/sources/manager.js';
import { Readable } from 'stream';

// Helper to create a Node Readable stream from string
function createMockStream(content: string): Readable {
  const stream = new Readable();
  stream.push(content);
  stream.push(null);
  return stream;
}

// Mock class for SparqlClient
function createMockSparqlClientClass(responseStream: Readable) {
  return class MockSparqlClient {
    literal = vi.fn().mockResolvedValue(responseStream);
  };
}

describe('parseSparqlJsonResults', () => {
  it('should parse SELECT results with URIs', () => {
    const json = `{
      "head": { "vars": ["s", "p", "o"] },
      "results": {
        "bindings": [
          {
            "s": { "type": "uri", "value": "http://example.org/subject" },
            "p": { "type": "uri", "value": "http://example.org/predicate" },
            "o": { "type": "uri", "value": "http://example.org/object" }
          }
        ]
      }
    }`;
    const result = parseSparqlJsonResults(json);
    expect(result).toEqual([
      {
        subject: 'http://example.org/subject',
        predicate: 'http://example.org/predicate',
        object: 'http://example.org/object',
      },
    ]);
  });

  it('should handle blank nodes', () => {
    const json = `{
      "head": { "vars": ["s", "p", "o"] },
      "results": {
        "bindings": [
          {
            "s": { "type": "bnode", "value": "b0" },
            "p": { "type": "uri", "value": "http://example.org/predicate" },
            "o": { "type": "bnode", "value": "b1" }
          }
        ]
      }
    }`;
    const result = parseSparqlJsonResults(json);
    expect(result).toEqual([
      {
        subject: 'b0',
        predicate: 'http://example.org/predicate',
        object: 'b1',
      },
    ]);
  });

  it('should parse literals without language or datatype', () => {
    const json = `{
      "head": { "vars": ["s", "p", "o"] },
      "results": {
        "bindings": [
          {
            "s": { "type": "uri", "value": "http://example.org/subject" },
            "p": { "type": "uri", "value": "http://example.org/predicate" },
            "o": { "type": "literal", "value": "plain literal" }
          }
        ]
      }
    }`;
    const result = parseSparqlJsonResults(json);
    expect(result).toEqual([
      {
        subject: 'http://example.org/subject',
        predicate: 'http://example.org/predicate',
        object: { value: 'plain literal' },
      },
    ]);
  });

  it('should parse literals with language tag', () => {
    const json = `{
      "head": { "vars": ["s", "p", "o"] },
      "results": {
        "bindings": [
          {
            "s": { "type": "uri", "value": "http://example.org/subject" },
            "p": { "type": "uri", "value": "http://example.org/predicate" },
            "o": { "type": "literal", "value": "hello", "xml:lang": "en" }
          }
        ]
      }
    }`;
    const result = parseSparqlJsonResults(json);
    expect(result).toEqual([
      {
        subject: 'http://example.org/subject',
        predicate: 'http://example.org/predicate',
        object: { value: 'hello', language: 'en' },
      },
    ]);
  });

  it('should parse literals with datatype', () => {
    const json = `{
      "head": { "vars": ["s", "p", "o"] },
      "results": {
        "bindings": [
          {
            "s": { "type": "uri", "value": "http://example.org/subject" },
            "p": { "type": "uri", "value": "http://example.org/predicate" },
            "o": { "type": "literal", "value": "42", "datatype": "http://www.w3.org/2001/XMLSchema#integer" }
          }
        ]
      }
    }`;
    const result = parseSparqlJsonResults(json);
    expect(result).toEqual([
      {
        subject: 'http://example.org/subject',
        predicate: 'http://example.org/predicate',
        object: { value: '42', datatype: 'http://www.w3.org/2001/XMLSchema#integer' },
      },
    ]);
  });

  it('should return empty array for empty results', () => {
    const json = `{
      "head": { "vars": ["s", "p", "o"] },
      "results": { "bindings": [] }
    }`;
    const result = parseSparqlJsonResults(json);
    expect(result).toEqual([]);
  });

  it('should return empty array for malformed JSON', () => {
    const json = `invalid json`;
    const result = parseSparqlJsonResults(json);
    expect(result).toEqual([]);
  });

  it('should return empty array for missing bindings', () => {
    const json = `{
      "head": { "vars": ["s", "p", "o"] }
    }`;
    const result = parseSparqlJsonResults(json);
    expect(result).toEqual([]);
  });

  it('should handle mixed binding types in same result', () => {
    const json = `{
      "head": { "vars": ["s", "p", "o"] },
      "results": {
        "bindings": [
          {
            "s": { "type": "uri", "value": "http://example.org/subject1" },
            "p": { "type": "uri", "value": "http://example.org/predicate1" },
            "o": { "type": "literal", "value": "literal value" }
          },
          {
            "s": { "type": "uri", "value": "http://example.org/subject2" },
            "p": { "type": "uri", "value": "http://example.org/predicate2" },
            "o": { "type": "bnode", "value": "b0" }
          }
        ]
      }
    }`;
    const result = parseSparqlJsonResults(json);
    expect(result).toEqual([
      {
        subject: 'http://example.org/subject1',
        predicate: 'http://example.org/predicate1',
        object: { value: 'literal value' },
      },
      {
        subject: 'http://example.org/subject2',
        predicate: 'http://example.org/predicate2',
        object: 'b0',
      },
    ]);
  });
});

describe('SourceManager.fetchByLiteral', () => {
  let source: any;
  let logger: any;

  beforeEach(() => {
    logger = { info: vi.fn(), error: vi.fn() };
    source = {
      dsName: 'test',
      originalPrefix: 'http://internal.org/',
      endpoints: [
        {
          type: 'sparql',
          mode: 'describe',
          url: 'http://localhost:9999/dataset',
        } as any,
      ],
    };
  });

  it('should fetch triples for a literal from single endpoint', async () => {
    const mockJson = {
      head: { vars: ['s', 'p', 'o'] },
      results: {
        bindings: [
          {
            s: { type: 'uri', value: 'http://internal.org/subject' },
            p: { type: 'uri', value: 'http://internal.org/predicate' },
            o: { type: 'literal', value: 'test' },
          },
        ],
      },
    };
    const responseStream = createMockStream(JSON.stringify(mockJson));
    const MockSparqlClientClass = createMockSparqlClientClass(responseStream);

    const manager = new SourceManager(
      [source],
      {
        SparqlClientClass: MockSparqlClientClass,
      } as any,
      logger
    );

    const result = await manager.fetchByLiteral('test', '"test"', 'text/turtle');

    expect(result.triples).toHaveLength(1);
    expect(result.triples[0].object).toEqual({ value: 'test' });
    expect(result.prefixes).toEqual({});
    expect(result.base).toBeUndefined();
  });

  it('should aggregate results from multiple endpoints', async () => {
    const sourceWithTwo: any = {
      dsName: 'test',
      originalPrefix: 'http://internal.org/',
      endpoints: [
        { type: 'sparql', mode: 'describe', url: 'http://localhost:9999/dataset1' } as any,
        { type: 'sparql', mode: 'describe', url: 'http://localhost:9999/dataset2' } as any,
      ],
    };

    const mockJson1 = {
      head: { vars: ['s', 'p', 'o'] },
      results: {
        bindings: [
          {
            s: { type: 'uri', value: 'http://internal.org/s1' },
            p: { type: 'uri', value: 'http://internal.org/p1' },
            o: { type: 'literal', value: 'test' },
          },
        ],
      },
    };
    const mockJson2 = {
      head: { vars: ['s', 'p', 'o'] },
      results: {
        bindings: [
          {
            s: { type: 'uri', value: 'http://internal.org/s2' },
            p: { type: 'uri', value: 'http://internal.org/p2' },
            o: { type: 'literal', value: 'test' },
          },
        ],
      },
    };

    const stream1 = createMockStream(JSON.stringify(mockJson1));
    const stream2 = createMockStream(JSON.stringify(mockJson2));

    // We need separate instances for each endpoint call. Since fetchByLiteral loops endpoints and creates a new client per endpoint, we need the MockSparqlClientClass to produce instances that give different streams. We'll define a class that captures the stream via closure.
    let callCount = 0;
    const MockSparqlClientClass = class {
      literal = vi.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1 ? stream1 : stream2;
      });
    };

    const manager = new SourceManager(
      [sourceWithTwo],
      {
        SparqlClientClass: MockSparqlClientClass,
      } as any,
      logger
    );

    const result = await manager.fetchByLiteral('test', '"test"', 'text/turtle');

    expect(result.triples).toHaveLength(2);
    // Ensure we got triples from both.
    expect(result.triples[0].object).toEqual({ value: 'test' });
    expect(result.triples[1].object).toEqual({ value: 'test' });
  });

  it('should throw AggregateError when all endpoints fail', async () => {
    const sourceWithOne: any = {
      dsName: 'test',
      originalPrefix: 'http://internal.org/',
      endpoints: [
        { type: 'sparql', mode: 'describe', url: 'http://localhost:9999/dataset' } as any,
      ],
    };

    const MockSparqlClientClass = class {
      literal = vi.fn().mockRejectedValue(new Error('SPARQL timeout'));
    };

    const manager = new SourceManager(
      [sourceWithOne],
      {
        SparqlClientClass: MockSparqlClientClass,
      } as any,
      logger
    );

    await expect(manager.fetchByLiteral('test', '"test"', 'text/turtle')).rejects.toThrow(
      'All endpoints failed for test:"test"'
    );
  });

  it('should return partial results when some endpoints fail', async () => {
    const sourceWithTwo: any = {
      dsName: 'test',
      originalPrefix: 'http://internal.org/',
      endpoints: [
        { type: 'sparql', mode: 'describe', url: 'http://localhost:9999/dataset1' } as any,
        { type: 'sparql', mode: 'describe', url: 'http://localhost:9999/dataset2' } as any,
      ],
    };

    const successJson = {
      head: { vars: ['s', 'p', 'o'] },
      results: {
        bindings: [
          {
            s: { type: 'uri', value: 'http://internal.org/s1' },
            p: { type: 'uri', value: 'http://internal.org/p1' },
            o: { type: 'literal', value: 'test' },
          },
        ],
      },
    };
    const successStream = createMockStream(JSON.stringify(successJson));

    let callCount = 0;
    const MockSparqlClientClass = class {
      literal = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return successStream;
        } else {
          throw new Error('Connection failed');
        }
      });
    };

    const manager = new SourceManager(
      [sourceWithTwo],
      {
        SparqlClientClass: MockSparqlClientClass,
      } as any,
      logger
    );

    const result = await manager.fetchByLiteral('test', '"test"', 'text/turtle');

    expect(result.triples).toHaveLength(1);
    // Should not throw
  });

  it('should throw error for unknown dataset', async () => {
    const manager = new SourceManager([source], {}, logger);
    await expect(manager.fetchByLiteral('unknown', '"test"', 'text/turtle')).rejects.toThrow(
      'Unknown dataset: unknown'
    );
  });

  it('should throw error for non-SPARQL endpoints', async () => {
    const sourceWithHttp: any = {
      dsName: 'test',
      originalPrefix: 'http://internal.org/',
      endpoints: [{ type: 'http', url: 'http://localhost:9999/data' } as any],
    };

    const manager = new SourceManager([sourceWithHttp], {}, logger);

    await expect(manager.fetchByLiteral('test', '"test"', 'text/turtle')).rejects.toThrow(
      'All endpoints failed for test:"test"'
    );
  });
});
