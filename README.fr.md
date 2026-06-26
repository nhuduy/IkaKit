# IkaKit

IkaKit est une extension de navigateur creee par la communaute pour Ikariam. Elle ajoute la gestion d'empire, les alertes et des outils de confort directement dans l'interface du jeu, afin de comprendre plus vite l'etat des villes et de reduire les clics repetitifs.

Ceci est un resume communautaire en francais. La documentation complete se trouve dans le [English README](README.md). La documentation vietnamienne complete se trouve dans [README.vi.md](README.vi.md).

## Installation

Prerequis :

- Node.js
- npm

Installer depuis le code source :

```bash
git clone <repo-url>
cd IkaKit
npm install
npm run build
```

Apres la compilation, les fichiers sont generes dans :

```text
dist/chrome/
dist/firefox/
```

Chrome / Chromium :

1. Ouvrir `chrome://extensions`.
2. Activer `Developer mode`.
3. Cliquer sur `Load unpacked`.
4. Selectionner `dist/chrome`.

Firefox :

1. Ouvrir `about:debugging#/runtime/this-firefox`.
2. Cliquer sur `Load Temporary Add-on`.
3. Selectionner `dist/firefox/manifest.json`.

## Features

- Fenetre Empire Manager injectee dans l'interface Ikariam.
- Vue par ville pour les ressources, le logement, la recherche et la corruption.
- Vue des batiments avec niveaux, etat d'amelioration, couts du niveau suivant et differences de ressources.
- Vues pour la recherche, les unites terrestres, les navires et l'espionnage.
- Scan des donnees de ville et cache local pour afficher les vues plus vite.
- Actions rapides pour le transport de ressources, le deploiement d'armee et le deploiement de flotte.
- Surveillance des ameliorations sur la carte de ville avec cercles de niveau, infobulles de cout et amelioration en un clic quand les ressources suffisent.
- Alertes militaires, notifications de nouvelles de ville, panneau d'avertissement en jeu, notifications bureau et badge d'extension.
- Onglet Events dans Alerts avec filtres, copie, actualisation et suppression des evenements detectes.

Cette version n'inclut pas Automation Center, Route Schedule, les flux d'envoi automatique de ressources, les lanceurs flottants d'evenements de jeu ni Auto Builder.

## FAQ

### IkaKit est-il un outil officiel Ikariam ?

Non. IkaKit est un projet communautaire inspire par des idees d'IkaEasy v3, mais reimplemente comme WebExtension.

### Quels navigateurs sont pris en charge ?

IkaKit prend en charge Chrome/Chromium et Firefox. Il a ete teste sur plusieurs navigateurs bases sur Chromium ainsi que sur Mozilla Firefox.

### Puis-je modifier ou redistribuer le code ?

Le code est publie sous licence GPL-3.0. Toute modification, compilation, distribution ou utilisation se fait sous votre propre responsabilite. Verifiez toujours les regles actuelles du jeu et les politiques de l'editeur.

### Pourquoi les notifications bureau n'apparaissent-elles pas ?

Verifiez que le navigateur et le systeme d'exploitation autorisent les notifications pour l'extension.

### Ou lire la documentation complete ?

La documentation complete se trouve dans le [English README](README.md).
