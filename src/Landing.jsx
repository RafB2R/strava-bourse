import { useState } from "react";
import Icon from "./components/Icon";
import Logo from "./components/Logo";
import { t, LANG, setLang } from "./i18n";

// Adaptation au téléphone : les styles en ligne décrivent la version ordinateur,
// ces règles les remplacent sous 640 px de large.
const RESPONSIVE_CSS = `
@media (max-width: 640px) {
  .lp-nav { padding: max(16px, env(safe-area-inset-top)) 20px 16px !important; }
  .lp-navlink { display: none !important; }
  .lp-pad { padding-left: 20px !important; padding-right: 20px !important; }
  .lp-hero { padding-top: 48px !important; padding-bottom: 48px !important; }
  .lp-section { padding-top: 48px !important; padding-bottom: 48px !important; }
  .lp-h1 { font-size: 38px !important; letter-spacing: -1px !important; }
  .lp-h1-page { font-size: 32px !important; letter-spacing: -1px !important; }
  .lp-h2 { font-size: 28px !important; letter-spacing: -0.5px !important; }
  .lp-lead { font-size: 16px !important; }
  .lp-grid { grid-template-columns: 1fr !important; }
  .lp-grid3 { grid-template-columns: 1fr 1fr !important; }
  .lp-card { padding: 20px !important; }
  .lp-quote { margin-left: 20px !important; margin-right: 20px !important; }
  .lp-cta { width: 100%; max-width: 360px; }
}
`;

// Icône de trait dans une pastille teintée (accent de la landing)
function LpIcon({ name, size = 20, box = 40, style }) {
  return (
    <div style={{ width: box, height: box, borderRadius: 12, background: "rgba(255,107,44,0.08)", border: "0.5px solid rgba(255,107,44,0.15)", color: "#FF6B2C", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, ...style }}>
      <Icon name={name} size={size} />
    </div>
  );
}

function ResponsiveStyle() {
  return <style>{RESPONSIVE_CSS}</style>;
}

function FooterLinks({ onPage }) {
  const link = { fontSize: 13, color: "rgba(255,255,255,0.45)", cursor: "pointer", background: "none", border: "none", fontFamily: "inherit", padding: 4 };
  return (
    <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", marginBottom: 10 }}>
      <button onClick={() => onPage("home")} style={link}>{t("Accueil")}</button>
      <button onClick={() => onPage("fonctionnalites")} style={link}>{t("Fonctionnalités")}</button>
      <button onClick={() => onPage("communaute")} style={link}>{t("Communauté")}</button>
    </div>
  );
}

// Choix de la langue (recharge la page)
function LangSwitch() {
  const btn = active => ({ background: "none", border: "none", padding: 4, fontFamily: "inherit", fontSize: 12, cursor: active ? "default" : "pointer", color: active ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.3)", fontWeight: active ? 600 : 400 });
  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={() => setLang("fr")} style={btn(LANG === "fr")} aria-pressed={LANG === "fr"} lang="fr">FR</button>
      <span aria-hidden="true"> / </span>
      <button onClick={() => setLang("en")} style={btn(LANG === "en")} aria-pressed={LANG === "en"} lang="en">EN</button>
    </div>
  );
}

// Nos engagements, à la place d'un témoignage (pas de faux avis)
function Commitments({ className = "", style }) {
  const items = [
    ["lock", t("Tes montants ne sont jamais visibles : seulement des pourcentages.")],
    ["mail", t("Tes messages privés ne sont lisibles que par toi et ton ami.")],
    ["compass", t("Pas de conseils d'achat : chacun reste maître de ses choix.")],
  ];
  return (
    <div className={`lp-card ${className}`} style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 28, ...style }}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>{t("Nos engagements")}</div>
      {items.map(([icon, text]) => (
        <div key={text} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
          <Icon name={icon} size={16} style={{ color: "#FF6B2C", marginTop: 3 }} />
          <span style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>{text}</span>
        </div>
      ))}
    </div>
  );
}

function LandingFooter({ onPage }) {
  return (
    <div style={{ textAlign: "center", padding: "28px 20px calc(28px + env(safe-area-inset-bottom))", borderTop: "0.5px solid rgba(255,255,255,0.05)", fontSize: 12, color: "rgba(255,255,255,0.15)" }}>
      <FooterLinks onPage={onPage} />
      © 2026 Verio · {t("Les montants restent toujours privés")}
      <LangSwitch />
    </div>
  );
}

const dark = { background: "#0D0D0D", color: "#f0f0f0", fontFamily: "Outfit, system-ui, -apple-system, sans-serif", minHeight: "100vh" };
const navStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 48px" };

function NavLogo({ onHome }) {
  return <Logo size={22} onClick={onHome} />;
}

