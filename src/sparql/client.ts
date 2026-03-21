import { Readable } from 'stream';
// @ts-expect-error - sparql-http-client lacks types
import StreamClient from 'sparql-http-client';
import type { RdfFormat, EndpointMode } from '../types/Resource.js';
import { EndpointError } from '../types/Errors.js';
import { describeResource, buildConstructQuery } from './query-builder.js';

/**
 * Wrapper around sparql-http-client providing a simplified interface
 * for executing DESCRIBE queries and retrieving RDF data.
 */
export class SparqlClient {
  private client: StreamClient;
  private endpoint: string;

  /**
   * Create a new SPARQL client
   * @param endpoint - SPARQL endpoint URL
   * @param options - Optional client options
   * @param options.fetch - Custom fetch implementation (for Node 18+ fetch polyfill)
   * @param options.timeout - Request timeout in milliseconds (default: 30000)
   * @param options.headers - Additional HTTP headers to send with each request
   */
  constructor(
    endpoint: string,
    options?: {
      fetch?: typeof fetch;
      timeout?: number;
      headers?: Record<string, string>;
    }
  ) {
    this.endpoint = endpoint;
    this.client = new StreamClient({
      endpointUrl: endpoint,
      fetch: options?.fetch,
      headers: options?.headers,
    });
  }

  /**
   * Describe a resource using SPARQL DESCRIBE query.
   * Returns a readable stream of RDF data in the requested format.
   *
   * @param resourceIri - The IRI of the resource to describe
   * @param format - Desired RDF format (MIME type)
   * @returns Readable stream of RDF data
   */
  async describe(resourceIri: string, format: RdfFormat): Promise<Readable> {
    try {
      const query = describeResource(resourceIri);
      const headers = new Headers({ Accept: format });
      const response = await this.client.get(query, { headers });

      if (!response.ok) {
        throw new Error(`SPARQL request failed: ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body received');
      }

      return Readable.fromWeb(response.body as any);
    } catch (err) {
      throw new EndpointError(
        `Failed to fetch resource from SPARQL endpoint: ${err instanceof Error ? err.message : String(err)}`,
        undefined,
        this.endpoint,
        err
      );
    }
  }

  /**
   * Execute a CONSTRUCT query based on the specified mode.
   * Returns a readable stream of RDF data in the requested format.
   *
   * @param resourceIri - The IRI of the resource to query
   * @param mode - The CONSTRUCT query mode (fwd-one, fwd-two, back-one, back-two, sym-one, sym-two, describe)
   * @param format - Desired RDF format (MIME type)
   * @returns Readable stream of RDF data
   */
  async construct(resourceIri: string, mode: EndpointMode, format: RdfFormat): Promise<Readable> {
    try {
      const query = buildConstructQuery(resourceIri, mode);
      const headers = new Headers({ Accept: format });
      const response = await this.client.get(query, { headers });

      if (!response.ok) {
        throw new Error(`SPARQL request failed: ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body received');
      }

      return Readable.fromWeb(response.body as any);
    } catch (err) {
      throw new EndpointError(
        `Failed to fetch resource from SPARQL endpoint: ${err instanceof Error ? err.message : String(err)}`,
        undefined,
        this.endpoint,
        err
      );
    }
  }

  /**
   * Execute an arbitrary SPARQL query.
   * Useful for custom queries (SELECT, ASK, CONSTRUCT, DESCRIBE).
   *
   * @param sparql - The SPARQL query string
   * @param format - Desired result format (for CONSTRUCT/DESCRIBE use RDF format)
   * @returns Readable stream of query results
   */
  async query(sparql: string, format: RdfFormat): Promise<Readable> {
    try {
      return await this.client.query(sparql, {
        accept: format,
      });
    } catch (err) {
      throw new EndpointError(
        `SPARQL query failed: ${err instanceof Error ? err.message : String(err)}`,
        undefined,
        this.endpoint,
        err
      );
    }
  }

  /**
   * Get the endpoint URL
   */
  get endpointUrl(): string {
    return this.endpoint;
  }
}
