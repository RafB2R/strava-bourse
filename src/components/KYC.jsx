import { useState } from "react";
import { supabase } from "../supabase";

const BROKERS = ["Boursorama", "Saxo", "Trade Republic", "Degiro", "Fortuneo", "BinckBank", "Interactive Brokers", "Revolut", "eToro", "Autre"];
const ACTIFS = ["ETF", "Actions", "Fonds actifs", "Obligations", "Crypto", "Immobilier (SCPI)", "Matières premières"];
const STRATEGIES = ["ETF passif", "Dividendes", "Value Investing", "Growth Investing", "Stock Picking", "DCA", "Mixte"];

const btn = { background: "#9FE1CB", border: "none", borderRadius: 10, padding: "12px 24px", fontSize: 14, color: "#0F6E56", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 };
const btnSm = { background: "none", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 16px", fontSize: 13, color: "rgba(255,255,255,0.4)", cursor: "pointer", fontFamily: "inherit" };
const inp = { width: "100%", padding: "10px 12px", fontSize: 13, borderRadius: 10, border: "0.5px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#f0f0f0", fontFamily: "inherit", marginBottom: 10, display: "block" };
const lbl = { fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 6, display: "block" };

function ChoiceGrid({ options, value, onChange, multi = false }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
      {options.map(opt => {
        const selected = multi ? (value || []).includes(opt) : value === opt;
        return (
          <button key={opt} onClick={() => {
            if (multi) {
              const current = value || [];
              onChange(selected ? current.filter(v => v !== opt) : [...current, opt]);
            } else {
              onChange(opt);
            }
          }} style={{ padding: "8px 14px", borderRadius: 999, fontSize: 13, border: `0.5px solid ${selected ? "#9FE1CB" : "rgba(255,255,255,0.1)"}`, background: selected ? "rgba(159,225,203,0.12)" : "none", color: selected ? "#9FE1CB" : "rgba(255,255,255,0.5)", cursor: "pointer", fontFamily: "inherit", fontWeight: selected ? 600 : 400 }}>
            {opt}
          </button>
        );
      })}
    </div>
  );
}

const STEPS = [
  { title: "Qui es-tu ?", emoji: "👤", subtitle: "Quelques infos de base pour personnaliser ton expérience" },
  { title: "Ta situation", emoji: "💼", subtitle: "Ces données restent totalement privées" },
  { title: "Ton profil investisseur", emoji: "📊", subtitle: "Comment tu abordes l'investissement" },
  { title: "Tes objectifs", emoji: "🎯", subtitle: "Où tu veux aller" },
  { title: "Ton setup", emoji: "🔧", subtitle: "Ce que tu utilises déjà" },
];

