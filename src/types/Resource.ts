export type Iri = string;

export interface NamedNode {
  termType: 'NamedNode';
  value: Iri;
}

export interface BlankNode {
  termType: 'BlankNode';
  value: string;
}

export interface Literal {
  termType: 'Literal';
  value: string;
  datatype?: Iri;
  language?: string;
}

export type Term = NamedNode | BlankNode | Literal;

export interface Triple {
  subject: NamedNode | BlankNode;
  predicate: NamedNode;
  object: NamedNode | BlankNode | Literal;
}

export type Dataset = Triple[];

export type RdfFormat =
  | 'text/turtle'
  | 'application/n-triples'
  | 'application/ld+json'
  | 'application/rdf+xml'
  | 'text/html';

export type EndpointMode =
  | 'describe'
  | 'fwd-one'
  | 'fwd-two'
  | 'back-one'
  | 'back-two'
  | 'sym-one'
  | 'sym-two'
  | 'fwd-one-blank'
  | 'back-one-blank'
  | 'sym-one-blank'
  | 'fwd-two-blank'
  | 'back-two-blank'
  | 'sym-two-blank'
  | 'fwd-three-blank'
  | 'back-three-blank'
  | 'sym-three-blank';

export interface SparqlEndpoint {
  type: 'sparql';
  mode: EndpointMode;
  url: string;
  headers?: Record<string, string>;
}

export interface HttpEndpoint {
  type: 'http';
  url: string;
  headers?: Record<string, string>;
}

export type Endpoint = SparqlEndpoint | HttpEndpoint;

export interface Source {
  dsName: string;
  originalPrefix: string;
  endpoints: Endpoint[];
  uriMappings?: [string, string][];
  comment?: string;
}

export interface NegotiatedFormat {
  format: RdfFormat;
  charset?: string;
}
