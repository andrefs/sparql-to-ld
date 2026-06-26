import { describe, it, expect } from 'vitest';
import { buildLiteralQuery, buildConstructQuery } from '../../../src/sparql/query-builder.js';

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

describe('buildConstructQuery', () => {
  const iri = 'http://example.org/resource';
  const escaped = `<${iri}>`;

  it('should build describe query', () => {
    const query = buildConstructQuery(iri, 'describe');
    expect(query).toBe(`DESCRIBE ${escaped}`);
  });

  it('should build fwd-one query', () => {
    const query = buildConstructQuery(iri, 'fwd-one');
    expect(query).toContain('CONSTRUCT');
    expect(query).toContain(escaped);
    expect(query).toContain('?p ?o');
    expect(query).not.toContain('UNION');
  });

  it('should build fwd-two query', () => {
    const query = buildConstructQuery(iri, 'fwd-two');
    expect(query).toContain('?o ?p2 ?o2');
    expect(query).toContain('FILTER(isBlank(?o))');
  });

  it('should build back-one query', () => {
    const query = buildConstructQuery(iri, 'back-one');
    expect(query).toContain('?s ?p');
    expect(query).toContain(escaped);
    expect(query).not.toContain('UNION');
  });

  it('should build back-two query', () => {
    const query = buildConstructQuery(iri, 'back-two');
    expect(query).toContain('?s2 ?p2 ?s');
    expect(query).toContain('FILTER(isBlank(?s))');
  });

  it('should build sym-one query', () => {
    const query = buildConstructQuery(iri, 'sym-one');
    expect(query).toContain('UNION');
    expect(query).toContain(escaped);
    expect(query).toContain('?s ?p');
  });

  it('should build sym-two query', () => {
    const query = buildConstructQuery(iri, 'sym-two');
    expect(query).toContain('?x ?p ?o');
    expect(query).toContain('BIND(?x AS ?s)');
    expect(query).toContain('BIND(?x AS ?o)');
  });

  it('should build fwd-one-blank query with single-level blank expansion', () => {
    const query = buildConstructQuery(iri, 'fwd-one-blank');
    expect(query).toContain('?x ?p2 ?o2');
    expect(query).not.toContain('?y ?p3 ?o3');
  });

  it('should build fwd-two-blank query with two-level blank expansion', () => {
    const query = buildConstructQuery(iri, 'fwd-two-blank');
    expect(query).toContain('?x ?p2 ?o2');
    expect(query).toContain('?y ?p3 ?o3');
    expect(query).toContain('FILTER(isBlank(?x))');
    expect(query).toContain('FILTER(isBlank(?y))');
  });

  it('should build back-one-blank query with single-level blank expansion', () => {
    const query = buildConstructQuery(iri, 'back-one-blank');
    expect(query).toContain('?s2 ?p2 ?x');
    expect(query).not.toContain('?s3 ?p3 ?y');
  });

  it('should build back-two-blank query with two-level blank expansion', () => {
    const query = buildConstructQuery(iri, 'back-two-blank');
    expect(query).toContain('?s2 ?p2 ?x');
    expect(query).toContain('?s3 ?p3 ?y');
    expect(query).toContain('FILTER(isBlank(?x))');
    expect(query).toContain('FILTER(isBlank(?y))');
  });

  it('should build sym-one-blank query with single-level blank expansion', () => {
    const query = buildConstructQuery(iri, 'sym-one-blank');
    expect(query).toContain('?x ?p2 ?o2');
    expect(query).toContain('?s2 ?p2 ?x');
    expect(query).not.toContain('?y ?p3 ?o3');
    expect(query).not.toContain('?s3 ?p3 ?y');
  });

  it('should build sym-two-blank query with two-level blank expansion', () => {
    const query = buildConstructQuery(iri, 'sym-two-blank');
    expect(query).toContain('?x ?p2 ?o2');
    expect(query).toContain('?s2 ?p2 ?x');
    expect(query).toContain('?y ?p3 ?o3');
    expect(query).toContain('?s3 ?p3 ?y');
    expect(query).toContain('FILTER(isBlank(?x))');
    expect(query).toContain('FILTER(isBlank(?y))');
  });

  it('should build fwd-three-blank query with three-level blank expansion', () => {
    const query = buildConstructQuery(iri, 'fwd-three-blank');
    expect(query).toContain('?x ?p2 ?o2');
    expect(query).toContain('?y ?p3 ?o3');
    expect(query).toContain('?z ?p4 ?o4');
    expect(query).toContain('FILTER(isBlank(?x))');
    expect(query).toContain('FILTER(isBlank(?y))');
    expect(query).toContain('FILTER(isBlank(?z))');
  });

  it('should build back-three-blank query with three-level blank expansion', () => {
    const query = buildConstructQuery(iri, 'back-three-blank');
    expect(query).toContain('?s2 ?p2 ?x');
    expect(query).toContain('?s3 ?p3 ?y');
    expect(query).toContain('?s4 ?p4 ?z');
    expect(query).toContain('FILTER(isBlank(?x))');
    expect(query).toContain('FILTER(isBlank(?y))');
    expect(query).toContain('FILTER(isBlank(?z))');
  });

  it('should build sym-three-blank query with three-level blank expansion', () => {
    const query = buildConstructQuery(iri, 'sym-three-blank');
    expect(query).toContain('?x ?p2 ?o2');
    expect(query).toContain('?s2 ?p2 ?x');
    expect(query).toContain('?y ?p3 ?o3');
    expect(query).toContain('?s3 ?p3 ?y');
    expect(query).toContain('?z ?p4 ?o4');
    expect(query).toContain('?s4 ?p4 ?z');
    expect(query).toContain('FILTER(isBlank(?x))');
    expect(query).toContain('FILTER(isBlank(?y))');
    expect(query).toContain('FILTER(isBlank(?z))');
  });

  it('should throw for unknown mode', () => {
    expect(() => buildConstructQuery(iri, 'invalid' as never)).toThrow('Unknown endpoint mode');
  });
});
