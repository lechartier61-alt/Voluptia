# Voluptia V141 — filtres Trio et Groupe dans la recherche

## Objectif
Ajout des profils **Trio** et **Groupe** dans le bloc **Profils recherchés** de `Découvrir > Recherche`.

## Nouveaux filtres ajoutés
En plus des filtres Homme, Femme, Trans et Couple déjà présents, le panneau de recherche propose maintenant :

### Trio
- Trio
- Trio mixte
- Trio avec femme bi
- Trio avec homme bi
- Trio bi

### Groupe
- Groupe
- Groupe mixte
- Groupe avec femme bi
- Groupe avec homme bi
- Groupe bi

## Fonctionnement
L'utilisateur peut cocher un ou plusieurs profils recherchés en même temps.

Exemples :

- Femme bi + Trio mixte
- Couple avec femme bi + Groupe bi
- Homme bi + Trio avec homme bi
- Trio + Groupe

Le filtre tient compte :

- de la catégorie du profil : Homme, Femme, Couple, Trans, Trio, Groupe ;
- du nombre minimum de membres pour les couples, trios et groupes ;
- du genre des membres quand il est renseigné ;
- de l'orientation des membres quand elle est renseignée.

## Fichiers modifiés

- `frontend/src/App.jsx`

## Vérifications

- `npm run build` : OK
- `npm run check:backend-syntax` : OK
