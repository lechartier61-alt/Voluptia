# Voluptia V126 — Finition graphique et correction des petits bugs visuels

## Objectif

Cette version corrige et polit les petits défauts visuels signalés : éléments coupés, bulle de discussion qui peut mal s'afficher, icônes qui paraissent irrégulières, fenêtre de profils sur la carte et détails responsive.

## Modifications principales

### 1. Bulle de discussion instantanée

- Remplacement de l'emoji de discussion par une icône SVG homogène.
- Le panneau du chat s'ouvre maintenant de manière stable sur PC, sans être coupé par le bord de l'écran.
- Meilleur z-index pour éviter que la bulle passe sous d'autres éléments.
- Meilleure taille du panneau, meilleure hauteur maximale et scroll plus propre.
- Conservation du comportement mobile avec panneau centré.

Fichiers modifiés :

- `frontend/src/App.jsx`
- `frontend/src/styles.css`

### 2. Icônes et logos

- Remplacement des glyphes un peu “chelou” dans le panneau profil par des icônes SVG.
- Icônes des actions profil uniformisées : suivre, message, cœur.
- Icônes des onglets du profil uniformisées : publications, profil, photos, agenda.
- Correction du logo pour éviter qu'il soit rogné dans certains cadres.

### 3. Carte Découvrir

- Points/bulles des profils sur la carte encore plus petits et plus propres.
- Taille Leaflet ajustée pour mieux centrer les points.
- Fenêtre flottante de profils agrandie sur PC.
- Fenêtre flottante harmonisée avec le thème sombre du site.
- Cartes de profils de la fenêtre flottante plus propres, avec moins de débordements.
- Scroll de la grille amélioré.

### 4. Éléments coupés / débordements

- Ajout de règles globales `box-sizing: border-box`.
- Meilleure gestion des textes longs dans :
  - menu gauche ;
  - barre haute ;
  - cloche de notifications ;
  - boutons ;
  - cartes de profils ;
  - panneau profil ;
  - fenêtre flottante de la carte.
- Ajout d'ellipses propres au lieu de textes coupés brutalement.

### 5. Panneau profil

- Onglets plus nets avec icônes SVG.
- Actions principales plus propres.
- Prévention des textes coupés sur petits écrans.
- Meilleure cohérence visuelle avec le reste de l'interface.

## Vérifications effectuées

```bash
npm ci --workspaces --include-workspace-root
npm run build
npm run check:backend-syntax
```

Résultat : OK.

## Fichiers modifiés

- `frontend/src/App.jsx`
- `frontend/src/styles.css`
- `AMELIORATIONS_V126_FINITION_GRAPHIQUE.md`
