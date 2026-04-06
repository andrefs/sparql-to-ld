import { describe, it, expect, vi } from 'vitest';
import { SparqlClient } from '../../../src/sparql/client.js';
import { Readable } from 'stream';

function createWebStream(content: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(content));
      controller.close();
    },
  });
}

function createFetchResponse(
  body: ReadableStream<Uint8Array> | null,
  status = 200,
  statusText = 'OK'
) {
  return {
    ok: status === 200,
    status,
    statusText,
    body,
    headers: new Headers({
      'Content-Type': 'application/sparql-results+json',
    }),
  };
}

describe('SparqlClient.literal()', () => {
  let client: SparqlClient;

  it('should call fetch with SELECT query and return readable stream', async () => {
    const mockJson = { head: { vars: ['s', 'p', 'o'] }, results: { bindings: [] } };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(createFetchResponse(createWebStream(JSON.stringify(mockJson))));
    client = new SparqlClient('http://localhost:9999/dataset', { fetch: fetchMock });

    const result = await client.literal('"test"', 'text/turtle');

    expect(result).toBeInstanceOf(Readable);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('query=');
    expect(options?.headers).toBeInstanceOf(Headers);
    expect(options?.headers).toHaveProperty('get', expect.any(Function));
    expect((options?.headers as Headers).get('Accept')).toBe('application/sparql-results+json');
  });

  it('should pass literal to query builder', async () => {
    const mockJson = { head: { vars: ['s', 'p', 'o'] }, results: { bindings: [] } };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(createFetchResponse(createWebStream(JSON.stringify(mockJson))));
    client = new SparqlClient('http://localhost:9999/dataset', { fetch: fetchMock });

    await client.literal('"test"@en', 'text/turtle');

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain(encodeURIComponent('SELECT ?s ?p ?o WHERE { ?s ?p "test"@en }'));
  });

  it('should pass literal with datatype to query builder', async () => {
    const mockJson = { head: { vars: ['s', 'p', 'o'] }, results: { bindings: [] } };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(createFetchResponse(createWebStream(JSON.stringify(mockJson))));
    client = new SparqlClient('http://localhost:9999/dataset', { fetch: fetchMock });

    await client.literal('"test"^^<http://example.org/type>', 'text/turtle');

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain(
      encodeURIComponent('SELECT ?s ?p ?o WHERE { ?s ?p "test"^^<http://example.org/type> }')
    );
  });

  it('should throw on non-ok response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(createFetchResponse(null, 500, 'Internal Server Error'));
    client = new SparqlClient('http://localhost:9999/dataset', { fetch: fetchMock });

    await expect(client.literal('"test"', 'text/turtle')).rejects.toThrow(
      'SPARQL request failed: 500 Internal Server Error'
    );
  });

  it('should throw on missing response body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createFetchResponse(null, 200, 'OK'));
    client = new SparqlClient('http://localhost:9999/dataset', { fetch: fetchMock });

    await expect(client.literal('"test"', 'text/turtle')).rejects.toThrow(
      'No response body received'
    );
  });

  it('should throw on fetch network error', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'));
    client = new SparqlClient('http://localhost:9999/dataset', { fetch: fetchMock });

    await expect(client.literal('"test"', 'text/turtle')).rejects.toThrow(
      'Failed to fetch literal from SPARQL endpoint: Network error'
    );
  });

  it('should wrap errors in EndpointError with endpoint context', async () => {
    const { EndpointError } = await import('../../../src/types/Errors.js');

    const fetchMock = vi.fn().mockRejectedValue(new Error('Connection timeout'));
    client = new SparqlClient('http://localhost:9999/dataset', { fetch: fetchMock });

    try {
      await client.literal('"test"', 'text/turtle');
      throw new Error('Expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EndpointError);
      expect((err as any).endpoint).toBe('http://localhost:9999/dataset');
      expect(err.message).toContain('Failed to fetch literal from SPARQL endpoint');
    }
  });
});
