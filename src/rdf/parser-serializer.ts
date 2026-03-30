import { Parser, Writer, DataFactory, Quad } from 'n3';
import { Dataset, Triple, Iri, BlankNode, Literal, RdfFormat } from '../types/Resource.js';
import { RdfParseError } from '../types/Errors.js';

const { namedNode, blankNode, literal, quad } = DataFactory;

export const RDF_FORMATS: Record<RdfFormat, { parserFormat: string; writerFormat: string }> = {
  'text/turtle': { parserFormat: 'Turtle', writerFormat: 'Turtle' },
  'application/n-triples': { parserFormat: 'N-Triples', writerFormat: 'N-Triples' },
  'application/ld+json': { parserFormat: 'JSON-LD', writerFormat: 'JSON-LD' },
  'application/rdf+xml': { parserFormat: 'RDF/XML', writerFormat: 'RDF/XML' },
  'text/html': { parserFormat: 'Turtle', writerFormat: 'Turtle' },
};

function quadToTriple(q: Quad): Triple {
  return {
    subject: nodeToIriOrBlankNode(q.subject),
    predicate: q.predicate.value,
    object: nodeToIriOrLiteral(q.object),
  };
}

function nodeToIriOrBlankNode(node: any): Iri | BlankNode {
  if (node.termType === 'NamedNode') return node.value;
  if (node.termType === 'BlankNode') return node.value;
  throw new RdfParseError(`Unexpected node type in subject/object: ${node.termType}`);
}

function nodeToIriOrLiteral(node: any): Iri | BlankNode | Literal {
  if (node.termType === 'NamedNode') return node.value;
  if (node.termType === 'BlankNode') return node.value;
  if (node.termType === 'Literal') {
    const lit: Literal = { value: node.value };
    if (node.language) lit.language = node.language;
    else if (node.datatype) lit.datatype = node.datatype.value;
    return lit;
  }
  throw new RdfParseError(`Cannot convert node type ${node.termType} to literal/iri`);
}

function tripleToN3Quad(triple: Triple): Quad {
  const { subject, predicate, object } = triple;
  const s =
    typeof subject === 'string' && subject.startsWith('_:')
      ? blankNode(subject)
      : namedNode(subject);
  const p = namedNode(predicate);
  const o = nodeToN3Object(object);
  return quad(s, p, o);
}

function nodeToN3Object(obj: Iri | BlankNode | Literal): any {
  if (typeof obj === 'string') {
    return obj.startsWith('_:') ? blankNode(obj) : namedNode(obj);
  }
  if (obj.language) return literal(obj.value, obj.language);
  if (obj.datatype) return literal(obj.value, namedNode(obj.datatype));
  return literal(obj.value);
}

/**
 * Result of parsing RDF with metadata (prefixes and base)
 */
export interface ParseResult {
  triples: Dataset;
  prefixes: Record<string, string>;
  base?: string;
}

export class RdfParser {
  parse(data: string, format: RdfFormat): Dataset {
    const { parserFormat } = RDF_FORMATS[format];
    const parser = new Parser({ format: parserFormat as any });
    const quads = parser.parse(data) as Quad[];
    return quads.map(quadToTriple);
  }

  parseWithMetadata(data: string, format: RdfFormat): ParseResult {
    const { parserFormat } = RDF_FORMATS[format];
    const parser = new Parser({ format: parserFormat as any });

    const quads = parser.parse(data) as Quad[];

    const prefixes: Record<string, string> = {};
    const parserAny = parser as any;
    if (parserAny._prefixes) {
      Object.assign(prefixes, parserAny._prefixes);
    }

    const base = parserAny._base as string | undefined;

    return {
      triples: quads.map(quadToTriple),
      prefixes,
      base,
    };
  }

  parseWithMime(data: string, mimeType: string): Dataset {
    const format = this.mimeToFormat(mimeType);
    return this.parse(data, format);
  }

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

export class RdfSerializer {
  serialize(
    dataset: Dataset,
    format: RdfFormat,
    options?: { prefixes?: Record<string, string>; base?: string }
  ): string {
    const { writerFormat } = RDF_FORMATS[format];
    const writerOptions: any = { format: writerFormat as any };
    if (options?.prefixes) writerOptions.prefixes = options.prefixes;
    if (options?.base) writerOptions.base = options.base;
    const writer = new Writer(writerOptions);

    const quads = dataset.map(tripleToN3Quad);
    for (const q of quads) {
      writer.addQuad(q);
    }

    const quadsOutput = writer.quadsToString(quads);

    if (format !== 'text/turtle') {
      return quadsOutput;
    }

    let result = '';
    if (options?.base) {
      result += `@base <${options.base}> .\n`;
    }
    if (options?.prefixes) {
      for (const [prefix, iri] of Object.entries(options.prefixes)) {
        result += `@prefix ${prefix}: <${iri}> .\n`;
      }
    }
    return result + quadsOutput;
  }

  serializeWithMime(dataset: Dataset, mimeType: string): string {
    const format = this.mimeToFormat(mimeType);
    return this.serialize(dataset, format);
  }

  serializeHtml(dataset: Dataset, translatedUris: Map<string, string> = new Map()): string {
    const escapeHtml = (str: string): string => {
      return str
        .replace(/&/g, '&amp;')
        .replace(/#/g, '&#35;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    };

    const escapeHref = (str: string): string => {
      return str
        .replace(/#/g, '%23')
        .replace(/&/g, '%26')
        .replace(/</g, '%3C')
        .replace(/>/g, '%3E');
    };

    const getLink = (uri: string): string => {
      return translatedUris.get(uri) ?? uri;
    };

    const formatSubjectOrPredicate = (term: Iri | BlankNode): string => {
      if (typeof term === 'string' && term.startsWith('_:')) {
        return escapeHtml(term);
      }
      const href = getLink(term);
      const display = escapeHtml(term);
      return `<a href="${escapeHref(href)}">${display}</a>`;
    };

    const formatObject = (term: Iri | BlankNode | Literal): string => {
      if (typeof term === 'string') {
        if (term.startsWith('_:')) {
          return escapeHtml(term);
        }
        const href = getLink(term);
        const display = escapeHtml(term);
        return `<a href="${escapeHref(href)}">${display}</a>`;
      }
      return `<span class="literal">"${escapeHtml(term.value)}"</span>`;
    };

    let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>RDF Description</title>
  <style>
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; word-break: break-all; }
    th { background-color: #f2f2f2; text-align: left; }
    a { color: #0066cc; }
    .literal { color: #666; font-style: italic; }
  </style>
</head>
<body>
  <table>
    <thead>
      <tr>
        <th>Subject</th>
        <th>Predicate</th>
        <th>Object</th>
      </tr>
    </thead>
    <tbody>
`;

    if (dataset.length === 0) {
      html += `      <tr>
        <td colspan="3">No results found</td>
      </tr>
`;
    } else {
      for (const triple of dataset) {
        html += `      <tr>
        <td>${formatSubjectOrPredicate(triple.subject)}</td>
        <td>${formatSubjectOrPredicate(triple.predicate)}</td>
        <td>${formatObject(triple.object)}</td>
      </tr>
`;
      }
    }

    html += `    </tbody>
  </table>
</body>
</html>
`;

    return html;
  }

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

export function parseRdf(data: string, format: RdfFormat): Dataset {
  return new RdfParser().parse(data, format);
}

export function serializeRdf(dataset: Dataset, format: RdfFormat): string {
  return new RdfSerializer().serialize(dataset, format);
}
