import { UriMapping } from '../types/Resource.js';
import { Dataset, Iri, BlankNode, Literal } from '../types/Resource.js';

export class UriTranslator {
  private mappings: UriMapping[];

  constructor(mappings: UriMapping[]) {
    this.mappings = mappings;
  }

  /**
   * Translate a request URI from external to internal format.
   * Finds the mapping where the external prefix matches and replaces with internal prefix.
   */
  translateRequestUri(uri: string): string {
    // Find the longest matching external prefix
    let bestMatch: UriMapping | null = null;
    let maxLength = -1;

    for (const mapping of this.mappings) {
      if (uri.startsWith(mapping.externalPrefix)) {
        const prefixLength = mapping.externalPrefix.length;
        if (prefixLength > maxLength) {
          maxLength = prefixLength;
          bestMatch = mapping;
        }
      }
    }

    if (bestMatch) {
      return bestMatch.internalPrefix + uri.slice(bestMatch.externalPrefix.length);
    }

    return uri;
  }

  /**
   * Translate a dataset from internal to external format.
   * Rewrites all IRIs in triples (subject, predicate, object) according to mappings.
   * Blank nodes and literals are left unchanged.
   */
  translateDataset(dataset: Dataset, options?: { translateResponse?: boolean }): Dataset {
    // If translation is disabled, return dataset as-is
    if (options?.translateResponse === false) {
      return dataset;
    }

    return dataset.map((triple) => ({
      subject: this.translateNode(triple.subject) as Iri | BlankNode,
      predicate: this.translateIri(triple.predicate),
      object: this.translateNode(triple.object),
    }));
  }

  /**
   * Translate a single node (IRI, blank node, or literal)
   */
  private translateNode(node: Iri | BlankNode | Literal): Iri | BlankNode | Literal {
    if (this.isBlankNode(node) || this.isLiteral(node)) {
      return node; // blank nodes and literals unchanged
    }
    // It's an IRI string
    return this.translateIri(node);
  }

  /**
   * Check if node is a blank node identifier
   */
  private isBlankNode(node: Iri | BlankNode | Literal): node is BlankNode {
    return typeof node === 'string' && node.startsWith('_:');
  }

  /**
   * Check if node is a literal
   */
  private isLiteral(node: Iri | BlankNode | Literal): node is Literal {
    return typeof node !== 'string' && 'value' in node;
  }

  /**
   * Translate an IRI from internal to external format
   */
  private translateIri(iri: Iri): Iri {
    // Find the longest matching internal prefix
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

  /**
   * Translate prefix declarations (e.g., in Turtle: @prefix ex: <http://internal.org/>)
   */
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

  /**
   * Translate BASE directive
   */
  translateBase(base: string): string | undefined {
    const translated = this.translateIri(base);
    return translated !== base ? translated : undefined;
  }
}
