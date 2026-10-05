// Tags dans les posts : $valeur et @membre

// Tag en cours de frappe juste avant le curseur : { sign, query, start } ou null
export function tagAtCaret(text, caret) {
  const m = /(^|[\s(«"'])([$@])([A-Za-z0-9._^=-]{0,24})$/.exec(text.slice(0, caret));
  return m ? { sign: m[2], query: m[3], start: caret - m[3].length - 1 } : null;
}

// Tags choisis pendant la frappe : { tickers: [{ symbol, name, type }], mentions: [{ id, username, full_name }] }
export const EMPTY_TAGS = { tickers: [], mentions: [] };

export function addTag(tags, sign, item) {
  const t = tags || EMPTY_TAGS;
  if (sign === "$") {
    if (t.tickers.some(x => x.symbol === item.symbol)) return t;
    return { ...t, tickers: [...t.tickers, { symbol: item.symbol, name: item.name, type: item.type }] };
  }
  if (!item.username || t.mentions.some(x => x.id === item.id)) return t;
  return { ...t, mentions: [...t.mentions, { id: item.id, username: item.username, full_name: item.full_name }] };
}

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Ne garde que les tags encore présents dans le texte ; null s'il n'en reste aucun
export function finalizeTags(content, tags) {
  const t = tags || EMPTY_TAGS;
  const tickers = t.tickers.filter(x => typeof x?.symbol === "string" && new RegExp(`\\$${escapeRe(x.symbol)}(?![A-Za-z0-9])`, "i").test(content));
  const mentions = t.mentions.filter(x => typeof x?.username === "string" && new RegExp(`@${escapeRe(x.username)}(?![A-Za-z0-9_])`, "i").test(content));
  return tickers.length || mentions.length ? { tickers, mentions } : null;
}
