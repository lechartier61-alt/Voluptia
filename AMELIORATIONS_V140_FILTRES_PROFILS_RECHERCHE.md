# Voluptia V140 — filtres profils recherchés

## Objectif
Ajout d'un filtre plus précis dans `Découvrir > Recherche` pour pouvoir cocher un ou plusieurs types de profils recherchés.

## Ajout principal
Dans le panneau de recherche, ajout du bloc **Profils recherchés** avec des cases à cocher multiples :

- Femme hétéro
- Femme bi
- Femme lesbienne
- Homme hétéro
- Homme bi
- Homme gay
- Trans bi
- Couple H/F hétéro
- Couple avec femme bi
- Couple avec homme bi
- Couple bi
- Couple F/F
- Couple H/H

L'utilisateur peut cocher une seule case ou plusieurs en même temps.

Exemples :

- Femme bi uniquement
- Femme bi + Couple avec femme bi
- Couple avec homme bi + Couple bi
- Homme gay + Homme bi

## Fonctionnement
Les profils sont filtrés selon :

- la catégorie du profil : Homme, Femme, Couple, Trans ;
- les membres du profil quand il s'agit d'un couple ;
- le genre de chaque membre ;
- l'orientation sexuelle renseignée.

Quand au moins une case est cochée, ce nouveau filtre prend le dessus sur le simple filtre **Type de profil**, afin d'éviter les conflits entre une sélection multiple et un menu déroulant unique.

## Fichiers modifiés

- `frontend/src/App.jsx`
- `frontend/src/styles.css`

## Vérifications

- `npm run build` : OK
- `npm run check:backend-syntax` : OK
