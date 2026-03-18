/**
 * RDF data model types
 */

/**
 * An IRI (Internationalized Resource Identifier)
 * Represented as a string in N-Triples format: <http://example.org/resource>
 */
export type Iri = string;

/**
 * A blank node identifier
 * Represented as a string: _:b0, _:node1, etc.
 */
export type BlankNode = string;

/**
 * An RDF literal with optional datatype and language tag
 */
export interface Literal {
  value: string;
  datatype?: Iri;
  language?: string;
}

/**
 * A triple (subject, predicate, object)
 * In RDF 1.0, triples are unnamed; in RDF 1.1, they belong to a graph.
 * For this project, we focus on default graph triples.
 */
export interface Triple {
  subject: Iri | BlankNode;
  predicate: Iri;
  object: Iri | BlankNode | Literal;
}

/**
 * A dataset is a set of triples (default graph only)
 * Could be extended to support named graphs later
 */
export type Dataset = Triple[];

/**
 * Supported RDF serialization formats (MIME types)
 */
export type RdfFormat =
  | 'text/turtle'
  | 'application/n-triples'
  | 'application/ld+json'
  | 'application/rdf+xml';

/**
 * URI mapping configuration for translating between internal and external URI spaces
 */
export interface UriMapping {
  /**
   * Short name for this mapping (used in URL path, e.g., 'dbpedia')
   */
  dsName: string;

  /**
   * SPARQL endpoint URL for this dataset
   */
  endpoint: string;

  /**
   * Base URI used in the SPARQL endpoint (internal namespace)
   */
  internalPrefix: string;

  /**
   * External URI prefix exposed to clients
   * Typically: http://host/ld/{dsName}/
   */
  externalPrefix: string;
}

/**
 * Content negotiation result: the format to use based on Accept header and query param
 */
export interface NegotiatedFormat {
  format: RdfFormat;
  charset?: string;
}
