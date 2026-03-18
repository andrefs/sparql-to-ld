#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { loadConfig } from '../config/loader.js';
import { createServer } from '../server/server.js';

interface CliOptions {
  config?: string;
  port?: number;
  host?: string;
  endpoint?: string;
  help?: boolean;
}

async function main() {
  const { values } = parseArgs({
    options: {
      config: {
        type: 'string',
        short: 'c',
        default: './sparql-to-ld.json',
        description: 'Path to configuration file',
      },
      port: {
        type: 'string',
        short: 'p',
        description: 'Server port (overrides config)',
      },
      host: {
        type: 'string',
        short: 'h',
        description: 'Server host (overrides config)',
      },
      endpoint: {
        type: 'string',
        short: 'e',
        description: 'SPARQL endpoint URL (overrides config)',
      },
      help: {
        type: 'boolean',
        short: '?',
        description: 'Show this help message',
      },
    },
  });

  const options = values as CliOptions;

  if (options.help) {
    console.log(`
sparql-to-ld - Serve RDF resources with URI translation

Usage: sparql-to-ld [options]

Options:
  -c, --config <path>    Path to configuration file (default: ./sparql-to-ld.json)
  -p, --port <number>    Server port (default: 3000)
  -h, --host <string>    Server host (default: 0.0.0.0)
  -e, --endpoint <url>   SPARQL endpoint URL
  -?, --help             Show this help message

Configuration can also be provided via environment variables:
  SPARQL_TO_LD_PORT, SPARQL_TO_LD_HOST, SPARQL_TO_LD_SPARQL_ENDPOINT

Example config file (sparql-to-ld.json):
{
  "sparql": {
    "endpoint": "http://localhost:3030/dataset",
    "timeout": 30000
  },
  "cors": {
    "origin": "*"
  },
  "uriMappings": [
    { "internalPrefix": "http://internal.org/", "externalPrefix": "http://external.org/" }
  ],
  "translateResponse": true
}
`);
    process.exit(0);
  }

  try {
    const config = await loadConfig({ configPath: options.config });

    if (options.port) {
      config.port = parseInt(String(options.port), 10);
    }
    if (options.host) {
      config.host = options.host;
    }
    if (options.endpoint) {
      config.sparql = config.sparql ?? { endpoint: options.endpoint };
      config.sparql.endpoint = options.endpoint;
    }

    const server = await createServer(config);

    const address = await server.listen({
      port: config.port ?? 3000,
      host: config.host ?? '0.0.0.0',
    });

    console.log(`Server listening at ${address}`);

    const serverHost = config.host ?? '0.0.0.0';
    const serverPort = config.port ?? 3000;

    if (config.uriMappings && config.uriMappings.length > 0) {
      console.log(`URI mappings:`);
      for (const m of config.uriMappings) {
        const externalPrefix =
          m.externalPrefix ??
          `http://${serverHost === '0.0.0.0' ? 'localhost' : serverHost}:${serverPort}/ld/${m.dsName}/`;
        console.log(`  ${m.dsName}: ${externalPrefix} -> ${m.internalPrefix} (${m.endpoint})`);
      }
    } else {
      console.log(`No URI mappings configured`);
    }

    console.log(
      `Response translation: ${(config.translateResponse ?? true) ? 'enabled' : 'disabled'}`
    );

    const shutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}, shutting down...`);
      await server.close();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('Failed to start server:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
