# Braand Relais — Kit officiel 1.0.0

Édition du 30 octobre 2026. Commencez par **braand-charte-design-system-v1.pdf**, le guide illustré de 24 pages. La version HTML se consulte hors ligne, avec la police intégrée et un sommaire. Le Markdown conserve le contenu éditorial modifiable.

## Contenu

- **Logos/SVG** : signe, logo complet, versions sombre, claire, noire et blanche ; icône d’application. Les tracés sont vectoriels, sans police externe.
- **Logos/PNG** : logos transparents haute définition, symboles de 16 à 1 024 px et icônes d’application 180, 192, 512 et 1 024 px. Les versions blanches sont prévues pour un fond sombre.
- **Logos/favicon.svg et favicon.ico** : fichiers pour le navigateur.
- **Polices** : Manrope variable (graisses 200 à 800) et sa licence SIL OFL 1.1. Placez la police à `/fonts/Manrope.ttf` pour utiliser les CSS sans adaptation.
- **Tokens** : les quatre feuilles CSS de référence de l’application. Le JSON à la racine contient les thèmes calculés, les couleurs de marque, les contrastes et l’inventaire des sources.
- **Composants** : les composants de marque, les primitives React existantes avec leurs CSS et les utilitaires nécessaires. `dependencies.json` indique les versions déclarées par le projet.
- **Sources** : géométrie officielle, contenu du guide et scripts de génération.
- **manifest.sha256.json** : taille et empreinte SHA-256 de chaque fichier, à l’exception du manifeste lui-même.

## Utiliser le logo

Utilisez `relais-logo.svg` sur fond clair, `relais-logo-dark.svg` sur fond sombre, ou les variantes monochromes. Conservez le rapport largeur/hauteur et les deux parties du signe. Le guide définit les tailles minimales et la zone de protection. Ne recomposez pas le mot-symbole avec une police : il est fourni sous forme de tracés.

Dans le projet React/TypeScript, conservez les dossiers `components`, `lib` et l’alias `@/` vers la racine :

```tsx
import {BrandLogo, BrandMark} from '@/components/brand';

<BrandLogo height={28} />
<span style={{color: 'var(--ds-accent)'}}><BrandMark size={28} /></span>
```

`BrandLogo` porte le nom accessible « Braand ». `BrandMark` est décoratif : un bouton qui ne contient que le signe doit avoir son propre libellé accessible. La mascotte animée du chat est distincte du logo et n’est pas incluse dans ce kit.

## Réutiliser le design system

Les feuilles et composants sont les sources réelles du SaaS ; ce dossier n’est pas un paquet npm autonome. Les primitives emploient React, des dépendances d’interface et des classes utilitaires : réutilisez le pipeline du dépôt Braand ou configurez Tailwind dans votre application. Les dépendances ne sont pas embarquées et gardent leurs licences respectives. Aucun moteur serveur, secret, identifiant client ou contenu privé n’est exporté.

Chargez `globals.css`, `design-tokens.css`, `design-system.css`, puis `appearance.css`. Les styles historiques ciblent `html[data-design-system="muse"]` : conservez cette valeur technique dans une intégration existante. La marque affichée reste Braand. Les CSS contiennent les styles des écrans du SaaS ; importez les feuilles complètes dans Braand, ou extrayez les règles dont un nouveau produit a besoin.

Les thèmes sombre et clair utilisent les tokens calculés dans le JSON. Les préférences d’apparence doivent être gérées par l’application hôte. Les ratios du guide portent sur les paires de couleurs mesurées ; ils ne constituent pas une certification globale d’accessibilité.

## Maintenir les fichiers

La source du signe et du logo est `Sources/brand/relais.geometry.json`. Dans le dépôt complet, exécutez dans cet ordre :

```sh
node scripts/build-brand-assets.mjs
node scripts/build-brand-kit.mjs
node scripts/package-brand-kit.mjs
```

Le générateur de guide utilise Playwright/Chromium et le conditionnement utilise fflate, déjà disponibles dans l’environnement de développement. Aucun de ces scripts n’appelle un modèle IA ou un fournisseur payant. Les exports PNG et PDF sont générés par Chromium ; le favicon ICO est livré prêt à l’emploi.

Le guide documente l’interface présente lors de cette édition. Les illustrations sont des exemples locaux ; un statut d’exemple ne prouve pas l’exécution d’une action réelle. La proposition de réorganisation de la sidebar n’est pas incluse dans cette livraison de marque.

Les sources tierces conservent leurs licences. La licence Manrope est fournie dans `Polices/OFL.txt` ; la licence de la feuille de référence shadcn est dans `Licences`. L’inventaire des dépendances permet de retrouver leurs distributions et leurs notices.
