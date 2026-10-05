import { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { searchAssets, fetchQuote } from "../attachments";
import { fmtChange } from "../indices";

// Texte d'un post avec valeurs ($TTE.PA) et membres (@pseudo) identifiés, façon Blossom.
// Seuls les tags choisis dans les suggestions (data.tickers / data.mentions) sont
// mis en valeur : un « $ » tapé à la main reste du texte.

const TOKEN = /([$@])([A-Za-z0-9._^=-]{1,24})/g;

// Retire la ponctuation de fin collée au tag (« $TTE.PA. » → « TTE.PA »)
const trimToken = t => t.replace(/[.\-_]+$/, "");

export function RichText({ text, tickers = [], mentions = [], T, onAsset, onProfile }) {
  if (!text) return null;
  const bySymbol = new Map(tickers.map(t => [t.symbol.toUpperCase(), t]));
  const byUser = new Map(mentions.map(m => [String(m.username).toLowerCase(), m]));
  const parts = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    const [, sign, raw] = match;
    const value = trimToken(raw);
    const start = match.index, end = start + 1 + value.length;
    const before = start === 0 ? " " : text[start - 1];
    if (!/[\s(«"']/.test(before)) continue; // « 10$ » ou un e-mail ne sont pas des tags
    const ticker = sign === "$" && bySymbol.get(value.toUpperCase());
    const mention = sign === "@" && byUser.get(value.toLowerCase());
    if (!ticker && !mention) continue;
    parts.push(text.slice(last, start));
    parts.push(
      <button key={start} onClick={() => (ticker ? onAsset?.(ticker) : onProfile?.(mention.id))}
        title={ticker ? ticker.name : mention.full_name}
        style={{ background: "none", border: "none", padding: 0, font: "inherit", fontWeight: 700, color: T.accent, cursor: "pointer" }}>
        {sign}{value}
      </button>
    );
    last = end;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}

// Cartes des valeurs citées, sous le texte : symbole et variation du jour ; clic → fiche
export function TickerChips({ tickers, T, onAsset }) {
  if (!tickers?.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
      {tickers.slice(0, 6).map(t => <TickerChip key={t.symbol} ticker={t} T={T} onClick={() => onAsset?.(t)} />)}
    </div>
  );
}

function TickerChip({ ticker, T, onClick }) {
  const [quote, setQuote] = useState(null);
  useEffect(() => {
    let ignore = false;
    fetchQuote(ticker.symbol).then(q => { if (!ignore) setQuote(q); });
    return () => { ignore = true; };
  }, [ticker.symbol]);
  const ch = quote?.change;
  const short = ticker.symbol.replace(/^\^/, "").split(".")[0].slice(0, 5);
  return (
    <button onClick={onClick} title={ticker.name}
      style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px 6px 6px", borderRadius: 10, border: `0.5px solid ${T.border}`, background: T.bgSubtle, cursor: "pointer", fontFamily: "inherit", maxWidth: 220 }}>
      <span style={{ width: 30, height: 30, borderRadius: "50%", background: T.accentBg, color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, flexShrink: 0 }}>{short}</span>
      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: T.text, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ticker.name}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: ch == null ? T.textFaint : ch >= 0 ? T.accent : T.red }}>{quote ? fmtChange(ch) : "…"}</span>
      </span>
    </button>
  );
}

async function searchMembers(q, myId) {
  const safe = q.replace(/[,()%*\\]/g, "");
  let query = supabase.from("profiles").select("id, full_name, username").neq("id", myId).not("username", "is", null).limit(5);
  if (safe) query = query.or(`username.ilike.${safe}%,full_name.ilike.%${safe}%`);
  const { data } = await query;
  return data || [];
}

// Suggestions sous la zone de texte pendant la frappe de « $… » ou « @… »
export function TagSuggestions({ tag, myId, T, onPick }) {
  const [state, setState] = useState({ key: null, items: [] });
  const key = tag ? `${tag.sign}${tag.query}` : null;

  useEffect(() => {
    if (!tag) return;
    if (tag.sign === "$" && tag.query.length < 2) return;
    let ignore = false;
    const t = setTimeout(async () => {
      const items = tag.sign === "$" ? await searchAssets(tag.query) : await searchMembers(tag.query, myId);
      if (!ignore) setState({ key: `${tag.sign}${tag.query}`, items });
    }, 250);
    return () => { ignore = true; clearTimeout(t); };
  }, [tag, myId]);

  if (!tag) return null;
  const hint = tag.sign === "$" ? "Tape le nom ou le ticker d'une valeur (ex. $total, $CW8)…" : "Tape le pseudo ou le nom d'un membre…";
  const ready = state.key === key;
  const waiting = tag.sign === "$" && tag.query.length < 2;
  return (
    <div role="listbox" aria-label={tag.sign === "$" ? "Valeurs" : "Membres"}
      style={{ marginTop: 6, border: `0.5px solid ${T.border}`, borderRadius: 10, background: T.bgCard, boxShadow: T.cardShadow, overflow: "hidden" }}>
      {(waiting || !ready) && <div style={{ fontSize: 12, color: T.textFaint, padding: "8px 12px" }}>{waiting ? hint : "Recherche…"}</div>}
      {ready && !waiting && state.items.length === 0 && <div style={{ fontSize: 12, color: T.textFaint, padding: "8px 12px" }}>Aucun résultat.</div>}
      {ready && !waiting && state.items.map(item => (
        <button key={item.symbol || item.id} role="option" aria-selected="false"
          onMouseDown={e => e.preventDefault()} // garde le curseur dans la zone de texte
          onClick={() => onPick(item)}
          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", background: "none", border: "none", borderTop: `0.5px solid ${T.border}`, padding: "8px 12px", cursor: "pointer", fontFamily: "inherit" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.accent, flexShrink: 0 }}>{tag.sign === "$" ? `$${item.symbol}` : `@${item.username}`}</span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {tag.sign === "$" ? `${item.name} · ${item.type}${item.exchange ? ` · ${item.exchange}` : ""}` : item.full_name}
          </span>
        </button>
      ))}
    </div>
  );
}
