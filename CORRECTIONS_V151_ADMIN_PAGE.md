# Corrections V151 — Page admin

## Problème corrigé
La page Administration pouvait planter au chargement à cause d’un état `socialPrefs` ajouté par erreur dans le composant `AdminPage`.

Cet état utilisait la variable `me`, qui n’existe pas dans `AdminPage`. Résultat possible côté navigateur :

```text
ReferenceError: me is not defined
```

## Correction
- suppression du bloc `socialPrefs` inutile dans `AdminPage` ;
- conservation des préférences sociales dans le bon composant utilisateur ;
- aucune suppression des fonctions admin existantes ;
- aucune suppression de la Carte des membres / Profils regroupés par ville.

## Vérifications
- `npm run check:backend-syntax`
- `npm run build`
