import { Parser, Writer, DataFactory, Quad } from 'n3';
import { Dataset, Triple, Iri, BlankNode, Literal, RdfFormat } from '../types/Resource.js';
import { RdfParseError } from '../types/Errors.js';

const { namedNode, blankNode, literal, quad } = DataFactory;

/**
 * Supported RDF formats and their MIME types
 */
export const RDF_FORMATS: Record<RdfFormat, { parserFormat: string; writerFormat: string }> = {
  'text/turtle': { parserFormat: 'Turtle', writerFormat: 'Turtle' },
  'application/n-triples': { parserFormat: 'N-Triples', writerFormat: 'N-Triples' },
  'application/ld+json': { parserFormat: 'JSON-LD', writerFormat: 'JSON-LD' },
  'application/rdf+xml': { parserFormat: 'RDF/XML', writerFormat: 'RDF/XML' },
};

/**
 * Convert n3 quad to internal Triple format
 */
function quadToTriple(q: Quad): Triple {
  return {
    subject: nodeToIriOrBlankNode(q.subject),
    predicate: q.predicate.value,
    object: nodeToIriOrLiteral(q.object),
  };
}

/**
 * Convert n3 node to Iri or BlankNode string
 */
function nodeToIriOrBlankNode(node: any): Iri | BlankNode {
  if (node.termType === 'NamedNode') {
    return node.value;
  } else if (node.termType === 'BlankNode') {
    return node.value;
  } else {
    throw new RdfParseError(`Unexpected node type in subject/object: ${node.termType}`);
  }
}

/**
 * Convert n3 node to Iri, BlankNode, or Literal
 */
function nodeToIriOrLiteral(node: any): Iri | BlankNode | Literal {
  if (node.termType === 'NamedNode') {
    return node.value;
  } else if (node.termType === 'BlankNode') {
    return node.value;
  } else if (node.termType === 'Literal') {
    const lit: Literal = {
      value: node.value,
    };
    // In RDF, a literal can have either a language tag OR a datatype, not both
    if (node.language) {
      lit.language = node.language;
    } else if (node.datatype) {
      lit.datatype = node.datatype.value;
    }
    return lit;
  } else {
    throw new RdfParseError(`Cannot convert node type ${node.termType} to literal/iri`);
  }
}

/**
 * Convert internal Triple to n3 quad
 */
function tripleToN3Quad(triple: Triple): Quad {
  const { subject, predicate, object } = triple;
  const s =
    typeof subject === 'string' && subject.startsWith('_:')
      ? blankNode(subject)
      : namedNode(subject);
  const p = namedNode(predicate);
  const o = nodeToN3Object(object);
  // Use quad() to create a Quad. The fourth argument (graph) is omitted for default graph.
  return quad(s, p, o);
}

/**
 * Convert internal object to n3 object
 */
function nodeToN3Object(obj: Iri | BlankNode | Literal): any {
  if (typeof obj === 'string') {
    if (obj.startsWith('_:')) {
      return blankNode(obj);
    } else {
      return namedNode(obj);
    }
  } else {
    // Literal - n3's literal() takes (value, languageOrDatatype?)
    // We can only specify one: either language or datatype
    if (obj.language) {
      return literal(obj.value, obj.language);
    } else if (obj.datatype) {
      return literal(obj.value, namedNode(obj.datatype));
    } else {
      return literal(obj.value);
    }
  }
}

/**
 * RDF Parser: Parse RDF data in various formats into Dataset
 */
export class RdfParser {
  /**
   * Parse RDF data string into a Dataset
   * @param data - RDF data as string
   * @param format - MIME type of the input format
   * @returns Dataset (array of triples)
   */
  parse(data: string, format: RdfFormat): Dataset {
    const { parserFormat } = RDF_FORMATS[format];
    const parser = new Parser({ format: parserFormat as any });
    const quads = parser.parse(data) as Quad[];
    return quads.map(quadToTriple);
  }

  /**
   * Parse RDF data with automatic format detection from MIME type
   */
  parseWithMime(data: string, mimeType: string): Dataset {
    const format = this.mimeToFormat(mimeType);
    return this.parse(data, format);
  }

  /**
   * Convert MIME type to RdfFormat
   */
  private mimeToFormat(mimeType: string): RdfFormat {
    const normalized = mimeType.split(';')[0].trim();
    switch (normalized) {
      case 'text/turtle':
        return 'text/turtle';
      case 'application/n-triples':
        return 'application/n-triples';
      case 'application/ld+json':
        return 'application/ld+json';
      case 'application/rdf+xml':
        return 'application/rdf+xml';
      default:
        throw new RdfParseError(`Unsupported RDF format: ${mimeType}`);
    }
  }
}

/**
 * RDF Serializer: Convert Dataset to RDF string in various formats
 */
export class RdfSerializer {
  /**
   * Serialize a Dataset to RDF string in the specified format
   * @param dataset - Dataset (array of triples)
   * @param format - Desired output format MIME type
   * @returns RDF data as string
   */
  serialize(dataset: Dataset, format: RdfFormat): string {
    const { writerFormat } = RDF_FORMATS[format];
    const writer = new Writer({ format: writerFormat as any });
    const quads = dataset.map(tripleToN3Quad);

    // Add all quads to writer
    for (const q of quads) {
      writer.addQuad(q);
    }

    // Use quadsToString to get the result
    return writer.quadsToString(quads);
  }

  /**
   * Serialize dataset with automatic MIME type mapping
   */
  serializeWithMime(dataset: Dataset, mimeType: string): string {
    const format = this.mimeToFormat(mimeType);
    return this.serialize(dataset, format);
  }

  /**
   * Convert MIME type to RdfFormat
   */
  private mimeToFormat(mimeType: string): RdfFormat {
    const normalized = mimeType.split(';')[0].trim();
    switch (normalized) {
      case 'text/turtle':
        return 'text/turtle';
      case 'application/n-triples':
        return 'application/n-triples';
      case 'application/ld+json':
        return 'application/ld+json';
      case 'application/rdf+xml':
        return 'application/rdf+xml';
      default:
        throw new RdfParseError(`Unsupported RDF format: ${mimeType}`);
    }
  }
}

// Re-export convenience functions
export function parseRdf(data: string, format: RdfFormat): Dataset {
  return new RdfParser().parse(data, format);
}

export function serializeRdf(dataset: Dataset, format: RdfFormat): string {
  return new RdfSerializer().serialize(dataset, format);
}
