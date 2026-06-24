# Voluptia V149 — interactions sociales avancées

## Audit rapide des points d’intégration

Le projet contenait déjà les routes et zones suivantes :
- `POST /api/media/:mediaId/like` : ancien like média, conservé en compatibilité.
- `POST /api/media/:mediaId/comments` : commentaires médias.
- `POST /api/media/:mediaId/comments/:commentId/like` : likes de commentaires.
- `POST /api/profiles/:id/heart` : coups de cœur profil et matchs réciproques.
- `POST /api/profiles/:id/follow` : suivis.
- `POST /api/profiles/:id/pass` : profils ignorés.
- `/api/conversations` et `/api/instant-chats` : messagerie privée et chat instantané.
- `/api/notifications` : notifications.
- `/api/albums` et `/api/album-access` : albums publics/privés et demandes d’accès.
- `/api/reports` : signalements.
- `SocialEngagementPanel`, `ToktakCard`, `MediaTile`, `AlbumCard`, `MessagesHub`, `PrivacyPage` côté React.

## Ce qui a été ajouté

### Réactions médias avancées
Nouvelle route :
- `POST /api/media/:mediaId/reaction`

Réactions disponibles :
- `heart`
- `fire`
- `wow`
- `clap`
- `eyes`

Règles :
- une seule réaction active par média et par utilisateur ;
- même réaction = retrait ;
- autre réaction = remplacement ;
- compatibilité avec l’ancien `likedBy` ;
- `/api/media/:mediaId/like` reste disponible et correspond à `heart`.

`serializeMedia` retourne maintenant :
- `reactionCounts`
- `myReaction`
- `likeCount`
- `liked`
- `likePreview`

### Commentaires améliorés
Ajout :
- réponses aux commentaires ;
- mentions `@pseudo` ;
- signalement de commentaire ;
- suppression par auteur ou propriétaire du média ;
- épinglage par propriétaire ;
- tri récent/populaire côté interface ;
- affichage des 3 premiers commentaires puis “Voir tout”.

Nouvelles routes :
- `POST /api/media/:mediaId/comments/:commentId/reply`
- `POST /api/media/:mediaId/comments/:commentId/report`
- `POST /api/media/:mediaId/comments/:commentId/pin`

### Page Interactions
Ajout d’un onglet **Interactions** dans Messages.

Elle regroupe :
- likes reçus ;
- réactions médias ;
- commentaires ;
- visites profil ;
- coups de cœur ;
- matchs ;
- suivis ;
- albums privés ;
- demandes en attente.

Route enrichie :
- `GET /api/social`

### Nouvelles interactions profil
Ajout :
- favoris privés ;
- clin d’œil ;
- brise-glace ;
- proposition “discussion ce soir”.

Nouvelles routes :
- `POST /api/profiles/:id/favorite`
- `GET /api/favorites`
- `POST /api/profiles/:id/wink`
- `POST /api/profiles/:id/icebreaker`
- `POST /api/profiles/:id/discuss-tonight`

### Confidentialité sociale
Ajout dans **Mon espace > Confidentialité** :
- qui peut m’envoyer un message ;
- qui peut liker mes médias ;
- qui peut commenter mes médias ;
- afficher mes vues de profil ;
- autoriser les clins d’œil ;
- autoriser les demandes d’albums privés.

Route mise à jour :
- `PUT /api/profile/social-preferences`

### Notifications
Les notifications ont maintenant des métadonnées plus précises :
- `targetType`
- `targetId`
- `actionUrl`
- `mediaId`
- `commentId`
- `reaction`

Types ajoutés :
- `media_reaction`
- `comment_reply`
- `mention`
- `wink`
- `icebreaker`
- `availability`

### Anti-abus
Ajout :
- rate limit social ;
- anti-duplication de commentaire récent ;
- limite de clin d’œil : 1 par profil toutes les 24h ;
- masquage automatique d’un commentaire après plusieurs signalements ;
- respect du blocage sur réactions, commentaires, messages, accès album et notifications.

## Vérifications effectuées

- `npm run check:backend-syntax` : OK
- `npm run build` : OK
- lancement backend rapide avec `node backend/src/server.js` : OK, serveur démarré.

