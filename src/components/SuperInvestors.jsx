import { useState, useEffect } from "react";
import IndexDetail from "./IndexDetail";
import LegendIcon from "./LegendIcon";
import { useDetailView } from "../useDetailView";
import { resolveAsset } from "../attachments";
import { detailFor } from "../indices";
import { fetchSuperInvestors } from "../superInvestors";
import { t, LOCALE } from "../i18n";

// Super Investors : positions déclarées à la SEC (formulaire 13F), lues par /api/superinvestors.
// Mise à jour automatique : l'API relit la dernière déclaration (cache 12 h).
// Uniquement des % du portefeuille, jamais de montants.

const SUPER_INVESTORS = [
  { cik: 1067983, name: "Warren Buffett", firm: "Berkshire Hathaway", style: "Value investing", icon: "🦁" },
  { cik: 1336528, name: "Bill Ackman", firm: "Pershing Square", style: "Activiste, portefeuille concentré", icon: "🎯" },
  { cik: 1536411, name: "Stanley Druckenmiller", firm: "Duquesne Family Office", style: "Macro", icon: "🌍" },
  { cik: 1061768, name: "Seth Klarman", firm: "Baupost Group", style: "Value investing", icon: "🛡️" },
  { cik: 1709323, name: "Li Lu", firm: "Himalaya Capital", style: "Value investing", icon: "🏔️" },
  { cik: 1656456, name: "David Tepper", firm: "Appaloosa Management", style: "Opportuniste", icon: "🐎" },
  { cik: 1569205, name: "Terry Smith", firm: "Fundsmith", style: "Entreprises de qualité, long terme", icon: "💎" },
  { cik: 1649339, name: "Michael Burry", firm: "Scion Asset Management", style: "Contrarian", icon: "🔍" },
];

const cache = new Map();
async function fetchInvestor(cik) {
  if (!cache.has(cik)) {
    cache.set(cik, fetch(`/api/superinvestors?cik=${cik}`).then(async r => {
      const data = await r.json().catch(() => null);
      if (!r.ok || !data || data.error) { cache.delete(cik); throw new Error(data?.error || "indisponible"); }
      return data;
    }));
  }
  return cache.get(cik);
}

const fmtPct = n => (n > 0 && n < 0.1 ? t("< 0,1 %") : `${n.toLocaleString(LOCALE, { maximumFractionDigits: 1 })} %`);
const fmtDate = d => new Date(`${d}T12:00:00`).toLocaleDateString(LOCALE, { day: "numeric", month: "long", year: "numeric" });

// Nom de la déclaration → recherche de la valeur (« Berkshire Hathaway Inc Del » → « Berkshire Hathaway »)
const searchName = name => name.replace(/\b(inc|corp|co|ltd|plc|del|new|com|cl [a-z]|class [a-z]|hldgs?|holdings?|group|sa|nv|ag|se|lp|llc)\b\.?/gi, " ").replace(/\s+/g, " ").trim() || name;

// Gardé dans l'adresse : une actualisation rouvre le portefeuille de ce gérant
const SUPER_URL = {
  urlKey: "super",
  toUrl: inv => ({ cik: inv.cik }),
  fromUrl: d => SUPER_INVESTORS.find(i => i.cik === d.cik) || null,
};

// Profils des Super Investors en base (cik → user_id), chargés une fois
let profilesPromise = null;
function loadProfiles() {
  profilesPromise ||= fetchSuperInvestors()
    .then(rows => Object.fromEntries(rows.map(r => [r.cik, r.user_id])))
    .catch(() => { profilesPromise = null; return {}; });
  return profilesPromise;
}

// Chaque Super Investor a un vrai profil Verio (on le suit comme un membre) ; tant que
// les comptes ne sont pas créés en base, la carte ouvre la fiche directe ci-dessous.
export default function SuperInvestors({ T, onViewProfile }) {
  const [investor, openInvestor, closeInvestor] = useDetailView(SUPER_URL);

  // On attend la liste des profils avant d'ouvrir (sinon un clic rapide ouvrait la fiche directe)
  async function open(inv) {
    const profiles = await loadProfiles();
    if (profiles[inv.cik] && onViewProfile) onViewProfile(profiles[inv.cik]);
    else openInvestor(inv);
  }

  // Fiche directe rouverte depuis l'adresse (actualisation) : le profil la remplace s'il existe
  useEffect(() => {
    if (!investor || !onViewProfile) return;
    let ignore = false;
    loadProfiles().then(profiles => {
      if (ignore || !profiles[investor.cik]) return;
      closeInvestor();
      onViewProfile(profiles[investor.cik]);
    });
    return () => { ignore = true; };
  }, [investor, onViewProfile, closeInvestor]);

  if (investor) return <InvestorDetail investor={investor} T={T} onBack={closeInvestor} />;

  return (
    <div>
      <div style={{ fontSize: 13, color: T.textFaint, marginBottom: 16, lineHeight: 1.6 }}>
        {t("Les positions des grands investisseurs, d'après leurs déclarations publiques à la SEC (formulaire 13F).")}
        {" "}{t("Mises à jour automatiquement chaque trimestre ; actions cotées aux États-Unis uniquement, publiées jusqu'à 45 jours après la fin du trimestre.")}
      </div>
      {SUPER_INVESTORS.map(inv => (
        <button key={inv.cik} onClick={() => open(inv)} aria-label={t("Voir le portefeuille de {name}", { name: inv.name })}
          style={{ display: "flex", gap: 14, alignItems: "center", width: "100%", textAlign: "left", background: T.bgCard, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: "14px 16px", marginBottom: 10, cursor: "pointer", fontFamily: "inherit", boxShadow: T.cardShadow }}>
          <LegendIcon icon={inv.icon} size={48} T={T} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: T.text }}>{inv.name}</span>
            <span style={{ display: "block", fontSize: 13, color: T.textMuted, marginTop: 2 }}>{inv.firm} · {t(inv.style)}</span>
            <InvestorSummary cik={inv.cik} T={T} />
          </span>
        </button>
      ))}
    </div>
  );
}

