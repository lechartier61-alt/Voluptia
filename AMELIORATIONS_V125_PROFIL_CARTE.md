# Voluptia V125 — profil sans Lieux + carte améliorée

## Modifications réalisées

### 1. Fiche profil utilisateur
- Suppression de l’onglet **Lieux** quand on clique sur un profil.
- Suppression du contenu associé à la localisation approximative dans la fiche profil flottante.
- La fiche profil affiche maintenant seulement :
  - Publications
  - Profil
  - Photos
  - Agenda

### 2. Carte dans Découvrir
- Les points/bulles de profils sur la carte sont plus petits.
- La taille Leaflet des marqueurs passe de `72px` à `56px` sur desktop.
- Les marqueurs mobiles passent à `50px`.
- Les ombres et bordures ont été réduites pour que la carte soit plus lisible.

### 3. Fenêtre flottante de la carte sur PC
- La fenêtre flottante affichée après clic sur une ville est plus grande sur version PC.
- Largeur augmentée jusqu’à environ `760px`.
- La grille de profils affiche maintenant 4 colonnes sur desktop.
- Les photos dans cette fenêtre sont légèrement plus grandes.

## Fichiers modifiés

- `frontend/src/App.jsx`
- `frontend/src/styles.css`

## Vérifications

Commandes exécutées :

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run build
npm run check:backend-syntax
```

Résultat : OK.
