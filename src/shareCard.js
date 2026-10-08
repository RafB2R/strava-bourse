// Dessin de la card de partage du portefeuille (canvas), aux couleurs de la marque.
// Aucune somme en euros : uniquement des pourcentages, la série, les badges et le score.
import { t, LANG } from "./i18n";

export const SHARE_FORMATS = {
  story: { width: 1080, height: 1920, label: "Story", hint: "Instagram" },
  square: { width: 1080, height: 1080, label: t("Carré"), hint: "X, WhatsApp" },
};

const C = {
  bgTop: "#0D0D0D",
  bgBottom: "#24140C",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,0.68)",
  faint: "rgba(255,255,255,0.45)",
  tile: "rgba(255,255,255,0.06)",
  tileBorder: "rgba(255,255,255,0.10)",
  track: "rgba(255,255,255,0.10)",
  accent: "#FF6B2C",
  up: "#3DD68C",
  red: "#F08080",
};
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

function font(ctx, size, weight = 400) {
  ctx.font = `${weight} ${size}px ${FONT}`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Coupe le texte avec « … » pour qu'il tienne dans maxWidth
function fit(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) t = t.slice(0, -1);
  return t.trimEnd() + "…";
}

const fmtPct = (v, digits = 1) => t("{v} %", { v: `${v >= 0 ? "+" : ""}${v.toFixed(digits).replace(".", LANG === "en" ? "." : ",")}` });

/**
 * data : {
 *   name, username, perf (nombre ou null), streak, badges, diversif,
 *   allocation: [{ label, pct, color }], positions: [{ label, pct, perf }], domain
 * }
 * options : { format: "story" | "square", showPerf, showPositions (Story uniquement) }
 */
