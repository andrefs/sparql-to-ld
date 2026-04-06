/**
 * SPARQL Query Builder
 *
 * Constructs SPARQL DESCRIBE and CONSTRUCT queries with support for
 * (S)CBD (Concise Bounded Description) patterns.
 */

import type { EndpointMode } from '../types/Resource.js';

/**
 * Options for building a DESCRIBE query
 */
export interface DescribeOptions {
  /**
   * Include triples where the resource appears as object (inverse)
   * Default: false
   */
  includeInverse?: boolean;

  /**
   * Property paths to include (e.g., ['rdfs:seeAlso', 'foaf:knows/foaf:name'])
   * If empty, all properties are included.
   */
  propertyPaths?: string[];

  /**
   * Maximum number of results (safety limit)
   */
  limit?: number;
}

/**
 * Build a SPARQL DESCRIBE query for a given resource IRI.
 *
 * Basic DESCRIBE query:
 *   DESCRIBE <http://example.org/resource>
 *
 * With FedBox/CBD pattern (include inverse):
 *   DESCRIBE ?resource WHERE {
 *     { ?resource ?p ?o }
 *     UNION
 *     { ?s ?p ?resource }
 *   } VALUES ?resource { <http://example.org/resource> }
 *
 * @param resourceIri - The IRI of the resource to describe
 * @param options - Query building options
 * @returns SPARQL query string
 */
export function buildDescribeQuery(resourceIri: string, options: DescribeOptions = {}): string {
  const { includeInverse = false, propertyPaths = [], limit } = options;

  // Validate IRI is not empty
  if (!resourceIri || typeof resourceIri !== 'string') {
    throw new Error('Invalid resource IRI');
  }

  // Escape IRI for SPARQL: wrap in <>
  const escapedIri = escapeIri(resourceIri);

  // If no special options, use simple DESCRIBE
  if (!includeInverse && propertyPaths.length === 0) {
    return `DESCRIBE ${escapedIri}`;
  }

  // Build query using VALUES and UNION pattern for FedBox/CBD
  const queryLines: string[] = ['DESCRIBE ?resource', 'WHERE {'];

  if (includeInverse && propertyPaths.length === 0) {
    // Both subject and object patterns
    queryLines.push('  { ?resource ?p ?o }');
    queryLines.push('  UNION');
    queryLines.push('  { ?s ?p ?resource }');
  } else if (propertyPaths.length > 0) {
    // Property path constraints
    const pathPatterns = propertyPaths
      .map((path) => `?resource <${path}> ?o`)
      .join('\n    UNION\n    ');
    queryLines.push(`  { ${pathPatterns} }`);

    if (includeInverse) {
      queryLines.push('  UNION');
      const inversePatterns = propertyPaths
        .map((path) => `?s <${path}> ?resource`)
        .join('\n    UNION\n    ');
      queryLines.push(`  { ${inversePatterns} }`);
    }
  }

  queryLines.push('}');
  queryLines.push(`VALUES ?resource { ${escapedIri} }`);

  if (limit !== undefined) {
    queryLines.push(`LIMIT ${limit}`);
  }

  return queryLines.join('\n');
}

/**
 * Escape an IRI for inclusion in a SPARQL query.
 * The IRI should already be absolute. We wrap it in <> and escape special chars if needed.
 *
 * @param iri - The IRI string
 * @returns Escaped IRI for SPARQL
 */
function escapeIri(iri: string): string {
  // Simple approach: wrap in angle brackets
  // For proper IRI validation, we could use a library, but for now assume valid input
  return `<${iri}>`;
}

/**
 * Build a basic DESCRIBE query without options
 * Convenience wrapper around buildDescribeQuery
 */
export function describeResource(resourceIri: string): string {
  return buildDescribeQuery(resourceIri);
}

/**
 * Build a CBD (Concise Bounded Description) query
 * This includes triples where resource is subject OR object.
 */
export function buildCbdQuery(resourceIri: string, limit?: number): string {
  return buildDescribeQuery(resourceIri, { includeInverse: true, limit });
}

