import { Source, Dataset, Iri, BlankNode, Literal } from '../types/Resource.js';

export class UriTranslator {
  private sources: Source[];
  private sourceExternalPrefixes: Map<string, string>;

  constructor(sources: Source[], baseUrl?: string) {
    this.sources = sources;
    this.sourceExternalPrefixes = new Map(
      sources.map((s) => [s.dsName, `${baseUrl ?? 'http://localhost:3000'}/ld/${s.dsName}/`])
    );
  }

  private normalizeHost(uri: string): string {
    try {
      const url = new URL(uri);
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        url.hostname = 'localhost';
      }
      return url.toString().replace(/\/$/, '');
    } catch {
      return uri;
    }
  }

  getSource(dsName: string): Source | undefined {
    return this.sources.find((s) => s.dsName === dsName);
  }

  findSourceForIri(uri: string): Source | undefined {
    const normalizedUri = this.normalizeHost(uri);
    let bestMatch: Source | undefined;
    let maxLength = -1;

    for (const source of this.sources) {
      const externalPrefix = this.sourceExternalPrefixes.get(source.dsName);
      if (!externalPrefix) continue;
      const normalizedPrefix = this.normalizeHost(externalPrefix);
      if (normalizedUri.startsWith(normalizedPrefix)) {
        const prefixLength = normalizedPrefix.length;
        if (prefixLength > maxLength) {
          maxLength = prefixLength;
          bestMatch = source;
        }
      }
    }

    return bestMatch;
  }

  translateRequestUri(uri: string): string {
    const normalizedUri = this.normalizeHost(uri);

    let bestMatch: Source | null = null;
    let maxLength = -1;
    let matchedPrefixLength = 0;

    for (const source of this.sources) {
      const externalPrefix = this.sourceExternalPrefixes.get(source.dsName);
      if (!externalPrefix) continue;
      const normalizedPrefix = this.normalizeHost(externalPrefix);
      if (normalizedUri.startsWith(normalizedPrefix)) {
        const prefixLength = normalizedPrefix.length;
        if (prefixLength > maxLength) {
          maxLength = prefixLength;
          bestMatch = source;
          matchedPrefixLength = externalPrefix.length;
        }
      }
    }

    if (bestMatch) {
      return bestMatch.originalPrefix + uri.slice(matchedPrefixLength);
    }

    return uri;
  }

  translateDataset(dataset: Dataset, options?: { translateResponse?: boolean }): Dataset {
    if (options?.translateResponse === false) {
      return dataset;
    }

    return dataset.map((triple) => ({
      subject: this.translateNode(triple.subject) as Iri | BlankNode,
      predicate: this.translateIri(triple.predicate),
      object: this.translateNode(triple.object),
    }));
  }

  private translateNode(node: Iri | BlankNode | Literal): Iri | BlankNode | Literal {
    if (this.isBlankNode(node) || this.isLiteral(node)) {
      return node;
    }
    return this.translateIri(node);
  }

  private isBlankNode(node: Iri | BlankNode | Literal): node is BlankNode {
    return typeof node === 'string' && node.startsWith('_:');
  }

  private isLiteral(node: Iri | BlankNode | Literal): node is Literal {
    return typeof node !== 'string' && 'value' in node;
  }

  private translateIri(iri: Iri): Iri {
    let bestMatch: Source | null = null;
    let maxLength = -1;
    let matchedDsName: string | null = null;

    for (const source of this.sources) {
      if (source.originalPrefix && iri.startsWith(source.originalPrefix)) {
        const prefixLength = source.originalPrefix.length;
        if (prefixLength > maxLength) {
          maxLength = prefixLength;
          bestMatch = source;
          matchedDsName = source.dsName;
        }
      }
    }

    if (bestMatch && matchedDsName) {
      const externalPrefix = this.sourceExternalPrefixes.get(matchedDsName);
      if (externalPrefix) {
        return externalPrefix + iri.slice(bestMatch.originalPrefix.length);
      }
    }

    return iri;
  }

  translatePrefixes(prefixes: Record<string, string>): Record<string, string> {
    const result: Record<string, string> = {};

    for (const [prefix, iri] of Object.entries(prefixes)) {
      const translated = this.translateIri(iri);
      result[prefix] = translated;
    }

    return result;
  }

  translateBase(base: string): string | undefined {
    const translated = this.translateIri(base);
    return translated !== base ? translated : undefined;
  }
}
