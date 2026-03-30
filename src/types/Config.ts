/**
 * Configuration types
 */

import { z } from 'zod';
import { EndpointMode } from './Resource.js';

/**
 * CORS configuration for the HTTP server
 */
export interface CorsOptions {
  origin?: string | string[] | RegExp | boolean;
  credentials?: boolean;
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  maxAge?: number;
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  level?: string;
  prettyPrint?: boolean;
}

/**
 * Server configuration
 */
export interface ServerConfig {
  server?: {
    host?: string;
    port?: number;
  };
  cors?: CorsOptions;
  logging?: LoggingConfig;
  sources?: SourceConfig[];
  translateResponse?: boolean;
  html?: boolean;
  verbose?: boolean;
}

export interface SourceConfig {
  dsName: string;
  originalPrefix: string;
  endpoints: EndpointConfig[];
}

export interface EndpointConfig {
  type: 'sparql' | 'http';
  mode?: EndpointMode;
  url: string;
  headers?: Record<string, string>;
}

export const serverConfigSchema = z.object({
  server: z
    .object({
      host: z.string().optional(),
      port: z.number().int().positive().optional(),
    })
    .optional(),
  cors: z
    .object({
      origin: z.any().optional(),
      credentials: z.boolean().optional(),
      methods: z.array(z.string()).optional(),
      allowedHeaders: z.array(z.string()).optional(),
      exposedHeaders: z.array(z.string()).optional(),
      maxAge: z.number().int().nonnegative().optional(),
    })
    .optional(),
  logging: z
    .object({
      level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).optional(),
      prettyPrint: z.boolean().optional(),
    })
    .optional(),
  sources: z
    .array(
      z.object({
        dsName: z.string(),
        originalPrefix: z.string(),
        endpoints: z.array(
          z.object({
            type: z.enum(['sparql', 'http']),
            mode: z
              .enum([
                'describe',
                'fwd-one',
                'fwd-two',
                'back-one',
                'back-two',
                'sym-one',
                'sym-two',
              ])
              .optional(),
            url: z.string(),
            headers: z.record(z.string(), z.string()).optional(),
          })
        ),
      })
    )
    .optional(),
  translateResponse: z.boolean().optional(),
  html: z.boolean().optional(),
  verbose: z.boolean().optional(),
});

export function isServerConfig(value: unknown): value is ServerConfig {
  return serverConfigSchema.safeParse(value).success;
}