export default function KYC({ session, profile, onComplete, onSkip }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState({
    full_name: profile?.full_name || "",
    city: profile?.city || "",
    date_naissance: profile?.date_naissance || "",
    investing_since: profile?.investing_since || "",
    revenus: profile?.revenus || "",
    patrimoine_estime: profile?.patrimoine_estime || "",
    epargne_mensuelle: profile?.epargne_mensuelle || "",
    experience: profile?.experience || "",
    strategy: profile?.strategy || "",
    tolerance_risque: profile?.tolerance_risque || "",
    objectif_principal: profile?.objectif_principal || "",
    horizon: profile?.horizon || "",
    objectif_patrimoine: profile?.objectif_patrimoine || "",
    brokers_utilises: profile?.brokers_utilises || [],
    actifs_detenus: profile?.actifs_detenus || [],
  });

  function set(key, val) { setData(p => ({ ...p, [key]: val })); }

  async function save() {
    setSaving(true);
    await supabase.from("profiles").update({ ...data, kyc_complete: true }).eq("id", session.user.id);
    setSaving(false);
    onComplete();
  }

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1rem" }}>
      <div style={{ background: "#181b23", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "2rem", maxWidth: 520, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>

        {/* Progress bar */}
        <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, marginBottom: 24, overflow: "hidden" }}>
          <div style={{ width: `${progress}%`, height: "100%", background: "#9FE1CB", borderRadius: 2, transition: "width 0.3s" }} />
        </div>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>{STEPS[step].emoji}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{STEPS[step].title}</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>{STEPS[step].subtitle}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", marginTop: 4 }}>Étape {step + 1} / {STEPS.length}</div>
        </div>

        {/* Étape 1 — Qui es-tu */}
        {step === 0 && (
          <div>
            <label style={lbl}>Prénom et nom</label>
            <input style={inp} placeholder="Raphaël Dupont" value={data.full_name} onChange={e => set("full_name", e.target.value)} />
            <label style={lbl}>Ville</label>
            <input style={inp} placeholder="Paris" value={data.city} onChange={e => set("city", e.target.value)} />
            <label style={lbl}>Date de naissance</label>
            <input style={inp} type="date" value={data.date_naissance} onChange={e => set("date_naissance", e.target.value)} />
            <label style={lbl}>Investisseur depuis (année)</label>
            <input style={inp} type="number" placeholder="2018" value={data.investing_since} onChange={e => set("investing_since", e.target.value)} />
          </div>
        )}

        {/* Étape 2 — Situation */}
        {step === 1 && (
          <div>
            <label style={lbl}>Revenus annuels nets</label>
            <ChoiceGrid options={["< 30 000 €", "30 000 – 50 000 €", "50 000 – 100 000 €", "100 000 – 200 000 €", "> 200 000 €"]} value={data.revenus} onChange={v => set("revenus", v)} />
            <label style={lbl}>Patrimoine financier estimé</label>
            <ChoiceGrid options={["< 10 000 €", "10 000 – 50 000 €", "50 000 – 100 000 €", "100 000 – 500 000 €", "> 500 000 €"]} value={data.patrimoine_estime} onChange={v => set("patrimoine_estime", v)} />
            <label style={lbl}>Capacité d'épargne mensuelle</label>
            <ChoiceGrid options={["< 100 €", "100 – 500 €", "500 – 1 000 €", "1 000 – 3 000 €", "> 3 000 €"]} value={data.epargne_mensuelle} onChange={v => set("epargne_mensuelle", v)} />
          </div>
        )}

        {/* Étape 3 — Profil investisseur */}
        {step === 2 && (
          <div>
            <label style={lbl}>Ton niveau d'expérience</label>
            <ChoiceGrid options={["Débutant", "Intermédiaire", "Avancé", "Expert"]} value={data.experience} onChange={v => set("experience", v)} />
            <label style={lbl}>Ta stratégie principale</label>
            <ChoiceGrid options={STRATEGIES} value={data.strategy} onChange={v => set("strategy", v)} />
            <label style={lbl}>Ta tolérance au risque</label>
            <ChoiceGrid options={["Défensif", "Équilibré", "Dynamique", "Agressif"]} value={data.tolerance_risque} onChange={v => set("tolerance_risque", v)} />
          </div>
        )}

        {/* Étape 4 — Objectifs */}
        {step === 3 && (
          <div>
            <label style={lbl}>Ton objectif principal</label>
            <ChoiceGrid options={["Retraite", "Liberté financière", "Projet immobilier", "Revenus complémentaires", "Croissance du patrimoine", "Protection contre l'inflation"]} value={data.objectif_principal} onChange={v => set("objectif_principal", v)} />
            <label style={lbl}>Horizon d'investissement</label>
            <ChoiceGrid options={["< 3 ans", "3 – 10 ans", "> 10 ans"]} value={data.horizon} onChange={v => set("horizon", v)} />
            <label style={lbl}>Objectif de patrimoine cible</label>
            <ChoiceGrid options={["100 000 €", "250 000 €", "500 000 €", "1 000 000 €", "> 1 000 000 €"]} value={data.objectif_patrimoine} onChange={v => set("objectif_patrimoine", v)} />
          </div>
        )}

        {/* Étape 5 — Setup */}
        {step === 4 && (
          <div>
            <label style={lbl}>Brokers que tu utilises (plusieurs possibles)</label>
            <ChoiceGrid options={BROKERS} value={data.brokers_utilises} onChange={v => set("brokers_utilises", v)} multi />
            <label style={lbl}>Types d'actifs que tu détiens (plusieurs possibles)</label>
            <ChoiceGrid options={ACTIFS} value={data.actifs_detenus} onChange={v => set("actifs_detenus", v)} multi />
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 8 }}>
            {step > 0 && <button style={btnSm} onClick={() => setStep(s => s - 1)}>← Retour</button>}
            <button style={{ ...btnSm, fontSize: 12 }} onClick={onSkip}>Passer</button>
          </div>
          {step < STEPS.length - 1 ? (
            <button style={btn} onClick={() => setStep(s => s + 1)}>Continuer →</button>
          ) : (
            <button style={btn} onClick={save} disabled={saving}>{saving ? "Enregistrement…" : "Terminer ✓"}</button>
          )}
        </div>
      </div>
    </div>
  );
}
