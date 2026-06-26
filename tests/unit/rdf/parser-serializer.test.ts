import { describe, it, expect } from 'vitest';
import { RdfSerializer, RdfParser } from '../../../src/rdf/parser-serializer';
import { Dataset } from '../../../src/types/Resource';

describe('RdfParser', () => {
  it('should parse Turtle with blank nodes preserving term types', () => {
    const turtle = `
      @prefix : <http://example.org/> .
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
      :Employee owl:intersectionOf [ rdf:first :Person ; rdf:rest () ] .
    `;
    const parser = new RdfParser();
    const dataset = parser.parse(turtle, 'text/turtle');

    const intersectionTriple = dataset.find(
      (t) => t.predicate.value === 'http://www.w3.org/2002/07/owl#intersectionOf'
    );

    expect(intersectionTriple).toBeDefined();
    expect(intersectionTriple!.object.termType).toBe('BlankNode');

    const firstTriple = dataset.find(
      (t) => t.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first'
    );
    expect(firstTriple).toBeDefined();
    expect(firstTriple!.subject.termType).toBe('BlankNode');
    expect(firstTriple!.subject.value).toMatch(/^n3-\d+$/);
  });
});

describe('RdfSerializer', () => {
  describe('serialize', () => {
    it('should serialize blank nodes correctly', () => {
      const dataset: Dataset = [
        {
          subject: { termType: 'BlankNode', value: 'n3-128' },
          predicate: {
            termType: 'NamedNode',
            value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first',
          },
          object: { termType: 'NamedNode', value: 'http://example.org/Person' },
        },
        {
          subject: { termType: 'BlankNode', value: 'n3-128' },
          predicate: {
            termType: 'NamedNode',
            value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest',
          },
          object: { termType: 'BlankNode', value: 'n3-129' },
        },
      ];

      const serializer = new RdfSerializer();
      const result = serializer.serialize(dataset, 'text/turtle');

      expect(result).toContain('_:n3-128');
      expect(result).toContain('_:n3-129');
      expect(result).not.toContain('<n3-128>');
    });

    it('should handle labeled blank nodes (_:b0 style)', () => {
      const dataset: Dataset = [
        {
          subject: { termType: 'BlankNode', value: 'b0' },
          predicate: { termType: 'NamedNode', value: 'http://example.org/p' },
          object: { termType: 'NamedNode', value: 'http://example.org/o' },
        },
      ];

      const serializer = new RdfSerializer();
      const result = serializer.serialize(dataset, 'text/turtle');

      expect(result).toContain('_:b0');
      expect(result).not.toContain('<b0>');
    });
  });

  describe('serializeHtml', () => {
    it('should generate HTML table with URIs as links', () => {
      const dataset: Dataset = [
        {
          subject: { termType: 'NamedNode', value: 'http://example.org/resource1' },
          predicate: { termType: 'NamedNode', value: 'http://example.org/name' },
          object: { termType: 'NamedNode', value: 'http://example.org/resource2' },
        },
      ];

      const serializer = new RdfSerializer();
      const result = serializer.serializeHtml(dataset);

      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('<th>Subject</th>');
      expect(result).toContain('<th>Predicate</th>');
      expect(result).toContain('<th>Object</th>');
      expect(result).toContain('http://example.org/resource1');
      expect(result).toContain('http://example.org/resource2');
      expect(result).toContain('<a href="http://example.org/resource1">');
      expect(result).toContain('<a href="http://example.org/resource2">');
    });

    it('should use translated URIs for href when provided', () => {
      const dataset: Dataset = [
        {
          subject: { termType: 'NamedNode', value: 'http://internal.org/resource1' },
          predicate: { termType: 'NamedNode', value: 'http://example.org/name' },
          object: { termType: 'NamedNode', value: 'http://internal.org/resource2' },
        },
      ];

      const translatedUris = new Map<string, string>([
        ['http://internal.org/resource1', 'http://localhost:3000/ld/test/resource1'],
        ['http://internal.org/resource2', 'http://localhost:3000/ld/test/resource2'],
      ]);

      const serializer = new RdfSerializer();
      const result = serializer.serializeHtml(dataset, translatedUris);

      expect(result).toContain('>http://internal.org/resource1<');
      expect(result).toContain('href="http://localhost:3000/ld/test/resource1"');
      expect(result).toContain('>http://internal.org/resource2<');
      expect(result).toContain('href="http://localhost:3000/ld/test/resource2"');
    });

    it('should display literals without link', () => {
      const dataset: Dataset = [
        {
          subject: { termType: 'NamedNode', value: 'http://example.org/resource1' },
          predicate: { termType: 'NamedNode', value: 'http://example.org/name' },
          object: { termType: 'Literal', value: 'Test Literal', language: 'en' },
        },
      ];

      const serializer = new RdfSerializer();
      const result = serializer.serializeHtml(dataset);

      expect(result).toContain('"Test Literal"');
      expect(result).toContain('class="literal"');
      expect(result).not.toContain('<a href="Test Literal">');
    });

    it('should handle blank nodes without link', () => {
      const dataset: Dataset = [
        {
          subject: { termType: 'NamedNode', value: 'http://example.org/resource1' },
          predicate: { termType: 'NamedNode', value: 'http://example.org/name' },
          object: { termType: 'BlankNode', value: 'b0' },
        },
      ];

      const serializer = new RdfSerializer();
      const result = serializer.serializeHtml(dataset);

      expect(result).toContain('b0');
      expect(result).not.toContain('<a href="b0">');
    });

    it('should show "No results found" for empty dataset', () => {
      const dataset: Dataset = [];

      const serializer = new RdfSerializer();
      const result = serializer.serializeHtml(dataset);

      expect(result).toContain('No results found');
      expect(result).toContain('<th>Subject</th>');
    });

    it('should escape HTML special characters', () => {
      const dataset: Dataset = [
        {
          subject: { termType: 'NamedNode', value: 'http://example.org/resource<test>' },
          predicate: { termType: 'NamedNode', value: 'http://example.org/name' },
          object: { termType: 'Literal', value: 'Value with "quotes" and <special> chars' },
        },
      ];

      const serializer = new RdfSerializer();
      const result = serializer.serializeHtml(dataset);

      expect(result).toContain('&lt;test&gt;');
      expect(result).toContain('&quot;quotes&quot;');
      expect(result).toContain('&lt;special&gt;');
      expect(result).not.toContain('<test>');
      expect(result).not.toContain('"quotes"');
    });

    it('should escape # character in URIs', () => {
      const dataset: Dataset = [
        {
          subject: { termType: 'NamedNode', value: 'http://example.org/resource#section' },
          predicate: { termType: 'NamedNode', value: 'http://example.org/name' },
          object: { termType: 'NamedNode', value: 'http://example.org/other#frag' },
        },
      ];

      const serializer = new RdfSerializer();
      const result = serializer.serializeHtml(dataset);

      expect(result).toContain('&#35;');
      expect(result).toContain('http://example.org/resource&#35;section');
      expect(result).not.toContain('http://example.org/resource#section');
    });

    it('should URL-encode # in href attributes', () => {
      const dataset: Dataset = [
        {
          subject: { termType: 'NamedNode', value: 'http://example.org/resource#section' },
          predicate: { termType: 'NamedNode', value: 'http://example.org/name' },
          object: { termType: 'NamedNode', value: 'http://example.org/other#frag' },
        },
      ];

      const serializer = new RdfSerializer();
      const result = serializer.serializeHtml(dataset);

      expect(result).toContain('href="http://example.org/resource%23section"');
      expect(result).toContain('href="http://example.org/other%23frag"');
    });

    it('should handle multiple triples in table', () => {
      const dataset: Dataset = [
        {
          subject: { termType: 'NamedNode', value: 'http://example.org/resource1' },
          predicate: { termType: 'NamedNode', value: 'http://example.org/name' },
          object: { termType: 'Literal', value: 'Value 1' },
        },
        {
          subject: { termType: 'NamedNode', value: 'http://example.org/resource1' },
          predicate: { termType: 'NamedNode', value: 'http://example.org/description' },
          object: { termType: 'Literal', value: 'Value 2' },
        },
        {
          subject: { termType: 'NamedNode', value: 'http://example.org/resource2' },
          predicate: { termType: 'NamedNode', value: 'http://example.org/name' },
          object: { termType: 'Literal', value: 'Value 3' },
        },
      ];

      const serializer = new RdfSerializer();
      const result = serializer.serializeHtml(dataset);

      const occurrences = result.match(/<tr>/g);
      expect(occurrences?.length).toBe(4);
    });
  });
});
