# Corrections V175 — Suppression du bloc Découvrir

## Demande
Supprimer le grand bloc de présentation de la page Découvrir visible sur mobile, car il prenait trop d’espace utile.

## Modification appliquée
- Suppression du composant `HubHeader` uniquement dans le hub Découvrir.
- Conservation de la barre supérieure avec le titre de page `Découvrir`.
- Conservation des onglets Carte / Recherche / Lieux / Événements.
- Conservation des corrections V174, de la configuration Railway PostgreSQL et de l’adresse GitHub `https://github.com/lechartier61-alt/Voluptia.git`.

## Fichier modifié
- `frontend/src/App.jsx`

## Résultat attendu
Sur téléphone, tablette et ordinateur, la page Découvrir démarre directement sur les onglets et le contenu. Le grand encadré `Découvrir — Profils proches, filtres détaillés et lieux libertins` n’apparaît plus.
