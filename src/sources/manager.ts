import { Readable } from 'stream';
import type {
  Source,
  Endpoint,
  SparqlEndpoint,
  HttpEndpoint,
  RdfFormat,
  Dataset,
} from '../types/Resource.js';
import { SparqlClient } from '../sparql/client.js';
import { HttpClient } from '../http/client.js';
import { RdfParser } from '../rdf/parser-serializer.js';
import { buildConstructQuery } from '../sparql/query-builder.js';

export interface SourceManagerOptions {
  SparqlClientClass?: typeof SparqlClient;
  HttpClientClass?: typeof HttpClient;
  fetch?: typeof fetch;
  verbose?: boolean;
}

export class SourceManager {
  private sources: Source[];
  private sourceMap: Map<string, Source>;
  private SparqlClientClass: typeof SparqlClient;
  private HttpClientClass: typeof HttpClient;
  private fetchFn: typeof fetch;
  private verbose: boolean;
  private logger?: { info: (msg: string) => void; error: (msg: string) => void };

  constructor(
    sources: Source[],
    options: SourceManagerOptions = {},
    logger?: { info: (msg: string) => void; error: (msg: string) => void }
  ) {
    this.sources = sources;
    this.sourceMap = new Map(sources.map((s) => [s.dsName, s]));
    this.SparqlClientClass = options.SparqlClientClass ?? SparqlClient;
    this.HttpClientClass = options.HttpClientClass ?? HttpClient;
    this.fetchFn = options.fetch ?? fetch;
    this.verbose = options.verbose ?? false;
    this.logger = logger;
  }

  getSource(dsName: string): Source | undefined {
    return this.sourceMap.get(dsName);
  }

  getAllSources(): Source[] {
    return this.sources;
  }

  async fetchResource(
    dsName: string,
    internalIri: string,
    format: RdfFormat
  ): Promise<{ triples: Dataset; prefixes: Record<string, string>; base?: string }> {
    const source = this.getSource(dsName);
    if (!source) {
      throw new Error(`Unknown dataset: ${dsName}`);
    }

    let allTriples: Dataset = [];
    let mergedPrefixes: Record<string, string> = {};
    let mergedBase: string | undefined;

    const errors: Error[] = [];

    for (const endpoint of source.endpoints) {
      try {
        const result = await this.executeEndpoint(endpoint, internalIri, format);
        allTriples = [...allTriples, ...result.triples];

        for (const [prefix, iri] of Object.entries(result.prefixes)) {
          if (!mergedPrefixes[prefix]) {
            mergedPrefixes[prefix] = iri;
          }
        }

        if (result.base && !mergedBase) {
          mergedBase = result.base;
        }

        this.logger?.info(
          `[${dsName}] Successfully fetched from ${endpoint.type} endpoint: ${endpoint.url}`
        );
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        errors.push(error);
        this.logger?.error(
          `[${dsName}] Failed to fetch from ${endpoint.type} endpoint ${endpoint.url}: ${error.message}`
        );
      }
    }

    if (allTriples.length === 0 && errors.length > 0) {
      const errorMessages = errors.map((e) => e.message).join('; ');
      throw new AggregateError(
        errors,
        `All endpoints failed for ${dsName}:${internalIri}: ${errorMessages}`
      );
    }

    if (errors.length > 0) {
      this.logger?.info(
        `[${dsName}] Partial results: ${allTriples.length} triples with ${errors.length} endpoint failures`
      );
    }

    return {
      triples: allTriples,
      prefixes: mergedPrefixes,
      base: mergedBase,
    };
  }

  private async executeEndpoint(
    endpoint: Endpoint,
    resourceIri: string,
    format: RdfFormat
  ): Promise<{ triples: Dataset; prefixes: Record<string, string>; base?: string }> {
    if (endpoint.type === 'sparql') {
      return this.executeSparqlEndpoint(endpoint, resourceIri, format);
    } else {
      return this.executeHttpEndpoint(endpoint, resourceIri, format);
    }
  }

  private async executeSparqlEndpoint(
    endpoint: SparqlEndpoint,
    resourceIri: string,
    format: RdfFormat
  ): Promise<{ triples: Dataset; prefixes: Record<string, string>; base?: string }> {
    const client = new this.SparqlClientClass(endpoint.url, {
      fetch: this.fetchFn,
      headers: endpoint.headers,
    });

    const mode = endpoint.mode ?? 'describe';
    const query = buildConstructQuery(resourceIri, mode);

    if (this.verbose) {
      this.logger?.info(`[SPARQL] ${query}`);
    }

    const rdfStream = await client.construct(resourceIri, mode, format);
    const rdfString = await this.streamToString(rdfStream);

    return new RdfParser().parseWithMetadata(rdfString, format);
  }

  private async executeHttpEndpoint(
    endpoint: HttpEndpoint,
    resourceIri: string,
    format: RdfFormat
  ): Promise<{ triples: Dataset; prefixes: Record<string, string>; base?: string }> {
    const client = new this.HttpClientClass(endpoint.url, {
      fetch: this.fetchFn,
      headers: endpoint.headers,
    });

    if (this.verbose) {
      this.logger?.info(
        `[HTTP] GET ${endpoint.url}?uri=${encodeURIComponent(resourceIri)} (format: ${format})`
      );
    }
    const rdfStream = await client.fetchRdf(resourceIri, format);
    const rdfString = await this.streamToString(rdfStream);

    return new RdfParser().parseWithMetadata(rdfString, format);
  }

  private streamToString(stream: Readable): Promise<string> {
    return new Promise((resolve, reject) => {
      let data = '';
      stream.on('data', (chunk: Buffer | string) => {
        data += chunk;
      });
      stream.on('end', () => resolve(data));
      stream.on('error', reject);
    });
  }
}
