import { useState, useEffect } from "react";
import { analyzeDiversification } from "../diversification";
import Icon from "./Icon";
import { t } from "../i18n";

// Diversification détaillée (portefeuille privé) : zones géographiques, taille des
// entreprises et types d'actifs, chacun en barre empilée et en liste, en % seulement.

const fmt = v => (v < 1 ? "<1" : v.toFixed(0));

function Breakdown({ title, icon, rows, note, colors, T }) {
  if (!rows.length) return null;
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: T.text, display: "flex", alignItems: "center", gap: 6, marginBottom: note ? 2 : 8 }}>
        <Icon name={icon} size={14} style={{ color: T.accent }} />{t(title)}
      </div>
      {note && <div style={{ fontSize: 11, color: T.textFaint, marginBottom: 8 }}>{note}</div>}
      <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", background: T.bgSubtle, marginBottom: 8, gap: 2 }}>
        {rows.map(([k, v], i) => <div key={k} title={`${t(k)} : ${fmt(v)} %`} style={{ width: `${v}%`, background: colors(k, i) }} />)}
      </div>
      {rows.map(([k, v], i) => (
        <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, padding: "3px 0" }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: colors(k, i), flexShrink: 0 }} />
          <span style={{ flex: 1, color: T.textMuted }}>{t(k)}</span>
          <span style={{ fontWeight: 600, color: T.text }}>{t("{v} %", { v: fmt(v) })}</span>
        </div>
      ))}
    </div>
  );
}

export default function Diversification({ entries, T, onVol }) {
  const key = JSON.stringify((entries || []).map(e => [e.label, e.isin, e.type, e.exposition, Number(e.percentage)]));
  const [state, setState] = useState({ key: null, data: null });

  useEffect(() => {
    let ignore = false;
    analyzeDiversification(JSON.parse(key).map(([label, isin, type, exposition, percentage]) => ({ label, isin, type, exposition, percentage })))
      .catch(() => null)
      .then(data => {
        if (ignore) return;
        setState({ key, data });
        if (data && onVol) onVol(data.vol);
      });
    return () => { ignore = true; };
  }, [key, onVol]);

  const data = state.key === key ? state.data : null;
  if (state.key !== key) return <div style={{ marginTop: 16, fontSize: 12, color: T.textFaint, textAlign: "center" }}>{t("Analyse de la diversification…")}</div>;
  if (!data) return null;

  const palette = [T.accent, T.blue, T.purple, T.up, T.yellow, T.orange, T.gold];
  const neutral = k => /Non |Hors zone|Autres$/.test(k);
  const colors = (k, i) => (neutral(k) ? T.textFaint : palette[i % palette.length]);

  return (
    <div>
      <Breakdown T={T} title="Zones géographiques" icon="globe" rows={data.zones} colors={colors} />
      <Breakdown T={T} title="Taille des entreprises" icon="building" rows={data.sizes} colors={colors}
        note={t("Sur la part en actions ({v} %)", { v: fmt(data.equityPct) })} />
      <Breakdown T={T} title="Par type" icon="layers" rows={data.types} colors={colors} />
      <div style={{ fontSize: 11, color: T.textFaint, lineHeight: 1.5, marginTop: 12 }}>
        {t("Estimations : une action compte pour le pays de la société ; un ETF est réparti d'après l'indice qu'il suit, reconnu à son nom. La taille vient de la capitalisation boursière (grandes : plus de 10 Md$, petites : moins de 2 Md$).")}
      </div>
    </div>
  );
}
