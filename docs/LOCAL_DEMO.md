# Prévisualisation locale avec des données fictives

Depuis la racine du projet, avec Node et les dépendances déjà installées :

```sh
node scripts/preview-demo.mjs
```

Ouvrir [le Studio de démonstration](http://127.0.0.1:4202/?view=creations). Le port 4203 est réservé à son adaptateur de données local. `AIRA_DEMO_PORT` permet de choisir une autre paire de ports libres.

Maison Naya est une marque fictive. L'espace contient 27 ressources : cinq discussions, trois projets, six créations vectorielles originales, deux pages de vente privées, trois plans de campagne, trois missions préparées, deux fiches de marque et trois fichiers texte. Les échanges enregistrés, aperçus, recherches et rubriques des paramètres utilisent les composants et routes Aïra existants. Les résultats publicitaires et le catalogue de connecteurs sont simulés par le serveur de démonstration ; ils ne correspondent à aucun compte connecté. Le bandeau permanent signale que tous les contenus, comptes et chiffres sont fictifs.

Le forfait Business, ses trois membres et son portefeuille sont des exemples locaux. Le solde de 438,5 crédits sur 600 est calculé depuis les écritures fictives de la base. Aucun paiement, facture, compte fournisseur ou proposition de génération n'est créé.

La base est séparée dans `.local-data/maison-naya-demo/` et le bundle dans `.local-build/maison-naya-demo/`. Le seed refuse une base déjà peuplée qui n'appartient pas à cette démonstration ; une relance conserve les contenus sans les dupliquer. Les fichiers sont écrits uniquement dans le stockage de cet espace. Le serveur écoute sur la boucle locale, conserve la session de développement côté serveur, ignore `.dev.vars`, retire la configuration des fournisseurs et bloque les connexions réseau sortantes de son adaptateur. Il ne fournit aucun point d'entrée au Worker hébergé.

La démo est prévue pour la consultation : générations, paiements, publications, modifications et connexions externes sont refusés. La seule requête POST autorisée produit un lien temporaire pour consulter ou télécharger l'un des trois fichiers fictifs. Ce mode ne doit pas servir de mécanisme d'authentification ou de données initiales pour un déploiement public.

Arrêter avec Ctrl+C. Les données locales restent disponibles pour la prochaine ouverture. Le test `node --test tests/demo-preview.test.mjs` contrôle notamment l'isolation, les liens, l'idempotence et la cohérence du portefeuille.
