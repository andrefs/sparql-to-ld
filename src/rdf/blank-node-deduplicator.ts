import { Dataset, NamedNode, BlankNode, Literal } from '../types/Resource.js';

interface TripleSignature {
  predicate: string;
  object: string;
}

function getObjectString(obj: NamedNode | BlankNode | Literal): string {
  if (obj.termType !== 'Literal') {
    return obj.value;
  }
  let s = obj.value;
  if (obj.language) {
    s += '@' + obj.language;
  } else if (obj.datatype) {
    s += '^^<' + obj.datatype + '>';
  }
  return s;
}

export function deduplicateBlankNodes(dataset: Dataset): Dataset {
  const blankNodeTriples = new Map<string, Set<TripleSignature>>();

  for (const triple of dataset) {
    if (triple.subject.termType === 'BlankNode') {
      const bnId = triple.subject.value;
      if (!blankNodeTriples.has(bnId)) {
        blankNodeTriples.set(bnId, new Set());
      }
      const objValue = getObjectString(triple.object);
      blankNodeTriples.get(bnId)!.add({ predicate: triple.predicate.value, object: objValue });
    }
  }

  const signatureToCanonical = new Map<string, string>();
  const blankNodeReplacement = new Map<string, string>();

  for (const [bnId, triples] of blankNodeTriples) {
    const signature = Array.from(triples)
      .sort((a, b) => {
        if (a.predicate !== b.predicate) return a.predicate.localeCompare(b.predicate);
        return a.object.localeCompare(b.object);
      })
      .map((t) => `${t.predicate}->${t.object}`)
      .join('|||');

    if (!signatureToCanonical.has(signature)) {
      signatureToCanonical.set(signature, bnId);
    } else {
      blankNodeReplacement.set(bnId, signatureToCanonical.get(signature)!);
    }
  }

  if (blankNodeReplacement.size === 0) {
    return dataset;
  }

  const result = dataset.map((triple) => {
    let subject = triple.subject;
    let object = triple.object;

    if (subject.termType === 'BlankNode') {
      const replacement = blankNodeReplacement.get(subject.value);
      if (replacement) {
        subject = { termType: 'BlankNode', value: replacement };
      }
    }

    if (object.termType === 'BlankNode') {
      const replacement = blankNodeReplacement.get(object.value);
      if (replacement) {
        object = { termType: 'BlankNode', value: replacement };
      }
    }

    return {
      subject,
      predicate: triple.predicate,
      object,
    };
  });

  const uniqueTriples = new Set<string>();
  const deduped: typeof result = [];
  for (const t of result) {
    const key = `${t.subject.value}|${t.predicate.value}|${getObjectString(t.object)}`;
    if (!uniqueTriples.has(key)) {
      uniqueTriples.add(key);
      deduped.push(t);
    }
  }

  return deduped;
}
