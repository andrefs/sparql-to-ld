import fastify, { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import { ServerConfig } from '../types/Config.js';
import { SourceManager } from '../sources/manager.js';
import { RDF_FORMATS, RdfSerializer } from '../rdf/parser-serializer.js';
import { UriTranslator } from '../rdf/uri-translator.js';
import { RdfFormat, NegotiatedFormat, Source } from '../types/Resource.js';
import { InvalidIriError, UnsupportedFormatError } from '../types/Errors.js';

export interface ServerDeps {
  SourceManager?: typeof SourceManager;
}

export function createServer(config: ServerConfig, deps: ServerDeps = {}): FastifyInstance {
  const SourceManagerClass = deps.SourceManager ?? SourceManager;
  const server = fastify();

  const serverHost = config.server?.host ?? '0.0.0.0';
  const serverPort = config.server?.port ?? 3000;
  const baseUrl = `http://${serverHost === '0.0.0.0' ? 'localhost' : serverHost}:${serverPort}`;

  const sources = (config.sources ?? []) as Source[];

  if (sources.length > 0) {
    server.log.info('Configured sources:');
    for (const source of sources) {
      const externalPrefix = `${baseUrl}/ld/${source.dsName}/`;
      const endpoints = source.endpoints
        .map((e) => `${e.type}:${e.type === 'sparql' ? (e.mode ?? 'describe') : 'direct'}`)
        .join(', ');
      server.log.info(
        `  ${source.dsName}: ${externalPrefix} -> ${source.originalPrefix} [${endpoints}]`
      );
    }
  } else {
    server.log.warn('No sources configured');
  }

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

  const sourceManager = new SourceManagerClass(
    sources,
    {
      verbose: config.verbose ?? false,
    },
    {
      info: (msg: string) => server.log.info(msg),
      error: (msg: string) => server.log.error(msg),
    }
  );

  const translator = sources.length > 0 ? new UriTranslator(sources, baseUrl) : null;

  server.get('/health', async (_req: any, _reply: any) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      sources: sources.map((s) => ({
        dsName: s.dsName,
        originalPrefix: s.originalPrefix,
        externalPrefix: `${baseUrl}/ld/${s.dsName}/`,
        endpoints: s.endpoints,
      })),
    };
  });

  server.get('/ld/:dsName/*', async (req: any, reply: any) => {
    try {
      const dsName = req.params.dsName;
      const pathSuffix = req.params['*'];

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

      const translateResponse =
        translateResponseQuery !== undefined
          ? translateResponseQuery !== 'false'
          : (config.translateResponse ?? true);

      const source = sourceManager.getSource(dsName);
      if (!source) {
        reply.code(404).send({ error: `Unknown dataset: ${dsName}` });
        return;
      }

      const internalIri = translator ? translator.translateRequestUri(externalIri) : externalIri;

      server.log.info(`[${dsName}] Request for ${externalIri} -> ${internalIri}`);

      try {
        const { triples, prefixes, base } = await sourceManager.fetchResource(
          dsName,
          internalIri,
          negotiated.format
        );

        if (!translateResponse || !translator) {
          const serializer = new RdfSerializer();
          const result = serializer.serialize(triples, negotiated.format, { prefixes, base });
          return reply.header('Content-Type', negotiated.format).send(result);
        }

        const translatedDataset = translator.translateDataset(triples);
        const translatedPrefixes = translator.translatePrefixes(prefixes);
        const translatedBase = base ? translator.translateBase(base) : undefined;

        const serializer = new RdfSerializer();
        const result = serializer.serialize(translatedDataset, negotiated.format, {
          prefixes: translatedPrefixes,
          base: translatedBase,
        });

        reply.header('Content-Type', negotiated.format).send(result);
      } catch (err) {
        server.log.error({ err }, 'Request failed: ' + (err as Error).message);
        handleError(err, reply, server);
      }
    } catch (err) {
      handleError(err, reply, server);
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

  function handleError(err: any, reply: any, server: any) {
    if (err instanceof InvalidIriError) {
      reply.code(400).send({ error: err.message, details: { iri: (err as any).iri } });
    } else if (err instanceof UnsupportedFormatError) {
      reply.code(406).send({ error: err.message, format: (err as any).format });
    } else if (err.name === 'AggregateError' || err.name === 'EndpointError') {
      reply.code(502).send({ error: err.message });
    } else {
      server.log.error(err, 'Error handling request');
      reply.code(500).send({ error: 'Internal server error' });
    }
  }

  return server;
}
