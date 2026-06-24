# Corrections V174 — bugs mobile signalés par captures

Date : 18/06/2026
Base : V173 Railway PostgreSQL

## Captures analysées

1. **Découvrir / Recherche sur téléphone**
   - Sous-navigation du hub partiellement hors écran.
   - Barre de recherche affichée en thème clair au milieu du thème sombre.
   - Onglets de résultats qui chevauchaient le titre `Profils compatibles`.
   - Boutons `Découverte / Qui m’a liké / Matchs / Visiteurs / Cartes / Liste` trop larges pour un écran mobile.

2. **Mon espace / formulaire profil sur téléphone**
   - Barre `Sauvegarder les changements` en position fixe au-dessus du formulaire.
   - Champs du profil masqués pendant le défilement.
   - Risque de saisie difficile sur petits écrans.

## Modifications appliquées

### Découvrir / Recherche

- La sous-navigation des hubs passe en grille responsive 2 colonnes sur téléphone.
- Les sous-onglets ne débordent plus à droite de l’écran.
- Les barres `Pseudo`, `Profils / Vidéos` et les boutons d’affichage reprennent le thème sombre.
- Les éléments collants internes de la recherche sont remis dans le flux sur mobile pour éviter les superpositions.
- La ligne de titre des résultats devient verticale sur téléphone : titre d’abord, filtres/onglets ensuite.
- Les boutons `Découverte`, `Qui m’a liké`, `Matchs`, `Visiteurs`, `Cartes`, `Liste` passent en grille compacte, sans chevauchement.
- Le panneau de filtres flottant devient un tiroir mobile en bas d’écran.
- La carte membres est limitée en hauteur mobile pour éviter les écrans trop longs et les débordements.

### Mon espace

- La barre de sauvegarde du profil n’est plus `fixed` sur téléphone.
- Elle reste dans le flux du formulaire et ne recouvre plus les champs.
- Le formulaire reçoit un espace bas sécurisé pour la navigation mobile.
- Les champs, cartes et grilles internes sont contraints à `max-width: 100%`.

## Fichiers modifiés

- `frontend/src/main.jsx`
- `frontend/src/responsive-fixes-v174.css`
- `frontend/dist/assets/index-Dt7uHb2k.css`

## Vérifications

- Compilation frontend vérifiée avec `npm run build`.
- Syntaxe backend vérifiée avec :
  - `node --check backend/src/app.js`
  - `node --check backend/src/server.js`
- Compilation frontend Vite effectuée avec succès après ajout du CSS V174. Le warning de taille du bundle principal (>500 kB) reste identique aux versions précédentes et n’empêche pas la compilation.

## Notes

Railway PostgreSQL reste configuré comme dans la V173 :

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
REQUIRE_DATABASE_URL=true
```

Le dépôt GitHub configuré reste :

```text
https://github.com/lechartier61-alt/Voluptia.git
```
