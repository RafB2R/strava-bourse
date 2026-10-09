import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// main.jsx charge l'appli après la langue (import dynamique) : on fait précharger App et
// ses dépendances directes dès le HTML, pour ne pas ajouter d'aller-retour au démarrage.
function preloadApp() {
  return {
    name: 'verio-preload-app',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html, { bundle }) {
        if (!bundle) return html;
        const chunks = Object.values(bundle).filter(c => c.type === 'chunk');
        const app = chunks.find(c => c.facadeModuleId?.endsWith('/src/App.jsx'));
        if (!app) return html;
        const files = new Set();
        const visit = c => {
          if (!c || files.has(c.fileName)) return;
          files.add(c.fileName);
          c.imports.forEach(f => visit(bundle[f]));
        };
        visit(app);
        const already = html;
        const links = [...files].filter(f => !already.includes(f)).map(f => `<link rel="modulepreload" crossorigin href="/${f}">`).join('\n    ');
        return html.replace('</head>', `    ${links}\n  </head>`);
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), preloadApp()],
})
