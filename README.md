# CPREY DRAW

Socle de dessin local pour préparer les futures fonctions de plan électrique CPREYCONNECT.

Cette première version se limite volontairement au moteur de dessin :

- import d'un plan PNG ou JPG/JPEG ;
- affichage dans un canvas Konva ;
- zoom sous le pointeur ;
- déplacement du viewport ;
- ajustement du plan à l'écran ;
- définition d'une échelle réelle ;
- mesure de distances réelles ;
- sauvegarde temporaire dans `localStorage`.

Les pieuvres, tableaux électriques, appareillages, gaines, exports, authentification, backend et base de données ne sont pas encore implémentés.

## Installation

```bash
npm install
```

## Lancement en développement

```bash
npm run dev
```

## Build de production

```bash
npm run build
```

Le dossier généré par Vite est `dist/`. Il pourra être servi plus tard derrière Apache sur le serveur Linux, sans dépendre d'un backend pour cette première étape.
