# Bonus d’inscription — 26 octobre 2026

## Règle livrée

Chaque nouveau compte reçoit automatiquement **15 crédits**, une seule fois,
après vérification de son adresse e-mail. Ils expirent exactement **7 jours**
après cette inscription vérifiée. Une demande de lien sans confirmation ne crée
ni compte ni bonus. Une reconnexion ne recharge pas le lot et ne déplace pas son
échéance. Les anciens lots et soldes ne sont pas modifiés rétroactivement.

La création du compte, de son organisation, de son espace personnel, de la
réclamation unique et du lot est transactionnelle (D1 `batch`). Le candidat
d’identifiant doit correspondre au nouveau compte effectivement inséré ; un
e-mail déjà connu ne permet pas une nouvelle attribution. Les montants sont
stockés en centièmes : 1 500 unités pour 15 crédits.

`FREE_DAILY_CREDITS` reste le garde-fou historique de l’activation manuelle.
Il ne limite pas ce bonus automatique d’inscription. Sa valeur distante n’a pas
été changée. L’écran Découverte annonce l’attribution à l’inscription et permet
au visiteur de créer son compte. Aucun nouveau service ou paiement n’est activé.

## Vérifications exécutées

- TypeScript, ESLint sans avertissement, build et `git diff --check` : réussis.
- Suite `tests/run-tests.mjs` : 186 tests unitaires, 20 suites de services,
  4 suites d’artefacts et 2 lanceurs HTTP réussis, réseau externe bloqué.
- Authentification : 29 contrôles SQLite/Web Crypto, dont doubles clics,
  attribution personnelle, plusieurs nouveaux comptes, reconnexion après
  consommation/expiration et annulation transactionnelle après erreur de stockage.
- Facturation : 31 contrôles, dont lot de 15 crédits, échéance fixe, refus de
  réattribution après expiration et conservation d’un ancien lot de 10 crédits.
- Chromium HTTPS local : 8 contrôles réussis, dont inscription réelle dans le
  formulaire avec fournisseur e-mail simulé et vérification du lot de 15 crédits.
- La suite optionnelle générale `agent-ui.browser.mjs` échoue sur une assertion
  préexistante qui interdit le nom Braand alors qu’elle vérifie son affichage.
  Aucun assouplissement de cette assertion n’est inclus dans cette livraison.
- Preview distante sur Cloudflare : catalogue HTTP 200, 15 crédits/7 jours ;
  santé D1 accessible. Ce contrôle n’a créé aucun compte distant.

## Publication et preuve publique

Code applicatif poussé sur `main` : `68d9f11` ; dernières évolutions de connexion
de `38fa9e6` conservées. Le dépôt GitHub annonce son déplacement vers
`https://github.com/Braand-web/Braand` lors du push.

- Staging `aira-staging` : `63f8821e-35eb-45ea-b71d-18961c37a9b2`, à 100 %.
- Production `aira-production` : `23b54bdb-cfdc-4755-944a-bdf9e4c910eb`, à 100 %.
- Relecture des configurations : mêmes bindings, empreintes des variables
  publiques identiques et références des secrets conservées, sans lecture de
  leurs valeurs. Aucune migration de données nécessaire.
- `https://braand.fun/` et `/api/health` : HTTP 200, santé `{"status":"ok"}`.
- `/api/billing/catalog` : HTTP 200, `free.credits=15`, `free.days=7`, paiement
  hébergé toujours actif.
- `/api/billing/summary` sans session : HTTP 401 ; `/auth/form` : HTTP 200.

Aucun e-mail réel ni nouveau compte de production n’a été créé pendant cette
recette. Le parcours connecté de production n’est donc pas présenté comme testé
de bout en bout ; le parcours d’inscription est couvert par la recette locale.

## Relancer les vérifications

```sh
npm run typecheck
npm run lint
npm run build
npm test
node tests/auth-runtime.integration.mjs
node tests/billing.integration.mjs
# Playwright installé, ou BRAAND_PLAYWRIGHT_MODULE pointant vers son module :
node tests/auth-ui.browser.mjs
```
