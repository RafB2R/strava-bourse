// Indices de l'écran Marchés : présentation pédagogique et principales entreprises.
// Les « top 5 » sont indicatifs (plus gros poids de l'indice) : à revoir une ou
// deux fois par an, les compositions évoluent lentement.
import { t, LANG } from "./i18n";

export const TOP5_UPDATED = t("octobre 2026");

export const PERIODS = [
  { id: "1d", label: t("1J"), long: t("1 jour") },
  { id: "5d", label: t("5J"), long: t("5 jours") },
  { id: "1mo", label: "1M", long: t("1 mois") },
  { id: "3mo", label: "3M", long: t("3 mois") },
  { id: "ytd", label: "YTD", long: t("l'année en cours") },
  { id: "1y", label: t("1A"), long: t("{n} an", { n: 1 }) },
  { id: "5y", label: t("5A"), long: t("{n} ans", { n: 5 }) },
  { id: "10y", label: t("10A"), long: t("{n} ans", { n: 10 }) },
  { id: "max", label: "Max", long: t("depuis l'origine") },
];

// « sur 5 ans », mais « depuis l'origine »
export const periodPhrase = p => (p.id === "max" ? p.long : t("sur {p}", { p: p.long }));

// Période affichée à l'ouverture d'un indice : le long terme d'abord
export const DEFAULT_PERIOD = "5y";

