import fastify, { FastifyInstance } from 'fastify';
import { Readable } from 'stream';
import fastifyCors from '@fastify/cors';
import { ServerConfig } from '../types/Config.js';
import { SparqlClient } from '../sparql/client.js';
import { RDF_FORMATS, RdfParser, RdfSerializer } from '../rdf/parser-serializer.js';
import { UriTranslator } from '../rdf/uri-translator.js';
import { RdfFormat, NegotiatedFormat } from '../types/Resource.js';
import { InvalidIriError, UnsupportedFormatError, EndpointError } from '../types/Errors.js';

function streamToString(stream: Readable): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    stream.on('data', (chunk: Buffer | string) => {
      data += chunk;
    });
    stream.on('end', () => resolve(data));
    stream.on('error', reject);
  });
}

interface SparqlClientLike {
  describe(resourceIri: string, format: string): Promise<Readable>;
}

export interface ServerDeps {
  SparqlClient?: new (
    endpoint: string,
    options?: { timeout?: number; headers?: Record<string, string> }
  ) => SparqlClientLike;
}

export function createServer(config: ServerConfig, deps: ServerDeps = {}): FastifyInstance {
  const SparqlClientClass = deps.SparqlClient ?? SparqlClient;
  const server = fastify();

  // CORS
  if (config.cors) {
    server.register(fastifyCors, {
      origin: config.cors.origin ?? '*',
      credentials: config.cors.credentials,
      methods: config.cors.methods ?? ['GET'],
      allowedHeaders: config.cors.allowedHeaders ?? ['Content-Type', 'Authorization'],
      exposedHeaders: config.cors.exposedHeaders ?? ['Content-Type', 'Content-Disposition'],
      maxAge: config.cors.maxAge ?? 86400,
    });
  }

  // Health check
  server.get('/health', async (_req: any, _reply: any) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Resource endpoint
  server.get('/ld/:dsName/*', async (req: any, reply: any) => {
    try {
      const dsName = req.params.dsName;
      const pathSuffix = req.params['*'];

      // Reconstruct full external IRI from request
      const protocol = req.headers['x-forwarded-proto'] ?? 'http';
      const host = req.headers.host ?? 'localhost:3000';
      const externalIri = `${protocol}://${host}/ld/${dsName}/${pathSuffix}`;

      if (!pathSuffix || pathSuffix.trim() === '') {
        throw new InvalidIriError('Resource IRI is required');
      }

      const acceptHeader = req.headers.accept as string | undefined;
      const formatQuery = req.query.format as string | undefined;
      const translateResponseQuery = req.query.translateResponse as string | undefined;
      const negotiated = negotiateFormat(acceptHeader, formatQuery);

      // Determine if response translation is enabled (config default: true)
      const translateResponse =
        translateResponseQuery !== undefined
          ? translateResponseQuery !== 'false'
          : (config.translateResponse ?? true);

      // Create URI translator if mappings are configured
      const translator =
        config.uriMappings && config.uriMappings.length > 0
          ? new UriTranslator(config.uriMappings)
          : null;

      // Translate request IRI if translator is available
      const internalIri = translator ? translator.translateRequestUri(externalIri) : externalIri;

      // Find matching mapping for logging/endpoint selection
      const mapping = translator?.findMappingForIri(externalIri);
      const endpoint = mapping?.endpoint ?? config.sparql?.endpoint ?? '';

      server.log.info(`[${dsName}] Request for ${externalIri} -> ${internalIri}`);

      const sparqlConfig = config.sparql;
      const client = new SparqlClientClass(endpoint || sparqlConfig.endpoint, {
        timeout: sparqlConfig?.timeout,
        headers: sparqlConfig?.headers,
      });

      const rdfStream = await client.describe(internalIri, negotiated.format);

      // If translation is disabled and no translator, just stream response
      if (!translateResponse || !translator) {
        return reply.header('Content-Type', negotiated.format).send(rdfStream);
      }

      // Otherwise, we need to parse, translate, and serialize
      const rdfString = await streamToString(rdfStream);
      const parser = new RdfParser();
      const parsed = parser.parseWithMetadata(rdfString, negotiated.format);

      // Translate dataset, prefixes, and base
      const translatedDataset = translator.translateDataset(parsed.triples);
      const translatedPrefixes = translator.translatePrefixes(parsed.prefixes);
      const translatedBase = parsed.base ? translator.translateBase(parsed.base) : undefined;

      // Serialize the translated result
      const serializer = new RdfSerializer();
      const result = serializer.serialize(translatedDataset, negotiated.format, {
        prefixes: translatedPrefixes,
        base: translatedBase,
      });

      reply.header('Content-Type', negotiated.format).send(result);
    } catch (err) {
      handleError(err, reply, config.sparql.endpoint, server);
    }
  });

  server.setNotFoundHandler((req, reply) => {
    reply.code(404).send({ error: 'Not found' });
  });

  server.setErrorHandler((error: any, req: any, reply: any) => {
    if (reply.statusCode >= 400) {
      return;
    }
    server.log.error(error, `Request ${req.method} ${req.url} failed`);
    reply.code(500).send({ error: 'Internal server error' });
  });

  // Helpers
  function negotiateFormat(acceptHeader?: string, formatQuery?: string): NegotiatedFormat {
    if (formatQuery) {
      return { format: queryParamToFormat(formatQuery) };
    }
    if (acceptHeader) {
      const accepts = acceptHeader.split(',').map((a) => a.trim().split(';')[0]);
      for (const accept of accepts) {
        if (accept in RDF_FORMATS) {
          return { format: accept as RdfFormat };
        }
      }
    }
    return { format: 'text/turtle' };
  }

  function queryParamToFormat(format: string): RdfFormat {
    switch (format.toLowerCase()) {
      case 'ttl':
      case 'turtle':
        return 'text/turtle';
      case 'nt':
      case 'ntriples':
        return 'application/n-triples';
      case 'jsonld':
      case 'json-ld':
        return 'application/ld+json';
      case 'rdfxml':
      case 'rdf+xml':
        return 'application/rdf+xml';
      default:
        throw new UnsupportedFormatError(`Unsupported format: ${format}`, format);
    }
  }

  function handleError(err: any, reply: any, endpoint: string, server: any) {
    if (err instanceof InvalidIriError) {
      reply.code(400).send({ error: err.message, details: { iri: (err as any).iri } });
    } else if (err instanceof UnsupportedFormatError) {
      reply.code(406).send({ error: err.message, format: (err as any).format });
    } else if (err instanceof EndpointError) {
      reply.code(502).send({ error: err.message, endpoint });
    } else {
      server.log.error(err, 'Error handling request');
      reply.code(500).send({ error: 'Internal server error' });
    }
  }

  return server;
}