export function drawShareCard(canvas, data, { format = "story", showPerf = true, showPositions = true } = {}) {
  const { width: W, height: H } = SHARE_FORMATS[format];
  const story = format === "story";
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const pad = story ? 96 : 72;
  const inner = W - pad * 2;
  ctx.textBaseline = "alphabetic";

  // Fond
  const g = ctx.createLinearGradient(0, 0, W * 0.4, H);
  g.addColorStop(0, C.bgTop);
  g.addColorStop(1, C.bgBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(255,107,44,0.08)";
  ctx.beginPath();
  ctx.arc(W - 40, story ? 260 : 120, story ? 360 : 260, 0, Math.PI * 2);
  ctx.fill();

  let y = story ? 150 : 104;

  // Logo + étiquette
  font(ctx, story ? 64 : 52, 800);
  ctx.fillStyle = C.text;
  ctx.fillText("ve", pad, y);
  const veW = ctx.measureText("ve").width;
  ctx.fillStyle = C.accent;
  ctx.fillText("rio", pad + veW, y);
  font(ctx, story ? 30 : 26, 600);
  const tag = t("MON PORTEFEUILLE");
  const tagW = ctx.measureText(tag).width + 40;
  ctx.fillStyle = "rgba(255,107,44,0.14)";
  roundRect(ctx, W - pad - tagW, y - (story ? 42 : 36), tagW, story ? 56 : 48, 28);
  ctx.fill();
  ctx.fillStyle = C.accent;
  ctx.fillText(tag, W - pad - tagW + 20, y - (story ? 4 : 3));

  // Identité
  y += story ? 130 : 96;
  font(ctx, story ? 76 : 60, 800);
  ctx.fillStyle = C.text;
  ctx.fillText(fit(ctx, data.name || t("Investisseur Verio"), inner), pad, y);
  if (data.username) {
    y += story ? 58 : 46;
    font(ctx, story ? 40 : 32, 400);
    ctx.fillStyle = C.muted;
    ctx.fillText(fit(ctx, `@${data.username}`, inner), pad, y);
  }

  // Performance
  if (showPerf && data.perf !== null && data.perf !== undefined) {
    y += story ? 120 : 104;
    font(ctx, story ? 36 : 30, 500);
    ctx.fillStyle = C.muted;
    ctx.fillText(t("Performance totale"), pad, y);
    y += story ? 170 : 124;
    font(ctx, story ? 180 : 132, 800);
    ctx.fillStyle = data.perf >= 0 ? C.up : C.red;
    ctx.fillText(fmtPct(data.perf), pad, y);
  }

  // Tuiles : série, badges, diversification
  y += story ? 90 : 64;
  const tiles = [
    { icon: "🔥", value: t("{n} mois", { n: data.streak || 0 }), label: t("d'affilée") },
    { icon: "🏅", value: `${data.badges || 0}`, label: data.badges > 1 ? "badges" : "badge" },
    { icon: "📊", value: `${data.diversif || 0}/100`, label: "diversification" },
  ];
  const gap = story ? 24 : 20;
  const tileW = (inner - gap * 2) / 3;
  const tileH = story ? 200 : 150;
  tiles.forEach((t, i) => {
    const x = pad + i * (tileW + gap);
    ctx.fillStyle = C.tile;
    roundRect(ctx, x, y, tileW, tileH, 28);
    ctx.fill();
    ctx.strokeStyle = C.tileBorder;
    ctx.lineWidth = 2;
    ctx.stroke();
    font(ctx, story ? 44 : 34, 400);
    ctx.fillStyle = C.text;
    ctx.fillText(t.icon, x + 28, y + (story ? 66 : 50));
    font(ctx, story ? 46 : 36, 800);
    ctx.fillStyle = C.text;
    ctx.fillText(fit(ctx, t.value, tileW - 56), x + 28, y + (story ? 132 : 100));
    font(ctx, story ? 28 : 23, 500);
    ctx.fillStyle = C.muted;
    ctx.fillText(t.label, x + 28, y + (story ? 172 : 132));
  });
  y += tileH;

  // Allocation : barre empilée + légende
  const allocation = (data.allocation || []).filter(a => a.pct > 0);
  if (allocation.length > 0) {
    y += story ? 110 : 72;
    font(ctx, story ? 34 : 28, 700);
    ctx.fillStyle = C.text;
    ctx.fillText("Allocation", pad, y);
    y += story ? 36 : 28;
    const barH = story ? 34 : 28;
    const total = allocation.reduce((s, a) => s + a.pct, 0) || 1;
    ctx.save();
    roundRect(ctx, pad, y, inner, barH, barH / 2);
    ctx.clip();
    ctx.fillStyle = C.track;
    ctx.fillRect(pad, y, inner, barH);
    let x = pad;
    for (const a of allocation) {
      const w = (a.pct / Math.max(total, 100)) * inner;
      ctx.fillStyle = a.color;
      ctx.fillRect(x, y, w, barH);
      x += w;
    }
    ctx.restore();
    y += barH;

    // Légende sur deux colonnes
    const legend = allocation.slice(0, story ? 6 : 4);
    const colW = inner / 2;
    const rowH = story ? 58 : 46;
    font(ctx, story ? 30 : 25, 500);
    legend.forEach((a, i) => {
      const lx = pad + (i % 2) * colW;
      const ly = y + (story ? 64 : 50) + Math.floor(i / 2) * rowH;
      ctx.fillStyle = a.color;
      ctx.beginPath();
      ctx.arc(lx + 10, ly - 10, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.muted;
      const pctText = t("{v} %", { v: Math.round(a.pct) });
      ctx.fillText(fit(ctx, a.label, colW - 150), lx + 34, ly);
      ctx.fillStyle = C.text;
      ctx.fillText(pctText, lx + colW - 40 - ctx.measureText(pctText).width, ly);
    });
    y += (story ? 64 : 50) + Math.ceil(legend.length / 2) * rowH - (story ? 30 : 24);
  }

  // Principales positions (format Story uniquement : pas la place en carré)
  const positions = (data.positions || []).slice(0, 5);
  const footerTop = H - (story ? 130 : 84) - (story ? 70 : 52) - 24; // au-dessus du trait du pied de page
  if (story && showPositions && positions.length > 0) {
    y += 90;
    const rowH = 84;
    // N'affiche que les lignes qui tiennent avant le pied de page
    const fitting = positions.filter((_, i) => y + (story ? 30 : 22) + (i + 1) * rowH <= footerTop);
    if (fitting.length > 0) {
      font(ctx, story ? 34 : 28, 700);
      ctx.fillStyle = C.text;
      ctx.fillText(t("Principales positions"), pad, y);
      y += story ? 30 : 22;
      fitting.forEach((p, i) => {
        const ry = y + i * rowH;
        const barW = inner * Math.min(p.pct, 100) / 100;
        ctx.fillStyle = C.tile;
        roundRect(ctx, pad, ry + 12, inner, rowH - 20, 18);
        ctx.fill();
        ctx.fillStyle = "rgba(255,107,44,0.16)";
        roundRect(ctx, pad, ry + 12, Math.max(barW, 36), rowH - 20, 18);
        ctx.fill();
        const textY = ry + rowH / 2 + (story ? 12 : 10);
        font(ctx, story ? 32 : 26, 600);
        const right = [t("{v} %", { v: Math.round(p.pct) })];
        if (showPerf && p.perf !== null && p.perf !== undefined) right.unshift(fmtPct(p.perf));
        const rightText = right.join("   ");
        const rightW = ctx.measureText(rightText).width;
        ctx.fillStyle = C.text;
        ctx.fillText(fit(ctx, p.label, inner - rightW - 80), pad + 24, textY);
        ctx.fillStyle = C.muted;
        ctx.fillText(rightText, W - pad - 24 - rightW, textY);
      });
    }
  }

  // Pied de page
  const fy = H - (story ? 130 : 84);
  ctx.strokeStyle = C.tileBorder;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, fy - (story ? 70 : 52));
  ctx.lineTo(W - pad, fy - (story ? 70 : 52));
  ctx.stroke();
  font(ctx, story ? 34 : 28, 600);
  ctx.fillStyle = C.text;
  ctx.fillText(t("Investir long terme, ensemble."), pad, fy);
  font(ctx, story ? 28 : 23, 400);
  ctx.fillStyle = C.faint;
  ctx.fillText(t("Montants toujours privés"), pad, fy + (story ? 46 : 36));
  if (data.domain) {
    font(ctx, story ? 34 : 28, 700);
    ctx.fillStyle = C.accent;
    const dw = ctx.measureText(data.domain).width;
    ctx.fillText(data.domain, W - pad - dw, fy);
  }
}

export function shareText(data, { showPerf = true } = {}) {
  const parts = [];
  if (showPerf && data.perf !== null && data.perf !== undefined) parts.push(t("{v} de performance", { v: fmtPct(data.perf) }));
  if (data.streak > 0) parts.push(data.streak === 1 ? t("🔥 1 mois d'affilée") : t("🔥 {n} mois d'affilée", { n: data.streak }));
  const head = parts.length ? t("Mon portefeuille sur Verio : {parts}.", { parts: parts.join(" · ") }) : t("Je construis mon patrimoine sur Verio.");
  return t("{head} Investir long terme, ensemble 👉", { head });
}
