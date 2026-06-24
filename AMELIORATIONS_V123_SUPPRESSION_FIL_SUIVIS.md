# Voluptia V123 — Suppression des onglets Fil et Suivis dans Découvrir

## Demande
Supprimer les pages **Fil** et **Suivis** dans l’onglet **Découvrir**.

## Modifications réalisées

### 1. Hub Découvrir simplifié
L’onglet **Découvrir** affiche maintenant uniquement :

- **Carte**
- **Tinder**
- **Recherche**
- **Lieux**

Les boutons **Fil** et **Suivis** ont été retirés de la sous-navigation.

### 2. Contenu des pages retiré du rendu Découvrir
Les composants suivants ne sont plus appelés depuis `DiscoverHub` :

- `FeedPage`
- `FollowsPage`

Ils restent dans le code pour éviter une suppression brutale de logique existante, mais ils ne sont plus accessibles depuis l’onglet Découvrir.

### 3. Routes anciennes sécurisées
Les anciennes URLs :

- `/fil-actualite`
- `/suivis`

ne déclenchent plus les sous-pages supprimées. Elles retombent maintenant sur **Découvrir**, avec l’onglet par défaut **Carte**.

### 4. Texte d’en-tête mis à jour
Ancien texte :

> Carte, Tinder, recherche, fil, suivis et lieux

Nouveau texte :

> Carte, Tinder, recherche et lieux

## Fichier modifié

- `frontend/src/App.jsx`

## Vérifications techniques

Commandes exécutées :

```bash
npm run build
npm run check:backend-syntax
```

Résultat : OK.
