import { useState, useEffect, useEffectEvent, useRef } from "react";
import { supabase } from "../supabase";
import { T as TLive } from "../theme";

const VEHICULES = ["ETF", "Action directe", "Fonds actif", "Obligation directe", "SCPI", "Crypto", "Autre"];
const EXPOSITIONS = ["Actions", "Obligations", "Immobilier", "Multi-actifs", "Monétaire", "Crypto", "Matières premières"];
const EXP_COLORS = { Actions: "#1D9E75", Obligations: "#185FA5", Immobilier: "#7F77DD", "Multi-actifs": "#854F0B", Monétaire: "#888", Crypto: "#D85A30", "Matières premières": "#F0CB7B" };
const VEH_COLORS = { ETF: "#1D9E75", "Action directe": "#D85A30", "Fonds actif": "#534AB7", "Obligation directe": "#185FA5", Crypto: "#854F0B", SCPI: "#7F77DD", Autre: "#888" };
const EXP_VOLATILITY = { Actions: 0.18, Crypto: 0.65, Immobilier: 0.12, Obligations: 0.05, Monétaire: 0.01, "Multi-actifs": 0.10, "Matières premières": 0.20 };







function calcPerf(a, b) { if (!a || !b || a === 0) return null; return ((b - a) / a) * 100; }
function formatEur(n) { return n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " €"; }

async function createActivity(userId, type, data) {
  await supabase.from("activities").insert({ user_id: userId, type, data });
}

async function fetchPrixViaISIN(isin) {
  try {
    const proxy = "https://corsproxy.io/?";
    const searchUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${isin}&quotesCount=1&newsCount=0&listsCount=0`;
    const res = await fetch(proxy + encodeURIComponent(searchUrl));
    const data = await res.json();
    const quotes = data?.quotes;
    if (!quotes || quotes.length === 0) return null;
    const symbol = quotes[0].symbol;
    const nom = quotes[0].longname || quotes[0].shortname || symbol;
    const quoteUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
    const res2 = await fetch(proxy + encodeURIComponent(quoteUrl));
    const data2 = await res2.json();
    const prix = data2?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (!prix) return null;
    return { prix: Math.round(prix * 100) / 100, nom, symbol };
  } catch { return null; }
}

// Mes positions, montants compris (fonction Supabase réservée au propriétaire)
async function fetchMyEntries() {
  const { data } = await supabase.rpc("get_my_portfolio_entries");
  return data || [];
}

// Pas encore d'historique de valeur : on l'annonce plutôt que d'afficher une courbe inventée
function HistoryPlaceholder({ T }) {
  return (
    <div style={{ height: 90, borderRadius: 10, border: `0.5px dashed ${T.border}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 10 }}>
      <div style={{ fontSize: 13, color: T.textMuted }}>📈 Historique disponible bientôt</div>
      <div style={{ fontSize: 11, color: T.textFaint }}>La courbe se construira jour après jour</div>
    </div>
  );
}

