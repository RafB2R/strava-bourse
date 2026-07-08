import { useState, useEffect } from "react";
import { supabase } from "../supabase";

const card = { background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "1.25rem", marginBottom: 12 };
const sectionLabel = { fontSize: 11, color: "rgba(255,255,255,0.25)", fontWeight: 500, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" };

const EXP_VOLATILITY = {
  Actions: 0.18, Crypto: 0.65, Immobilier: 0.12,
  Obligations: 0.05, Monétaire: 0.01, "Multi-actifs": 0.10,
  "Matières premières": 0.20,
};

function ScoreBar({ value, max = 100, color = "#9FE1CB", label }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color }}>{value}/{max}</span>
      </div>
      <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${(value / max) * 100}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.5s" }} />
      </div>
    </div>
  );
}

function BlurredMetric({ label, value, desc }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "12px 14px", marginBottom: 8, position: "relative", overflow: "hidden" }}>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "rgba(255,255,255,0.15)", letterSpacing: 4 }}>••••</div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.15)", marginTop: 2 }}>{desc}</div>
      <div style={{ position: "absolute", inset: 0, background: "rgba(17,19,24,0.75)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, marginBottom: 2 }}>🔒</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Verio Plus</div>
        </div>
      </div>
    </div>
  );
}

export default function Stats({ session, profile }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data } = await supabase.from("portfolio_entries").select("*").eq("user_id", session.user.id);
    setEntries(data || []);
    setLoading(false);
  }

  if (loading) return <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "2rem" }}>Chargement…</div>;
  if (entries.length === 0) return (
    <div style={{ ...card, textAlign: "center", padding: "2rem" }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
      <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}>Ajoute des positions pour voir tes stats</div>
    </div>
  );

  // ---- Calculs gratuits ----
  const totalPct = entries.reduce((s, e) => s + Number(e.percentage), 0);
  const avecPerf = entries.filter(e => e.performance !== null);
  const totalPctPerf = avecPerf.reduce((s, e) => s + Number(e.percentage), 0);
  const perfGlobale = totalPctPerf > 0 ? avecPerf.reduce((s, e) => s + Number(e.performance) * Number(e.percentage) / totalPctPerf, 0) : null;

  const expositions = entries.reduce((acc, e) => { const k = e.exposition || e.type || "Autre"; acc[k] = (acc[k] || 0) + Number(e.percentage); return acc; }, {});
  const nbExpo = Object.keys(expositions).length;
  const nbBrokers = new Set(entries.filter(e => e.broker).map(e => e.broker)).size;
  const maxPosition = Math.max(...entries.map(e => Number(e.percentage)));

  // Score diversification (0-100)
  const scoreExpo = Math.min(nbExpo * 15, 40);
  const scoreBroker = Math.min(nbBrokers * 10, 20);
  const scoreConcentration = maxPosition <= 30 ? 25 : maxPosition <= 50 ? 15 : 5;
  const scorePositions = Math.min(entries.length * 3, 15);
  const scoreDiversification = Math.round(scoreExpo + scoreBroker + scoreConcentration + scorePositions);

  // Profil de risque
  const volPonderee = entries.reduce((s, e) => {
    const vol = EXP_VOLATILITY[e.exposition] || EXP_VOLATILITY[e.type] || 0.12;
    return s + vol * (Number(e.percentage) / 100);
  }, 0);
  const profilRisque = volPonderee < 0.06 ? { label: "Défensif", color: "#7BB8F0", desc: "Portefeuille peu risqué, orienté stabilité" }
    : volPonderee < 0.12 ? { label: "Équilibré", color: "#9FE1CB", desc: "Bon équilibre rendement/risque" }
    : volPonderee < 0.20 ? { label: "Dynamique", color: "#F0CB7B", desc: "Portefeuille orienté croissance" }
    : { label: "Agressif", color: "#F0997B", desc: "Portefeuille à haute volatilité" };

  // Drawdown max (pire position pondérée)
  const drawdownMax = avecPerf.length > 0
    ? Math.min(...avecPerf.map(e => Number(e.performance)))
    : null;

  // ---- Calculs premium (floutés) ----
  const sharpe = perfGlobale !== null ? (perfGlobale - 3) / (volPonderee * 100) : null;
  const alpha = perfGlobale !== null ? perfGlobale - 12.5 : null; // vs benchmark S&P 500 estimé
  const herfindahl = entries.reduce((s, e) => s + Math.pow(Number(e.percentage) / 100, 2), 0);

  return (
    <div>
      {/* Stats gratuites */}
      <div style={card}>
        <div style={sectionLabel}>Vue d'ensemble</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {[
            ["Perf. totale", perfGlobale !== null ? `${perfGlobale >= 0 ? "+" : ""}${perfGlobale.toFixed(2)}%` : "—", perfGlobale !== null && perfGlobale >= 0 ? "#9FE1CB" : "#F08080"],
            ["Positions", entries.length, "#fff"],
            ["Expositions", nbExpo, "#fff"],
            ["Brokers", nbBrokers || "—", "#fff"],
          ].map(([label, val, color]) => (
            <div key={label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color }}>{val}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: `rgba(${profilRisque.color === "#9FE1CB" ? "159,225,203" : profilRisque.color === "#7BB8F0" ? "123,184,240" : profilRisque.color === "#F0CB7B" ? "240,203,123" : "240,153,123"},0.1)`, borderRadius: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 2 }}>Profil de risque</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: profilRisque.color }}>{profilRisque.label}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{profilRisque.desc}</div>
          </div>
          <div style={{ fontSize: 32 }}>
            {profilRisque.label === "Défensif" ? "🛡️" : profilRisque.label === "Équilibré" ? "⚖️" : profilRisque.label === "Dynamique" ? "🚀" : "⚡"}
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={sectionLabel}>Score de diversification</div>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 48, fontWeight: 700, color: scoreDiversification >= 70 ? "#9FE1CB" : scoreDiversification >= 40 ? "#F0CB7B" : "#F08080" }}>
            {scoreDiversification}
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>/ 100</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
            {scoreDiversification >= 70 ? "Excellent" : scoreDiversification >= 40 ? "À améliorer" : "Concentré"}
          </div>
        </div>
        <ScoreBar value={Math.min(nbExpo * 15, 40)} max={40} label="Types d'exposition" color="#9FE1CB" />
        <ScoreBar value={Math.min(nbBrokers * 10, 20)} max={20} label="Multi-broker" color="#7BB8F0" />
        <ScoreBar value={scoreConcentration} max={25} label="Concentration" color="#F0CB7B" />
        <ScoreBar value={Math.min(entries.length * 3, 15)} max={15} label="Nombre de positions" color="#AFA9EC" />
      </div>

      {drawdownMax !== null && (
        <div style={card}>
          <div style={sectionLabel}>Drawdown</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(240,128,128,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>📉</div>
            <div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>Pire position du portefeuille</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#F08080" }}>{drawdownMax.toFixed(2)}%</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                {drawdownMax > -10 ? "Drawdown limité" : drawdownMax > -25 ? "Drawdown modéré" : "Drawdown important"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Paywall Verio Plus */}
      <div style={{ ...card, border: "0.5px solid rgba(159,225,203,0.2)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 12, right: 12, background: "#9FE1CB", color: "#0F6E56", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 999 }}>PLUS</div>

        <div style={sectionLabel}>Stats avancées</div>

        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, marginBottom: 16, padding: "10px 12px", background: "rgba(159,225,203,0.05)", borderRadius: 8 }}>
          Ton portefeuille a fait <strong style={{ color: "#9FE1CB" }}>{perfGlobale !== null ? `+${perfGlobale.toFixed(1)}%` : "—"}</strong>. Découvre si cette performance vient du marché, de ton allocation ou de ta prise de risque.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <BlurredMetric label="Sharpe Ratio" value={sharpe !== null ? sharpe.toFixed(2) : "1.24"} desc="Rendement ajusté au risque" />
          <BlurredMetric label="Alpha" value={alpha !== null ? `${alpha >= 0 ? "+" : ""}${alpha.toFixed(1)}%` : "+2.2%"} desc="Surperformance vs marché" />
          <BlurredMetric label="Volatilité" value={`${(volPonderee * 100).toFixed(1)}%`} desc="Volatilité annualisée estimée" />
          <BlurredMetric label="Concentration" value={`${(herfindahl * 100).toFixed(0)}%`} desc="Index Herfindahl" />
        </div>

        {!showPaywall ? (
          <button
            onClick={() => setShowPaywall(true)}
            style={{ width: "100%", marginTop: 16, padding: "12px", background: "#9FE1CB", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, color: "#0F6E56", cursor: "pointer", fontFamily: "inherit" }}
          >
            Passer à Verio Plus — 9,99 €/mois
          </button>
        ) : (
          <div style={{ marginTop: 16, padding: "16px", background: "rgba(159,225,203,0.05)", borderRadius: 10, textAlign: "center" }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>🚧</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#9FE1CB", marginBottom: 6 }}>Bientôt disponible</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
              Verio Plus arrive prochainement. Tu seras notifié en avant-première.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
