# Voluptia V134 — Inscription + nettoyage accueil

## Demandes traitées

### 1. Inscription : ajout de la silhouette
Dans le bloc **Détails de la personne** de l'inscription, ajout du champ :

- **Silhouette**

Le champ utilise les valeurs déjà prévues par l'application :

- Non renseigné
- Mince
- Sportif
- Normal
- Pulpeux
- Rond
- Athlétique

La silhouette est maintenant conservée dans les informations de chaque personne du profil.

### 2. Mon espace : silhouette modifiable après inscription
Dans **Mon espace > Mon profil > Identité**, la zone des détails modifiables contient maintenant :

- Âge affiché
- Genre
- Origine
- Silhouette

Le texte d'aide a été mis à jour :

> Âge, genre, origine et silhouette restent modifiables ici à tout moment.

### 3. Page d'accueil publique : suppressions demandées
D'après les captures envoyées, les blocs suivants ont été supprimés de la page d'accueil publique :

- **Comment ça marche ?**
- **Conformité France · RGPD**
- **Prêt·e à rejoindre la communauté ?**

La page d'accueil est maintenant plus courte et plus directe.

## Fichier modifié

- `frontend/src/App.jsx`

## Vérifications

Commandes exécutées :

```bash
npm run build
npm run check:backend-syntax
```

Résultat : OK.
