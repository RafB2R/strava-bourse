import { useState } from "react";

const dark = { background: "#111318", color: "#f0f0f0", fontFamily: "system-ui, -apple-system, sans-serif", minHeight: "100vh" };
const navStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 48px" };

function Logo({ onHome }) {
  return <div onClick={onHome} style={{ fontSize: 20, fontWeight: 700, color: "#fff", letterSpacing: -0.5, cursor: "pointer" }}>ve<span style={{ color: "#9FE1CB" }}>rio</span></div>;
}

function Nav({ onStart, onPage, onHome }) {
  return (
    <nav style={navStyle}>
      <Logo onHome={onHome} />
      <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
        <span onClick={() => onPage("fonctionnalites")} style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", cursor: "pointer" }}>Fonctionnalités</span>
        <span onClick={() => onPage("communaute")} style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", cursor: "pointer" }}>Communauté</span>
        <button onClick={onStart} style={{ background: "#9FE1CB", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, color: "#0F6E56", cursor: "pointer", fontFamily: "inherit" }}>Commencer</button>
      </div>
    </nav>
  );
}

function Fonctionnalites({ onStart, onPage, onHome }) {
  const features = [
    { icon: "📊", title: "Portefeuille multi-broker", desc: "Connecte tous tes comptes en un seul endroit. Boursorama, Saxo, Trade Republic, Degiro — tout est agrégé automatiquement. Tu vois ta vraie allocation, ta vraie performance.", tag: "Portefeuille" },
    { icon: "⚡", title: "Fil d'activités", desc: "Chaque investissement de tes amis apparaît automatiquement. Achat, renforcement, rebalancement, série de DCA. Pas de saisie manuelle — tout est détecté.", tag: "Social" },
    { icon: "🏅", title: "Badges de discipline", desc: "100 mois de DCA. 5 ans sans vendre. Zéro cash depuis 3 ans. Des récompenses qui mesurent ce qui compte vraiment : la constance, pas la chance.", tag: "Gamification" },
    { icon: "🏛️", title: "Clubs thématiques", desc: "Rejoins des communautés d'investisseurs qui partagent ta stratégie. ETF Monde, Dividendes, Value Investing, PEA France — chaque club a ses classements et discussions.", tag: "Communauté" },
    { icon: "👥", title: "Comparaison entre amis", desc: "Compare tes performances avec tes proches. Les montants restent toujours privés — seuls les pourcentages sont visibles. Sain et motivant.", tag: "Social" },
    { icon: "📈", title: "Stats avancées", desc: "Au-delà du rendement brut : Sharpe ratio, drawdown, exposition sectorielle, évolution de l'allocation dans le temps. Comprends vraiment comment tu investis.", tag: "Analyse" },
  ];

  return (
    <div style={dark}>
      <Nav onStart={onStart} onPage={onPage} onHome={onHome} />
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "60px 48px 100px" }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>Ce que Verio propose</div>
        <h1 style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1.5, color: "#fff", marginBottom: 12, lineHeight: 1.15 }}>Tout ce dont tu as besoin<br /><span style={{ color: "#9FE1CB" }}>pour investir mieux.</span></h1>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", marginBottom: 56, lineHeight: 1.7 }}>Verio réunit dans une seule app tout ce qu'il faut pour suivre, comprendre et partager ton parcours d'investisseur.</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {features.map(f => (
            <div key={f.title} style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ fontSize: 22 }}>{f.icon}</div>
                <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 500, background: "rgba(159,225,203,0.08)", color: "#9FE1CB" }}>{f.tag}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 8 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 56, textAlign: "center" }}>
          <button onClick={onStart} style={{ background: "#9FE1CB", border: "none", borderRadius: 10, padding: "15px 36px", fontSize: 15, fontWeight: 700, color: "#0F6E56", cursor: "pointer", fontFamily: "inherit" }}>Commencer gratuitement</button>
        </div>
      </div>
    </div>
  );
}

