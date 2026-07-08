import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase";

const VEHICULES = ["ETF", "Action directe", "Fonds actif", "Obligation directe", "SCPI", "Crypto", "Autre"];
const EXPOSITIONS = ["Actions", "Obligations", "Immobilier", "Multi-actifs", "Monétaire", "Crypto", "Matières premières"];
const EXP_COLORS = { Actions: "#1D9E75", Obligations: "#185FA5", Immobilier: "#7F77DD", "Multi-actifs": "#854F0B", Monétaire: "#888", Crypto: "#D85A30", "Matières premières": "#F0CB7B" };
const VEH_COLORS = { ETF: "#1D9E75", "Action directe": "#D85A30", "Fonds actif": "#534AB7", "Obligation directe": "#185FA5", Crypto: "#854F0B", SCPI: "#7F77DD", Autre: "#888" };
const EXP_VOLATILITY = { Actions: 0.18, Crypto: 0.65, Immobilier: 0.12, Obligations: 0.05, Monétaire: 0.01, "Multi-actifs": 0.10, "Matières premières": 0.20 };

const inp = { width: "100%", padding: "10px 12px", fontSize: 13, borderRadius: 10, border: "0.5px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#f0f0f0", fontFamily: "inherit", marginBottom: 10, display: "block" };
const btn = { background: "#9FE1CB", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13, color: "#0F6E56", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 };
const btnSm = { background: "none", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "5px 10px", fontSize: 12, color: "rgba(255,255,255,0.4)", cursor: "pointer", fontFamily: "inherit" };
const card = { background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "1.25rem", marginBottom: 14 };
const sectionLabel = { fontSize: 11, color: "rgba(255,255,255,0.25)", fontWeight: 500, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" };

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
  } catch (e) { return null; }
}

function MiniChart({ perfGlobale }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const [period, setPeriod] = useState("1M");
  const isUp = perfGlobale === null || perfGlobale >= 0;
  const datasets = {
    "1J": [23800,23850,23780,23900,24100,24050,24200,24350,24580],
    "1S": [23200,23400,23600,23500,23800,24000,24300,24580],
    "1M": [21400,21800,22200,22600,23100,23500,23900,24200,24580],
    "1A": [18500,19200,20100,21000,21800,22500,23200,23800,24580],
    "ALL": [12000,14500,17000,19500,21000,22500,23500,24580],
  };
  const labels = {
    "1J": ["9h","11h","12h","13h","14h","15h","16h","17h","18h"],
    "1S": ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim","Lun"],
    "1M": ["S1","S2","S3","S4","S5","S6","S7","S8","S9"],
    "1A": ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Déc"],
    "ALL": ["2019","2020","2021","2022","2023","2024","2025","2026"],
  };
  useEffect(() => {
    if (!canvasRef.current || !window.Chart) return;
    if (chartRef.current) chartRef.current.destroy();
    const ctx = canvasRef.current.getContext("2d");
    const color = isUp ? "#9FE1CB" : "#F08080";
    const g = ctx.createLinearGradient(0, 0, 0, 120);
    g.addColorStop(0, isUp ? "rgba(159,225,203,0.2)" : "rgba(240,128,128,0.2)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    chartRef.current = new window.Chart(ctx, {
      type: "line",
      data: { labels: labels[period], datasets: [{ data: datasets[period], borderColor: color, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, pointHoverBackgroundColor: color, fill: true, backgroundColor: g, tension: 0.4 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { mode: "index", intersect: false, callbacks: { label: c => c.parsed.y.toLocaleString("fr-FR") + " €" } } }, scales: { x: { grid: { display: false }, ticks: { color: "rgba(255,255,255,0.3)", font: { size: 10 } }, border: { display: false } }, y: { display: false } } },
    });
  }, [period]);
  return (
    <div>
      <div style={{ position: "relative", width: "100%", height: 120, marginBottom: 10 }}>
        <canvas ref={canvasRef} role="img" aria-label="Évolution du portefeuille"></canvas>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        {["1J","1S","1M","1A","ALL"].map(p => (
          <button key={p} onClick={() => setPeriod(p)} style={{ padding: "4px 10px", borderRadius: 999, fontSize: 11, border: `0.5px solid ${period === p ? "#9FE1CB" : "rgba(255,255,255,0.1)"}`, background: period === p ? "rgba(159,225,203,0.1)" : "none", color: period === p ? "#9FE1CB" : "rgba(255,255,255,0.35)", cursor: "pointer", fontFamily: "inherit" }}>{p}</button>
        ))}
      </div>
    </div>
  );
}

