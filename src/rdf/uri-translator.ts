import { Source, Dataset, NamedNode, BlankNode, Literal } from '../types/Resource.js';

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
      const suffix = normalizedUri.slice(matchedPrefixLength);
      const mappedSuffix = this.applyMappings(suffix, bestMatch.uriMappings, 'reverse');
      return bestMatch.originalPrefix + mappedSuffix;
    }

    return uri;
  }

  translateDataset(
    dataset: Dataset,
    options?: { translateResponse?: boolean; dsName?: string }
  ): Dataset {
    if (options?.translateResponse === false) {
      return dataset;
    }

    const dsName = options?.dsName;

    return dataset.map((triple) => ({
      subject: this.translateSubject(triple.subject, dsName),
      predicate: this.translatePredicate(triple.predicate, dsName),
      object: this.translateObject(triple.object, dsName),
    }));
  }

  private translateSubject(node: NamedNode | BlankNode, dsName?: string): NamedNode | BlankNode {
    if (node.termType === 'BlankNode') return node;
    return { termType: 'NamedNode', value: this.translateIri(node.value, dsName) };
  }

  private translatePredicate(node: NamedNode, dsName?: string): NamedNode {
    return { termType: 'NamedNode', value: this.translateIri(node.value, dsName) };
  }

  private translateObject(
    node: NamedNode | BlankNode | Literal,
    dsName?: string
  ): NamedNode | BlankNode | Literal {
    if (node.termType === 'BlankNode') return node;
    if (node.termType === 'Literal') return node;
    return { termType: 'NamedNode', value: this.translateIri(node.value, dsName) };
  }

  private translateIri(iri: string, dsName?: string): string {
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

    if (dsName && bestMatch && bestMatch.dsName !== dsName) {
      const exactSource = this.sources.find(
        (s) => s.dsName === dsName && s.originalPrefix && iri.startsWith(s.originalPrefix)
      );
      if (exactSource) {
        bestMatch = exactSource;
        matchedDsName = dsName;
      }
    }

    if (bestMatch && matchedDsName) {
      const externalPrefix = this.sourceExternalPrefixes.get(matchedDsName);
      if (externalPrefix) {
        const suffix = iri.slice(bestMatch.originalPrefix.length);
        const mappedSuffix = this.applyMappings(suffix, bestMatch.uriMappings, 'forward');
        return externalPrefix + mappedSuffix;
      }
    }

    return iri;
  }

  private applyMappings(
    value: string,
    mappings: [string, string][] | undefined,
    direction: 'forward' | 'reverse'
  ): string {
    if (!mappings || mappings.length === 0) return value;
    let result = value;
    for (const [from, to] of mappings) {
      const source = direction === 'forward' ? from : to;
      const target = direction === 'forward' ? to : from;
      if (source === '') continue;
      result = result.split(source).join(target);
    }
    return result;
  }

  translatePrefixes(prefixes: Record<string, string>, dsName?: string): Record<string, string> {
    const result: Record<string, string> = {};

    for (const [prefix, iri] of Object.entries(prefixes)) {
      const translated = this.translateIri(iri, dsName);
      result[prefix] = translated;
    }

    return result;
  }

  translateBase(base: string, dsName?: string): string | undefined {
    const translated = this.translateIri(base, dsName);
    return translated !== base ? translated : undefined;
  }

  translateUri(uri: string, dsName?: string): string {
    return this.translateIri(uri, dsName);
  }
}
