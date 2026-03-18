/**
 * Configuration types
 */

import { z } from 'zod';
import { UriMapping } from './Resource.js';

/**
 * SPARQL endpoint configuration
 */
export interface SparqlEndpointConfig {
  /**
   * URL of the SPARQL endpoint (required)
   * Example: http://localhost:3030/dataset
   */
  endpoint: string;

  /**
   * Query timeout in milliseconds (optional)
   * @default 30000
   */
  timeout?: number;

  /**
   * Maximum number of results to return (optional)
   * Used as a safety limit for DESCRIBE queries
   * @default 10000
   */
  maxResults?: number;

  /**
   * HTTP headers to send with each request (optional)
   */
  headers?: Record<string, string>;
}

/**
 * CORS configuration for the HTTP server
 */
export interface CorsOptions {
  /**
   * Allowed origins. Can be:
   * - '*' (any origin)
   * - A specific origin string
   * - An array of origin strings
   * - A RegExp to match origins
   * @default '*'
   */
  origin?: string | string[] | RegExp | boolean;

  /**
   * Allow credentials (Access-Control-Allow-Credentials)
   * @default false
   */
  credentials?: boolean;

  /**
   * Allowed HTTP methods
   * @default ['GET']
   */
  methods?: string[];

  /**
   * Allowed headers
   * @default ['Content-Type', 'Authorization']
   */
  allowedHeaders?: string[];

  /**
   * Exposed headers
   * @default ['Content-Type', 'Content-Disposition']
   */
  exposedHeaders?: string[];

  /**
   * Max age for preflight cache in seconds
   * @default 86400
   */
  maxAge?: number;
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  /**
   * Log level: trace, debug, info, warn, error, fatal
   * @default 'info'
   */
  level?: string;

  /**
   * Pretty-print logs (useful for development)
   * @default false
   */
  prettyPrint?: boolean;
}

/**
 * Server configuration
 */
export interface ServerConfig {
  /**
   * Server port
   * @default 3000
   */
  port?: number;

  /**
   * Server host
   * @default '0.0.0.0'
   */
  host?: string;

  /**
   * CORS settings
   */
  cors?: CorsOptions;

  /**
   * SPARQL endpoint configuration (required)
   */
  sparql: SparqlEndpointConfig;

  /**
   * Logging settings
   */
  logging?: LoggingConfig;

  /**
   * URI mappings for translating between external and internal URIs
   */
  uriMappings?: UriMapping[];

  /**
   * Whether to translate the response dataset from internal to external URIs
   * Can be overridden by query parameter ?translateResponse=false
   * @default true
   */
  translateResponse?: boolean;
}

/**
 * Zod schema for ServerConfig validation
 */
export const serverConfigSchema = z.object({
  port: z.number().int().positive().optional(),
  host: z.string().optional(),
  cors: z
    .object({
      origin: z.any().optional(), // string, array, regex, or boolean
      credentials: z.boolean().optional(),
      methods: z.array(z.string()).optional(),
      allowedHeaders: z.array(z.string()).optional(),
      exposedHeaders: z.array(z.string()).optional(),
      maxAge: z.number().int().nonnegative().optional(),
    })
    .optional(),
  sparql: z
    .object({
      endpoint: z.string().url({ message: 'SPARQL endpoint must be a valid URL' }),
      timeout: z.number().int().positive().optional(),
      maxResults: z.number().int().positive().optional(),
      headers: z.record(z.string(), z.string()).optional(),
    })
    .strict()
    .optional(),
  logging: z
    .object({
      level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).optional(),
      prettyPrint: z.boolean().optional(),
    })
    .optional(),
  uriMappings: z
    .array(
      z.object({
        dsName: z.string(),
        endpoint: z.string().url(),
        internalPrefix: z.string(),
        externalPrefix: z.string(),
      })
    )
    .optional(),
  translateResponse: z.boolean().optional(),
});

/**
 * Type guard to validate ServerConfig at runtime
 */
export function isServerConfig(value: unknown): value is ServerConfig {
  return serverConfigSchema.safeParse(value).success;
}
