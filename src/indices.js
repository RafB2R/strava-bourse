// Indices de l'écran Marchés : présentation pédagogique et principales entreprises.
// Les « top 5 » sont indicatifs (plus gros poids de l'indice) : à revoir une ou
// deux fois par an, les compositions évoluent lentement.
export const TOP5_UPDATED = "octobre 2026";

export const PERIODS = [
  { id: "1d", label: "1J", long: "1 jour" },
  { id: "5d", label: "5J", long: "5 jours" },
  { id: "1mo", label: "1M", long: "1 mois" },
  { id: "3mo", label: "3M", long: "3 mois" },
  { id: "ytd", label: "YTD", long: "l'année en cours" },
  { id: "1y", label: "1A", long: "1 an" },
  { id: "5y", label: "5A", long: "5 ans" },
  { id: "10y", label: "10A", long: "10 ans" },
];

// Période affichée à l'ouverture d'un indice : le long terme d'abord
export const DEFAULT_PERIOD = "5y";

export const INDICES = [
  {
    symbol: "^FCHI", name: "CAC 40", flag: "🇫🇷",
    summary: "Les 40 plus grandes entreprises cotées à la Bourse de Paris. C'est le baromètre de l'économie française… et de ses géants mondiaux du luxe, de l'énergie et de l'industrie.",
    facts: [
      ["Entreprises", "40"],
      ["Marché", "Euronext Paris"],
      ["Créé", "1987 (base 1 000)"],
      ["Pondération", "Capitalisation flottante, plafonnée à 15 % par valeur"],
    ],
    dividends: "Indice de prix : les dividendes versés ne sont pas comptés. La performance réelle d'un investisseur qui les réinvestit est donc plus élevée.",
    top5: [
      { symbol: "MC.PA", name: "LVMH" },
      { symbol: "SU.PA", name: "Schneider Electric" },
      { symbol: "TTE.PA", name: "TotalEnergies" },
      { symbol: "AIR.PA", name: "Airbus" },
      { symbol: "OR.PA", name: "L'Oréal" },
    ],
  },
  {
    symbol: "^GSPC", name: "S&P 500", flag: "🇺🇸",
    summary: "Environ 500 des plus grandes entreprises américaines, soit près de 80 % de la valeur de la Bourse des États-Unis. C'est l'indice de référence mondial des actions.",
    facts: [
      ["Entreprises", "≈ 500"],
      ["Marché", "NYSE et Nasdaq"],
      ["Créé", "1957"],
      ["Pondération", "Capitalisation flottante"],
    ],
    dividends: "Indice de prix : les dividendes ne sont pas comptés. Réinvestis, ils ont ajouté en moyenne 1 à 2 points de rendement par an ces dernières décennies.",
    top5: [
      { symbol: "NVDA", name: "NVIDIA" },
      { symbol: "MSFT", name: "Microsoft" },
      { symbol: "AAPL", name: "Apple" },
      { symbol: "AMZN", name: "Amazon" },
      { symbol: "META", name: "Meta Platforms" },
    ],
  },
  {
    symbol: "^IXIC", name: "NASDAQ", flag: "🇺🇸",
    summary: "Le Nasdaq Composite regroupe toutes les actions cotées sur le Nasdaq, la Bourse américaine de la technologie. Très concentré sur les géants de la tech.",
    facts: [
      ["Entreprises", "Plus de 3 000"],
      ["Marché", "Nasdaq (États-Unis)"],
      ["Créé", "1971 (base 100)"],
      ["Pondération", "Capitalisation"],
    ],
    dividends: "Indice de prix : les dividendes ne sont pas comptés (ils restent faibles pour la plupart des valeurs tech).",
    top5: [
      { symbol: "NVDA", name: "NVIDIA" },
      { symbol: "MSFT", name: "Microsoft" },
      { symbol: "AAPL", name: "Apple" },
      { symbol: "AMZN", name: "Amazon" },
      { symbol: "GOOGL", name: "Alphabet (Google)" },
    ],
  },
  {
    symbol: "^STOXX50E", name: "Euro Stoxx 50", flag: "🇪🇺",
    summary: "Les 50 plus grandes entreprises de la zone euro, tous pays confondus. L'équivalent européen du CAC 40, avec l'Allemagne, la France et les Pays-Bas en tête.",
    facts: [
      ["Entreprises", "50"],
      ["Marché", "Zone euro"],
      ["Créé", "1998"],
      ["Pondération", "Capitalisation flottante, plafonnée à 10 % par valeur"],
    ],
    dividends: "Indice de prix : les dividendes ne sont pas comptés.",
    top5: [
      { symbol: "ASML.AS", name: "ASML" },
      { symbol: "SAP.DE", name: "SAP" },
      { symbol: "SIE.DE", name: "Siemens" },
      { symbol: "MC.PA", name: "LVMH" },
      { symbol: "ALV.DE", name: "Allianz" },
    ],
  },
  {
    symbol: "^GDAXI", name: "DAX", flag: "🇩🇪",
    summary: "Les 40 plus grandes entreprises cotées à Francfort (30 jusqu'en 2021). Le reflet de l'industrie, de l'assurance et de la tech allemandes.",
    facts: [
      ["Entreprises", "40"],
      ["Marché", "Bourse de Francfort"],
      ["Créé", "1988 (base 1 000)"],
      ["Pondération", "Capitalisation flottante"],
    ],
    dividends: "Particularité : le DAX est un indice de performance, les dividendes y sont réinvestis. Attention en le comparant au CAC 40, qui ne les compte pas.",
    top5: [
      { symbol: "SAP.DE", name: "SAP" },
      { symbol: "SIE.DE", name: "Siemens" },
      { symbol: "ALV.DE", name: "Allianz" },
      { symbol: "DTE.DE", name: "Deutsche Telekom" },
      { symbol: "AIR.DE", name: "Airbus" },
    ],
  },
  {
    symbol: "^N225", name: "Nikkei 225", flag: "🇯🇵",
    summary: "225 grandes entreprises cotées à la Bourse de Tokyo. Le plus ancien indice boursier d'Asie, calculé depuis 1950.",
    facts: [
      ["Entreprises", "225"],
      ["Marché", "Bourse de Tokyo"],
      ["Créé", "1950"],
      ["Pondération", "Par le prix de l'action (et non la taille de l'entreprise)"],
    ],
    dividends: "Indice de prix : les dividendes ne sont pas comptés. Pondéré par le prix, il donne beaucoup de poids aux actions chères, quelle que soit leur taille.",
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
export async function fetchChart(symbol, period) {
  try {
    const res = await fetch(`/api/chart?symbol=${encodeURIComponent(symbol)}&period=${period}`);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export const fmtChange = v => (v === null || v === undefined ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2).replace(".", ",")} %`);