export default function Portfolio({ session, T: TProp }) {
  const T = TProp || TLive;
  const inp = { width: "100%", padding: "10px 12px", fontSize: 13, borderRadius: 10, border: `0.5px solid ${T.input.border}`, background: T.input.background, color: T.input.color, fontFamily: "inherit", marginBottom: 10, display: "block" };
  const btn = { background: T.accent, border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13, color: T.onAccent, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 };
  const btnSm = { background: "none", border: `0.5px solid ${T.border}`, borderRadius: 8, padding: "5px 10px", fontSize: 12, color: T.textMuted, cursor: "pointer", fontFamily: "inherit" };
  const card = { background: T.bgCard, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: "1.25rem", marginBottom: 14 };
  const sectionLabel = { fontSize: 11, color: T.textFaint, fontWeight: 500, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" };
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ label: "", isin: "", vehicule: "ETF", exposition: "Actions", percentage: "", prix_achat: "", prix_actuel: "", nombre_parts: "", broker: "" });
  const [error, setError] = useState("");
  const [openDetail, setOpenDetail] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [knownBrokers, setKnownBrokers] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [priceHint, setPriceHint] = useState(null);
  const [editFetchingPrice, setEditFetchingPrice] = useState(false);
  const [editPriceHint, setEditPriceHint] = useState(null);
  const hasRefreshed = useRef(false);

  function applyEntries(data) {
    setEntries(data || []);
    if (data) setKnownBrokers([...new Set(data.filter(e => e.broker).map(e => e.broker))]);
    setLoading(false);
  }

  async function loadEntries() {
    setLoading(true);
    applyEntries(await fetchMyEntries());
  }

  // Au premier chargement : afficher les positions puis rafraîchir une fois les cours
  const onInitialEntries = useEffectEvent(data => {
    applyEntries(data);
    if (data && data.length > 0 && !hasRefreshed.current) {
      hasRefreshed.current = true;
      refreshAllPrices(data);
    }
  });

  useEffect(() => {
    let ignore = false;
    fetchMyEntries().then(data => { if (!ignore) onInitialEntries(data); });
    return () => { ignore = true; };
  }, []);

  async function refreshAllPrices(entriesList) {
    const withISIN = entriesList.filter(e => e.isin);
    if (withISIN.length === 0) return;
    setRefreshing(true);
    for (const e of withISIN) {
      const result = await fetchPrixViaISIN(e.isin);
      if (result) {
        const perf = e.prix_achat ? Math.round(((result.prix - Number(e.prix_achat)) / Number(e.prix_achat)) * 10000) / 100 : null;
        await supabase.from("portfolio_entries").update({ prix_actuel: result.prix, performance: perf }).eq("id", e.id);
      }
    }
    setLastRefresh(new Date());
    setRefreshing(false);
    setEntries(await fetchMyEntries());
  }

  async function startEdit(e) {
    setEditingId(e.id);
    setEditForm({ label: e.label || "", isin: e.isin || "", type: e.type || "ETF", exposition: e.exposition || "Actions", percentage: e.percentage || "", prix_achat: e.prix_achat || "", prix_actuel: e.prix_actuel || "", nombre_parts: e.nombre_parts || "", broker: e.broker || "" });
  }

  async function updateEntry() {
    setEditSaving(true);
    const perf = calcPerf(Number(editForm.prix_achat), Number(editForm.prix_actuel));
    await supabase.from("portfolio_entries").update({ label: editForm.label.trim(), isin: editForm.isin.trim().toUpperCase() || null, type: editForm.type, exposition: editForm.exposition || null, percentage: Number(editForm.percentage), performance: perf, prix_achat: editForm.prix_achat ? Number(editForm.prix_achat) : null, prix_actuel: editForm.prix_actuel ? Number(editForm.prix_actuel) : null, nombre_parts: editForm.nombre_parts ? Number(editForm.nombre_parts) : null, broker: editForm.broker.trim() || null }).eq("id", editingId);
    setEditingId(null); setEditForm({}); setEditSaving(false);
    loadEntries();
  }

  async function addEntry() {
    setError("");
    if (!form.label.trim()) return setError("Donne un nom à cette position.");
    if (!form.percentage || isNaN(form.percentage)) return setError("Entre un pourcentage valide.");
    const total = entries.reduce((s, e) => s + Number(e.percentage), 0) + Number(form.percentage);
    if (total > 100) return setError(`Total dépasserait 100% (${(total - Number(form.percentage)).toFixed(0)}% alloué).`);
    const perf = calcPerf(Number(form.prix_achat), Number(form.prix_actuel));
    setSaving(true);
    const { error: err } = await supabase.from("portfolio_entries").insert({ user_id: session.user.id, label: form.label.trim(), isin: form.isin.trim().toUpperCase() || null, type: form.vehicule, exposition: form.exposition, percentage: Number(form.percentage), performance: perf, prix_achat: form.prix_achat ? Number(form.prix_achat) : null, prix_actuel: form.prix_actuel ? Number(form.prix_actuel) : null, nombre_parts: form.nombre_parts ? Number(form.nombre_parts) : null, broker: form.broker.trim() || null });
    if (err) { setError(err.message); setSaving(false); return; }
    await createActivity(session.user.id, "new_position", { label: form.label.trim(), vehicule: form.vehicule, exposition: form.exposition, broker: form.broker.trim() || null, percentage: Number(form.percentage) });
    if (total === 100) await createActivity(session.user.id, "portfolio_complete", {});
    if (form.broker.trim() && !knownBrokers.includes(form.broker.trim())) await createActivity(session.user.id, "new_broker", { broker: form.broker.trim() });
    setForm({ label: "", isin: "", vehicule: "ETF", exposition: "Actions", percentage: "", prix_achat: "", prix_actuel: "", nombre_parts: "", broker: "" });
    setShowForm(false); loadEntries(); setSaving(false);
  }

  async function deleteEntry(id) {
    await supabase.from("portfolio_entries").delete().eq("id", id);
    loadEntries();
  }

  // Calculs
  const avecPerf = entries.filter(e => e.performance !== null);
  const totalPctPerf = avecPerf.reduce((s, e) => s + Number(e.percentage), 0);
  const perfGlobale = totalPctPerf > 0 ? avecPerf.reduce((s, e) => s + Number(e.performance) * Number(e.percentage) / totalPctPerf, 0) : null;
  const valeurParPosition = entries.map(e => ({ ...e, valeur: e.prix_actuel && e.nombre_parts ? Number(e.prix_actuel) * Number(e.nombre_parts) : null, valeurAchat: e.prix_achat && e.nombre_parts ? Number(e.prix_achat) * Number(e.nombre_parts) : null }));
  const valeurTotale = valeurParPosition.filter(e => e.valeur !== null).reduce((s, e) => s + e.valeur, 0);
  const valeurAchatTotale = valeurParPosition.filter(e => e.valeurAchat !== null).reduce((s, e) => s + e.valeurAchat, 0);
  const gainTotal = valeurTotale > 0 && valeurAchatTotale > 0 ? valeurTotale - valeurAchatTotale : null;
  const hasValeur = valeurTotale > 0;
  const byExpo = entries.reduce((acc, e) => { const k = e.exposition || e.type || "Autre"; acc[k] = (acc[k] || 0) + Number(e.percentage); return acc; }, {});
  const vehiculeCounts = entries.reduce((acc, e) => { acc[e.type] = (acc[e.type] || 0) + 1; return acc; }, {});

  // Calculs score diversification
  const nbExpo = Object.keys(byExpo).length;
  const nbBrokers = new Set(entries.filter(e => e.broker).map(e => e.broker)).size;
  const maxPos = entries.length > 0 ? Math.max(...entries.map(e => Number(e.percentage))) : 0;
  const scoreExpo = Math.min(nbExpo * 15, 40);
  const scoreBroker = Math.min(nbBrokers * 10, 20);
  const scoreConc = maxPos <= 30 ? 25 : maxPos <= 50 ? 15 : 5;
  const scorePos = Math.min(entries.length * 3, 15);
  const scoreDiversif = scoreExpo + scoreBroker + scoreConc + scorePos;
  const volPonderee = entries.reduce((s, e) => { const vol = EXP_VOLATILITY[e.exposition] || EXP_VOLATILITY[e.type] || 0.12; return s + vol * (Number(e.percentage) / 100); }, 0);
  const profilRisque = volPonderee < 0.06 ? { label: "Défensif", color: "#7BB8F0", icon: "🛡️" } : volPonderee < 0.12 ? { label: "Équilibré", color: T.accent, icon: "⚖️" } : volPonderee < 0.20 ? { label: "Dynamique", color: "#F0CB7B", icon: "🚀" } : { label: "Agressif", color: T.red, icon: "⚡" };

  const formValeur = form.prix_actuel && form.nombre_parts ? Number(form.prix_actuel) * Number(form.nombre_parts) : null;
  const formValeurAchat = form.prix_achat && form.nombre_parts ? Number(form.prix_achat) * Number(form.nombre_parts) : null;

  return (
    <div>
      {/* 1. HEADER */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontSize: 13, color: T.textMuted }}>Valeur du portefeuille</div>
          <button onClick={() => refreshAllPrices(entries)} disabled={refreshing || entries.filter(e => e.isin).length === 0} style={{ background: "none", border: `0.5px solid ${T.borderStrong}`, borderRadius: 8, padding: "4px 10px", fontSize: 11, color: refreshing ? T.accent : T.textMuted, cursor: "pointer", fontFamily: "inherit" }}>
            {refreshing ? "⟳ Mise à jour…" : "⟳ Actualiser"}
          </button>
        </div>
        <div style={{ fontSize: 36, fontWeight: 700, color: T.text, letterSpacing: -1.5, marginBottom: 6 }}>
          {hasValeur ? formatEur(valeurTotale) : "— €"}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
          {perfGlobale !== null && <span style={{ fontSize: 17, fontWeight: 600, color: perfGlobale >= 0 ? T.accent : T.red }}>{perfGlobale >= 0 ? "+" : ""}{perfGlobale.toFixed(2)}%</span>}
          {gainTotal !== null && <span style={{ fontSize: 14, color: gainTotal >= 0 ? "rgba(159,225,203,0.6)" : "rgba(240,128,128,0.6)" }}>{gainTotal >= 0 ? "+" : ""}{formatEur(gainTotal)}</span>}
          {!hasValeur && <span style={{ fontSize: 13, color: T.textFaint }}>Ajoute le nombre de parts pour voir la valeur</span>}
          {lastRefresh && <span style={{ fontSize: 11, color: T.textFaint }}>· {lastRefresh.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>}
        </div>
        <HistoryPlaceholder T={T} />
      </div>

      {/* 2. ALLOCATION */}
      {Object.keys(byExpo).length > 0 && (
        <div style={card}>
          <div style={sectionLabel}>Exposition réelle</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            {Object.entries(vehiculeCounts).map(([v, count]) => (
              <span key={v} style={{ padding: "3px 10px", borderRadius: 999, fontSize: 12, background: T.bgCard, color: T.textMuted }}>{count} {v}</span>
            ))}
          </div>
          {Object.entries(byExpo).sort((a, b) => b[1] - a[1]).map(([expo, pct]) => (
            <div key={expo} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: T.text }}>{expo}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{pct.toFixed(0)} %</span>
              </div>
              <div style={{ height: 6, background: T.border, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: EXP_COLORS[expo] || "#888", borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. POSITIONS */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={sectionLabel}>Positions ({entries.length})</div>
          <button style={btn} onClick={() => setShowForm(!showForm)}>{showForm ? "Annuler" : "+ Ajouter"}</button>
        </div>

        {showForm && (
          <div style={{ background: T.bgCard, borderRadius: 10, padding: "1rem", marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: T.text }}>Nouvelle position</div>
            <label style={{ fontSize: 12, color: T.textMuted, marginBottom: 4, display: "block" }}>Nom</label>
            <input style={inp} placeholder="ex: MSCI World ETF" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} />
            <label style={{ fontSize: 12, color: T.textMuted, marginBottom: 4, display: "block" }}>ISIN</label>
            <input style={inp} placeholder="ex: LU1681043599" value={form.isin} onChange={e => setForm({ ...form, isin: e.target.value })} />
            {form.isin && (
              <button type="button" onClick={async () => { setFetchingPrice(true); setPriceHint(null); const r = await fetchPrixViaISIN(form.isin); if (r) { setForm(f => ({ ...f, prix_actuel: r.prix.toString(), label: f.label || r.nom })); setPriceHint(`✅ ${r.nom} — ${r.prix} €`); } else { setPriceHint("⚠️ Prix introuvable"); } setFetchingPrice(false); }} style={{ ...btnSm, width: "100%", textAlign: "center", marginBottom: 10, borderColor: T.accent, color: T.accent }}>
                {fetchingPrice ? "Recherche…" : "🔍 Récupérer le prix via ISIN"}
              </button>
            )}
            {priceHint && <div style={{ fontSize: 12, color: priceHint.startsWith("✅") ? T.accent : T.red, marginBottom: 10 }}>{priceHint}</div>}
            <label style={{ fontSize: 12, color: T.textMuted, marginBottom: 4, display: "block" }}>Véhicule</label>
            <select style={{ ...inp, background: T.bgCard }} value={form.vehicule} onChange={e => setForm({ ...form, vehicule: e.target.value })}>
              {VEHICULES.map(t => <option key={t} style={{ background: T.bgSecondary }}>{t}</option>)}
            </select>
            <label style={{ fontSize: 12, color: T.textMuted, marginBottom: 4, display: "block" }}>Exposition (sous-jacent)</label>
            <select style={{ ...inp, background: T.bgCard }} value={form.exposition} onChange={e => setForm({ ...form, exposition: e.target.value })}>
              {EXPOSITIONS.map(t => <option key={t} style={{ background: T.bgSecondary }}>{t}</option>)}
            </select>
            <label style={{ fontSize: 12, color: T.textMuted, marginBottom: 4, display: "block" }}>% du portefeuille</label>
            <input style={inp} placeholder="ex: 30" type="number" value={form.percentage} onChange={e => setForm({ ...form, percentage: e.target.value })} />
            <label style={{ fontSize: 12, color: T.textMuted, marginBottom: 4, display: "block" }}>Nombre de parts</label>
            <input style={inp} placeholder="ex: 12.5" type="number" value={form.nombre_parts} onChange={e => setForm({ ...form, nombre_parts: e.target.value })} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 12, color: T.textMuted, marginBottom: 4, display: "block" }}>Prix d'achat (€)</label>
                <input style={{ ...inp, marginBottom: 0 }} placeholder="ex: 450.20" type="number" value={form.prix_achat} onChange={e => setForm({ ...form, prix_achat: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: T.textMuted, marginBottom: 4, display: "block" }}>Prix actuel (€)</label>
                <input style={{ ...inp, marginBottom: 0 }} placeholder="ex: 512.80" type="number" value={form.prix_actuel} onChange={e => setForm({ ...form, prix_actuel: e.target.value })} />
              </div>
            </div>
            {formValeur !== null && (
              <div style={{ background: T.accentBg, border: "0.5px solid rgba(159,225,203,0.15)", borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 4 }}>Valeur de la position</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: T.accent }}>{formatEur(formValeur)}</div>
                {formValeurAchat && (() => { const p = calcPerf(Number(form.prix_achat), Number(form.prix_actuel)); return p !== null ? <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>Achat : {formatEur(formValeurAchat)} · <span style={{ color: p >= 0 ? T.accent : T.red }}>{p >= 0 ? "+" : ""}{p.toFixed(2)}%</span></div> : null; })()}
              </div>
            )}
            <label style={{ fontSize: 12, color: T.textMuted, marginBottom: 4, display: "block" }}>Broker</label>
            <input style={inp} placeholder="ex: Boursorama, Saxo…" value={form.broker} onChange={e => setForm({ ...form, broker: e.target.value })} />
            {error && <div style={{ fontSize: 13, color: T.red, marginBottom: 10 }}>⚠️ {error}</div>}
            <button style={btn} onClick={addEntry} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</button>
          </div>
        )}

        {editingId && (
          <div style={{ background: T.accentBg, border: "0.5px solid rgba(159,225,203,0.2)", borderRadius: 10, padding: "1rem", marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: T.accent }}>✏️ Modifier la position</div>
            <label style={{ fontSize: 12, color: T.textMuted, marginBottom: 4, display: "block" }}>Nom</label>
            <input style={inp} value={editForm.label} onChange={e => setEditForm({ ...editForm, label: e.target.value })} />
            <label style={{ fontSize: 12, color: T.textMuted, marginBottom: 4, display: "block" }}>ISIN</label>
            <input style={inp} value={editForm.isin} onChange={e => setEditForm({ ...editForm, isin: e.target.value })} />
            {editForm.isin && (
              <button type="button" onClick={async () => { setEditFetchingPrice(true); setEditPriceHint(null); const r = await fetchPrixViaISIN(editForm.isin); if (r) { setEditForm(f => ({ ...f, prix_actuel: r.prix.toString() })); setEditPriceHint(`✅ ${r.nom} — ${r.prix} €`); } else { setEditPriceHint("⚠️ Prix introuvable"); } setEditFetchingPrice(false); }} style={{ ...btnSm, width: "100%", textAlign: "center", marginBottom: 10, borderColor: T.accent, color: T.accent }}>
                {editFetchingPrice ? "Recherche…" : "🔍 Mettre à jour le prix via ISIN"}
              </button>
            )}
            {editPriceHint && <div style={{ fontSize: 12, color: editPriceHint.startsWith("✅") ? T.accent : T.red, marginBottom: 10 }}>{editPriceHint}</div>}
            <label style={{ fontSize: 12, color: T.textMuted, marginBottom: 4, display: "block" }}>Véhicule</label>
            <select style={{ ...inp, background: T.bgCard }} value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value })}>
              {VEHICULES.map(t => <option key={t} style={{ background: T.bgSecondary }}>{t}</option>)}
            </select>
            <label style={{ fontSize: 12, color: T.textMuted, marginBottom: 4, display: "block" }}>Exposition</label>
            <select style={{ ...inp, background: T.bgCard }} value={editForm.exposition || ""} onChange={e => setEditForm({ ...editForm, exposition: e.target.value })}>
              {EXPOSITIONS.map(t => <option key={t} style={{ background: T.bgSecondary }}>{t}</option>)}
            </select>
            <label style={{ fontSize: 12, color: T.textMuted, marginBottom: 4, display: "block" }}>% du portefeuille</label>
            <input style={inp} type="number" value={editForm.percentage} onChange={e => setEditForm({ ...editForm, percentage: e.target.value })} />
            <label style={{ fontSize: 12, color: T.textMuted, marginBottom: 4, display: "block" }}>Nombre de parts</label>
            <input style={inp} type="number" value={editForm.nombre_parts} onChange={e => setEditForm({ ...editForm, nombre_parts: e.target.value })} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 12, color: T.textMuted, marginBottom: 4, display: "block" }}>Prix d'achat (€)</label>
                <input style={{ ...inp, marginBottom: 0 }} type="number" value={editForm.prix_achat} onChange={e => setEditForm({ ...editForm, prix_achat: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: T.textMuted, marginBottom: 4, display: "block" }}>Prix actuel (€)</label>
                <input style={{ ...inp, marginBottom: 0 }} type="number" value={editForm.prix_actuel} onChange={e => setEditForm({ ...editForm, prix_actuel: e.target.value })} />
              </div>
            </div>
            {editForm.prix_achat && editForm.prix_actuel && editForm.nombre_parts && (() => {
              const val = Number(editForm.prix_actuel) * Number(editForm.nombre_parts);
              const p = calcPerf(Number(editForm.prix_achat), Number(editForm.prix_actuel));
              return <div style={{ background: T.accentBg, borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}><div style={{ fontSize: 18, fontWeight: 700, color: T.accent }}>{formatEur(val)}</div>{p !== null && <div style={{ fontSize: 12, color: p >= 0 ? T.accent : T.red, marginTop: 2 }}>{p >= 0 ? "+" : ""}{p.toFixed(2)}%</div>}</div>;
            })()}
            <label style={{ fontSize: 12, color: T.textMuted, marginBottom: 4, display: "block" }}>Broker</label>
            <input style={inp} value={editForm.broker} onChange={e => setEditForm({ ...editForm, broker: e.target.value })} />
            <div style={{ display: "flex", gap: 8 }}>
              <button style={btn} onClick={updateEntry} disabled={editSaving}>{editSaving ? "Sauvegarde…" : "Sauvegarder"}</button>
              <button style={btnSm} onClick={() => setEditingId(null)}>Annuler</button>
            </div>
          </div>
        )}

        {loading && <div style={{ fontSize: 13, color: T.textFaint, textAlign: "center", padding: "1rem" }}>Chargement…</div>}
        {!loading && entries.length === 0 && <div style={{ fontSize: 13, color: T.textFaint, textAlign: "center", padding: "1.5rem 0" }}>Aucune position — clique sur "+ Ajouter" 🙂</div>}

        {valeurParPosition.map((e, i) => (
          <div key={e.id}>
            <div onClick={() => setOpenDetail(p => ({ ...p, [e.id]: !p[e.id] }))} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderTop: i === 0 ? "none" : `0.5px solid ${T.border}`, cursor: "pointer" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: EXP_COLORS[e.exposition] || VEH_COLORS[e.type] || "#888", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: T.text }}>{e.label}</div>
                <div style={{ fontSize: 12, color: T.textMuted }}>{e.exposition || e.type}{e.broker ? ` · ${e.broker}` : ""}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                {e.valeur !== null ? <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{formatEur(e.valeur)}</div> : <div style={{ fontSize: 13, color: T.textFaint }}>{e.percentage}%</div>}
                {e.performance !== null && <div style={{ fontSize: 12, fontWeight: 500, color: e.performance >= 0 ? T.accent : T.red }}>{e.performance >= 0 ? "+" : ""}{Number(e.performance).toFixed(2)}%</div>}
              </div>
              <div style={{ fontSize: 16, color: T.textFaint, transition: "transform 0.2s", transform: openDetail[e.id] ? "rotate(90deg)" : "none" }}>›</div>
            </div>
            {openDetail[e.id] && (
              <div style={{ background: T.bgCard, borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
                {e.nombre_parts && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, color: T.textMuted }}><span>Nombre de parts</span><span style={{ color: T.text, fontWeight: 500 }}>{e.nombre_parts}</span></div>}
                {e.prix_achat && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, color: T.textMuted }}><span>Prix d'achat</span><span style={{ color: T.text, fontWeight: 500 }}>{e.prix_achat} €</span></div>}
                {e.prix_actuel && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, color: T.textMuted }}><span>Prix actuel</span><span style={{ color: T.text, fontWeight: 500 }}>{e.prix_actuel} €</span></div>}
                {e.valeurAchat && e.valeur && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, color: T.textMuted }}><span>Gain / perte</span><span style={{ fontWeight: 500, color: e.valeur >= e.valeurAchat ? T.accent : T.red }}>{e.valeur >= e.valeurAchat ? "+" : ""}{formatEur(e.valeur - e.valeurAchat)}</span></div>}
                {e.isin && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, color: T.textMuted }}><span>ISIN</span><span style={{ color: T.text, fontWeight: 500, fontFamily: "monospace", fontSize: 12 }}>{e.isin}</span></div>}
                {e.broker && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, color: T.textMuted }}><span>Broker</span><span style={{ color: T.text, fontWeight: 500 }}>{e.broker}</span></div>}
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button onClick={() => { startEdit(e); setOpenDetail(p => ({ ...p, [e.id]: false })); }} style={{ ...btnSm, flex: 1, textAlign: "center" }}>Modifier</button>
                  <button onClick={() => deleteEntry(e.id)} style={{ ...btnSm, flex: 1, textAlign: "center", borderColor: T.red, color: T.red }}>Supprimer</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>


      {/* PROJECTIONS */}
      {entries.length > 0 && perfGlobale !== null && hasValeur && (
        <div style={card}>
          <div style={{ fontSize: 11, color: T.textFaint, fontWeight: 500, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            📊 Projection
          </div>
          <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
            Si ton portefeuille continue sur cette lancée à <strong style={{ color: T.accent }}>+{Math.min(perfGlobale, 30).toFixed(1)}%/an</strong>
            <span style={{ fontSize: 11, color: T.textFaint, marginLeft: 6 }}>(plafonné à 30% pour rester réaliste)</span>
          </div>

          {[5, 10, 20].map(years => {
            const rate = Math.min(perfGlobale / 100, 0.30);
            const valeur = valeurTotale * Math.pow(1 + rate, years);
            return (
              <div key={years} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: years === 5 ? "none" : `0.5px solid ${T.border}` }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: T.accentBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: T.accent }}>{years}</div>
                    <div style={{ fontSize: 9, color: T.textFaint }}>ans</div>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>
                    {valeur.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €
                  </div>
                  <div style={{ fontSize: 12, color: T.textFaint, marginTop: 2 }}>
                    +{(valeur - valeurTotale).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} € de gains estimés
                  </div>
                </div>
                <div style={{ fontSize: 11, color: T.textFaint }}>
                  ×{Math.pow(1 + rate, years).toFixed(1)}
                </div>
              </div>
            );
          })}

          <div style={{ marginTop: 14, padding: "10px 12px", background: T.bgCard, borderRadius: 8, fontSize: 12, color: T.textFaint, lineHeight: 1.6 }}>
            ⚠️ Projection indicative basée sur ta performance actuelle. Les rendements passés ne préjugent pas des rendements futurs.
          </div>

          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: T.accentBg, border: "0.5px solid rgba(159,225,203,0.15)", borderRadius: 10 }}>
            <span style={{ fontSize: 16 }}>✨</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.accent }}>Verio Plus</div>
              <div style={{ fontSize: 12, color: T.textMuted }}>Ajuste le rendement, l'apport mensuel et l'horizon</div>
            </div>
            <span style={{ fontSize: 11, color: T.accent, fontWeight: 600, padding: "2px 8px", borderRadius: 999, border: "0.5px solid rgba(159,225,203,0.3)" }}>🔒</span>
          </div>
        </div>
      )}

      {/* 4. SCORE DIVERSIFICATION + PROFIL RISQUE */}
      {entries.length > 0 && (
        <div style={card}>
          <div style={sectionLabel}>Analyse gratuite</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            <div style={{ background: T.bgCard, borderRadius: 10, padding: 14, textAlign: "center" }}>
              <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 6 }}>Score diversification</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: scoreDiversif >= 70 ? T.accent : scoreDiversif >= 40 ? "#F0CB7B" : T.red }}>{scoreDiversif}</div>
              <div style={{ fontSize: 11, color: T.textFaint }}>/ 100</div>
            </div>
            <div style={{ background: T.bgCard, borderRadius: 10, padding: 14, textAlign: "center" }}>
              <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 6 }}>Profil de risque</div>
              <div style={{ fontSize: 24, marginBottom: 4 }}>{profilRisque.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: profilRisque.color }}>{profilRisque.label}</div>
            </div>
          </div>
        </div>
      )}

      {/* 5. ANALYSE AVANCÉE — PAYWALL */}
      {entries.length > 0 && (
        <div style={{ ...card, border: "0.5px solid rgba(159,225,203,0.15)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={sectionLabel}>Analyse avancée</div>
            <span style={{ background: T.accent, color: T.onAccent, fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 999 }}>PLUS</span>
          </div>

          {perfGlobale !== null && (
            <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.7, marginBottom: 16, padding: "10px 12px", background: T.accentBg, borderRadius: 8 }}>
              Ton portefeuille a fait <strong style={{ color: T.accent }}>+{perfGlobale.toFixed(1)}%</strong>. Découvre si cette performance vient du marché, de ton allocation ou de ta prise de risque.
            </div>
          )}

          {[
            { label: "Volatilité annualisée", desc: "Mesure les fluctuations de ton portefeuille" },
            { label: "Sharpe Ratio", desc: "Rendement ajusté au risque" },
            { label: "Beta", desc: "Sensibilité par rapport au marché" },
            { label: "Alpha", desc: "Surperformance vs benchmark" },
            { label: "Max Drawdown", desc: "Perte maximale depuis un sommet" },
            { label: "Tracking Error", desc: "Écart par rapport à l'indice de référence" },
          ].map((m, i) => (
            <div key={m.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: i === 0 ? "none" : `0.5px solid ${T.border}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: T.textMuted }}>{m.label}</div>
                <div style={{ fontSize: 11, color: T.textFaint, marginTop: 2 }}>{m.desc}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13 }}>🔒</span>
                <span style={{ fontSize: 11, color: T.accent, fontWeight: 500, padding: "2px 8px", borderRadius: 999, border: "0.5px solid rgba(159,225,203,0.3)", background: T.accentBg }}>Plus</span>
              </div>
            </div>
          ))}

          <button onClick={() => alert("Verio Plus arrive bientôt ! Tu seras notifié en avant-première.")} style={{ width: "100%", marginTop: 16, padding: "12px", background: T.accent, border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, color: T.onAccent, cursor: "pointer", fontFamily: "inherit" }}>
            ✨ Débloquer l'analyse avancée — 9,99 €/mois
          </button>
        </div>
      )}
    </div>
  );
}
