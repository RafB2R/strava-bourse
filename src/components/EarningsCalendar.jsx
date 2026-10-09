import { useState } from "react";
import { t, LOCALE } from "../i18n";

// Calendrier des résultats d'entreprises : mois en grille (un point sous chaque jour
// avec des publications), liste du mois à côté, flèches pour changer de mois.
// Un clic sur un jour filtre la liste ; un clic sur une entreprise ouvre sa fiche.

// Initiales des jours, du lundi au dimanche
const WEEKDAYS = t("L,M,M,J,V,S,D").split(",");
const TIME_LABELS = { "pre-market": t("avant ouverture"), "post-market": t("après clôture") };
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmtEps = (v, currency) => `${v.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\u00a0${currency === "USD" || !currency ? "$" : currency}`;

export default function EarningsCalendar({ earnings, loading, T, onOpen }) {
  const today = new Date();
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(null);

  // Mois navigables : du mois en cours au dernier mois qui a des publications
  const lastDate = earnings.length ? new Date(earnings[earnings.length - 1].date) : today;
  const minMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const maxMonth = new Date(lastDate.getFullYear(), lastDate.getMonth(), 1);
  const canPrev = month > minMonth, canNext = month < maxMonth;
  const changeMonth = delta => { setMonth(m => new Date(m.getFullYear(), m.getMonth() + delta, 1)); setSelectedDay(null); };

  const monthKey = ymd(month).slice(0, 7);
  const ofMonth = earnings.filter(e => e.date.startsWith(monthKey));
  const byDay = {};
  for (const e of ofMonth) (byDay[e.date] ||= []).push(e);
  const list = selectedDay ? byDay[selectedDay] || [] : ofMonth;

  // Grille : cases vides avant le 1er (semaine commençant le lundi), puis les jours
  const offset = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  const todayKey = ymd(today);
  const monthLabel = month.toLocaleDateString(LOCALE, { month: "long", year: "numeric" });
  const arrow = enabled => ({ background: "none", border: `0.5px solid ${T.border}`, borderRadius: 8, width: 30, height: 30, cursor: enabled ? "pointer" : "default", color: enabled ? T.text : T.textFaint, opacity: enabled ? 1 : 0.4, fontSize: 15, fontFamily: "inherit" });

  return (
    <div className="earnings-layout" style={{ display: "grid", gridTemplateColumns: "minmax(0, 300px) minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
      <style>{`@media (max-width: 640px) { .earnings-layout { grid-template-columns: minmax(0, 1fr) !important; } }`}</style>

      {/* Calendrier */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <button onClick={() => canPrev && changeMonth(-1)} disabled={!canPrev} aria-label={t("Mois précédent")} style={arrow(canPrev)}>‹</button>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, textTransform: "capitalize" }}>{monthLabel}</div>
          <button onClick={() => canNext && changeMonth(1)} disabled={!canNext} aria-label={t("Mois suivant")} style={arrow(canNext)}>›</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, textAlign: "center" }}>
          {WEEKDAYS.map((d, i) => <div key={i} style={{ fontSize: 10, color: T.textFaint, fontWeight: 600, padding: "2px 0 6px" }}>{d}</div>)}
          {cells.map((d, i) => {
            if (!d) return <div key={`v${i}`} />;
            const key = ymd(d);
            const count = byDay[key]?.length || 0;
            const selected = selectedDay === key;
            const isToday = key === todayKey;
            return (
              <button key={key} onClick={() => count && setSelectedDay(selected ? null : key)} disabled={!count}
                aria-label={count ? t(count > 1 ? "{date} : {n} publications" : "{date} : {n} publication", { date: `${d.getDate()} ${monthLabel}`, n: count }) : `${d.getDate()} ${monthLabel}`} aria-pressed={selected}
                style={{ height: 38, borderRadius: 8, border: `0.5px solid ${selected ? T.accent : isToday ? T.borderStrong : "transparent"}`, background: selected ? T.accentBg : "none", cursor: count ? "pointer" : "default", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, padding: 0 }}>
                <span style={{ fontSize: 12, fontWeight: count ? 700 : 400, color: count ? T.text : T.textFaint }}>{d.getDate()}</span>
                <span style={{ display: "flex", gap: 2, height: 5 }}>
                  {Array.from({ length: Math.min(count, 3) }).map((_, j) => <span key={j} style={{ width: 5, height: 5, borderRadius: "50%", background: T.accent }} />)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Liste du mois (ou du jour choisi) */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, minHeight: 30 }}>
          <span style={{ flex: 1, fontSize: 12, color: T.textMuted }}>
            {selectedDay
              ? new Date(`${selectedDay}T12:00:00`).toLocaleDateString(LOCALE, { weekday: "long", day: "numeric", month: "long" })
              : t(ofMonth.length > 1 ? "{n} publications ce mois-ci" : "{n} publication ce mois-ci", { n: ofMonth.length })}
          </span>
          {selectedDay && <button onClick={() => setSelectedDay(null)} style={{ background: "none", border: "none", fontSize: 12, color: T.accent, cursor: "pointer", fontFamily: "inherit" }}>{t("Tout le mois")}</button>}
        </div>
        <div style={{ maxHeight: 340, overflowY: "auto", paddingRight: 2 }}>
          {loading && <div style={{ fontSize: 13, color: T.textFaint, textAlign: "center", padding: "1rem" }}>{t("Chargement…")}</div>}
          {!loading && list.length === 0 && <div style={{ fontSize: 13, color: T.textFaint, textAlign: "center", padding: "1rem" }}>{t("Aucune publication suivie ce mois-ci")}</div>}
          {list.map((e, i) => {
            const d = new Date(`${e.date}T12:00:00`);
            return (
              <button key={`${e.symbol}-${e.date}`} onClick={() => onOpen?.(e)}
                style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: "9px 4px", background: "none", border: "none", borderTop: i === 0 ? "none" : `0.5px solid ${T.border}`, cursor: "pointer", fontFamily: "inherit" }}>
                <span style={{ width: 42, height: 42, borderRadius: 10, background: T.bgSubtle, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 13, color: T.accent, fontWeight: 700 }}>{d.getDate()}</span>
                  <span style={{ fontSize: 9, color: T.textMuted }}>{d.toLocaleString(LOCALE, { month: "short" })}</span>
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</span>
                  <span style={{ display: "block", fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                    {e.symbol}{e.time ? ` · ${TIME_LABELS[e.time]}` : ""}{e.eps !== null && e.eps !== undefined ? ` · ${t("BPA estimé")}\u00a0${fmtEps(e.eps, e.currency)}` : ""}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