/**
 * Build a CONSTRUCT query based on endpoint mode.
 *
 * Modes:
 * - describe: Simple DESCRIBE query
 * - fwd-one: CONSTRUCT with ?uri ?p ?o
 * - fwd-two: CONSTRUCT with ?uri ?p ?o + 1-hop blank node expansion
 * - back-one: CONSTRUCT with ?s ?p ?uri
 * - back-two: CONSTRUCT with ?s ?p ?uri + 1-hop blank node expansion
 * - sym-one: UNION of fwd-one and back-one
 * - sym-two: Full symmetric 2-hop pattern
 */
export function buildConstructQuery(resourceIri: string, mode: EndpointMode): string {
  const escaped = escapeIri(resourceIri);

  switch (mode) {
    case 'describe':
      return `DESCRIBE ${escaped}`;

    case 'fwd-one':
      return `CONSTRUCT {
  ${escaped} ?p ?o .
}
WHERE {
  ${escaped} ?p ?o .
}`;

    case 'fwd-two':
      return `CONSTRUCT {
  ${escaped} ?p ?o .
  ?o ?p2 ?o2 .
}
WHERE {
  ${escaped} ?p ?o .
  OPTIONAL {
    FILTER(isBlank(?o))
    ?o ?p2 ?o2 .
  }
}`;

    case 'back-one':
      return `CONSTRUCT {
  ?s ?p ${escaped} .
}
WHERE {
  ?s ?p ${escaped} .
}`;

    case 'back-two':
      return `CONSTRUCT {
  ?s ?p ${escaped} .
  ?s2 ?p2 ?s .
}
WHERE {
  ?s ?p ${escaped} .
  OPTIONAL {
    FILTER(isBlank(?s))
    ?s2 ?p2 ?s .
  }
}`;

    case 'sym-one':
      return `CONSTRUCT {
  ${escaped} ?p ?o .
  ?s ?p ${escaped} .
}
WHERE {
  {
    ${escaped} ?p ?o .
    BIND(${escaped} AS ?s)
  }
  UNION
  {
    ?s ?p ${escaped} .
    BIND(${escaped} AS ?o)
  }
}`;

    case 'sym-two':
      return `CONSTRUCT {
  ?s ?p ?o .
}
WHERE {
  {
    ${escaped} ?p ?o .
    BIND(${escaped} AS ?s)
  }
  UNION
  {
    ?s ?p ${escaped} .
    BIND(${escaped} AS ?o)
  }
  UNION
  {
    ${escaped} ?p1 ?x .
    ?x ?p ?o .
    BIND(?x AS ?s)
  }
  UNION
  {
    ?x ?p1 ${escaped} .
    ?s ?p ?x .
    BIND(?x AS ?o)
  }
}`;

    case 'fwd-one-blank':
      return `CONSTRUCT {
  ${escaped} ?p ?o .
  ?x ?p2 ?o2 .
}
WHERE {
  {
    ${escaped} ?p ?o .
  }
  UNION
  {
    ${escaped} ?p1 ?x .
    ?x ?p2 ?o2 .
    FILTER(isBlank(?x))
  }
}`;

    case 'back-one-blank':
      return `CONSTRUCT {
  ?s ?p ${escaped} .
  ?s2 ?p2 ?x .
}
WHERE {
  {
    ?s ?p ${escaped} .
  }
  UNION
  {
    ?x ?p1 ${escaped} .
    ?s2 ?p2 ?x .
    FILTER(isBlank(?x))
  }
}`;

    case 'sym-one-blank':
      return `CONSTRUCT {
  ${escaped} ?p ?o .
  ?s ?p ${escaped} .
  ?x ?p2 ?o2 .
  ?s2 ?p2 ?x .
}
WHERE {
  {
    ${escaped} ?p ?o .
  }
  UNION
  {
    ?s ?p ${escaped} .
  }
  UNION
  {
    ${escaped} ?p1 ?x .
    ?x ?p2 ?o2 .
    FILTER(isBlank(?x))
  }
  UNION
  {
    ?x ?p1 ${escaped} .
    ?s2 ?p2 ?x .
    FILTER(isBlank(?x))
  }
}`;

    default:
      throw new Error(`Unknown endpoint mode: ${mode}`);
  }
}

export function buildLiteralQuery(literal: string): string {
  return `SELECT ?s ?p ?o WHERE { ?s ?p ${literal} }`;
}
