import { describe, it, expect } from 'vitest';
import { deduplicateBlankNodes } from '../../../src/rdf/blank-node-deduplicator';
import { Dataset } from '../../../src/types/Resource';

describe('deduplicateBlankNodes', () => {
  it('does not collapse distinct IRIs with the same predicate/object', () => {
    const dataset: Dataset = [
      {
        subject: 'http://wordnet-rdf.princeton.edu/wn31/103443585-n',
        predicate: 'http://wordnet-rdf.princeton.edu/ontology#synset_member',
        object: 'http://wordnet-rdf.princeton.edu/wn31/glass-n',
      },
      {
        subject: 'http://wordnet-rdf.princeton.edu/wn31/103694158-n',
        predicate: 'http://wordnet-rdf.princeton.edu/ontology#synset_member',
        object: 'http://wordnet-rdf.princeton.edu/wn31/glass-n',
      },
    ];

    const result = deduplicateBlankNodes(dataset);

    expect(result).toHaveLength(2);
    expect(result).toEqual(dataset);
  });

  it('deduplicates blank nodes with identical signatures', () => {
    const dataset: Dataset = [
      {
        subject: '_:b0',
        predicate: 'http://example.org/predicate',
        object: 'http://example.org/object',
      },
      {
        subject: '_:b1',
        predicate: 'http://example.org/predicate',
        object: 'http://example.org/object',
      },
    ];

    const result = deduplicateBlankNodes(dataset);

    expect(result).toHaveLength(1);
    expect(result[0].subject).toBe('_:b0');
  });
});
