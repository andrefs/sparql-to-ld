import { Readable } from 'stream';
// Using any for now; sparql-http-client doesn't have its own types
const SparqlHttpClient: any = require('sparql-http-client');
import { RdfFormat } from '../types/Resource.js';
import { EndpointError } from '../types/Errors.js';

/**
 * Wrapper around sparql-http-client providing a simplified interface
 * for executing DESCRIBE queries and retrieving RDF data.
 */
export class SparqlClient {
  private client: any;
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
    this.client = new SparqlHttpClient({
      endpoint,
      fetch: options?.fetch,
      timeout: options?.timeout ?? 30000,
      defaultHeaders: options?.headers,
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
      return await this.client.describe(resourceIri, {
        accept: format,
      });
    } catch (err) {
      throw new EndpointError(
        `Failed to describe resource from SPARQL endpoint: ${err instanceof Error ? err.message : String(err)}`,
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
