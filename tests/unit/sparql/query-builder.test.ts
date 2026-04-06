import { describe, it, expect } from 'vitest';
import { buildLiteralQuery } from '../../../src/sparql/query-builder.js';

describe('buildLiteralQuery', () => {
  it('should build simple literal query', () => {
    const query = buildLiteralQuery('"test"');
    expect(query).toBe('SELECT ?s ?p ?o WHERE { ?s ?p "test" }');
  });

  it('should handle literal with language tag', () => {
    const query = buildLiteralQuery('"test"@en');
    expect(query).toBe('SELECT ?s ?p ?o WHERE { ?s ?p "test"@en }');
  });

  it('should handle literal with datatype', () => {
    const query = buildLiteralQuery('"test"^^<http://example.org/type>');
    expect(query).toBe('SELECT ?s ?p ?o WHERE { ?s ?p "test"^^<http://example.org/type> }');
  });

  it('should handle empty literal', () => {
    const query = buildLiteralQuery('""');
    expect(query).toBe('SELECT ?s ?p ?o WHERE { ?s ?p "" }');
  });

  it('should handle literal with special characters', () => {
    const query = buildLiteralQuery('"hello world"');
    expect(query).toBe('SELECT ?s ?p ?o WHERE { ?s ?p "hello world" }');
  });

  it('should handle literal with quotes inside', () => {
    const query = buildLiteralQuery('"he said \\"hi\\""');
    expect(query).toBe('SELECT ?s ?p ?o WHERE { ?s ?p "he said \\"hi\\"" }');
  });

  it('should handle Unicode characters in literal', () => {
    const query = buildLiteralQuery('"日本語"');
    expect(query).toBe('SELECT ?s ?p ?o WHERE { ?s ?p "日本語" }');
  });

  it('should not escape special SPARQL characters unnecessarily', () => {
    const query = buildLiteralQuery('"test\\nnewline"');
    expect(query).toBe('SELECT ?s ?p ?o WHERE { ?s ?p "test\\nnewline" }');
  });
});
