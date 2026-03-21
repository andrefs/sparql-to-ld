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
 * Supported endpoint modes for retrieving RDF resources
 */
export type EndpointMode =
  | 'describe'
  | 'fwd-one'
  | 'fwd-two'
  | 'back-one'
  | 'back-two'
  | 'sym-one'
  | 'sym-two';

/**
 * A SPARQL endpoint with mode configuration
 */
export interface SparqlEndpoint {
  type: 'sparql';
  mode: EndpointMode;
  url: string;
  headers?: Record<string, string>;
}

/**
 * An HTTP endpoint for direct CBD access (e.g., Fuseki's /data?uri=)
 */
export interface HttpEndpoint {
  type: 'http';
  url: string;
  headers?: Record<string, string>;
}

/**
 * An endpoint (SPARQL or HTTP)
 */
export type Endpoint = SparqlEndpoint | HttpEndpoint;

/**
 * A data source configuration containing multiple endpoints
 */
export interface Source {
  dsName: string;
  originalPrefix: string;
  endpoints: Endpoint[];
}

/**
 * Content negotiation result: the format to use based on Accept header and query param
 */
export interface NegotiatedFormat {
  format: RdfFormat;
  charset?: string;
}
