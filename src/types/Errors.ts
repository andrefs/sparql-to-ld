/**
 * Custom error types for the sparql-to-ld project
 */

/**
 * Base error class for all sparql-to-ld errors
 */
export class SparqlToLdError extends Error {
  constructor(
    message: string,
    public cause?: unknown
  ) {
    super(message);
    this.name = 'SparqlToLdError';
  }
}

/**
 * Error thrown when configuration is invalid or missing
 */
export class ConfigurationError extends SparqlToLdError {
  constructor(
    message: string,
    public details?: Record<string, unknown>,
    cause?: unknown
  ) {
    super(message, cause);
    this.name = 'ConfigurationError';
  }
}

/**
 * Error thrown when the SPARQL endpoint returns an error or times out
 */
export class EndpointError extends SparqlToLdError {
  constructor(
    message: string,
    public statusCode?: number,
    public endpoint?: string,
    cause?: unknown
  ) {
    super(message, cause);
    this.name = 'EndpointError';
  }
}

/**
 * Error thrown when RDF parsing or serialization fails
 */
export class RdfParseError extends SparqlToLdError {
  constructor(
    message: string,
    public format?: string,
    cause?: unknown
  ) {
    super(message, cause);
    this.name = 'RdfParseError';
  }
}

/**
 * Error thrown when an invalid resource IRI is provided
 */
export class InvalidIriError extends SparqlToLdError {
  constructor(
    message: string,
    public iri?: string,
    cause?: unknown
  ) {
    super(message, cause);
    this.name = 'InvalidIriError';
  }
}

/**
 * Error thrown when content negotiation fails (unsupported format)
 */
export class UnsupportedFormatError extends SparqlToLdError {
  constructor(
    message: string,
    public format?: string,
    cause?: unknown
  ) {
    super(message, cause);
    this.name = 'UnsupportedFormatError';
  }
}