function Nav({ onStart, onPage, onHome }) {
  return (
    <nav className="lp-nav" style={navStyle}>
      <NavLogo onHome={onHome} />
      <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
        <span className="lp-navlink" onClick={() => onPage("fonctionnalites")} style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", cursor: "pointer" }}>{t("Fonctionnalités")}</span>
        <span className="lp-navlink" onClick={() => onPage("communaute")} style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", cursor: "pointer" }}>{t("Communauté")}</span>
        <button onClick={onStart} style={{ background: "#FF6B2C", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, color: "#0D0D0D", cursor: "pointer", fontFamily: "inherit" }}>{t("Commencer")}</button>
      </div>
    </nav>
  );
}

function Fonctionnalites({ onStart, onPage, onHome }) {
  const features = [
    { icon: "pie", title: t("Tout ton portefeuille au même endroit"), desc: t("Ajoute tes positions, quel que soit ton courtier : Boursorama, Trade Republic, Degiro, assurance vie… Verio calcule ta performance, ta répartition et tes dividendes à venir."), tag: t("Portefeuille") },
    { icon: "zap", title: t("Fil d'activités"), desc: t("Les mouvements de tes amis apparaissent dans ton fil : nouvelle position, renforcement, allègement, toujours en pourcentage. Publie aussi tes analyses, photos et sondages."), tag: t("Social") },
    { icon: "award", title: t("Badges de discipline"), desc: t("12 mois d'affilée d'investissement, 10 ans d'ancienneté, un portefeuille diversifié… Des récompenses qui mesurent ce qui compte vraiment : la constance, pas la chance."), tag: t("Gamification") },
    { icon: "landmark", title: t("Clubs thématiques"), desc: t("Rejoins des communautés d'investisseurs qui partagent ta stratégie, ou crée la tienne : ETF Monde, Dividendes, PEA… Chaque club a ses discussions et son classement."), tag: t("Communauté") },
    { icon: "users", title: t("Comparaison entre amis"), desc: t("Compare ta performance, ta diversification et ta régularité avec tes proches. Les montants restent toujours privés : seuls les pourcentages sont visibles."), tag: t("Social") },
    { icon: "line", title: t("Marchés et revenus"), desc: t("Les grands indices, les secteurs et les taux d'État en un coup d'œil, et le calendrier des dividendes que ton portefeuille devrait te verser."), tag: t("Analyse") },
  ];

  return (
    <div style={dark}>
      <ResponsiveStyle />
      <Nav onStart={onStart} onPage={onPage} onHome={onHome} />
      <div className="lp-pad lp-section" style={{ maxWidth: 700, margin: "0 auto", padding: "60px 48px 100px" }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>{t("Ce que Verio propose")}</div>
        <h1 className="lp-h1-page" style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1.5, color: "#fff", marginBottom: 12, lineHeight: 1.15 }}>{t("Tout ce dont tu as besoin")}<br /><span style={{ color: "#FF6B2C" }}>{t("pour investir mieux.")}</span></h1>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", marginBottom: 56, lineHeight: 1.7 }}>{t("Verio réunit dans une seule app tout ce qu'il faut pour suivre, comprendre et partager ton parcours d'investisseur.")}</p>

        <div className="lp-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {features.map(f => (
            <div key={f.title} className="lp-card" style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <LpIcon name={f.icon} size={18} box={36} />
                <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 500, background: "rgba(255,107,44,0.08)", color: "#FF6B2C" }}>{f.tag}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 8 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 56, textAlign: "center" }}>
          <button className="lp-cta" onClick={onStart} style={{ background: "#FF6B2C", border: "none", borderRadius: 10, padding: "15px 36px", fontSize: 15, fontWeight: 700, color: "#0D0D0D", cursor: "pointer", fontFamily: "inherit" }}>{t("Commencer gratuitement")}</button>
        </div>
      </div>
      <LandingFooter onPage={onPage} />
    </div>
  );
}

