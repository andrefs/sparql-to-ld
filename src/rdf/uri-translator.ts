import { UriMapping } from '../types/Resource.js';
import { Dataset, Iri, BlankNode, Literal } from '../types/Resource.js';

export class UriTranslator {
  private mappings: UriMapping[];

  constructor(mappings: UriMapping[]) {
    this.mappings = mappings;
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

  /**
   * Find the mapping that matches a given external IRI.
   * Returns the mapping with the longest matching external prefix.
   */
  findMappingForIri(uri: string): UriMapping | undefined {
    const normalizedUri = this.normalizeHost(uri);
    let bestMatch: UriMapping | undefined;
    let maxLength = -1;

    for (const mapping of this.mappings) {
      const normalizedPrefix = this.normalizeHost(mapping.externalPrefix);
      if (normalizedUri.startsWith(normalizedPrefix)) {
        const prefixLength = normalizedPrefix.length;
        if (prefixLength > maxLength) {
          maxLength = prefixLength;
          bestMatch = mapping;
        }
      }
    }

    return bestMatch;
  }

  /**
   * Translate a request URI from external to internal format.
   * Finds the mapping where the external prefix matches and replaces with internal prefix.
   */
  translateRequestUri(uri: string): string {
    const normalizedUri = this.normalizeHost(uri);

    let bestMatch: UriMapping | null = null;
    let maxLength = -1;
    let matchedPrefixLength = 0;

    for (const mapping of this.mappings) {
      const normalizedPrefix = this.normalizeHost(mapping.externalPrefix);
      if (normalizedUri.startsWith(normalizedPrefix)) {
        const prefixLength = normalizedPrefix.length;
        if (prefixLength > maxLength) {
          maxLength = prefixLength;
          bestMatch = mapping;
          matchedPrefixLength = mapping.externalPrefix.length;
        }
      }
    }

    if (bestMatch) {
      return bestMatch.internalPrefix + uri.slice(matchedPrefixLength);
    }

    return uri;
  }

  /**
   * Translate a dataset from internal to external format.
   * Rewrites all IRIs in triples (subject, predicate, object) according to mappings.
   * Blank nodes and literals are left unchanged.
   */
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
    let bestMatch: UriMapping | null = null;
    let maxLength = -1;

    for (const mapping of this.mappings) {
      if (iri.startsWith(mapping.internalPrefix)) {
        const prefixLength = mapping.internalPrefix.length;
        if (prefixLength > maxLength) {
          maxLength = prefixLength;
          bestMatch = mapping;
        }
      }
    }

    if (bestMatch) {
      return bestMatch.externalPrefix + iri.slice(bestMatch.internalPrefix.length);
    }

    return iri;
  }

  translatePrefixes(prefixes: Record<string, string>): Record<string, string> {
    const result: Record<string, string> = {};

    for (const [prefix, iri] of Object.entries(prefixes)) {
      const translated = this.translateIri(iri);
      if (translated !== iri) {
        result[prefix] = translated;
      } else {
        result[prefix] = iri;
      }
    }

    return result;
  }

  translateBase(base: string): string | undefined {
    const translated = this.translateIri(base);
    return translated !== base ? translated : undefined;
  }
}
