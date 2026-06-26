import { Parser, Writer, DataFactory, Quad } from 'n3';
import { Dataset, Triple, NamedNode, BlankNode, Literal, RdfFormat } from '../types/Resource.js';
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
    subject: nodeToSubject(q.subject),
    predicate: namedNode(q.predicate.value),
    object: nodeToObject(q.object),
  };
}

function nodeToSubject(node: any): NamedNode | BlankNode {
  if (node.termType === 'NamedNode') return { termType: 'NamedNode', value: node.value };
  if (node.termType === 'BlankNode') return { termType: 'BlankNode', value: node.value };
  throw new RdfParseError(`Unexpected node type in subject: ${node.termType}`);
}

function nodeToObject(node: any): NamedNode | BlankNode | Literal {
  if (node.termType === 'NamedNode') return { termType: 'NamedNode', value: node.value };
  if (node.termType === 'BlankNode') return { termType: 'BlankNode', value: node.value };
  if (node.termType === 'Literal') {
    const lit: Literal = { termType: 'Literal', value: node.value };
    if (node.language) lit.language = node.language;
    else if (node.datatype) lit.datatype = node.datatype.value;
    return lit;
  }
  throw new RdfParseError(`Cannot convert node type ${node.termType} to triple term`);
}

function tripleToN3Quad(triple: Triple): Quad {
  const s =
    triple.subject.termType === 'BlankNode'
      ? blankNode(triple.subject.value)
      : namedNode(triple.subject.value);
  const p = namedNode(triple.predicate.value);
  const o = nodeToN3Term(triple.object);
  return quad(s, p, o);
}

function nodeToN3Term(node: NamedNode | BlankNode | Literal): any {
  if (node.termType === 'NamedNode') return namedNode(node.value);
  if (node.termType === 'BlankNode') return blankNode(node.value);
  if (node.language) return literal(node.value, node.language);
  if (node.datatype) return literal(node.value, namedNode(node.datatype));
  return literal(node.value);
}

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

    const formatSubjectOrPredicate = (term: NamedNode | BlankNode): string => {
      if (term.termType === 'BlankNode') {
        return escapeHtml(term.value);
      }
      const href = getLink(term.value);
      const display = escapeHtml(term.value);
      return `<a href="${escapeHref(href)}">${display}</a>`;
    };

    const formatObject = (term: NamedNode | BlankNode | Literal): string => {
      if (term.termType === 'BlankNode') {
        return escapeHtml(term.value);
      }
      if (term.termType === 'Literal') {
        return `<span class="literal">"${escapeHtml(term.value)}"</span>`;
      }
      const href = getLink(term.value);
      const display = escapeHtml(term.value);
      return `<a href="${escapeHref(href)}">${display}</a>`;
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
    .row-num { user-select: none; color: #999; text-align: right; width: 1px; white-space: nowrap; }
  </style>
</head>
<body>
  <table>
    <thead>
      <tr>
        <th style="width:1px; white-space:nowrap;">#</th>
        <th>Subject</th>
        <th>Predicate</th>
        <th>Object</th>
      </tr>
    </thead>
    <tbody>
`;

    if (dataset.length === 0) {
      html += `      <tr>
        <td colspan="4">No results found</td>
      </tr>
`;
    } else {
      let rowNum = 1;
      for (const triple of dataset) {
        html += `      <tr>
        <td class="row-num">${rowNum++}</td>
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
