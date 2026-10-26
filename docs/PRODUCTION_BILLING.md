# Paiements et remboursements

## Checkout hébergé et reçus — 25 octobre 2026

Sur instruction du propriétaire, `BILLING_CHECKOUT_MODE=hosted` ouvre un parcours direct : un choix de forfait ou de recharge prépare un devis serveur et redirige vers le checkout hébergé. Le prix de commande reste celui du catalogue XAF. Le prestataire affiche la conversion éventuelle avant confirmation. Le retour ouvre `/?settings=billing&billingOrder=…` et vérifie la commande ; le planificateur rapproche aussi les paiements si le navigateur est fermé.

Ce mode émet un **reçu de paiement**, jamais une facture fiscale sans configuration réelle. Aucun taux, exonération, adresse, immatriculation ou e-mail d’assistance n’est inventé. Le reçu conserve la marque Braand, le client, la référence, le total XAF et la devise ainsi que le montant effectivement retournés par la transaction vérifiée. Le mode `invoiced` conserve les validations de vendeur, de fiscalité et de lancement ci-dessous.

L’ouverture du mode hébergé nécessite `BILLING_ENABLED=true`, les trois secrets de paiement, une clé cohérente avec l’environnement et le secret du planificateur. Les autres indicateurs restent des diagnostics honnêtes : ils ne sont pas artificiellement déclarés validés. Les diagnostics économiques continuent d’être calculés ; ils ne bloquent plus les achats dans ce mode demandé par le propriétaire.

Une conversion ne suffit pas à attribuer des crédits : le serveur vérifie le marchand, l’identifiant exact de session, les métadonnées de commande, le montant XAF original, la transaction liée via l’API de vérification, son succès entrant et son mode de frais déduits. XAF reste comparé exactement au prix. Pour les monnaies des réseaux du prestataire, un montant positif et un débit identique sont exigés ; le change est confié au prestataire, sans taux inventé. Le rapprochement est idempotent. Les reçus et remboursements restent privés et rattachés à leur organisation.

Les sections suivantes décrivent les contrôles historiques du mode avec facturation fiscale ; leur ancienne règle de rejet systématique USD est remplacée par le rapprochement de session vérifié ci-dessus. Aucun test simulé ne constitue un paiement réel ni une validation du réseau bancaire.

## Vérification historique du 18 octobre 2026

## Portée prouvée

Les tests exécutent les services et routes de l’application avec une base SQLite isolée. Les réponses SasPay sont simulées à partir du contrat public. Aucun appel réseau, paiement, retrait ou remboursement réel n’est effectué. Un test simulé ne valide ni le compte marchand ni la disponibilité effective d’un moyen de paiement.

```powershell
node tests/billing.integration.mjs
node tests/production-billing.integration.mjs
```

La première suite couvre 21 scénarios existants (création de checkout, confirmation exactement une fois, webhook répété, devis obsolète, changement de formule, allocations, quotas). La seconde couvre 11 scénarios supplémentaires : remboursements total/partiel, concurrence, réservations, droits annuels, rejet/réouverture, environnements, avoirs privés et schéma REST SasPay documenté. Les échecs, l’abandon, la transaction USD et le mauvais marchand ne donnent aucun crédit.

## Contrat externe vérifié

Sources officielles consultées le **18 octobre 2026** :