function Communaute({ onStart, onPage, onHome }) {
  const values = [
    { icon: "leaf", title: t("Long terme avant tout"), desc: t("Verio est fait pour les investisseurs qui pensent en années, pas en heures. Pas de signaux d'achat, pas de course au trading. Juste ton parcours.") },
    { icon: "handshake", title: t("Une communauté, pas une compétition"), desc: t("On ne compare pas les patrimoines — on compare les habitudes. Quelqu'un qui investit 100 € par mois avec discipline est plus inspirant qu'un coup de chance à 50 000 €.") },
    { icon: "lock", title: t("Tes montants restent privés"), desc: t("Personne ne verra jamais combien tu investis. Seulement tes performances en pourcentage. Parce que l'argent, c'est personnel.") },
    { icon: "megaphone", title: t("Pas de fake gurus"), desc: t("Pas de screeners de trades, pas de '+400% ce mois'. Verio récompense la régularité et la discipline — pas la spéculation.") },
  ];

  // Thèmes de clubs possibles (aucun chiffre d'audience : Verio démarre)
  const clubs = [
    { icon: "globe", name: "ETF Monde", members: t("Investir passivement") },
    { icon: "coins", name: "Dividendes", members: t("Revenus réguliers") },
    { icon: "up", name: "Value Investing", members: t("Sociétés sous-cotées") },
    { icon: "home", name: "SCPI & Immo", members: t("Pierre-papier") },
    { icon: "briefcase", name: "PEA", members: t("Fiscalité française") },
    { icon: "bitcoin", name: "Bitcoin", members: t("Long terme") },
  ];

  return (
    <div style={dark}>
      <ResponsiveStyle />
      <Nav onStart={onStart} onPage={onPage} onHome={onHome} />
      <div className="lp-pad lp-section" style={{ maxWidth: 700, margin: "0 auto", padding: "60px 48px 100px" }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>{t("Notre état d'esprit")}</div>
        <h1 className="lp-h1-page" style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1.5, color: "#fff", marginBottom: 12, lineHeight: 1.15 }}>{t("Un club,")}<br /><span style={{ color: "#FF6B2C" }}>{t("pas une app.")}</span></h1>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", marginBottom: 56, lineHeight: 1.7 }}>{t("Verio c'est l'opposé de WallStreetBets. Pas de hype, pas de spéculation. Une communauté d'investisseurs qui pensent long terme et s'entraident.")}</p>

        <div className="lp-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 56 }}>
          {values.map(v => (
            <div key={v.title} className="lp-card" style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 24 }}>
              <LpIcon name={v.icon} style={{ marginBottom: 14 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 8 }}>{v.title}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>{v.desc}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>{t("Des clubs pour chaque stratégie")}</div>
        <div className="lp-grid3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 56 }}>
          {clubs.map(c => (
            <div key={c.name} style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "16px 14px", textAlign: "center" }}>
              <LpIcon name={c.icon} size={18} box={36} style={{ margin: "0 auto 10px" }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 4 }}>{t(c.name)}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>{c.members}</div>
            </div>
          ))}
        </div>

        <Commitments style={{ marginBottom: 48 }} />

        <div style={{ textAlign: "center" }}>
          <button className="lp-cta" onClick={onStart} style={{ background: "#FF6B2C", border: "none", borderRadius: 10, padding: "15px 36px", fontSize: 15, fontWeight: 700, color: "#0D0D0D", cursor: "pointer", fontFamily: "inherit" }}>{t("Commencer gratuitement")}</button>
        </div>
      </div>
      <LandingFooter onPage={onPage} />
    </div>
  );
}

