/**
 * SPARQL Query Builder
 *
 * Constructs SPARQL DESCRIBE queries with support for
 * FedBox/CBD (Concise Bounded Description) patterns.
 */

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
