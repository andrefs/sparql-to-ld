import { Dataset, Literal } from '../types/Resource.js';

interface TripleSignature {
  predicate: string;
  object: string;
}

function isBlankNode(id: string): boolean {
  return !id.startsWith('<');
}

function getObjectString(obj: string | Literal): string {
  if (typeof obj === 'string') {
    return obj;
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
    if (typeof triple.subject === 'string' && isBlankNode(triple.subject)) {
      const bnId = triple.subject;
      if (!blankNodeTriples.has(bnId)) {
        blankNodeTriples.set(bnId, new Set());
      }
      const objValue = getObjectString(triple.object);
      blankNodeTriples.get(bnId)!.add({ predicate: triple.predicate, object: objValue });
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
    let subject: string = triple.subject;
    let object: string | Literal = triple.object;

    if (typeof subject === 'string' && isBlankNode(subject)) {
      const replacement = blankNodeReplacement.get(subject);
      if (replacement) {
        subject = replacement;
      }
    }

    if (typeof object === 'string' && isBlankNode(object)) {
      const replacement = blankNodeReplacement.get(object);
      if (replacement) {
        object = replacement;
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
    const key = `${t.subject}|${t.predicate}|${getObjectString(t.object)}`;
    if (!uniqueTriples.has(key)) {
      uniqueTriples.add(key);
      deduped.push(t);
    }
  }

  return deduped;
}
