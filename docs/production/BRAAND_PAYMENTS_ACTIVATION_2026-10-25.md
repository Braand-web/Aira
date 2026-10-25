# Paiements Braand — activation du 25 octobre 2026

## Publication

- Code publié sur `main` : `cade220b4b0100e0e7d6e25b6ef7ae57dd21d6e6`.
- Worker desservant le domaine existant : `aira-production`.
- Version déployée à 100 % : `4a548ca8-a01e-43aa-b23d-65c080f5d6b0`.
- Route conservée : `braand.fun/*`. Les bindings D1/R2, les secrets, la file de travail et les deux fréquences du planificateur sont conservés.
- Configuration active : `BILLING_ENABLED=true`, `BILLING_CHECKOUT_MODE=hosted`, `SASPAY_ENV=live`.

## Parcours livré

Le choix d’une recharge ou d’un forfait prépare un devis au prix du catalogue côté serveur, crée une commande et ouvre directement le checkout hébergé. Le client confirme son moyen de paiement et la conversion éventuelle sur ce checkout. Le retour ouvre la facturation et vérifie la commande. Le planificateur assure aussi le rapprochement quand le navigateur est fermé.

Les crédits sont attribués après vérification serveur de la session et de sa transaction, avec protection contre les répétitions. Une transaction convertie doit provenir de la session exacte de la commande XAF. Le reçu conserve le prix de commande, le montant réellement payé, sa devise et la référence. Aucun taux de TVA, exonération, adresse ou identifiant fiscal n’a été inventé. Ces documents sont des reçus de paiement, sans prétention de facture fiscale.

Les trois recharges et les forfaits mensuels et annuels sont disponibles. Le renouvellement reste volontaire, sans prélèvement récurrent. Le mode avec facturation fiscale reste disponible séparément avec ses exigences de configuration. Les indicateurs historiques non validés restent affichés comme tels ; ils n’ont pas été artificiellement passés à vrai.

## Vérifications

- Types, lint, build et `npm test` réussis. La suite comprend 186 tests unitaires, les intégrations de services, les inspections d’artefacts et les tests HTTP locaux. Les intégrations de facturation couvrent 30 scénarios plus 12 scénarios de rapprochement/remboursement. Les appels prestataires de ces tests sont simulés et le réseau externe est bloqué.
- Les fins de ligne de onze ressources utilisateur ont été rétablies uniquement lorsque leurs octets LF correspondaient aux empreintes du manifeste existant. La règle Git protège ces octets lors des checkouts Windows ; aucun contenu ni manifeste d’empreintes n’a été changé.
- Le compte marchand est indiqué comme vérifié. Le choix du mode de frais par l’API est autorisé ; le webhook Braand est actif pour les événements de paiement créé, réussi, échoué et annulé.
- Catalogue public : HTTP 200, version `2026-10-25.1`, mode `hosted`, `readiness.enabled=true`, environnement `live`, contrôles opérationnels paiement/environnement/planificateur/activation à vrai. Confirmation renouvelée le 26 octobre 2026.
- Santé : HTTP 200, `{"status":"ok"}`, confirmée à nouveau le 26 octobre 2026.
- Accueil : HTTP 200. Résumé financier sans session : HTTP 401. Webhook sans signature : HTTP 401.

Aucun paiement réel n’a été exécuté. Le propriétaire a demandé à vérifier lui-même le parcours connecté et le règlement. Cette vérification reste distincte de la preuve d’activation, des tests simulés et de la santé du service.

## Prochain déploiement

Le manifeste local ignoré `.wrangler/deploy/production-public.json` a été actualisé avec les chemins du build Braand, les réglages actifs, les fréquences et la file de production. Préserver les variables et secrets existants lors des prochaines publications. Le générateur de configuration de base garde volontairement les encaissements fermés ; ne pas le substituer sans revue au manifeste public actif.