export default function Landing({ onStart }) {
  const [page, setPage] = useState("home");

  if (page === "fonctionnalites") return <Fonctionnalites onStart={onStart} onPage={setPage} onHome={() => setPage("home")} />;
  if (page === "communaute") return <Communaute onStart={onStart} onPage={setPage} onHome={() => setPage("home")} />;

  return (
    <div style={dark}>
      <ResponsiveStyle />
      <nav className="lp-nav" style={navStyle}>
        <NavLogo onHome={() => setPage("home")} />
        <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
          <span className="lp-navlink" onClick={() => setPage("fonctionnalites")} style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", cursor: "pointer" }}>{t("Fonctionnalités")}</span>
          <span className="lp-navlink" onClick={() => setPage("communaute")} style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", cursor: "pointer" }}>{t("Communauté")}</span>
          <button onClick={onStart} style={{ background: "#FF6B2C", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, color: "#0D0D0D", cursor: "pointer", fontFamily: "inherit" }}>{t("Commencer")}</button>
        </div>
      </nav>

      <div className="lp-pad lp-hero" style={{ textAlign: "center", padding: "100px 48px 80px", maxWidth: 700, margin: "0 auto" }}>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 28 }}>{t("Pour les investisseurs long terme")}</div>
        <h1 className="lp-h1" style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.1, letterSpacing: -2, color: "#fff", marginBottom: 12 }}>
          {t("Construis ton patrimoine.")}<br /><span style={{ color: "#FF6B2C" }}>{t("Entouré.")}</span>
        </h1>
        <div className="lp-lead" style={{ fontSize: 18, color: "rgba(255,255,255,0.4)", marginBottom: 12 }}>{t("Investir, c'est un parcours. Pas une course.")}</div>
        <div style={{ fontSize: 15, color: "rgba(255,255,255,0.25)", marginBottom: 48 }}>{t("Suis ton portefeuille, partage ton parcours et progresse avec tes proches et une communauté d'investisseurs qui pensent long terme.")}</div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <button className="lp-cta" onClick={onStart} style={{ background: "#FF6B2C", border: "none", borderRadius: 10, padding: "15px 36px", fontSize: 15, fontWeight: 700, color: "#0D0D0D", cursor: "pointer", fontFamily: "inherit" }}>{t("Commencer gratuitement")}</button>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}>{t("Gratuit · Aucune carte requise")}</div>
        </div>
      </div>

      <div style={{ width: "0.5px", height: 80, background: "rgba(255,255,255,0.08)", margin: "0 auto" }} />

      <div className="lp-pad lp-section" style={{ padding: "80px 48px", maxWidth: 700, margin: "0 auto" }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 20 }}>{t("Notre conviction")}</div>
        <h2 className="lp-h2" style={{ fontSize: 36, fontWeight: 700, letterSpacing: -1, color: "#fff", lineHeight: 1.2, marginBottom: 16 }}>
          {t("Conçu pour les investisseurs,")}<br />{t("pas les")} <span style={{ color: "#FF6B2C" }}>traders.</span>
        </h2>
        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.4)", lineHeight: 1.8, maxWidth: 500 }}>
          {t("La plupart des apps se concentrent sur les achats et les ventes. Verio se concentre sur la construction d'un patrimoine durable. Parce qu'investir avec succès, ce n'est pas timer le marché — c'est rester investi.")}
        </p>
      </div>

      <div className="lp-pad lp-grid" style={{ padding: "0 48px 80px", maxWidth: 700, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[
          { icon: "chart", title: t("Suis ta progression"), text: t("Toutes tes positions, tous courtiers confondus. Ta performance, ta répartition, tes dividendes.") },
          { icon: "trophy", title: t("Reste discipliné"), text: t("Séries d'investissement mensuel, badges, moments clés. Investir comme une habitude.") },
          { icon: "users", title: t("Progresse avec les autres"), text: t("Ajoute tes amis, rejoins des clubs, partage ton parcours. Grandis ensemble.") },
          { icon: "up", title: t("Au-delà des rendements"), text: t("La constance compte plus que la performance. Mesure ta discipline, pas juste tes gains.") },
        ].map(f => (
          <div key={f.title} className="lp-card" style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 28 }}>
            <LpIcon name={f.icon} style={{ marginBottom: 16 }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 8 }}>{f.title}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>{f.text}</div>
          </div>
        ))}
      </div>

      <div style={{ width: "0.5px", height: 80, background: "rgba(255,255,255,0.08)", margin: "0 auto" }} />

      <div className="lp-pad lp-section" style={{ textAlign: "center", padding: "80px 48px", maxWidth: 600, margin: "0 auto" }}>
        <h2 className="lp-h2" style={{ fontSize: 32, fontWeight: 700, letterSpacing: -1, color: "#fff", marginBottom: 24, lineHeight: 1.2 }}>{t("Investir n'est pas une compétition.")}<br />{t("C'est une habitude.")}</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 40 }}>
          {[["Discipline", true], ["Patience", true], ["Régularité", true], ["Sans hype", false], ["Progression", true], ["Sans spéculation", false], ["Communauté", true], ["Long terme", true]].map(([w, hi]) => (
            <span key={w} style={{ padding: "6px 16px", borderRadius: 999, fontSize: 13, fontWeight: 500, border: `0.5px solid ${hi ? "rgba(255,107,44,0.3)" : "rgba(255,255,255,0.1)"}`, color: hi ? "#FF6B2C" : "rgba(255,255,255,0.45)", background: hi ? "rgba(255,107,44,0.06)" : "none" }}>{t(w)}</span>
          ))}
        </div>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.25)", lineHeight: 1.7 }}>{t("Que tu investisses 100 € ou 100 000 €, tout le monde commence de la même façon. Un investissement à la fois.")}</p>
      </div>

      <Commitments className="lp-quote" style={{ maxWidth: 600, margin: "0 auto 80px" }} />

      <div className="lp-pad lp-section" style={{ textAlign: "center", padding: "80px 48px 100px" }}>
        <h2 className="lp-h2" style={{ fontSize: 36, fontWeight: 700, letterSpacing: -1, color: "#fff", marginBottom: 12 }}>{t("Prêt à investir autrement ?")}</h2>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.35)", marginBottom: 36 }}>{t("Verio démarre : rejoins les premiers membres et invite tes proches.")}</p>
        <button className="lp-cta" onClick={onStart} style={{ background: "#FF6B2C", border: "none", borderRadius: 10, padding: "15px 36px", fontSize: 15, fontWeight: 700, color: "#0D0D0D", cursor: "pointer", fontFamily: "inherit" }}>{t("Commencer gratuitement")}</button>
      </div>

      <LandingFooter onPage={setPage} />
    </div>
  );
}
