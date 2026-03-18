import dotenv from 'dotenv';
import { readFile } from 'node:fs/promises';
import { ServerConfig, serverConfigSchema } from '../types/Config.js';
import { ConfigurationError } from '../types/Errors.js';

export interface LoadConfigOptions {
  /**
   * Custom environment variables (for testing)
   */
  env?: Record<string, string | undefined>;
  /**
   * Path to config file (default: ./sparql-to-ld.json)
   */
  configPath?: string;
}

/**
 * Load and merge configuration from multiple sources:
 * 1. Default values
 * 2. JSON config file (if exists)
 * 3. .env file (if exists)
 * 4. Environment variables (highest priority)
 *
 * Returns validated ServerConfig
 */
export async function loadConfig(options: LoadConfigOptions = {}): Promise<ServerConfig> {
  const { env: customEnv, configPath = './sparql-to-ld.json' } = options;

  // Start with default values (excluding sparql which must be provided)
  const config: Partial<ServerConfig> = {
    port: 3000,
    host: '0.0.0.0',
    uriMappings: [],
    translateResponse: true,
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

  // Load JSON config file if it exists
  try {
    const fileContent = await readFile(configPath, 'utf-8');
    const jsonConfig = JSON.parse(fileContent);
    mergeConfig(config, jsonConfig);
  } catch (err) {
    // Ignore if file doesn't exist
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
      // Config file not found, use env only
    } else {
      throw new ConfigurationError('Failed to parse config file', { cause: err });
    }
  }

  // Load .env file if exists (dotenv will handle gracefully if not present)
  const env = customEnv || process.env;
  dotenv.parse(env as any); // dotenv mutates process.env, but we can pass custom env via parse

  // Override with environment variables
  overrideFromEnv(config, env as Record<string, string>);

  // Set defaults for sparql fields if sparql is present
  if (config.sparql) {
    if (config.sparql.timeout === undefined) config.sparql.timeout = 30000;
    if (config.sparql.maxResults === undefined) config.sparql.maxResults = 10000;
  }

  // Validate final configuration
  const result = serverConfigSchema.safeParse(config);

  if (!result.success) {
    throw new ConfigurationError('Invalid configuration', { cause: result.error });
  }

  return result.data as ServerConfig;
}

/**
 * Deep merge source object into target
 */
function mergeConfig(target: any, source: any): void {
  if (!source || typeof source !== 'object') return;
  if (Array.isArray(source)) return; // Don't merge arrays

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

/**
 * Override config values from environment variables
 * Supported variables (with SPARQL_TO_LD_ prefix):
 * - SPARQL_TO_LD_PORT
 * - SPARQL_TO_LD_HOST
 * - SPARQL_TO_LD_SPARQL_ENDPOINT
 * - SPARQL_TO_LD_SPARQL_TIMEOUT
 * - SPARQL_TO_LD_SPARQL_MAX_RESULTS
 * - SPARQL_TO_LD_CORS_ORIGIN
 * - SPARQL_TO_LD_LOGGING_LEVEL
 * - SPARQL_TO_LD_LOGGING_PRETTY_PRINT
 */
function overrideFromEnv(config: any, env: Record<string, string>): void {
  // Server settings
  if (env.SPARQL_TO_LD_PORT) {
    config.port = parseInt(env.SPARQL_TO_LD_PORT, 10);
  }
  if (env.SPARQL_TO_LD_HOST) {
    config.host = env.SPARQL_TO_LD_HOST;
  }

  // SPARQL endpoint
  if (env.SPARQL_TO_LD_SPARQL_ENDPOINT) {
    config.sparql = config.sparql || {};
    config.sparql.endpoint = env.SPARQL_TO_LD_SPARQL_ENDPOINT;
  }
  if (env.SPARQL_TO_LD_SPARQL_TIMEOUT) {
    config.sparql = config.sparql || {};
    config.sparql.timeout = parseInt(env.SPARQL_TO_LD_SPARQL_TIMEOUT, 10);
  }
  if (env.SPARQL_TO_LD_SPARQL_MAX_RESULTS) {
    config.sparql = config.sparql || {};
    config.sparql.maxResults = parseInt(env.SPARQL_TO_LD_SPARQL_MAX_RESULTS, 10);
  }

  // CORS
  if (env.SPARQL_TO_LD_CORS_ORIGIN) {
    config.cors = config.cors || {};
    config.cors.origin = env.SPARQL_TO_LD_CORS_ORIGIN;
  }

  // Logging
  if (env.SPARQL_TO_LD_LOGGING_LEVEL) {
    config.logging = config.logging || {};
    config.logging.level = env.SPARQL_TO_LD_LOGGING_LEVEL;
  }
  if (env.SPARQL_TO_LD_LOGGING_PRETTY_PRINT) {
    config.logging = config.logging || {};
    config.logging.prettyPrint = env.SPARQL_TO_LD_LOGGING_PRETTY_PRINT === 'true';
  }
}