function Communaute({ onStart, onPage, onHome }) {
  const values = [
    { icon: "🧘", title: "Long terme avant tout", desc: "Verio est fait pour les investisseurs qui pensent en années, pas en heures. Pas de cours en temps réel, pas de signaux d'achat. Juste ton parcours." },
    { icon: "🤝", title: "Une communauté, pas une compétition", desc: "On ne compare pas les patrimoines — on compare les habitudes. Quelqu'un qui investit 100 € par mois avec discipline est plus inspirant qu'un coup de chance à 50 000 €." },
    { icon: "🔒", title: "Tes montants restent privés", desc: "Personne ne verra jamais combien tu investis. Seulement tes performances en pourcentage. Parce que l'argent, c'est personnel." },
    { icon: "📣", title: "Pas de fake gurus", desc: "Pas de screeners de trades, pas de '+400% ce mois'. Verio récompense la régularité et la discipline — pas la spéculation." },
  ];

  const clubs = [
    { icon: "📊", name: "ETF Monde", members: "2 341 membres" },
    { icon: "💰", name: "Dividendes", members: "1 876 membres" },
    { icon: "📈", name: "Value Investing", members: "934 membres" },
    { icon: "🏠", name: "SCPI & Immo", members: "721 membres" },
    { icon: "💼", name: "PEA France", members: "1 203 membres" },
    { icon: "₿", name: "Bitcoin", members: "654 membres" },
  ];

  return (
    <div style={dark}>
      <Nav onStart={onStart} onPage={onPage} onHome={onHome} />
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "60px 48px 100px" }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>Notre état d'esprit</div>
        <h1 style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1.5, color: "#fff", marginBottom: 12, lineHeight: 1.15 }}>Un club,<br /><span style={{ color: "#9FE1CB" }}>pas une app.</span></h1>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", marginBottom: 56, lineHeight: 1.7 }}>Verio c'est l'opposé de WallStreetBets. Pas de hype, pas de spéculation. Une communauté d'investisseurs qui pensent long terme et s'entraident.</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 56 }}>
          {values.map(v => (
            <div key={v.title} style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 24 }}>
              <div style={{ fontSize: 24, marginBottom: 12 }}>{v.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 8 }}>{v.title}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>{v.desc}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>Les clubs les plus actifs</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 56 }}>
          {clubs.map(c => (
            <div key={c.name} style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "16px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{c.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 4 }}>{c.name}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>{c.members}</div>
            </div>
          ))}
        </div>

        <div style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 28, marginBottom: 48 }}>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.6)", lineHeight: 1.7, fontStyle: "italic", marginBottom: 12 }}>« Pour la première fois, j'aime vraiment suivre mes investissements. »</p>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.25)" }}>Sophie L. · Membre Verio · 28 mois de DCA</div>
        </div>

        <div style={{ textAlign: "center" }}>
          <button onClick={onStart} style={{ background: "#9FE1CB", border: "none", borderRadius: 10, padding: "15px 36px", fontSize: 15, fontWeight: 700, color: "#0F6E56", cursor: "pointer", fontFamily: "inherit" }}>Commencer gratuitement</button>
        </div>
      </div>
    </div>
  );
}