export const INDICES = [
  {
    symbol: "^FCHI", name: "CAC 40", country: "fr",
    summary: t("Les 40 plus grandes entreprises cotées à la Bourse de Paris. C'est le baromètre de l'économie française… et de ses géants mondiaux du luxe, de l'énergie et de l'industrie."),
    facts: [
      [t("Entreprises"), "40"],
      [t("Marché"), "Euronext Paris"],
      [t("Créé"), t("1987 (base 1 000)")],
      [t("Pondération"), t("Capitalisation flottante, plafonnée à 15 % par valeur")],
    ],
    dividends: t("Indice de prix : les dividendes versés ne sont pas comptés. La performance réelle d'un investisseur qui les réinvestit est donc plus élevée."),
    top5: [
      { symbol: "MC.PA", name: "LVMH" },
      { symbol: "SU.PA", name: "Schneider Electric" },
      { symbol: "TTE.PA", name: "TotalEnergies" },
      { symbol: "AIR.PA", name: "Airbus" },
      { symbol: "OR.PA", name: "L'Oréal" },
    ],
  },
  {
    symbol: "^GSPC", name: "S&P 500", country: "us",
    summary: t("Environ 500 des plus grandes entreprises américaines, soit près de 80 % de la valeur de la Bourse des États-Unis. C'est l'indice de référence mondial des actions."),
    facts: [
      [t("Entreprises"), "≈ 500"],
      [t("Marché"), t("NYSE et Nasdaq")],
      [t("Créé"), "1957"],
      [t("Pondération"), t("Capitalisation flottante")],
    ],
    dividends: t("Indice de prix : les dividendes ne sont pas comptés. Réinvestis, ils ont ajouté en moyenne 1 à 2 points de rendement par an ces dernières décennies."),
    top5: [
      { symbol: "NVDA", name: "NVIDIA" },
      { symbol: "MSFT", name: "Microsoft" },
      { symbol: "AAPL", name: "Apple" },
      { symbol: "AMZN", name: "Amazon" },
      { symbol: "META", name: "Meta Platforms" },
    ],
  },
  {
    symbol: "^IXIC", name: "NASDAQ", country: "us",
    summary: t("Le Nasdaq Composite regroupe toutes les actions cotées sur le Nasdaq, la Bourse américaine de la technologie. Très concentré sur les géants de la tech."),
    facts: [
      [t("Entreprises"), t("Plus de 3 000")],
      [t("Marché"), t("Nasdaq (États-Unis)")],
      [t("Créé"), "1971 (base 100)"],
      [t("Pondération"), t("Capitalisation")],
    ],
    dividends: t("Indice de prix : les dividendes ne sont pas comptés (ils restent faibles pour la plupart des valeurs tech)."),
    top5: [
      { symbol: "NVDA", name: "NVIDIA" },
      { symbol: "MSFT", name: "Microsoft" },
      { symbol: "AAPL", name: "Apple" },
      { symbol: "AMZN", name: "Amazon" },
      { symbol: "GOOGL", name: "Alphabet (Google)" },
    ],
  },
  {
    symbol: "^STOXX50E", name: "Euro Stoxx 50", country: "eu",
    summary: t("Les 50 plus grandes entreprises de la zone euro, tous pays confondus. L'équivalent européen du CAC 40, avec l'Allemagne, la France et les Pays-Bas en tête."),
    facts: [
      [t("Entreprises"), "50"],
      [t("Marché"), t("Zone euro")],
      [t("Créé"), "1998"],
      [t("Pondération"), t("Capitalisation flottante, plafonnée à 10 % par valeur")],
    ],
    dividends: t("Indice de prix : les dividendes ne sont pas comptés."),
    top5: [
      { symbol: "ASML.AS", name: "ASML" },
      { symbol: "SAP.DE", name: "SAP" },
      { symbol: "SIE.DE", name: "Siemens" },
      { symbol: "MC.PA", name: "LVMH" },
      { symbol: "ALV.DE", name: "Allianz" },
    ],
  },
  {
    symbol: "^GDAXI", name: "DAX", country: "de",
    summary: t("Les 40 plus grandes entreprises cotées à Francfort (30 jusqu'en 2021). Le reflet de l'industrie, de l'assurance et de la tech allemandes."),
    facts: [
      [t("Entreprises"), "40"],
      [t("Marché"), t("Bourse de Francfort")],
      [t("Créé"), t("1988 (base 1 000)")],
      [t("Pondération"), t("Capitalisation flottante")],
    ],
    dividends: t("Particularité : le DAX est un indice de performance, les dividendes y sont réinvestis. Attention en le comparant au CAC 40, qui ne les compte pas."),
    top5: [
      { symbol: "SAP.DE", name: "SAP" },
      { symbol: "SIE.DE", name: "Siemens" },
      { symbol: "ALV.DE", name: "Allianz" },
      { symbol: "DTE.DE", name: "Deutsche Telekom" },
      { symbol: "AIR.DE", name: "Airbus" },
    ],
  },
  {
    symbol: "^N225", name: "Nikkei 225", country: "jp",
    summary: t("225 grandes entreprises cotées à la Bourse de Tokyo. Le plus ancien indice boursier d'Asie, calculé depuis 1950."),
    facts: [
      [t("Entreprises"), "225"],
      [t("Marché"), t("Bourse de Tokyo")],
      [t("Créé"), "1950"],
      [t("Pondération"), t("Par le prix de l'action (et non la taille de l'entreprise)")],
    ],
    dividends: t("Indice de prix : les dividendes ne sont pas comptés. Pondéré par le prix, il donne beaucoup de poids aux actions chères, quelle que soit leur taille."),
    top5: [
      { symbol: "9983.T", name: "Fast Retailing (Uniqlo)" },
      { symbol: "8035.T", name: "Tokyo Electron" },
      { symbol: "6857.T", name: "Advantest" },
      { symbol: "9984.T", name: "SoftBank Group" },
      { symbol: "4063.T", name: "Shin-Etsu Chemical" },
    ],
  },
];

// Historique d'un symbole sur une période (route /api/chart), null en cas d'échec
// Les taux OAT et Bund (« RATE:fr », « RATE:de ») viennent de l'historique mensuel de la BCE.
export async function fetchChart(symbol, period) {
  try {
    const url = symbol.startsWith("RATE:")
      ? `/api/rates?history=${symbol.slice(5)}&period=${period}`
      : `/api/chart?symbol=${encodeURIComponent(symbol)}&period=${period}`;
    const res = await fetch(url);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export const fmtChange = v => (v === null || v === undefined ? "—" : t("{v} %", { v: `${v >= 0 ? "+" : ""}${v.toFixed(2).replace(".", LANG === "en" ? "." : ",")}` }));

// Fiche à ouvrir pour une valeur citée dans un post : la fiche complète si c'est
// un indice connu (CAC 40…), sinon une fiche simple (nom, symbole, courbe)
export function detailFor(asset) {
  return INDICES.find(i => i.symbol === asset.symbol) || { symbol: asset.symbol, name: asset.name || asset.symbol, type: asset.type || "" };
}