- [SasPay — Checkout](https://docs.saspay.me/api-reference/payments/checkout-create) : `POST /checkout-sessions/`, clés serveur `sk_test_` / `sk_live_`, pas de prise en charge d’`Idempotency-Key`. `DEDUCTED` peut être ignoré si l’option marchande d’autorisation de surcharge est désactivée. Braand vérifie le mode renvoyé avant de proposer la redirection.
- [SasPay — Vérification du paiement](https://docs.saspay.me/api-reference/payments/verify) : `GET /payments/{payment_id}/verify/` rafraîchit une transaction en attente auprès du gateway. Champs REST : `requested_amount`, `debited_amount`, `transaction_type`, `flow_direction`, `merchant`. Ils diffèrent de la forme d’un webhook.
- [SasPay — Détail transaction](https://docs.saspay.me/api-reference/transactions/get) : montants bruts, ventilation, frais et référence. Les enregistrements Braand conservent la ventilation financière utile, sans recopier l’adresse IP ni le numéro de téléphone d’une réponse fournisseur.
- [SasPay — Statuts](https://docs.saspay.me/api-reference/payments) : `PENDING`, `SUCCESS`, `FAILED`, `CANCELLED`. Un paiement échoué n’est jamais assimilé à une réussite. Une confirmation tardive peut être rapprochée sans deuxième attribution.
- [SasPay — Pays et réseaux](https://docs.saspay.me/api-reference/reference/formats) : au Cameroun, MTN et Orange utilisent XAF ; la carte et la crypto sont **USD uniquement**, avec conversion fournisseur si l’entrée est dans une autre monnaie. La carte facturée en XAF n’est donc pas une capacité validée d’Braand.
- [SasPay — Mes tarifs](https://docs.saspay.me/api-reference/reference/my-rates) : `GET /pricing/my-rates/` donne les tarifs **du marchand**, par réseau et tranche, leur disponibilité et le mode de frais. Les pourcentages montrés dans la documentation sont des exemples, pas les frais d’Braand.
- [SasPay — Webhooks](https://docs.saspay.me/api-reference/webhooks) : signature HMAC de `timestamp.body`, contrôle de l’âge, corps brut. Création/rotation des secrets depuis le dashboard uniquement ; une clé API ne permet pas de créer le webhook.
- [SasPay — OpenAPI](https://docs.saspay.me/api-reference/openapi.json), récupéré par une requête GET publique : **aucune route de remboursement**. Ni endpoint, ni événement de remboursement n’a été inventé. Le [catalogue officiel](https://docs.saspay.me/llms.txt) ne décrit pas non plus cette opération.
- [SIX, agence ISO 4217 — liste officielle XML](https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml), récupérée par GET : XAF, code numérique 950, unité mineure 0. Braand stocke les montants XAF entiers. La chaîne `2500.00` de l’API représente 2 500 FCFA, jamais 25 FCFA. Les fractions non nulles sont refusées.

## Défaut corrigé dans le rapprochement

Le code utilisait les noms de champs d’un webhook (`amount`, `charged`, `type`) pour lire une réponse REST. Un paiement réel conforme au contrat REST aurait été refusé. Le rapprochement lit maintenant le schéma officiel, vérifie l’identifiant, le marchand, le flux entrant, la monnaie, le montant demandé, le montant débité et le mode `DEDUCTED`. Les fixtures historiques ont été corrigées pour reproduire ce schéma ; aucune assertion n’a été retirée ou assouplie.

L’environnement de paiement est enregistré avec chaque nouvelle commande. Un rapprochement effectué avec l’autre environnement échoue. Les commandes antérieures à cette migration restent sans environnement connu ; ni rapprochement d’un paiement encore en attente ni remboursement administratif ne peuvent être effectués silencieusement pour ces commandes. Les commandes déjà livrées ne sont pas recréditées ni altérées.

## Protection XAF avant encaissement

`BILLING_XAF_CHECKOUT_VALIDATED` est **faux par défaut**. Il complète les conditions fiscales, économiques et opérationnelles existantes. Ne le passer à `true` qu’après :

1. Un test SasPay sandbox réellement confirmé avec Mobile Money au Cameroun et vérification XAF/montant/mode de frais.
2. Une vérification du comportement carte sur le checkout hébergé. Le schéma public du checkout ne documente pas de filtre de moyens de paiement.
3. Une décision permettant d’éviter qu’un client paie en USD sans livraison : retrait de cette méthode du parcours par une configuration fournisseur prouvée, ou contrat multidevise explicitement conçu et testé. Aucune conversion de change n’est devinée par Braand.

Une transaction USD reçue pour une commande XAF est refusée au rapprochement et ne crée aucun droit. Elle demande une intervention ; cela ne justifie pas d’ouvrir un checkout connu pour proposer une méthode incompatible.

## Remboursement externe : workflow administratif

Ce workflow **enregistre une preuve externe ; il n’exécute aucun mouvement d’argent**. Les remboursements fournisseur de bout en bout restent **BLOQUÉS** tant que le prestataire n’a pas fourni son contrat et son parcours sandbox vérifiable.

Seuls les identifiants internes configurés dans `BILLING_ADMIN_IDS` accèdent à l’administration. Une mutation HTTP exige la même origine. Le modèle IA ne peut pas appeler ces confirmations pour s’accorder lui-même une autorisation.

1. Le propriétaire demande un remboursement ; les crédits de cet achat sont gelés. Un deuxième clic retrouve la demande existante.
2. Dans `/admin/billing`, le responsable clique **Examiner** et indique le montant **de cette opération**, en FCFA entiers.
3. **Vérifier le montant et les droits** produit un récapitulatif valable quinze minutes, lié au responsable, à la version de la demande et à un instantané des lots de crédits.
4. Le récapitulatif expose montant, cumul, environnement, crédits retirés, éventuelle concession sur des crédits déjà consommés/expirés, et annulation ou conservation de l’abonnement.
5. Après vérification humaine de la preuve externe, le responsable fournit sa référence et une note sans données de paiement sensibles, puis coche l’approbation explicite.
6. La confirmation enregistre en une opération transactionnelle : mouvement de crédits, état de commande, éventuelle annulation d’abonnement, avoir, journal d’audit et notification.

La référence externe est unique. Une confirmation répétée ne crée pas de second débit de crédits ni de second avoir. Des réservations actives, une modification de solde, une version obsolète, un environnement incorrect ou un cumul supérieur au paiement font échouer l’ensemble sans compensation partielle.

Politique technique initiale, à valider dans les conditions commerciales : un remboursement partiel retire la fraction correspondante des crédits déjà attribués encore disponibles, en conservant les dates d’abonnement ; un remboursement intégral retire tous les crédits restants de cet achat et annule l’abonnement acheté, donc ses allocations futures. Une concession sur des crédits déjà consommés ou expirés est présentée explicitement au responsable. Le portefeuille ne devient jamais négatif. Les changements de formule dépendants sont bloqués pour examen, car ils ne permettent pas d’inférer automatiquement les droits à rétablir.

Un rejet motivé libère les crédits gelés et conserve sa trace d’audit. La demande peut être réexaminée sans effacer les décisions antérieures. Une confirmation financière déjà enregistrée n’est jamais annulée par suppression du journal.

Les avoirs sont disponibles via `GET /api/billing/credit-notes/:id`, pour le propriétaire de l’organisation acheteuse uniquement, avec téléchargement et interdiction de cache. Le contenu HTML échappe les champs externes. La conformité fiscale des modèles de facture/avoir reste à valider avec l’identité et le régime réels de l’entreprise.

## Ce qui reste requis du propriétaire

- Clé SasPay **test**, identifiant marchand, moyens Mobile Money réellement actifs et permission PAYIN ; secrets à fournir dans les secrets serveur, jamais dans le chat ou Git.
- Webhook sandbox configuré au dashboard et secret de signature enregistré côté serveur ; événement de test reçu et rapproché.
- Lecture authentifiée des tarifs marchands par réseau, plancher, plafond, frais fixes/variables et conversion éventuelle ; conserver la date et l’environnement du relevé.
- Contrat et environnement de test du remboursement SasPay, ou procédure fournisseur autorisée et vérifiable. L’enregistrement administratif Braand ne remplace pas cette capacité externe.
- Décision sur la carte USD, sans annoncer une carte XAF non validée.
- Validation fiscale, facture/avoir, politique de remboursement et traitement des achats/quotas déjà consommés.
- Après tous les tests, accord explicite séparé pour basculer en live. Aucun drapeau de validation n’est une preuve à lui seul.

## Marge : limites de preuve

Le calcul `marginCheck` refuse les coûts absents et les offres sous 75 %. La couverture interne de 4 FCFA par crédit est un paramètre de gestion proposé dans le plan, **pas un tarif fournisseur prouvé**. Une configuration ou une fixture avec un coût ne démontre pas une marge réelle.

Avant toute vente, compléter coûts IA/médias, infrastructure variable, e-mails, support, taux de change, frais marchands et fiscalité. Le coût publicitaire Meta payé directement par le client n’est pas une dépense supportée par Braand ; les services Meta/Composio facturés au SaaS doivent, eux, être intégrés au coût variable. Sans relevés authentifiés, les 75 % par offre restent **BLOQUÉS**, même si le calcul déterministe et les tests d’arrondis passent.

## Catalogue annuel du 25 octobre 2026

Version `2026-10-25.1` : Essentiel 49 000 FCFA/an, Pro 99 000 FCFA/an, Business 249 000 FCFA/an, avant application des taxes configurées. Le prix correspond à dix mensualités pour douze mois de service. Les quotas de 100, 250 et 600 crédits sont attribués chaque mois anniversaire, sans report au mois suivant ; le paiement couvre l’année et le renouvellement reste volontaire. Les contrats historiques conservent leurs montants et quotas. Les contrôles de marge incluent les douze quotas et les douze mois de service. L’ouverture du cycle annuel ne contourne aucun prérequis global d’encaissement.
