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
          subject: { termType: 'NamedNode', value: 'http://internal.org/subject' },
          predicate: { termType: 'NamedNode', value: 'http://internal.org/predicate' },
          object: { termType: 'NamedNode', value: 'http://internal.org/object' },
        },
      ];

      const result = translator.translateDataset(dataset);
      expect(result).toEqual([
        {
          subject: { termType: 'NamedNode', value: 'http://localhost:3000/ld/test/subject' },
          predicate: { termType: 'NamedNode', value: 'http://localhost:3000/ld/test/predicate' },
          object: { termType: 'NamedNode', value: 'http://localhost:3000/ld/test/object' },
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
          subject: { termType: 'BlankNode', value: 'b0' },
          predicate: { termType: 'NamedNode', value: 'http://internal.org/predicate' },
          object: { termType: 'NamedNode', value: 'http://internal.org/object' },
        },
      ];

      const result = translator.translateDataset(dataset);
      expect(result[0].subject).toEqual({ termType: 'BlankNode', value: 'b0' });
    });

    it('should translate n3-style blank nodes unchanged', () => {
      const translator = new UriTranslator([
        {
          dsName: 'test',
          originalPrefix: 'http://internal.org/',
          endpoints: [{ type: 'sparql', mode: 'describe', url: 'http://localhost:9999/test' }],
        },
      ]);

      const dataset = [
        {
          subject: { termType: 'BlankNode', value: 'n3-128' },
          predicate: { termType: 'NamedNode', value: 'http://internal.org/predicate' },
          object: { termType: 'BlankNode', value: 'n3-129' },
        },
      ];

      const result = translator.translateDataset(dataset);
      expect(result[0].subject).toEqual({ termType: 'BlankNode', value: 'n3-128' });
      expect(result[0].object).toEqual({ termType: 'BlankNode', value: 'n3-129' });
    });

    it('should translate literals with IRIs in value? (probably not needed - literals contain plain text)', () => {
      const translator = new UriTranslator([
        {
          dsName: 'test',
          originalPrefix: 'http://internal.org/',
          endpoints: [{ type: 'sparql', mode: 'describe', url: 'http://localhost:9999/test' }],
        },
      ]);

      const dataset = [
        {
          subject: { termType: 'NamedNode', value: 'http://internal.org/s' },
          predicate: { termType: 'NamedNode', value: 'http://internal.org/p' },
          object: {
            termType: 'Literal',
            value: 'http://internal.org/in-text',
            datatype: 'http://www.w3.org/2001/XMLSchema#string',
          },
        },
      ];

      const result = translator.translateDataset(dataset);
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
          subject: { termType: 'NamedNode', value: 'http://internal.org/subject' },
          predicate: { termType: 'NamedNode', value: 'http://internal.org/predicate' },
          object: { termType: 'NamedNode', value: 'http://internal.org/object' },
        },
      ];

      const result = translator.translateDataset(dataset, { translateResponse: false });
      expect(result).toEqual(dataset);
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
          subject: { termType: 'NamedNode', value: 'http://internal.org/resource#section' },
          predicate: { termType: 'NamedNode', value: 'http://internal.org/predicate' },
          object: { termType: 'NamedNode', value: 'http://internal.org/object#frag' },
        },
      ];

      const result = translator.translateDataset(dataset);
      expect(result).toEqual([
        {
          subject: {
            termType: 'NamedNode',
            value: 'http://localhost:3000/ld/test/resource%23section',
          },
          predicate: { termType: 'NamedNode', value: 'http://localhost:3000/ld/test/predicate' },
          object: { termType: 'NamedNode', value: 'http://localhost:3000/ld/test/object%23frag' },
        },
      ]);
    });

    it('should use the correct source when dsName is provided and multiple sources share originalPrefix', () => {
      const translator = new UriTranslator([
        {
          dsName: 'synth01',
          originalPrefix: 'http://example.org/rdf/',
          endpoints: [{ type: 'sparql', mode: 'describe', url: 'http://localhost:3030/s1/sparql' }],
        },
        {
          dsName: 'synth02',
          originalPrefix: 'http://example.org/rdf/',
          endpoints: [{ type: 'sparql', mode: 'describe', url: 'http://localhost:3030/s2/sparql' }],
        },
      ]);

      const dataset = [
        {
          subject: { termType: 'NamedNode', value: 'http://example.org/rdf/subject' },
          predicate: { termType: 'NamedNode', value: 'http://example.org/rdf/predicate' },
          object: { termType: 'NamedNode', value: 'http://example.org/rdf/object' },
        },
      ];

      const result = translator.translateDataset(dataset, { dsName: 'synth02' });
      expect(result).toEqual([
        {
          subject: { termType: 'NamedNode', value: 'http://localhost:3000/ld/synth02/subject' },
          predicate: { termType: 'NamedNode', value: 'http://localhost:3000/ld/synth02/predicate' },
          object: { termType: 'NamedNode', value: 'http://localhost:3000/ld/synth02/object' },
        },
      ]);
    });

    it('should fall back to first longest-prefix match when dsName is not provided', () => {
      const translator = new UriTranslator([
        {
          dsName: 'synth01',
          originalPrefix: 'http://example.org/rdf/',
          endpoints: [{ type: 'sparql', mode: 'describe', url: 'http://localhost:3030/s1/sparql' }],
        },
        {
          dsName: 'synth02',
          originalPrefix: 'http://example.org/rdf/',
          endpoints: [{ type: 'sparql', mode: 'describe', url: 'http://localhost:3030/s2/sparql' }],
        },
      ]);

      const dataset = [
        {
          subject: { termType: 'NamedNode', value: 'http://example.org/rdf/subject' },
          predicate: { termType: 'NamedNode', value: 'http://example.org/rdf/predicate' },
          object: { termType: 'NamedNode', value: 'http://example.org/rdf/object' },
        },
      ];

      const result = translator.translateDataset(dataset);
      expect(result).toEqual([
        {
          subject: { termType: 'NamedNode', value: 'http://localhost:3000/ld/synth01/subject' },
          predicate: { termType: 'NamedNode', value: 'http://localhost:3000/ld/synth01/predicate' },
          object: { termType: 'NamedNode', value: 'http://localhost:3000/ld/synth01/object' },
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

    it('should use the correct source when dsName is provided and sources share originalPrefix', () => {
      const translator = new UriTranslator([
        {
          dsName: 'synth01',
          originalPrefix: 'http://example.org/rdf/',
          endpoints: [{ type: 'sparql', mode: 'describe', url: 'http://localhost:3030/s1/sparql' }],
        },
        {
          dsName: 'synth02',
          originalPrefix: 'http://example.org/rdf/',
          endpoints: [{ type: 'sparql', mode: 'describe', url: 'http://localhost:3030/s2/sparql' }],
        },
      ]);

      const prefixes = {
        ex: 'http://example.org/rdf/',
      };

      const result = translator.translatePrefixes(prefixes, 'synth02');
      expect(result).toEqual({
        ex: 'http://localhost:3000/ld/synth02/',
      });
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

    it('should use the correct source when dsName is provided and sources share originalPrefix', () => {
      const translator = new UriTranslator([
        {
          dsName: 'synth01',
          originalPrefix: 'http://example.org/rdf/',
          endpoints: [{ type: 'sparql', mode: 'describe', url: 'http://localhost:3030/s1/sparql' }],
        },
        {
          dsName: 'synth02',
          originalPrefix: 'http://example.org/rdf/',
          endpoints: [{ type: 'sparql', mode: 'describe', url: 'http://localhost:3030/s2/sparql' }],
        },
      ]);

      const result = translator.translateBase('http://example.org/rdf/', 'synth02');
      expect(result).toBe('http://localhost:3000/ld/synth02/');
    });
  });
});
