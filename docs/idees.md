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
