# Architecture de Verio

## Vue d'ensemble

| Couche | Technologie | Où |
|---|---|---|
| Interface | React 19 + Vite, styles en ligne (thème dans `src/theme.js`) | `src/` |
| Données et comptes | Supabase (Postgres, RLS, fonctions SQL, stockage, temps réel) | `supabase/migrations/` |
| API | Fonctions Vercel (Edge, sauf `push` et `superinvestors-sync` en Node) | `api/` |
| Tâches planifiées | Cron Vercel (`vercel.json`) et, en option, pg_cron | |

Règles de fond : montants jamais publics (pourcentages seulement), pas de classement
global, mouvements factuels, pas de promotion d'ETF.

## Démarrage de l'appli

1. `index.html` charge `main.jsx` et précharge (`modulepreload`) l'appli et ses
   dépendances directes (plugin `preloadApp` dans `vite.config.js`).
2. `main.jsx` attend la langue (`i18nReady`) : en anglais seulement, le dictionnaire
   (`src/i18n/en`, ~70 Ko) est téléchargé. Puis il charge `App.jsx`.
3. `App.jsx` écoute la session (`onAuthStateChange`) et charge le profil **une fois par
   compte** (pas à chaque renouvellement du jeton).
4. Chaque onglet (Fil, Explore, Portefeuille, Profil, Messages…) est un morceau chargé à
   la demande (`lazy`).

## Données

- **Lecture des positions et écritures du portefeuille** : uniquement via
  `src/portfolioStore.js`. Les poids de plusieurs positions s'enregistrent en un seul
  appel (`set_my_portfolio_weights`).
- **Fil** (`Feed.jsx` → `fetchFeed`) : amis, Légendes et valeurs suivies sont lus en
  parallèle, puis les activités, puis likes, commentaires, sondages et clubs en parallèle.
  Les actualités (Google Actualités, lentes) partent en même temps mais **n'empêchent pas
  l'affichage** : elles s'ajoutent quand elles arrivent. Au plus 8 sociétés interrogées.
- **Rafraîchissements réguliers** (messages non lus…) : `useVisibleInterval`, en pause
  quand l'appli n'est pas à l'écran. Sur ordinateur, seule la fenêtre de discussion
  interroge les messages.
- **Cours, recherche, graphiques** : `api/quote`, `api/search`, `api/chart` (Yahoo),
  mis en cache par Vercel.

## Préparation de Powens

Ce qui est déjà en place (migration `20261023000001_preparation_powens.sql`) :

- `portfolio_entries.source` (`manual` | `powens`), `external_id` (identifiant du
  placement chez Powens, privé), `synced_at`.
- Une position `powens` ne se modifie pas depuis l'appli, sauf son poids. C'est la base
  qui le refuse, et l'interface masque « Modifier » et « Supprimer ».
- `bank_connections` : banques connectées d'un membre (lecture par lui seul).
- `verio_private.powens_users` : identifiant et jeton Powens, illisibles depuis l'appli.
- `portfolio_valuations` : valeur du portefeuille jour par jour (privée), pour
  remplacer les simulations de performance par un historique réel.
- Les mouvements portent déjà leur origine (`data.source = "powens"` →
  « Synchronisé (Powens) »).

Ce qu'il restera à écrire quand le contrat Powens sera signé :

1. **Connexion** : `api/powens-connect` (Node) crée l'utilisateur Powens au premier
   passage (jeton rangé dans `verio_private.powens_users`) et renvoie l'adresse de la
   « webview » Powens. L'appli l'ouvre ; Powens redirige ensuite vers Verio.
2. **Synchronisation** : `api/powens-webhook` (Node, signature Powens vérifiée) reçoit
   les mises à jour de comptes et de placements. Avec la clé `service_role` :
   - met à jour `bank_connections` ;
   - fait correspondre chaque placement à une ligne de `portfolio_entries`
     (`source = 'powens'`, `external_id`) : ajout, mise à jour, suppression ;
   - recalcule les poids à partir des valorisations (100 % = valeur totale) ;
   - publie les mouvements (`activities`, `data.source = 'powens'`) en % seulement ;
   - enregistre le point du jour dans `portfolio_valuations`.
3. **Performance réelle** : une fonction SQL qui calcule, depuis
   `portfolio_valuations`, la performance hors apports sur une période et ne renvoie
   que des %. Elle remplacera `simulate()` (`src/compare.js`) sur le profil public et
   dans la comparaison.
4. **Variables Vercel** : identifiants Powens (client id, secret, domaine) et secret
   du webhook, jamais dans le code.