// Ligne « 41 positions · 1er trimestre 2026 » sous chaque gérant
function InvestorSummary({ cik, T }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let ignore = false;
    fetchInvestor(cik).then(d => { if (!ignore) setData(d); }, () => {});
    return () => { ignore = true; };
  }, [cik]);
  if (!data) return null;
  return (
    <span style={{ display: "block", fontSize: 12, color: T.accent, fontWeight: 600, marginTop: 4 }}>
      {t(data.positions.length > 1 ? "{n} positions · au {date}" : "{n} position · au {date}", { n: data.positions.length, date: fmtDate(data.period) })}
    </span>
  );
}

const MOVES = {
  new: { label: "Nouvelles positions", color: "accent" },
  up: { label: "Renforcements", color: "accent" },
  down: { label: "Allègements", color: "red" },
  sold: { label: "Ventes totales", color: "red" },
};

function InvestorDetail({ investor, T, onBack }) {
  const [state, setState] = useState({ cik: null, data: null, error: false });
  const [tab, setTab] = useState("portefeuille");
  const [showAll, setShowAll] = useState(false);
  const [asset, openAsset, closeAsset] = useDetailView();
  const [looking, setLooking] = useState(null);

  useEffect(() => {
    let ignore = false;
    fetchInvestor(investor.cik).then(
      data => { if (!ignore) setState({ cik: investor.cik, data, error: false }); },
      () => { if (!ignore) setState({ cik: investor.cik, data: null, error: true }); },
    );
    return () => { ignore = true; };
  }, [investor.cik]);

  async function openPosition(name) {
    setLooking(name);
    const found = await resolveAsset({ label: searchName(name) });
    if (found) { setLooking(null); openAsset(found); return; }
    // Nom de la déclaration non reconnu par la recherche (abrégé par la SEC…)
    setLooking(`!${name}`);
    setTimeout(() => setLooking(cur => (cur === `!${name}` ? null : cur)), 2500);
  }

  const lookLabel = name => (looking === name ? t("Recherche…") : looking === `!${name}` ? t("{name} · fiche introuvable", { name }) : name);

  if (asset) return <IndexDetail index={detailFor(asset)} T={T} backLabel={`← ${investor.name}`} onBack={closeAsset} />;

  const ready = state.cik === investor.cik;
  const { data, error } = ready ? state : { data: null, error: false };
  const stale = data?.stale; // plus de 7 mois sans déclaration (calculé par l'API)
  const shown = data ? (showAll ? data.positions : data.positions.slice(0, 20)) : [];
  const max = data?.positions[0]?.pct || 1;
  const tabBtn = id => ({ whiteSpace: "nowrap", padding: "7px 14px", borderRadius: 999, fontSize: 13, border: `0.5px solid ${tab === id ? T.accent : T.border}`, background: tab === id ? T.accentBg : "none", color: tab === id ? T.accent : T.textMuted, cursor: "pointer", fontFamily: "inherit" });
  const row = { display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: "10px 4px", background: "none", border: "none", borderTop: `0.5px solid ${T.border}`, cursor: "pointer", fontFamily: "inherit" };

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 13, padding: 0, marginBottom: 14, fontFamily: "inherit" }}>{t("← Légendes")}</button>
      <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 16 }}>
        <LegendIcon icon={investor.icon} size={56} T={T} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>{investor.name}</div>
          <div style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>{investor.firm} · {t(investor.style)}</div>
          {data && <div style={{ fontSize: 12, color: T.textFaint, marginTop: 4 }}>{t("Positions au {period} · déclarées le {filed}", { period: fmtDate(data.period), filed: fmtDate(data.filed) })}</div>}
        </div>
      </div>

      {!ready && <div style={{ fontSize: 13, color: T.textFaint, textAlign: "center", padding: "2rem" }}>{t("Chargement de la dernière déclaration…")}</div>}
      {error && <div style={{ fontSize: 13, color: T.textFaint, textAlign: "center", padding: "2rem" }}>{t("Déclaration indisponible pour le moment. Réessaie plus tard.")}</div>}

      {data && (
        <>
          {stale && (
            <div style={{ fontSize: 12, color: T.textMuted, background: T.bgSubtle, borderRadius: 10, padding: "8px 12px", marginBottom: 12, lineHeight: 1.5 }}>
              {t("Aucune nouvelle déclaration depuis le {date} : ce gestionnaire a peut-être cessé de déclarer ses positions.", { date: fmtDate(data.filed) })}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button onClick={() => setTab("portefeuille")} style={tabBtn("portefeuille")}>{t("Portefeuille")} · {data.positions.length}</button>
            <button onClick={() => setTab("mouvements")} style={tabBtn("mouvements")}>{t("Mouvements")}{data.moves.length ? ` · ${data.moves.length}` : ""}</button>
          </div>

          {tab === "portefeuille" && (
            <div style={{ background: T.bgCard, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: "4px 12px", boxShadow: T.cardShadow }}>
              {shown.map((p, i) => (
                <button key={p.cusip} onClick={() => openPosition(p.name)} aria-label={t("Voir la fiche {name}", { name: p.name })} style={{ ...row, borderTop: i === 0 ? "none" : row.borderTop }}>
                  <span style={{ width: 22, fontSize: 12, color: T.textFaint, textAlign: "right", flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lookLabel(p.name)}</span>
                    <span style={{ display: "block", height: 4, borderRadius: 2, background: T.bgSubtle, marginTop: 6 }}>
                      <span style={{ display: "block", height: 4, borderRadius: 2, background: T.accent, width: `${Math.max(2, (p.pct / max) * 100)}%` }} />
                    </span>
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.text, flexShrink: 0, minWidth: 56, textAlign: "right" }}>{fmtPct(p.pct)}</span>
                </button>
              ))}
              {data.positions.length > 20 && (
                <button onClick={() => setShowAll(v => !v)} style={{ ...row, justifyContent: "center", fontSize: 13, color: T.accent, fontWeight: 600 }}>
                  {showAll ? t("Voir moins") : t("Voir les {n} positions", { n: data.positions.length })}
                </button>
              )}
            </div>
          )}

          {tab === "mouvements" && (
            <div>
              {!data.previousPeriod && <div style={{ fontSize: 13, color: T.textFaint, textAlign: "center", padding: "1.5rem" }}>{t("Pas de déclaration précédente pour comparer.")}</div>}
              {data.previousPeriod && data.moves.length === 0 && <div style={{ fontSize: 13, color: T.textFaint, textAlign: "center", padding: "1.5rem" }}>{t("Aucun changement depuis le {date}.", { date: fmtDate(data.previousPeriod) })}</div>}
              {data.previousPeriod && data.moves.length > 0 && (
                <div style={{ fontSize: 12, color: T.textFaint, marginBottom: 10 }}>{t("Par rapport aux positions du {date} · en % du portefeuille", { date: fmtDate(data.previousPeriod) })}</div>
              )}
              {Object.entries(MOVES).map(([type, meta]) => {
                const list = data.moves.filter(m => m.type === type);
                if (!list.length) return null;
                const color = meta.color === "red" ? T.red : T.up;
                return (
                  <div key={type} style={{ background: T.bgCard, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: "10px 12px 4px", marginBottom: 12, boxShadow: T.cardShadow }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 4 }}>{t(meta.label)} · {list.length}</div>
                    {list.map(m => (
                      <button key={m.cusip} onClick={() => openPosition(m.name)} aria-label={t("Voir la fiche {name}", { name: m.name })} style={row}>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lookLabel(m.name)}</span>
                          {m.sharesChange != null && <span style={{ display: "block", fontSize: 11, color: T.textFaint, marginTop: 2 }}>{t("{value} % d'actions", { value: `${m.sharesChange > 0 ? "+" : ""}${m.sharesChange}` })}</span>}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color, flexShrink: 0 }}>{fmtPct(m.before)} → {fmtPct(m.after)}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {data.options > 0 && (
            <div style={{ fontSize: 12, color: T.textFaint, marginTop: 10 }}>
              {t(data.options > 1 ? "+ {n} lignes d'options (put / call) non affichées." : "+ {n} ligne d'options (put / call) non affichée.", { n: data.options })}
            </div>
          )}
          <div style={{ fontSize: 11, color: T.textFaint, marginTop: 14, lineHeight: 1.5 }}>
            {t("Source : déclaration 13F de {filer} à la SEC. Positions longues en actions cotées aux États-Unis uniquement ; pas de liquidités, ventes à découvert ni actifs hors États-Unis.", { filer: data.filer })}
          </div>
        </>
      )}
    </div>
  );
}
