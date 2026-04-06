import { Readable } from 'stream';
import type {
  Source,
  Endpoint,
  SparqlEndpoint,
  HttpEndpoint,
  RdfFormat,
  Dataset,
  Literal,
} from '../types/Resource.js';
import { SparqlClient } from '../sparql/client.js';
import { HttpClient } from '../http/client.js';
import { RdfParser } from '../rdf/parser-serializer.js';
import { buildConstructQuery } from '../sparql/query-builder.js';
import { deduplicateBlankNodes } from '../rdf/blank-node-deduplicator.js';

interface SparqlBinding {
  type: string;
  value: string;
  'xml:lang'?: string;
  datatype?: string;
}

interface SparqlResult {
  s: SparqlBinding;
  p: SparqlBinding;
  o: SparqlBinding;
}

export function parseSparqlJsonResults(jsonString: string): Dataset {
  const results: Dataset = [];

  try {
    const data = JSON.parse(jsonString);
    const bindings = data.results?.bindings as SparqlResult[] | undefined;

    if (!bindings) {
      return results;
    }

    for (const binding of bindings) {
      const subject = binding.s.type === 'bnode' ? binding.s.value : binding.s.value;
      const predicate = binding.p.type === 'bnode' ? binding.p.value : binding.p.value;

      let object: string | Literal;
      if (binding.o.type === 'bnode') {
        object = binding.o.value;
      } else if (binding.o.type === 'literal') {
        const lit: Literal = { value: binding.o.value };
        if (binding.o['xml:lang']) {
          lit.language = binding.o['xml:lang'];
        } else if (binding.o.datatype) {
          lit.datatype = binding.o.datatype;
        }
        object = lit;
      } else {
        object = binding.o.value;
      }

      results.push({
        subject,
        predicate,
        object,
      });
    }
  } catch {
    // Return empty results on parse error
  }

  return results;
}

export interface SourceManagerOptions {
  SparqlClientClass?: typeof SparqlClient;
  HttpClientClass?: typeof HttpClient;
  fetch?: typeof fetch;
  verbose?: boolean;
  blankDedup?: boolean;
}

export class SourceManager {
  private sources: Source[];
  private sourceMap: Map<string, Source>;
  private SparqlClientClass: typeof SparqlClient;
  private HttpClientClass: typeof HttpClient;
  private fetchFn: typeof fetch;
  private verbose: boolean;
  private blankDedup: boolean;
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
    this.blankDedup = options.blankDedup ?? true;
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

  async fetchByLiteral(
    dsName: string,
    literal: string,
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
        const result = await this.executeLiteralEndpoint(endpoint, literal, format);
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
          `[${dsName}] Successfully fetched literal from ${endpoint.type} endpoint: ${endpoint.url}`
        );
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        errors.push(error);
        this.logger?.error(
          `[${dsName}] Failed to fetch literal from ${endpoint.type} endpoint ${endpoint.url}: ${error.message}`
        );
      }
    }

    if (allTriples.length === 0 && errors.length > 0) {
      throw new AggregateError(errors, `All endpoints failed for ${dsName}:${literal}`);
    }

    if (errors.length > 0 && allTriples.length > 0) {
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

  private async executeLiteralEndpoint(
    endpoint: Endpoint,
    literal: string,
    format: RdfFormat
  ): Promise<{ triples: Dataset; prefixes: Record<string, string>; base?: string }> {
    if (endpoint.type !== 'sparql') {
      throw new Error('Literal queries are only supported for SPARQL endpoints');
    }

    const client = new this.SparqlClientClass(endpoint.url, {
      fetch: this.fetchFn,
      headers: endpoint.headers,
    });

    if (this.verbose) {
      this.logger?.info(`[SPARQL] Literal query: ${literal}`);
    }

    const jsonStream = await client.literal(literal, format);
    const jsonString = await this.streamToString(jsonStream);

    const triples = parseSparqlJsonResults(jsonString);

    return { triples, prefixes: {}, base: undefined };
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

    const result = new RdfParser().parseWithMetadata(rdfString, format);

    if (this.blankDedup) {
      result.triples = deduplicateBlankNodes(result.triples);
    }

    return result;
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

    const result = new RdfParser().parseWithMetadata(rdfString, format);

    if (this.blankDedup) {
      result.triples = deduplicateBlankNodes(result.triples);
    }

    return result;
  }

  private streamToString(stream: Readable): Promise<string> {
    return new Promise((resolve, reject) => {
      let data = '';
      stream.on('data', (chunk: Buffer | string | Uint8Array) => {
        if (Buffer.isBuffer(chunk)) {
          data += chunk.toString('utf8');
        } else if (chunk instanceof Uint8Array) {
          data += Buffer.from(chunk).toString('utf8');
        } else {
          data += chunk;
        }
      });
      stream.on('end', () => resolve(data));
      stream.on('error', reject);
    });
  }
}
