import { Readable } from 'stream';
import type { RdfFormat } from '../types/Resource.js';
import { EndpointError } from '../types/Errors.js';

export interface HttpClientOptions {
  fetch?: typeof fetch;
  headers?: Record<string, string>;
}

export class HttpClient {
  private baseUrl: string;
  private headers: Record<string, string>;
  private fetchFn: typeof fetch;

  constructor(baseUrl: string, options: HttpClientOptions = {}) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this.headers = options.headers ?? {};
    this.fetchFn = options.fetch ?? fetch;
  }

  async fetchRdf(resourceIri: string, format: RdfFormat): Promise<Readable> {
    try {
      const url = new URL(this.baseUrl);
      url.searchParams.set('uri', resourceIri);

      const headers: Record<string, string> = {
        Accept: format,
        ...this.headers,
      };

      const response = await this.fetchFn(url.toString(), {
        headers,
        redirect: 'follow',
      });

      if (!response.ok) {
        throw new Error(`HTTP request failed: ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body received');
      }

      return Readable.fromWeb(response.body as any);
    } catch (err) {
      if (err instanceof EndpointError) {
        throw err;
      }
      throw new EndpointError(
        `Failed to fetch resource from HTTP endpoint: ${err instanceof Error ? err.message : String(err)}`,
        undefined,
        this.baseUrl,
        err
      );
    }
  }

  get endpointUrl(): string {
    return this.baseUrl;
  }
}
