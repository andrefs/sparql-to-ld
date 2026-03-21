#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { loadConfig } from '../config/loader.js';
import { createServer } from '../server/server.js';

interface CliOptions {
  config?: string;
  port?: number;
  host?: string;
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
  -?, --help             Show this help message

Example config file (sparql-to-ld.json):
{
  "server": {
    "host": "0.0.0.0",
    "port": 3000
  },
  "cors": {
    "origin": "*"
  },
  "sources": [
    {
      "dsName": "dbpedia",
      "originalPrefix": "http://dbpedia.org/resource/",
      "endpoints": [
        {
          "type": "sparql",
          "mode": "describe",
          "url": "http://localhost:3030/dbpedia/sparql"
        }
      ]
    }
  ],
  "translateResponse": true
}
`);
    process.exit(0);
  }

  try {
    const config = await loadConfig({ configPath: options.config });

    if (options.port) {
      config.server = config.server ?? {};
      config.server.port = parseInt(String(options.port), 10);
    }
    if (options.host) {
      config.server = config.server ?? {};
      config.server.host = options.host;
    }

    const server = await createServer(config);

    const serverHost = config.server?.host ?? '0.0.0.0';
    const serverPort = config.server?.port ?? 3000;

    const address = await server.listen({
      port: serverPort,
      host: serverHost,
    });

    console.log(`Server listening at ${address}`);

    const baseUrl = `http://${serverHost === '0.0.0.0' ? 'localhost' : serverHost}:${serverPort}`;

    if (config.sources && config.sources.length > 0) {
      console.log(`Sources:`);
      for (const source of config.sources) {
        const externalPrefix = `${baseUrl}/ld/${source.dsName}/`;
        const endpoints = source.endpoints
          .map((e) => `${e.type}:${e.type === 'sparql' ? (e.mode ?? 'describe') : 'direct'}`)
          .join(', ');
        console.log(
          `  ${source.dsName}: ${externalPrefix} -> ${source.originalPrefix} [${endpoints}]`
        );
      }
    } else {
      console.log(`No sources configured`);
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