export default function Landing({ onStart }) {
  const [page, setPage] = useState("home");

  if (page === "fonctionnalites") return <Fonctionnalites onStart={onStart} onPage={setPage} onHome={() => setPage("home")} />;
  if (page === "communaute") return <Communaute onStart={onStart} onPage={setPage} onHome={() => setPage("home")} />;

  return (
    <div style={dark}>
      <nav style={navStyle}>
        <Logo onHome={() => setPage("home")} />
        <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
          <span onClick={() => setPage("fonctionnalites")} style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", cursor: "pointer" }}>Fonctionnalités</span>
          <span onClick={() => setPage("communaute")} style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", cursor: "pointer" }}>Communauté</span>
          <button onClick={onStart} style={{ background: "#9FE1CB", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, color: "#0F6E56", cursor: "pointer", fontFamily: "inherit" }}>Commencer</button>
        </div>
      </nav>

      <div style={{ textAlign: "center", padding: "100px 48px 80px", maxWidth: 700, margin: "0 auto" }}>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 28 }}>Pour les investisseurs long terme</div>
        <h1 style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.1, letterSpacing: -2, color: "#fff", marginBottom: 12 }}>
          Construis ton patrimoine.<br /><span style={{ color: "#9FE1CB" }}>Entouré.</span>
        </h1>
        <div style={{ fontSize: 18, color: "rgba(255,255,255,0.4)", marginBottom: 12 }}>Investir, c'est un parcours. Pas une course.</div>
        <div style={{ fontSize: 15, color: "rgba(255,255,255,0.25)", marginBottom: 48 }}>Suis ton portefeuille, rejoins des défis, progresse avec une communauté d'investisseurs qui pensent long terme.</div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <button onClick={onStart} style={{ background: "#9FE1CB", border: "none", borderRadius: 10, padding: "15px 36px", fontSize: 15, fontWeight: 700, color: "#0F6E56", cursor: "pointer", fontFamily: "inherit" }}>Commencer gratuitement</button>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}>Gratuit · Aucune carte requise</div>
        </div>
      </div>

      <div style={{ width: "0.5px", height: 80, background: "rgba(255,255,255,0.08)", margin: "0 auto" }} />

      <div style={{ padding: "80px 48px", maxWidth: 700, margin: "0 auto" }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 20 }}>Notre conviction</div>
        <h2 style={{ fontSize: 36, fontWeight: 700, letterSpacing: -1, color: "#fff", lineHeight: 1.2, marginBottom: 16 }}>
          Conçu pour les investisseurs,<br />pas les <span style={{ color: "#9FE1CB" }}>traders.</span>
        </h2>
        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.4)", lineHeight: 1.8, maxWidth: 500 }}>
          La plupart des apps se concentrent sur les achats et les ventes. Verio se concentre sur la construction d'un patrimoine durable. Parce qu'investir avec succès, ce n'est pas timer le marché — c'est rester investi.
        </p>
      </div>

      <div style={{ padding: "0 48px 80px", maxWidth: 700, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[
          { icon: "📊", title: "Suis ta progression", text: "Ton portefeuille unifié, multi-broker. Tes performances dans le temps." },
          { icon: "🏆", title: "Reste discipliné", text: "Séries de DCA. Défis mensuels. Badges. Investir comme une habitude." },
          { icon: "👥", title: "Progresse avec les autres", text: "Suis des investisseurs. Partage ton parcours. Grandis ensemble." },
          { icon: "📈", title: "Au-delà des rendements", text: "La constance compte plus que la performance. Mesure ta discipline, pas juste tes gains." },
        ].map(f => (
          <div key={f.title} style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 28 }}>
            <div style={{ fontSize: 22, marginBottom: 14 }}>{f.icon}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 8 }}>{f.title}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>{f.text}</div>
          </div>
        ))}
      </div>

      <div style={{ width: "0.5px", height: 80, background: "rgba(255,255,255,0.08)", margin: "0 auto" }} />

      <div style={{ textAlign: "center", padding: "80px 48px", maxWidth: 600, margin: "0 auto" }}>
        <h2 style={{ fontSize: 32, fontWeight: 700, letterSpacing: -1, color: "#fff", marginBottom: 24, lineHeight: 1.2 }}>Investir n'est pas une compétition.<br />C'est une habitude.</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 40 }}>
          {[["Discipline", true], ["Patience", true], ["Régularité", true], ["Sans hype", false], ["Progression", true], ["Sans spéculation", false], ["Communauté", true], ["Long terme", true]].map(([w, hi]) => (
            <span key={w} style={{ padding: "6px 16px", borderRadius: 999, fontSize: 13, fontWeight: 500, border: `0.5px solid ${hi ? "rgba(159,225,203,0.3)" : "rgba(255,255,255,0.1)"}`, color: hi ? "#9FE1CB" : "rgba(255,255,255,0.45)", background: hi ? "rgba(159,225,203,0.06)" : "none" }}>{w}</span>
          ))}
        </div>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.25)", lineHeight: 1.7 }}>Que tu investisses 100 € ou 100 000 €, tout le monde commence de la même façon. Un investissement à la fois.</p>
      </div>

      <div style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 28, maxWidth: 600, margin: "0 auto 80px" }}>
        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.6)", lineHeight: 1.7, fontStyle: "italic", marginBottom: 12 }}>« Pour la première fois, j'aime vraiment suivre mes investissements. »</p>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.25)" }}>Sophie L. · Membre Verio · 28 mois de DCA</div>
      </div>

      <div style={{ textAlign: "center", padding: "80px 48px 100px" }}>
        <h2 style={{ fontSize: 36, fontWeight: 700, letterSpacing: -1, color: "#fff", marginBottom: 12 }}>Prêt à investir autrement ?</h2>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.35)", marginBottom: 36 }}>Des milliers d'investisseurs construisent leur patrimoine. Rejoins-les.</p>
        <button onClick={onStart} style={{ background: "#9FE1CB", border: "none", borderRadius: 10, padding: "15px 36px", fontSize: 15, fontWeight: 700, color: "#0F6E56", cursor: "pointer", fontFamily: "inherit" }}>Commencer gratuitement</button>
      </div>

      <div style={{ textAlign: "center", padding: 28, borderTop: "0.5px solid rgba(255,255,255,0.05)", fontSize: 12, color: "rgba(255,255,255,0.15)" }}>
        © 2026 Verio · Les montants restent toujours privés
      </div>
    </div>
  );
}
