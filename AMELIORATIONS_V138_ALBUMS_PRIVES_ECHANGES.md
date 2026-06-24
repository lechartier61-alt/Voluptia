# Voluptia V138 — Albums privés, demandes et échanges temporaires

## Objectif
Ajouter tout ce qui manquait autour des albums publics/privés : visibilité sur les profils, demande d’accès, ouverture temporaire, échange réciproque et gestion depuis l’espace utilisateur.

## Ajouts côté utilisateur

### Fiche profil
- Les albums publics restent visibles directement.
- Les albums privés apparaissent verrouillés avec un cadenas.
- Le statut d’accès est plus clair : verrouillé, demande envoyée, refusé, ouvert, expiré.
- Le visiteur peut demander l’accès à un album privé.
- Le propriétaire peut ouvrir son propre album privé à ce profil pour une durée choisie.
- Nouveau bouton **Échanger albums** pour proposer un échange réciproque d’albums privés.

### Durées d’ouverture
- 1h
- 2h
- 5h
- 24h
- 1 semaine
- 30 jours
- Infini

### Échange privé réciproque
- Un membre peut proposer un échange d’albums privés.
- Son album privé est ouvert à l’autre personne pendant la durée choisie.
- L’autre personne reçoit une demande d’échange.
- Si elle accepte, les deux albums privés sont ouverts l’un à l’autre pendant la durée choisie.
- L’accès reste retirable à tout moment.

## Ajouts dans Mon espace > Sécurité

Nouvelle gestion des albums privés :

- demandes reçues ;
- demandes d’échange reçues ;
- accepter 24h, 7 jours, 30 jours ou sans limite ;
- refuser une demande ;
- voir les accès que l’on a déjà ouverts ;
- retirer un accès ouvert ;
- voir les demandes envoyées et leur statut.

## Backend

Nouveaux comportements :

- ajout de la durée 30 jours ;
- nouvelle route `POST /api/profiles/:id/album-access/exchange` ;
- réponse aux demandes compatible avec les échanges réciproques ;
- notification quand un échange est proposé ;
- notification quand un échange est accepté ;
- conservation des statuts `exchangeRequested`, `exchange`, `exchangeAcceptedAt`.

## Fichiers modifiés

- `frontend/src/App.jsx`
- `frontend/src/styles.css`
- `backend/src/app.js`

## Vérifications

- `npm run build` : OK
- `npm run check:backend-syntax` : OK
