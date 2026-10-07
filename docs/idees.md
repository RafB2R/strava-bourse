# Idées en attente

Pistes validées mais repoussées, avec ce qui les bloque aujourd'hui.

## Données

- **Perf YTD sur la card de partage** : à proposer en option quand on aura un
  historique de prix. Aujourd'hui on ne connaît que le prix d'achat et le prix
  actuel de chaque position. Le cours au 1er janvier existe chez Yahoo, mais le
  YTD de l'instrument est faux pour une position achetée en cours d'année.
  Bon format saisonnier : une card « Mon année » en décembre.
- **Perf annualisée** (« ≈ +2 %/an ») : la plus honnête pour comparer des
  investisseurs. Il faut la date d'achat de chaque position.
- **Mention « depuis 2019 » sous la performance de la card** : rapide, à partir
  de l'année « investisseur depuis » du profil.

- **Export CSV / « Télécharger mes données »** : repoussé, peu d'intérêt tant
  que les données sont pauvres. À reprendre avec l'historique et les revenus,
  par exemple dans les réglages ou dans l'offre Plus avec l'export PDF fiscal.
  Le RGPD (portabilité) peut être assuré à la demande, par e-mail.

## Badges

- **Builder et Diversification comptent la même chose** (le nombre de
  positions). Diversification pourrait compter les classes d'actifs, mais il
  n'y en a que 7, donc revoir les paliers 8 et 10.
- **Milestones repose sur l'année déclarée** « investisseur depuis » : on peut
  se déclarer 25 ans d'ancienneté. Alternative : l'ancienneté sur Verio.
- **La série peut être gonflée** en créant de fausses activités
  « nouvelle position » via l'API. Pour la verrouiller, il faut que ces
  activités soient créées côté serveur.

## Comptes

- **Vérifier qu'un pseudo est libre dès l'inscription** : les visiteurs non
  connectés n'ont plus accès aux profils. Une petite fonction « pseudo
  disponible ? » suffirait.

## Monétisation

- **Verio Plus masqué** (`SHOW_PLUS = false` dans `src/features.js`) : l'encart
  de la projection et la carte « Analyse avancée » (volatilité, Sharpe, beta,
  alpha, drawdown, tracking error, bouton 9,99 €/mois) sont prêts à être
  réaffichés quand l'offre et Stripe seront au point.

## Publication dans le fil

L'encadré de publication a les boutons « 🖼️ Image » (4 images max,
compressées avant l'envoi), « 📎 Fichier » (3 fichiers, 10 Mo, PDF, Excel,
CSV, Word, PowerPoint, texte) et « 📊 Sondage » (2 à 4 choix, 1 à 7 jours,
votes anonymes), « $ Valeur », « 📈 Graphique » et « 🥧 Répartition » (en %).
Pistes pour compléter la barre d'outils :

- **GIF** : nécessite une clé d'API (Giphy ou Tenor).
- **Clôture des sondages** : sans l'extension pg_cron, les sondages terminés
  sont clos à l'ouverture du fil ou des notifications par n'importe quel
  membre. Activer pg_cron (Database → Extensions) puis relancer la migration
  20261011000001 pour une clôture toutes les 15 minutes.

## Application mobile

Verio s'installe comme une application (PWA) : icône sur l'écran d'accueil,
plein écran, ouverture rapide, raccourcis (Portefeuille, Messagerie, Explore).
Suites possibles :

- **Notifications push** : en place (messages, demandes d'ami, commentaires,
  fins de sondage). Pistes : choisir par type ce qu'on reçoit, regrouper les
  messages d'une même conversation, notifier les réponses dans les clubs.
- **Partager vers Verio** depuis la galerie du téléphone (Web Share Target).
- **Applications natives (Expo)** pour être présent dans l'App Store et le
  Play Store, si la PWA ne suffit plus.

## Mouvements (trades)

Les mouvements sont des données factuelles, en % uniquement (jamais de
montant) : nouvelle position, renforcement, allègement, vente, versement,
retrait, rééquilibrage. Ce sont les seules « activités » : filtre Activité
du fil et onglet Activité du profil public. L'auteur peut y ajouter une
description (bouton « ✏️ Ajouter une description », set_activity_note).

Aujourd'hui, un renforcement ou un allègement n'est créé que si l'on modifie
le **%** d'une position dans Portef. ; une vente, si l'on supprime la position.

## ⭐ Important — en attente de Powens

Tout ce qui suit sera fait avec Powens, quand les opérations réelles des
comptes arriveront automatiquement :

- **Créer les mouvements depuis les opérations réelles** (achats, ventes,
  versements, retraits), toujours traduits en % du portefeuille.
- **Créer les mouvements dans la base** (trigger), et non plus depuis le
  navigateur : ils apparaissent quelle que soit la source, et personne ne
  peut fabriquer un faux mouvement (aujourd'hui l'application insère
  elle-même ses activités).
- **Détecter le renforcement par le nombre de parts** (plus de parts =
  renforcement, moins = allègement, zéro = vente), et pas seulement par le %.
- **Harmoniser la carte « Nouvelle position »** avec les autres mouvements :
  « 0 % → 35 % du portefeuille · Actions · Saxo ».
- **Dividendes et coupons** : les remettre dans les mouvements quand on aura
  les vrais montants reçus (rendement en %, régularité).
- **Proposer la description juste après le mouvement** : « Ajoute un mot sur
  ton renforcement de TotalEnergies ? » (notification), comme Strava après
  l'envoi d'une course.
- **Regrouper** plusieurs mouvements du même jour en une seule carte
  (« 3 mouvements aujourd'hui »), avec une seule description.
- **% détenu sur les valeurs citées** ($TTE.PA → « 16,7 % du portefeuille
  de l'auteur », façon Blossom) : relier les positions aux tickers.

