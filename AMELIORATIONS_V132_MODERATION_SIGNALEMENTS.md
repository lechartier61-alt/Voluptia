# Voluptia V132 — Modération, signalements et avertissements écrits

## Objectif

Cette version ajoute un vrai circuit de modération côté administration : recevoir les signalements, les prioriser, les traiter, et envoyer des avertissements écrits aux membres.

## Ajouts côté utilisateur

- Le bouton **Signaler** dans une fiche profil envoie maintenant un vrai signalement au backend.
- Le bouton **Signaler** dans une conversation envoie aussi un signalement relié à la source `conversation`.
- Le membre choisit une catégorie :
  - comportement inapproprié ;
  - harcèlement ou pression ;
  - faux profil / usurpation ;
  - contenu inapproprié ;
  - mineur suspecté ;
  - spam / arnaque ;
  - autre.
- Le membre doit écrire un détail du problème avant l’envoi.
- Les doublons sont évités : un même membre ne peut pas ouvrir plusieurs signalements actifs contre le même profil.

## Ajouts côté administration

Dans **Admin > Modération** :

- nouvelle boîte de réception des signalements ;
- filtres : **Ouverts**, **Urgents**, **Nouveaux**, **En cours**, **Clôturés**, **Tous** ;
- affichage de la priorité : normale, haute, urgente ;
- affichage du profil signalé, du membre qui signale et du statut ;
- bouton **Prendre en charge** ;
- bouton **Clôturer simple** ;
- bouton **Avertissement écrit** ;
- bouton **Masquer profil** ;
- bouton **Suspendre** ;
- bouton **Ignorer**.

## Avertissements écrits

L’administration peut maintenant envoyer un avertissement écrit :

- depuis un signalement ;
- directement depuis la fiche d’un membre dans l’administration ;
- depuis un formulaire dédié dans **Admin > Modération**.

Niveaux disponibles :

- rappel ;
- avertissement ;
- dernier avertissement.

Options disponibles :

- envoyer une notification officielle au membre ;
- masquer aussi son profil ;
- fermer ses sessions actives.

## Backend ajouté

Nouvelles données persistées :

- `moderationWarnings` ;
- `moderationActions`.

Nouvelles routes :

- `POST /api/reports` améliorée avec catégorie, priorité, source et anti-doublon ;
- `POST /api/admin/reports/:reportId/status` pour prendre en charge un signalement ;
- `POST /api/admin/reports/:reportId/resolve` enrichie avec actions de modération ;
- `POST /api/admin/users/:userId/warn` pour envoyer un avertissement écrit direct.

## Fichiers modifiés

- `frontend/src/App.jsx`
- `frontend/src/pro-polish-v118.css`
- `backend/src/app.js`

## Vérifications

Commandes exécutées :

```bash
npm run build
npm run check:backend-syntax
```

Résultat : OK.
