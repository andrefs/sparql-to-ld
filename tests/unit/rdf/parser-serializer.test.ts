import { describe, it, expect } from 'vitest';
import { RdfSerializer } from '../../../src/rdf/parser-serializer';
import { Dataset } from '../../../src/types/Resource';

describe('RdfSerializer', () => {
  describe('serializeHtml', () => {
    it('should generate HTML table with URIs as links', () => {
      const dataset: Dataset = [
        {
          subject: 'http://example.org/resource1',
          predicate: 'http://example.org/name',
          object: 'http://example.org/resource2',
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
          subject: 'http://internal.org/resource1',
          predicate: 'http://example.org/name',
          object: 'http://internal.org/resource2',
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
          subject: 'http://example.org/resource1',
          predicate: 'http://example.org/name',
          object: { value: 'Test Literal', language: 'en' },
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
          subject: 'http://example.org/resource1',
          predicate: 'http://example.org/name',
          object: '_:b0',
        },
      ];

      const serializer = new RdfSerializer();
      const result = serializer.serializeHtml(dataset);

      expect(result).toContain('_:b0');
      expect(result).not.toContain('<a href="_:b0">');
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
          subject: 'http://example.org/resource<test>',
          predicate: 'http://example.org/name',
          object: { value: 'Value with "quotes" and <special> chars' },
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
          subject: 'http://example.org/resource#section',
          predicate: 'http://example.org/name',
          object: 'http://example.org/other#frag',
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
          subject: 'http://example.org/resource#section',
          predicate: 'http://example.org/name',
          object: 'http://example.org/other#frag',
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
          subject: 'http://example.org/resource1',
          predicate: 'http://example.org/name',
          object: 'Value 1',
        },
        {
          subject: 'http://example.org/resource1',
          predicate: 'http://example.org/description',
          object: 'Value 2',
        },
        {
          subject: 'http://example.org/resource2',
          predicate: 'http://example.org/name',
          object: 'Value 3',
        },
      ];

      const serializer = new RdfSerializer();
      const result = serializer.serializeHtml(dataset);

      const occurrences = result.match(/<tr>/g);
      expect(occurrences?.length).toBe(4);
    });
  });
});
