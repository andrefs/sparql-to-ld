import { describe, it, expect } from 'vitest';
import { UriTranslator } from '../../../src/rdf/uri-translator';

describe('UriTranslator', () => {
  describe('translateRequestUri', () => {
    it('should translate external URI to internal URI using prefix mapping', () => {
      const translator = new UriTranslator([
        {
          dsName: 'test',
          originalPrefix: 'http://internal.org/',
          endpoints: [{ type: 'sparql', mode: 'describe', url: 'http://localhost:9999/test' }],
        },
      ]);

      const result = translator.translateRequestUri('http://localhost:3000/ld/test/resource');
      expect(result).toBe('http://internal.org/resource');
    });

    it('should return original URI if no mapping matches', () => {
      const translator = new UriTranslator([
        {
          dsName: 'test',
          originalPrefix: 'http://internal.org/',
          endpoints: [{ type: 'sparql', mode: 'describe', url: 'http://localhost:9999/test' }],
        },
      ]);

      const result = translator.translateRequestUri('http://other.org/resource');
      expect(result).toBe('http://other.org/resource');
    });

    it('should handle multiple mappings', () => {
      const translator = new UriTranslator([
        {
          dsName: 'test1',
          originalPrefix: 'http://internal1.org/',
          endpoints: [{ type: 'sparql', mode: 'describe', url: 'http://localhost:9999/test1' }],
        },
        {
          dsName: 'test2',
          originalPrefix: 'http://internal2.org/',
          endpoints: [{ type: 'sparql', mode: 'describe', url: 'http://localhost:9999/test2' }],
        },
      ]);

      expect(translator.translateRequestUri('http://localhost:3000/ld/test1/resource')).toBe(
        'http://internal1.org/resource'
      );
      expect(translator.translateRequestUri('http://localhost:3000/ld/test2/resource')).toBe(
        'http://internal2.org/resource'
      );
    });

    it('should translate using longest prefix match', () => {
      const translator = new UriTranslator([
        {
          dsName: 'test',
          originalPrefix: 'http://internal.org/',
          endpoints: [{ type: 'sparql', mode: 'describe', url: 'http://localhost:9999/test' }],
        },
        {
          dsName: 'specific',
          originalPrefix: 'http://internal.org/specific/',
          endpoints: [{ type: 'sparql', mode: 'describe', url: 'http://localhost:9999/specific' }],
        },
      ]);

      const result = translator.translateRequestUri('http://localhost:3000/ld/specific/resource');
      expect(result).toBe('http://internal.org/specific/resource');
    });

    it('should normalize localhost and 127.0.0.1 as equivalent', () => {
      const translator = new UriTranslator([
        {
          dsName: 'dbpedia',
          originalPrefix: 'http://dbpedia.org/',
          endpoints: [
            { type: 'sparql', mode: 'describe', url: 'http://localhost:3030/dbpedia/sparql' },
          ],
        },
      ]);

      const result = translator.translateRequestUri(
        'http://127.0.0.1:3000/ld/dbpedia/resource/Cheddar'
      );
      expect(result).toBe('http://dbpedia.org/resource/Cheddar');
    });

    it('should apply uriMappings in reverse direction for incoming requests', () => {
      const translator = new UriTranslator([
        {
          dsName: 'test',
          originalPrefix: 'http://internal.org/',
          uriMappings: [['#', '%23']],
          endpoints: [{ type: 'sparql', mode: 'describe', url: 'http://localhost:9999/test' }],
        },
      ]);

      const result = translator.translateRequestUri(
        'http://localhost:3000/ld/test/resource%23section'
      );
      expect(result).toBe('http://internal.org/resource#section');
    });

    it('should apply uriMappings in order for incoming requests', () => {
      const translator = new UriTranslator([
        {
          dsName: 'test',
          originalPrefix: 'http://internal.org/',
          uriMappings: [
            ['_', '%5F'],
            ['a', 'b'],
          ],
          endpoints: [{ type: 'sparql', mode: 'describe', url: 'http://localhost:9999/test' }],
        },
      ]);

      const result = translator.translateRequestUri('http://localhost:3000/ld/test/a%5Ffile');
      expect(result).toBe('http://internal.org/a_file');
    });
  });

  describe('translateDataset', () => {
    it('should translate all URIs in triples from internal to external', () => {
      const translator = new UriTranslator([
        {
          dsName: 'test',
          originalPrefix: 'http://internal.org/',
          endpoints: [{ type: 'sparql', mode: 'describe', url: 'http://localhost:9999/test' }],
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
          subject: 'http://localhost:3000/ld/test/subject',
          predicate: 'http://localhost:3000/ld/test/predicate',
          object: 'http://localhost:3000/ld/test/object',
        },
      ]);
    });

    it('should translate blank nodes unchanged', () => {
      const translator = new UriTranslator([
        {
          dsName: 'test',
          originalPrefix: 'http://internal.org/',
          endpoints: [{ type: 'sparql', mode: 'describe', url: 'http://localhost:9999/test' }],
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
          originalPrefix: 'http://internal.org/',
          endpoints: [{ type: 'sparql', mode: 'describe', url: 'http://localhost:9999/test' }],
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
          originalPrefix: 'http://internal.org/',
          endpoints: [{ type: 'sparql', mode: 'describe', url: 'http://localhost:9999/test' }],
        },
      ]);

      const result = translator.translateDataset([]);
      expect(result).toEqual([]);
    });

    it('should skip translation when disabled via flag', () => {
      const translator = new UriTranslator([
        {
          dsName: 'test',
          originalPrefix: 'http://internal.org/',
          endpoints: [{ type: 'sparql', mode: 'describe', url: 'http://localhost:9999/test' }],
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

    it('should apply uriMappings in order to translated IRIs', () => {
      const translator = new UriTranslator([
        {
          dsName: 'test',
          originalPrefix: 'http://internal.org/',
          uriMappings: [['#', '%23']],
          endpoints: [{ type: 'sparql', mode: 'describe', url: 'http://localhost:9999/test' }],
        },
      ]);

      const dataset = [
        {
          subject: 'http://internal.org/resource#section',
          predicate: 'http://internal.org/predicate',
          object: 'http://internal.org/object#frag',
        },
      ];

      const result = translator.translateDataset(dataset);
      expect(result).toEqual([
        {
          subject: 'http://localhost:3000/ld/test/resource%23section',
          predicate: 'http://localhost:3000/ld/test/predicate',
          object: 'http://localhost:3000/ld/test/object%23frag',
        },
      ]);
    });
  });

  describe('translatePrefixes', () => {
    it('should translate PREFIX declarations in Turtle-like format', () => {
      const translator = new UriTranslator([
        {
          dsName: 'test',
          originalPrefix: 'http://internal.org/',
          endpoints: [{ type: 'sparql', mode: 'describe', url: 'http://localhost:9999/test' }],
        },
      ]);

      const prefixes = {
        ex: 'http://internal.org/example',
        base: 'http://internal.org/base/',
      };

      const result = translator.translatePrefixes(prefixes);
      expect(result).toEqual({
        ex: 'http://localhost:3000/ld/test/example',
        base: 'http://localhost:3000/ld/test/base/',
      });
    });

    it('should leave prefixes unchanged if no mapping matches', () => {
      const translator = new UriTranslator([
        {
          dsName: 'test',
          originalPrefix: 'http://internal.org/',
          endpoints: [{ type: 'sparql', mode: 'describe', url: 'http://localhost:9999/test' }],
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
          originalPrefix: 'http://internal.org/',
          endpoints: [{ type: 'sparql', mode: 'describe', url: 'http://localhost:9999/test' }],
        },
      ]);

      const result = translator.translateBase('http://internal.org/base/');
      expect(result).toBe('http://localhost:3000/ld/test/base/');
    });

    it('should return undefined if no base or no mapping', () => {
      const translator = new UriTranslator([
        {
          dsName: 'test',
          originalPrefix: 'http://internal.org/',
          endpoints: [{ type: 'sparql', mode: 'describe', url: 'http://localhost:9999/test' }],
        },
      ]);

      expect(translator.translateBase('http://other.org/base/')).toBeUndefined();
    });
  });
});
