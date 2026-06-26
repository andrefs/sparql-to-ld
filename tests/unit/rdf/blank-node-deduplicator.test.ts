import { describe, it, expect } from 'vitest';
import { deduplicateBlankNodes } from '../../../src/rdf/blank-node-deduplicator';
import { Dataset } from '../../../src/types/Resource';

describe('deduplicateBlankNodes', () => {
  it('does not collapse distinct IRIs with the same predicate/object', () => {
    const dataset: Dataset = [
      {
        subject: {
          termType: 'NamedNode',
          value: 'http://wordnet-rdf.princeton.edu/wn31/103443585-n',
        },
        predicate: {
          termType: 'NamedNode',
          value: 'http://wordnet-rdf.princeton.edu/ontology#synset_member',
        },
        object: { termType: 'NamedNode', value: 'http://wordnet-rdf.princeton.edu/wn31/glass-n' },
      },
      {
        subject: {
          termType: 'NamedNode',
          value: 'http://wordnet-rdf.princeton.edu/wn31/103694158-n',
        },
        predicate: {
          termType: 'NamedNode',
          value: 'http://wordnet-rdf.princeton.edu/ontology#synset_member',
        },
        object: { termType: 'NamedNode', value: 'http://wordnet-rdf.princeton.edu/wn31/glass-n' },
      },
    ];

    const result = deduplicateBlankNodes(dataset);

    expect(result).toHaveLength(2);
    expect(result).toEqual(dataset);
  });

  it('deduplicates blank nodes with identical signatures', () => {
    const dataset: Dataset = [
      {
        subject: { termType: 'BlankNode', value: 'b0' },
        predicate: { termType: 'NamedNode', value: 'http://example.org/predicate' },
        object: { termType: 'NamedNode', value: 'http://example.org/object' },
      },
      {
        subject: { termType: 'BlankNode', value: 'b1' },
        predicate: { termType: 'NamedNode', value: 'http://example.org/predicate' },
        object: { termType: 'NamedNode', value: 'http://example.org/object' },
      },
    ];

    const result = deduplicateBlankNodes(dataset);

    expect(result).toHaveLength(1);
    expect(result[0].subject).toEqual({ termType: 'BlankNode', value: 'b0' });
  });

  it('handles n3-style blank node IDs', () => {
    const dataset: Dataset = [
      {
        subject: { termType: 'BlankNode', value: 'n3-128' },
        predicate: { termType: 'NamedNode', value: 'http://example.org/p' },
        object: { termType: 'NamedNode', value: 'http://example.org/o' },
      },
    ];

    const result = deduplicateBlankNodes(dataset);

    expect(result).toHaveLength(1);
    expect(result[0].subject).toEqual({ termType: 'BlankNode', value: 'n3-128' });
  });
});