export default function Portfolio({ session }) {
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
  const [chartLoaded, setChartLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [priceHint, setPriceHint] = useState(null);
  const [editFetchingPrice, setEditFetchingPrice] = useState(false);
  const [editPriceHint, setEditPriceHint] = useState(null);
  const hasRefreshed = useRef(false);

  useEffect(() => {
    loadEntries().then(data => {
      if (data && data.length > 0 && !hasRefreshed.current) {
        hasRefreshed.current = true;
        refreshAllPrices(data);
      }
    });
    if (!window.Chart) {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
      s.onload = () => setChartLoaded(true);
      document.head.appendChild(s);
    } else { setChartLoaded(true); }
  }, []);

  async function loadEntries() {
    setLoading(true);
    const { data } = await supabase.from("portfolio_entries").select("*").eq("user_id", session.user.id).order("percentage", { ascending: false });
    setEntries(data || []);
    if (data) setKnownBrokers([...new Set(data.filter(e => e.broker).map(e => e.broker))]);
    setLoading(false);
    return data;
  }

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
    const { data } = await supabase.from("portfolio_entries").select("*").eq("user_id", session.user.id).order("percentage", { ascending: false });
    setEntries(data || []);
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
  const totalPct = entries.reduce((s, e) => s + Number(e.percentage), 0);
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
  const profilRisque = volPonderee < 0.06 ? { label: "Défensif", color: "#7BB8F0", icon: "🛡️" } : volPonderee < 0.12 ? { label: "Équilibré", color: "#9FE1CB", icon: "⚖️" } : volPonderee < 0.20 ? { label: "Dynamique", color: "#F0CB7B", icon: "🚀" } : { label: "Agressif", color: "#F08080", icon: "⚡" };

  const formValeur = form.prix_actuel && form.nombre_parts ? Number(form.prix_actuel) * Number(form.nombre_parts) : null;
  const formValeurAchat = form.prix_achat && form.nombre_parts ? Number(form.prix_achat) * Number(form.nombre_parts) : null;

  return (
    <div>
      {/* 1. HEADER */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>Valeur du portefeuille</div>
          <button onClick={() => refreshAllPrices(entries)} disabled={refreshing || entries.filter(e => e.isin).length === 0} style={{ background: "none", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: refreshing ? "#9FE1CB" : "rgba(255,255,255,0.35)", cursor: "pointer", fontFamily: "inherit" }}>
            {refreshing ? "⟳ Mise à jour…" : "⟳ Actualiser"}
          </button>
        </div>
        <div style={{ fontSize: 36, fontWeight: 700, color: "#fff", letterSpacing: -1.5, marginBottom: 6 }}>
          {hasValeur ? formatEur(valeurTotale) : "— €"}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
          {perfGlobale !== null && <span style={{ fontSize: 17, fontWeight: 600, color: perfGlobale >= 0 ? "#9FE1CB" : "#F08080" }}>{perfGlobale >= 0 ? "+" : ""}{perfGlobale.toFixed(2)}%</span>}
          {gainTotal !== null && <span style={{ fontSize: 14, color: gainTotal >= 0 ? "rgba(159,225,203,0.6)" : "rgba(240,128,128,0.6)" }}>{gainTotal >= 0 ? "+" : ""}{formatEur(gainTotal)}</span>}
          {!hasValeur && <span style={{ fontSize: 13, color: "rgba(255,255,255,0.25)" }}>Ajoute le nombre de parts pour voir la valeur</span>}
          {lastRefresh && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>· {lastRefresh.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>}
        </div>
        {chartLoaded && <MiniChart perfGlobale={perfGlobale} />}
      </div>

      {/* 2. ALLOCATION */}
      {Object.keys(byExpo).length > 0 && (
        <div style={card}>
          <div style={sectionLabel}>Exposition réelle</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            {Object.entries(vehiculeCounts).map(([v, count]) => (
              <span key={v} style={{ padding: "3px 10px", borderRadius: 999, fontSize: 12, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>{count} {v}</span>
            ))}
          </div>
          {Object.entries(byExpo).sort((a, b) => b[1] - a[1]).map(([expo, pct]) => (
            <div key={expo} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.8)" }}>{expo}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>{pct.toFixed(0)} %</span>
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
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
          <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "1rem", marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: "#fff" }}>Nouvelle position</div>
            <label style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 4, display: "block" }}>Nom</label>
            <input style={inp} placeholder="ex: MSCI World ETF" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} />
            <label style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 4, display: "block" }}>ISIN</label>
            <input style={inp} placeholder="ex: LU1681043599" value={form.isin} onChange={e => setForm({ ...form, isin: e.target.value })} />
            {form.isin && (
              <button type="button" onClick={async () => { setFetchingPrice(true); setPriceHint(null); const r = await fetchPrixViaISIN(form.isin); if (r) { setForm(f => ({ ...f, prix_actuel: r.prix.toString(), label: f.label || r.nom })); setPriceHint(`✅ ${r.nom} — ${r.prix} €`); } else { setPriceHint("⚠️ Prix introuvable"); } setFetchingPrice(false); }} style={{ ...btnSm, width: "100%", textAlign: "center", marginBottom: 10, borderColor: "#9FE1CB", color: "#9FE1CB" }}>
                {fetchingPrice ? "Recherche…" : "🔍 Récupérer le prix via ISIN"}
              </button>
            )}
            {priceHint && <div style={{ fontSize: 12, color: priceHint.startsWith("✅") ? "#9FE1CB" : "#F08080", marginBottom: 10 }}>{priceHint}</div>}
            <label style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 4, display: "block" }}>Véhicule</label>
            <select style={{ ...inp, background: "rgba(255,255,255,0.05)" }} value={form.vehicule} onChange={e => setForm({ ...form, vehicule: e.target.value })}>
              {VEHICULES.map(t => <option key={t} style={{ background: "#1e2130" }}>{t}</option>)}
            </select>
            <label style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 4, display: "block" }}>Exposition (sous-jacent)</label>
            <select style={{ ...inp, background: "rgba(255,255,255,0.05)" }} value={form.exposition} onChange={e => setForm({ ...form, exposition: e.target.value })}>
              {EXPOSITIONS.map(t => <option key={t} style={{ background: "#1e2130" }}>{t}</option>)}
            </select>
            <label style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 4, display: "block" }}>% du portefeuille</label>
            <input style={inp} placeholder="ex: 30" type="number" value={form.percentage} onChange={e => setForm({ ...form, percentage: e.target.value })} />
            <label style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 4, display: "block" }}>Nombre de parts</label>
            <input style={inp} placeholder="ex: 12.5" type="number" value={form.nombre_parts} onChange={e => setForm({ ...form, nombre_parts: e.target.value })} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 4, display: "block" }}>Prix d'achat (€)</label>
                <input style={{ ...inp, marginBottom: 0 }} placeholder="ex: 450.20" type="number" value={form.prix_achat} onChange={e => setForm({ ...form, prix_achat: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 4, display: "block" }}>Prix actuel (€)</label>
                <input style={{ ...inp, marginBottom: 0 }} placeholder="ex: 512.80" type="number" value={form.prix_actuel} onChange={e => setForm({ ...form, prix_actuel: e.target.value })} />
              </div>
            </div>
            {formValeur !== null && (
              <div style={{ background: "rgba(159,225,203,0.06)", border: "0.5px solid rgba(159,225,203,0.15)", borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Valeur de la position</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#9FE1CB" }}>{formatEur(formValeur)}</div>
                {formValeurAchat && (() => { const p = calcPerf(Number(form.prix_achat), Number(form.prix_actuel)); return p !== null ? <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>Achat : {formatEur(formValeurAchat)} · <span style={{ color: p >= 0 ? "#9FE1CB" : "#F08080" }}>{p >= 0 ? "+" : ""}{p.toFixed(2)}%</span></div> : null; })()}
              </div>
            )}
            <label style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 4, display: "block" }}>Broker</label>
            <input style={inp} placeholder="ex: Boursorama, Saxo…" value={form.broker} onChange={e => setForm({ ...form, broker: e.target.value })} />
            {error && <div style={{ fontSize: 13, color: "#F08080", marginBottom: 10 }}>⚠️ {error}</div>}
            <button style={btn} onClick={addEntry} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</button>
          </div>
        )}

        {editingId && (
          <div style={{ background: "rgba(159,225,203,0.05)", border: "0.5px solid rgba(159,225,203,0.2)", borderRadius: 10, padding: "1rem", marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: "#9FE1CB" }}>✏️ Modifier la position</div>
            <label style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 4, display: "block" }}>Nom</label>
            <input style={inp} value={editForm.label} onChange={e => setEditForm({ ...editForm, label: e.target.value })} />
            <label style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 4, display: "block" }}>ISIN</label>
            <input style={inp} value={editForm.isin} onChange={e => setEditForm({ ...editForm, isin: e.target.value })} />
            {editForm.isin && (
              <button type="button" onClick={async () => { setEditFetchingPrice(true); setEditPriceHint(null); const r = await fetchPrixViaISIN(editForm.isin); if (r) { setEditForm(f => ({ ...f, prix_actuel: r.prix.toString() })); setEditPriceHint(`✅ ${r.nom} — ${r.prix} €`); } else { setEditPriceHint("⚠️ Prix introuvable"); } setEditFetchingPrice(false); }} style={{ ...btnSm, width: "100%", textAlign: "center", marginBottom: 10, borderColor: "#9FE1CB", color: "#9FE1CB" }}>
                {editFetchingPrice ? "Recherche…" : "🔍 Mettre à jour le prix via ISIN"}
              </button>
            )}
            {editPriceHint && <div style={{ fontSize: 12, color: editPriceHint.startsWith("✅") ? "#9FE1CB" : "#F08080", marginBottom: 10 }}>{editPriceHint}</div>}
            <label style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 4, display: "block" }}>Véhicule</label>
            <select style={{ ...inp, background: "rgba(255,255,255,0.05)" }} value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value })}>
              {VEHICULES.map(t => <option key={t} style={{ background: "#1e2130" }}>{t}</option>)}
            </select>
            <label style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 4, display: "block" }}>Exposition</label>
            <select style={{ ...inp, background: "rgba(255,255,255,0.05)" }} value={editForm.exposition || ""} onChange={e => setEditForm({ ...editForm, exposition: e.target.value })}>
              {EXPOSITIONS.map(t => <option key={t} style={{ background: "#1e2130" }}>{t}</option>)}
            </select>
            <label style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 4, display: "block" }}>% du portefeuille</label>
            <input style={inp} type="number" value={editForm.percentage} onChange={e => setEditForm({ ...editForm, percentage: e.target.value })} />
            <label style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 4, display: "block" }}>Nombre de parts</label>
            <input style={inp} type="number" value={editForm.nombre_parts} onChange={e => setEditForm({ ...editForm, nombre_parts: e.target.value })} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 4, display: "block" }}>Prix d'achat (€)</label>
                <input style={{ ...inp, marginBottom: 0 }} type="number" value={editForm.prix_achat} onChange={e => setEditForm({ ...editForm, prix_achat: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 4, display: "block" }}>Prix actuel (€)</label>
                <input style={{ ...inp, marginBottom: 0 }} type="number" value={editForm.prix_actuel} onChange={e => setEditForm({ ...editForm, prix_actuel: e.target.value })} />
              </div>
            </div>
            {editForm.prix_achat && editForm.prix_actuel && editForm.nombre_parts && (() => {
              const val = Number(editForm.prix_actuel) * Number(editForm.nombre_parts);
              const p = calcPerf(Number(editForm.prix_achat), Number(editForm.prix_actuel));
              return <div style={{ background: "rgba(159,225,203,0.06)", borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}><div style={{ fontSize: 18, fontWeight: 700, color: "#9FE1CB" }}>{formatEur(val)}</div>{p !== null && <div style={{ fontSize: 12, color: p >= 0 ? "#9FE1CB" : "#F08080", marginTop: 2 }}>{p >= 0 ? "+" : ""}{p.toFixed(2)}%</div>}</div>;
            })()}
            <label style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 4, display: "block" }}>Broker</label>
            <input style={inp} value={editForm.broker} onChange={e => setEditForm({ ...editForm, broker: e.target.value })} />
            <div style={{ display: "flex", gap: 8 }}>
              <button style={btn} onClick={updateEntry} disabled={editSaving}>{editSaving ? "Sauvegarde…" : "Sauvegarder"}</button>
              <button style={btnSm} onClick={() => setEditingId(null)}>Annuler</button>
            </div>
          </div>
        )}

        {loading && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "1rem" }}>Chargement…</div>}
        {!loading && entries.length === 0 && <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "1.5rem 0" }}>Aucune position — clique sur "+ Ajouter" 🙂</div>}

        {valeurParPosition.map((e, i) => (
          <div key={e.id}>
            <div onClick={() => setOpenDetail(p => ({ ...p, [e.id]: !p[e.id] }))} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderTop: i === 0 ? "none" : "0.5px solid rgba(255,255,255,0.06)", cursor: "pointer" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: EXP_COLORS[e.exposition] || VEH_COLORS[e.type] || "#888", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#fff" }}>{e.label}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>{e.exposition || e.type}{e.broker ? ` · ${e.broker}` : ""}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                {e.valeur !== null ? <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{formatEur(e.valeur)}</div> : <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>{e.percentage}%</div>}
                {e.performance !== null && <div style={{ fontSize: 12, fontWeight: 500, color: e.performance >= 0 ? "#9FE1CB" : "#F08080" }}>{e.performance >= 0 ? "+" : ""}{Number(e.performance).toFixed(2)}%</div>}
              </div>
              <div style={{ fontSize: 16, color: "rgba(255,255,255,0.2)", transition: "transform 0.2s", transform: openDetail[e.id] ? "rotate(90deg)" : "none" }}>›</div>
            </div>
            {openDetail[e.id] && (
              <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
                {e.nombre_parts && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, color: "rgba(255,255,255,0.5)" }}><span>Nombre de parts</span><span style={{ color: "#fff", fontWeight: 500 }}>{e.nombre_parts}</span></div>}
                {e.prix_achat && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, color: "rgba(255,255,255,0.5)" }}><span>Prix d'achat</span><span style={{ color: "#fff", fontWeight: 500 }}>{e.prix_achat} €</span></div>}
                {e.prix_actuel && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, color: "rgba(255,255,255,0.5)" }}><span>Prix actuel</span><span style={{ color: "#fff", fontWeight: 500 }}>{e.prix_actuel} €</span></div>}
                {e.valeurAchat && e.valeur && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, color: "rgba(255,255,255,0.5)" }}><span>Gain / perte</span><span style={{ fontWeight: 500, color: e.valeur >= e.valeurAchat ? "#9FE1CB" : "#F08080" }}>{e.valeur >= e.valeurAchat ? "+" : ""}{formatEur(e.valeur - e.valeurAchat)}</span></div>}
                {e.isin && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, color: "rgba(255,255,255,0.5)" }}><span>ISIN</span><span style={{ color: "#fff", fontWeight: 500, fontFamily: "monospace", fontSize: 12 }}>{e.isin}</span></div>}
                {e.broker && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, color: "rgba(255,255,255,0.5)" }}><span>Broker</span><span style={{ color: "#fff", fontWeight: 500 }}>{e.broker}</span></div>}
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button onClick={() => { startEdit(e); setOpenDetail(p => ({ ...p, [e.id]: false })); }} style={{ ...btnSm, flex: 1, textAlign: "center" }}>Modifier</button>
                  <button onClick={() => deleteEntry(e.id)} style={{ ...btnSm, flex: 1, textAlign: "center", borderColor: "#F08080", color: "#F08080" }}>Supprimer</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 4. SCORE DIVERSIFICATION + PROFIL RISQUE */}
      {entries.length > 0 && (
        <div style={card}>
          <div style={sectionLabel}>Analyse gratuite</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 14, textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>Score diversification</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: scoreDiversif >= 70 ? "#9FE1CB" : scoreDiversif >= 40 ? "#F0CB7B" : "#F08080" }}>{scoreDiversif}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>/ 100</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 14, textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 6 }}>Profil de risque</div>
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
            <span style={{ background: "#9FE1CB", color: "#0F6E56", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 999 }}>PLUS</span>
          </div>

          {perfGlobale !== null && (
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, marginBottom: 16, padding: "10px 12px", background: "rgba(159,225,203,0.05)", borderRadius: 8 }}>
              Ton portefeuille a fait <strong style={{ color: "#9FE1CB" }}>+{perfGlobale.toFixed(1)}%</strong>. Découvre si cette performance vient du marché, de ton allocation ou de ta prise de risque.
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
            <div key={m.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: i === 0 ? "none" : "0.5px solid rgba(255,255,255,0.06)" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.5)" }}>{m.label}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 2 }}>{m.desc}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13 }}>🔒</span>
                <span style={{ fontSize: 11, color: "#9FE1CB", fontWeight: 500, padding: "2px 8px", borderRadius: 999, border: "0.5px solid rgba(159,225,203,0.3)", background: "rgba(159,225,203,0.06)" }}>Plus</span>
              </div>
            </div>
          ))}

          <button onClick={() => alert("Verio Plus arrive bientôt ! Tu seras notifié en avant-première.")} style={{ width: "100%", marginTop: 16, padding: "12px", background: "#9FE1CB", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, color: "#0F6E56", cursor: "pointer", fontFamily: "inherit" }}>
            ✨ Débloquer l'analyse avancée — 9,99 €/mois
          </button>
        </div>
      )}
    </div>
  );
}
