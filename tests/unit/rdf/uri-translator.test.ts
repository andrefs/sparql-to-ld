import { describe, it, expect } from 'vitest';
import { UriTranslator } from '../../../src/rdf/uri-translator';

describe('UriTranslator', () => {
  describe('translateRequestUri', () => {
    it('should translate external URI to internal URI using prefix mapping', () => {
      const translator = new UriTranslator([
        {
          dsName: 'test',
          endpoint: 'http://localhost:9999/test',
          internalPrefix: 'http://internal.org/',
          externalPrefix: 'http://external.org/',
        },
      ]);

      const result = translator.translateRequestUri('http://external.org/resource');
      expect(result).toBe('http://internal.org/resource');
    });

    it('should return original URI if no mapping matches', () => {
      const translator = new UriTranslator([
        {
          dsName: 'test',
          endpoint: 'http://localhost:9999/test',
          internalPrefix: 'http://internal.org/',
          externalPrefix: 'http://external.org/',
        },
      ]);

      const result = translator.translateRequestUri('http://other.org/resource');
      expect(result).toBe('http://other.org/resource');
    });

    it('should handle multiple mappings', () => {
      const translator = new UriTranslator([
        {
          dsName: 'test1',
          endpoint: 'http://localhost:9999/test1',
          internalPrefix: 'http://internal1.org/',
          externalPrefix: 'http://external1.org/',
        },
        {
          dsName: 'test2',
          endpoint: 'http://localhost:9999/test2',
          internalPrefix: 'http://internal2.org/',
          externalPrefix: 'http://external2.org/',
        },
      ]);

      expect(translator.translateRequestUri('http://external1.org/resource')).toBe(
        'http://internal1.org/resource'
      );
      expect(translator.translateRequestUri('http://external2.org/resource')).toBe(
        'http://internal2.org/resource'
      );
    });

    it('should translate using longest prefix match', () => {
      const translator = new UriTranslator([
        {
          dsName: 'test',
          endpoint: 'http://localhost:9999/test',
          internalPrefix: 'http://internal.org/',
          externalPrefix: 'http://external.org/',
        },
        {
          dsName: 'specific',
          endpoint: 'http://localhost:9999/specific',
          internalPrefix: 'http://internal.org/specific/',
          externalPrefix: 'http://external.org/specific/',
        },
      ]);

      const result = translator.translateRequestUri('http://external.org/specific/resource');
      expect(result).toBe('http://internal.org/specific/resource');
    });
  });

  describe('translateDataset', () => {
    it('should translate all URIs in triples from internal to external', () => {
      const translator = new UriTranslator([
        {
          dsName: 'test',
          endpoint: 'http://localhost:9999/test',
          internalPrefix: 'http://internal.org/',
          externalPrefix: 'http://external.org/',
        },
      ]);

      const dataset = [
        {
          subject: 'http://internal.org/subject',
          predicate: 'http://internal.org/predicate',
          object: 'http://internal.org/object',
        },
      ];

      const result = translator.translateDataset(dataset);
      expect(result).toEqual([
        {
          subject: 'http://external.org/subject',
          predicate: 'http://external.org/predicate',
          object: 'http://external.org/object',
        },
      ]);
    });

    it('should translate blank nodes unchanged', () => {
      const translator = new UriTranslator([
        {
          dsName: 'test',
          endpoint: 'http://localhost:9999/test',
          internalPrefix: 'http://internal.org/',
          externalPrefix: 'http://external.org/',
        },
      ]);

      const dataset = [
        {
          subject: '_:b0',
          predicate: 'http://internal.org/predicate',
          object: 'http://internal.org/object',
        },
      ];

      const result = translator.translateDataset(dataset);
      expect(result[0].subject).toBe('_:b0');
    });

    it('should translate literals with IRIs in value? (probably not needed - literals contain plain text)', () => {
      // This is a design decision: we likely don't translate URIs inside literal values
      const translator = new UriTranslator([
        {
          dsName: 'test',
          endpoint: 'http://localhost:9999/test',
          internalPrefix: 'http://internal.org/',
          externalPrefix: 'http://external.org/',
        },
      ]);

      const dataset = [
        {
          subject: 'http://internal.org/s',
          predicate: 'http://internal.org/p',
          object: {
            value: 'http://internal.org/in-text',
            datatype: 'http://www.w3.org/2001/XMLSchema#string',
          },
        },
      ];

      const result = translator.translateDataset(dataset);
      // Literal value should NOT be translated (it's just text)
      expect((result[0].object as any).value).toBe('http://internal.org/in-text');
    });

    it('should handle empty dataset', () => {
      const translator = new UriTranslator([
        {
          dsName: 'test',
          endpoint: 'http://localhost:9999/test',
          internalPrefix: 'http://internal.org/',
          externalPrefix: 'http://external.org/',
        },
      ]);

      const result = translator.translateDataset([]);
      expect(result).toEqual([]);
    });

    it('should skip translation when disabled via flag', () => {
      const translator = new UriTranslator([
        {
          dsName: 'test',
          endpoint: 'http://localhost:9999/test',
          internalPrefix: 'http://internal.org/',
          externalPrefix: 'http://external.org/',
        },
      ]);

      const dataset = [
        {
          subject: 'http://internal.org/subject',
          predicate: 'http://internal.org/predicate',
          object: 'http://internal.org/object',
        },
      ];

      const result = translator.translateDataset(dataset, { translateResponse: false });
      expect(result).toEqual(dataset); // unchanged
    });
  });

  describe('translatePrefixes', () => {
    it('should translate PREFIX declarations in Turtle-like format', () => {
      const translator = new UriTranslator([
        {
          dsName: 'test',
          endpoint: 'http://localhost:9999/test',
          internalPrefix: 'http://internal.org/',
          externalPrefix: 'http://external.org/',
        },
      ]);

      const prefixes = {
        ex: 'http://internal.org/example',
        base: 'http://internal.org/base/',
      };

      const result = translator.translatePrefixes(prefixes);
      expect(result).toEqual({
        ex: 'http://external.org/example',
        base: 'http://external.org/base/',
      });
    });

    it('should leave prefixes unchanged if no mapping matches', () => {
      const translator = new UriTranslator([
        {
          dsName: 'test',
          endpoint: 'http://localhost:9999/test',
          internalPrefix: 'http://internal.org/',
          externalPrefix: 'http://external.org/',
        },
      ]);

      const prefixes = {
        other: 'http://other.org/example',
      };

      const result = translator.translatePrefixes(prefixes);
      expect(result).toEqual(prefixes);
    });
  });

  describe('translateBase', () => {
    it('should translate BASE IRI', () => {
      const translator = new UriTranslator([
        {
          dsName: 'test',
          endpoint: 'http://localhost:9999/test',
          internalPrefix: 'http://internal.org/',
          externalPrefix: 'http://external.org/',
        },
      ]);

      const result = translator.translateBase('http://internal.org/base/');
      expect(result).toBe('http://external.org/base/');
    });

    it('should return undefined if no base or no mapping', () => {
      const translator = new UriTranslator([
        {
          dsName: 'test',
          endpoint: 'http://localhost:9999/test',
          internalPrefix: 'http://internal.org/',
          externalPrefix: 'http://external.org/',
        },
      ]);

      expect(translator.translateBase('http://other.org/base/')).toBeUndefined();
    });
  });
});
