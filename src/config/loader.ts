import dotenv from 'dotenv';
import { readFile } from 'node:fs/promises';
import { ServerConfig, serverConfigSchema } from '../types/Config.js';
import { ConfigurationError } from '../types/Errors.js';

export interface LoadConfigOptions {
  env?: Record<string, string | undefined>;
  configPath?: string;
}

export async function loadConfig(options: LoadConfigOptions = {}): Promise<ServerConfig> {
  const { env: customEnv, configPath = './sparql-to-ld.json' } = options;

  const config: Partial<ServerConfig> = {
    server: {
      host: '0.0.0.0',
      port: 3000,
    },
    translateResponse: true,
    verbose: false,
    logging: {
      level: 'info',
      prettyPrint: false,
    },
    cors: {
      origin: '*',
      credentials: false,
      methods: ['GET'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['Content-Type', 'Content-Disposition'],
      maxAge: 86400,
    },
  };

  try {
    const fileContent = await readFile(configPath, 'utf-8');
    const jsonConfig = JSON.parse(fileContent);
    mergeConfig(config, jsonConfig);
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
    } else {
      throw new ConfigurationError('Failed to parse config file', { cause: err });
    }
  }

  const env = customEnv || process.env;
  dotenv.parse(env as any);

  overrideFromEnv(config, env as Record<string, string>);

  const result = serverConfigSchema.safeParse(config);

  if (!result.success) {
    throw new ConfigurationError('Invalid configuration', { cause: result.error });
  }

  return result.data as ServerConfig;
}

function mergeConfig(target: any, source: any): void {
  if (!source || typeof source !== 'object') return;
  if (Array.isArray(source)) return;

  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = source[key];
      } else {
        mergeConfig(target[key], source[key]);
      }
    } else {
      target[key] = source[key];
    }
  }
}

function overrideFromEnv(config: any, env: Record<string, string>): void {
  if (env.SPARQL_TO_LD_PORT) {
    config.server = config.server || {};
    config.server.port = parseInt(env.SPARQL_TO_LD_PORT, 10);
  }
  if (env.SPARQL_TO_LD_HOST) {
    config.server = config.server || {};
    config.server.host = env.SPARQL_TO_LD_HOST;
  }
  if (env.SPARQL_TO_LD_CORS_ORIGIN) {
    config.cors = config.cors || {};
    config.cors.origin = env.SPARQL_TO_LD_CORS_ORIGIN;
  }
  if (env.SPARQL_TO_LD_LOGGING_LEVEL) {
    config.logging = config.logging || {};
    config.logging.level = env.SPARQL_TO_LD_LOGGING_LEVEL;
  }
  if (env.SPARQL_TO_LD_LOGGING_PRETTY_PRINT) {
    config.logging = config.logging || {};
    config.logging.prettyPrint = env.SPARQL_TO_LD_LOGGING_PRETTY_PRINT === 'true';
  }
  if (env.SPARQL_TO_LD_VERBOSE) {
    config.verbose = env.SPARQL_TO_LD_VERBOSE === 'true';
  }
}
