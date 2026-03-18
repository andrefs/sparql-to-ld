import fastify, { FastifyInstance } from 'fastify';
import { ServerConfig } from '../types/Config.js';
import { SparqlClient } from '../sparql/client.js';
import { RDF_FORMATS } from '../rdf/parser-serializer.js';
import { RdfFormat, NegotiatedFormat } from '../types/Resource.js';
import { InvalidIriError, UnsupportedFormatError, EndpointError } from '../types/Errors.js';

export function createServer(config: ServerConfig): FastifyInstance {
  const server = fastify();

  // CORS
  if (config.cors) {
    const cors = require('@fastify/cors');
    server.register(cors, {
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
  server.get('/resource/:iri(*)', async (req: any, reply: any) => {
    try {
      const encodedIri = req.params.iri;
      const iri = decodeURIComponent(encodedIri);

      if (!iri || iri.trim() === '') {
        throw new InvalidIriError('Resource IRI is required');
      }

      const acceptHeader = req.headers.accept as string | undefined;
      const formatQuery = req.query.format as string | undefined;
      const negotiated = negotiateFormat(acceptHeader, formatQuery);

      const sparqlConfig = config.sparql;
      const client = new SparqlClient(sparqlConfig.endpoint, {
        timeout: sparqlConfig.timeout,
        headers: sparqlConfig.headers,
      });

      const rdfStream = await client.describe(iri, negotiated.format);

      reply.header('Content-Type', negotiated.format).send(rdfStream);
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
      reply.code(400);
      return { error: err.message, details: { iri: (err as any).iri } };
    } else if (err instanceof UnsupportedFormatError) {
      reply.code(406);
      return { error: err.message, format: (err as any).format };
    } else if (err instanceof EndpointError) {
      reply.code(502);
      return { error: err.message, endpoint };
    } else {
      server.log.error(err, 'Error handling request');
      reply.code(500);
      return { error: 'Internal server error' };
    }
  }

  return server;
}
