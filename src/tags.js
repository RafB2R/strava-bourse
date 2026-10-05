// Tags dans les posts : $valeur et @membre

// Tag en cours de frappe juste avant le curseur : { sign, query, start } ou null
export function tagAtCaret(text, caret) {
  const m = /(^|[\s(«"'])([$@])([A-Za-z0-9._^=-]{0,24})$/.exec(text.slice(0, caret));
  return m ? { sign: m[2], query: m[3], start: caret - m[3].length - 1 } : null;
}
